CREATE TABLE public.workflow_send_policies (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  whatsapp_daily_limit integer CHECK (whatsapp_daily_limit IS NULL OR whatsapp_daily_limit >= 0),
  email_daily_limit integer CHECK (email_daily_limit IS NULL OR email_daily_limit >= 0),
  dedupe_hours integer NOT NULL DEFAULT 0 CHECK (dedupe_hours BETWEEN 0 AND 720),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  window_start smallint CHECK (window_start BETWEEN 0 AND 23),
  window_end smallint CHECK (window_end BETWEEN 1 AND 24),
  weekdays smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  email_provider text NOT NULL DEFAULT 'gmail_owner' CHECK (email_provider IN ('gmail_owner','gmail_account','outlook')),
  email_account_id uuid,
  default_booking_page_id uuid,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.workflow_send_policies TO authenticated;
GRANT ALL ON public.workflow_send_policies TO service_role;
ALTER TABLE public.workflow_send_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY wsp_select ON public.workflow_send_policies FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY wsp_insert ON public.workflow_send_policies FOR INSERT TO authenticated
  WITH CHECK (public.is_active_workspace_admin(workspace_id, auth.uid()) AND NOT public.is_read_only_view());
CREATE POLICY wsp_update ON public.workflow_send_policies FOR UPDATE TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()) AND NOT public.is_read_only_view())
  WITH CHECK (public.is_active_workspace_admin(workspace_id, auth.uid()) AND NOT public.is_read_only_view());

CREATE TABLE public.workflow_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  workflow_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  step_path text,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email')),
  recipient text,
  status text NOT NULL CHECK (status IN ('in_flight','sent','retry_scheduled','failed','uncertain','deduped')),
  attempts integer NOT NULL DEFAULT 1,
  lease_until timestamptz,
  next_attempt_at timestamptz,
  provider text,
  provider_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflow_deliveries_quota_idx ON public.workflow_deliveries (workspace_id, channel, created_at);
CREATE INDEX workflow_deliveries_recipient_idx ON public.workflow_deliveries (workspace_id, channel, recipient, created_at);
GRANT SELECT ON public.workflow_deliveries TO authenticated;
GRANT ALL ON public.workflow_deliveries TO service_role;
ALTER TABLE public.workflow_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY wd_select ON public.workflow_deliveries FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

-- Reserva atômica (CAS) de um envio por nó: idempotência, lease, cota comercial e deduplicação.
CREATE OR REPLACE FUNCTION public.workflow_delivery_claim(
  p_workspace uuid, p_workflow uuid, p_key text, p_channel text, p_step_path text,
  p_recipient text, p_lease_seconds integer DEFAULT 120, p_max_attempts integer DEFAULT 4)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.workflow_deliveries%ROWTYPE;
  pol public.workflow_send_policies%ROWTYPE;
  lim integer; used integer;
BEGIN
  SELECT * INTO r FROM public.workflow_deliveries WHERE idempotency_key = p_key FOR UPDATE;
  IF FOUND THEN
    IF r.workspace_id <> p_workspace THEN RETURN jsonb_build_object('result','forbidden'); END IF;
    IF r.status IN ('sent','deduped') THEN RETURN jsonb_build_object('result','already_sent','provider_id',r.provider_id,'attempts',r.attempts); END IF;
    IF r.status = 'uncertain' THEN RETURN jsonb_build_object('result','uncertain','attempts',r.attempts); END IF;
    IF r.status = 'in_flight' THEN
      IF r.lease_until > now() THEN RETURN jsonb_build_object('result','in_flight','attempts',r.attempts); END IF;
      UPDATE public.workflow_deliveries SET status='uncertain', last_error='Lease expirou durante o envio', updated_at=now() WHERE id=r.id;
      RETURN jsonb_build_object('result','uncertain','attempts',r.attempts);
    END IF;
    IF r.status = 'failed' OR r.attempts >= p_max_attempts THEN
      RETURN jsonb_build_object('result','exhausted','attempts',r.attempts,'error',r.last_error);
    END IF;
    UPDATE public.workflow_deliveries SET status='in_flight', attempts=attempts+1,
      lease_until=now()+make_interval(secs=>p_lease_seconds), next_attempt_at=NULL, updated_at=now()
      WHERE id=r.id;
    RETURN jsonb_build_object('result','claimed','attempts',r.attempts+1);
  END IF;

  -- Primeiro envio: cota comercial e deduplicação, serializadas por workspace.
  PERFORM pg_advisory_xact_lock(hashtext('wfq:'||p_workspace::text||':'||p_channel));
  SELECT * INTO pol FROM public.workflow_send_policies WHERE workspace_id = p_workspace;
  IF FOUND THEN
    IF pol.dedupe_hours > 0 AND p_recipient IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workflow_deliveries d WHERE d.workspace_id=p_workspace AND d.channel=p_channel
        AND d.recipient=p_recipient AND d.status IN ('sent','in_flight','uncertain')
        AND d.created_at > now()-make_interval(hours=>pol.dedupe_hours)) THEN
      INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts)
        VALUES (p_workspace,p_workflow,p_key,p_step_path,p_channel,p_recipient,'deduped',0);
      RETURN jsonb_build_object('result','deduped');
    END IF;
    lim := CASE p_channel WHEN 'whatsapp' THEN pol.whatsapp_daily_limit ELSE pol.email_daily_limit END;
    IF lim IS NOT NULL THEN
      SELECT count(*) INTO used FROM public.workflow_deliveries d WHERE d.workspace_id=p_workspace
        AND d.channel=p_channel AND d.status IN ('sent','in_flight','uncertain','retry_scheduled')
        AND d.created_at > now()-interval '24 hours';
      IF used >= lim THEN RETURN jsonb_build_object('result','quota','used',used,'limit',lim); END IF;
    END IF;
  END IF;
  INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,lease_until)
    VALUES (p_workspace,p_workflow,p_key,p_step_path,p_channel,p_recipient,'in_flight',1,now()+make_interval(secs=>p_lease_seconds))
    ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','in_flight','attempts',1); END IF;
  RETURN jsonb_build_object('result','claimed','attempts',1);
END $$;

CREATE OR REPLACE FUNCTION public.workflow_delivery_finish(
  p_key text, p_status text, p_provider text, p_provider_id text, p_error text, p_next_attempt timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('sent','retry_scheduled','failed','uncertain') THEN RAISE EXCEPTION 'status inválido'; END IF;
  UPDATE public.workflow_deliveries SET status=p_status, provider=COALESCE(p_provider,provider),
    provider_id=COALESCE(p_provider_id,provider_id), last_error=p_error, next_attempt_at=p_next_attempt,
    lease_until=NULL, updated_at=now()
  WHERE idempotency_key=p_key AND status IN ('in_flight','uncertain');
END $$;

REVOKE ALL ON FUNCTION public.workflow_delivery_claim(uuid,uuid,text,text,text,text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workflow_delivery_finish(text,text,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workflow_delivery_claim(uuid,uuid,text,text,text,text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.workflow_delivery_finish(text,text,text,text,text,timestamptz) TO service_role;