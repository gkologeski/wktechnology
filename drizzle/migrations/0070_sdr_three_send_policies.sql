-- Três políticas de envio do SDR: prospecção/follow-ups (cota comercial),
-- atendimento em conversa (sem cota comercial) e proteção técnica.

ALTER TABLE public.sdr_workspace_settings
  ADD COLUMN IF NOT EXISTS followup_daily_limit integer,
  ADD COLUMN IF NOT EXISTS template_daily_limit integer,
  ADD COLUMN IF NOT EXISTS template_respect_hours boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tech_conv_turns_per_hour integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS tech_failure_threshold integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tech_breaker_open_at timestamptz,
  ADD COLUMN IF NOT EXISTS tech_breaker_reason text;
-- Retomadas herdam a cota que antes valia para tudo (não amplia volume).
UPDATE public.sdr_workspace_settings SET followup_daily_limit = daily_send_limit WHERE followup_daily_limit IS NULL;
ALTER TABLE public.sdr_workspace_settings ALTER COLUMN followup_daily_limit SET DEFAULT 50;
COMMENT ON COLUMN public.sdr_workspace_settings.daily_send_limit IS 'DEPRECATED: substituído por followup_daily_limit (retomadas) e template_daily_limit (início de contato). Respostas em conversa não usam cota comercial.';
COMMENT ON COLUMN public.sdr_workspace_settings.template_daily_limit IS 'Cota de 24 h de templates de início de contato por workspace; NULL = sem cota adicional (apenas ritmo da campanha).';
COMMENT ON COLUMN public.sdr_workspace_settings.quiet_hours_start IS 'Horário de prospecção: vale para retomadas (e templates quando template_respect_hours). Não suspende respostas em conversa.';

ALTER TABLE public.sdr_turn_jobs
  ADD COLUMN IF NOT EXISTS block_category text,
  ADD COLUMN IF NOT EXISTS ai_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS send_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text;
COMMENT ON COLUMN public.sdr_turn_jobs.block_category IS 'prospecting | conversation | technical | reconcile';

ALTER TABLE public.whatsapp_campaign_recipients
  ADD COLUMN IF NOT EXISTS quota_reserved_until timestamptz;

-- Origem derivada no servidor: "reply" só nasce de inbound real da mesma
-- conversa/workspace; "follow_up" nunca tem inbound. Tipo e origem são imutáveis.
CREATE OR REPLACE FUNCTION public.sdr_turn_jobs_origin_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE m record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.inbound_message_id IS DISTINCT FROM OLD.inbound_message_id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'sdr_turn_jobs: origem do trabalho é imutável';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.kind = 'reply' THEN
    SELECT id, conversation_id, workspace_id, direction INTO m
      FROM public.whatsapp_messages WHERE id = NEW.inbound_message_id;
    IF NOT FOUND OR m.direction <> 'inbound' OR m.conversation_id <> NEW.conversation_id
       OR m.workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'sdr_turn_jobs: resposta sem mensagem recebida válida';
    END IF;
  ELSIF NEW.kind = 'follow_up' THEN
    IF NEW.inbound_message_id IS NOT NULL THEN
      RAISE EXCEPTION 'sdr_turn_jobs: retomada não pode apontar mensagem recebida';
    END IF;
  ELSE
    RAISE EXCEPTION 'sdr_turn_jobs: tipo inválido';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sdr_turn_jobs_origin_guard ON public.sdr_turn_jobs;
CREATE TRIGGER sdr_turn_jobs_origin_guard BEFORE INSERT OR UPDATE ON public.sdr_turn_jobs
  FOR EACH ROW EXECUTE FUNCTION public.sdr_turn_jobs_origin_guard();

-- Cota de retomadas (janela móvel de 24 h): só follow-ups confirmados com wamid
-- único + reservas ativas de outros follow-ups. Respostas nunca entram aqui.
CREATE OR REPLACE FUNCTION public.sdr_reserve_followup_quota(p_job uuid, p_lease uuid, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE j record; v_confirmed integer; v_reserved integer;
BEGIN
  SELECT * INTO j FROM public.sdr_turn_jobs WHERE id = p_job;
  IF NOT FOUND OR j.status <> 'running' OR j.lease_token IS DISTINCT FROM p_lease THEN
    RETURN jsonb_build_object('result','lease_lost');
  END IF;
  IF j.kind <> 'follow_up' THEN RETURN jsonb_build_object('result','not_follow_up'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('sdr-fu-quota:' || j.workspace_id::text, 0));
  SELECT count(DISTINCT a.provider_ref) INTO v_confirmed
    FROM public.sdr_actions a JOIN public.sdr_turn_jobs t ON t.id = a.job_id
   WHERE a.workspace_id = j.workspace_id AND a.kind = 'message_sent' AND a.status = 'success'
     AND a.provider_ref IS NOT NULL AND t.kind = 'follow_up'
     AND a.created_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_reserved
    FROM public.sdr_turn_jobs t
   WHERE t.workspace_id = j.workspace_id AND t.id <> j.id AND t.kind = 'follow_up'
     AND t.status IN ('running','sent') AND t.send_reserved_until > now()
     AND NOT EXISTS (SELECT 1 FROM public.sdr_actions a2
                      WHERE a2.job_id = t.id AND a2.kind = 'message_sent' AND a2.status = 'success');
  IF j.send_reserved_until > now() THEN
    RETURN jsonb_build_object('result','already_reserved','used',v_confirmed,'reserved',v_reserved,'limit',p_limit);
  END IF;
  IF v_confirmed + v_reserved >= GREATEST(0, p_limit) THEN
    RETURN jsonb_build_object('result','followup_quota','used',v_confirmed,'reserved',v_reserved,'limit',p_limit);
  END IF;
  UPDATE public.sdr_turn_jobs SET send_reserved_until = now() + interval '90 seconds' WHERE id = p_job;
  RETURN jsonb_build_object('result','ok','used',v_confirmed,'reserved',v_reserved + 1,'limit',p_limit);
END;
$$;
REVOKE ALL ON FUNCTION public.sdr_reserve_followup_quota(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_reserve_followup_quota(uuid, uuid, integer) TO service_role;

-- Cota de templates de início de contato por workspace (opcional).
CREATE OR REPLACE FUNCTION public.wa_reserve_template_quota(p_recipient uuid, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; v_ws uuid; v_confirmed integer; v_reserved integer;
BEGIN
  SELECT rc.id, rc.status, c.workspace_id INTO r
    FROM public.whatsapp_campaign_recipients rc JOIN public.whatsapp_campaigns c ON c.id = rc.campaign_id
   WHERE rc.id = p_recipient;
  IF NOT FOUND OR r.status <> 'pending' THEN RETURN jsonb_build_object('result','not_pending'); END IF;
  v_ws := r.workspace_id;
  IF p_limit IS NULL THEN RETURN jsonb_build_object('result','ok','unlimited',true); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('wa-tpl-quota:' || v_ws::text, 0));
  SELECT count(DISTINCT rc.wa_message_id) INTO v_confirmed
    FROM public.whatsapp_campaign_recipients rc JOIN public.whatsapp_campaigns c ON c.id = rc.campaign_id
   WHERE c.workspace_id = v_ws AND rc.status = 'sent' AND rc.wa_message_id IS NOT NULL
     AND rc.sent_at >= now() - interval '24 hours';
  SELECT count(*) INTO v_reserved
    FROM public.whatsapp_campaign_recipients rc JOIN public.whatsapp_campaigns c ON c.id = rc.campaign_id
   WHERE c.workspace_id = v_ws AND rc.id <> p_recipient AND rc.status = 'pending'
     AND rc.quota_reserved_until > now();
  IF v_confirmed + v_reserved >= GREATEST(0, p_limit) THEN
    RETURN jsonb_build_object('result','template_quota','used',v_confirmed,'reserved',v_reserved,'limit',p_limit);
  END IF;
  UPDATE public.whatsapp_campaign_recipients SET quota_reserved_until = now() + interval '90 seconds' WHERE id = p_recipient;
  RETURN jsonb_build_object('result','ok','used',v_confirmed,'reserved',v_reserved + 1,'limit',p_limit);
END;
$$;
REVOKE ALL ON FUNCTION public.wa_reserve_template_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_reserve_template_quota(uuid, integer) TO service_role;

COMMENT ON FUNCTION public.sdr_reserve_send_quota(uuid, uuid, integer) IS 'DEPRECATED: cota única antiga; substituída por sdr_reserve_followup_quota. Respostas em conversa não usam cota.';