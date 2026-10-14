-- Ferramentas da Lia (aditivo). Configuração de ferramentas e agenda é versionada
-- junto da persona: o worker só lê a versão publicada.
ALTER TABLE public.sdr_agent_versions ADD COLUMN IF NOT EXISTS tool_config jsonb;

CREATE TABLE IF NOT EXISTS public.sdr_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  playbook_id uuid NOT NULL,
  agent_version_id uuid,
  job_id uuid,
  conversation_id uuid,
  enrollment_id uuid,
  tool text NOT NULL,
  tool_call_id text NOT NULL,
  idem_key text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  status text NOT NULL CHECK (status IN ('ok','error','denied','pending')),
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idem_key)
);
GRANT SELECT ON public.sdr_tool_calls TO authenticated;
GRANT ALL ON public.sdr_tool_calls TO service_role;
ALTER TABLE public.sdr_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_tool_calls_select ON public.sdr_tool_calls FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX IF NOT EXISTS sdr_tool_calls_pb_idx ON public.sdr_tool_calls (playbook_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sdr_slot_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  playbook_id uuid NOT NULL,
  offer_set integer NOT NULL,
  position integer NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','rejected','chosen','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, offer_set, position)
);
GRANT SELECT ON public.sdr_slot_offers TO authenticated;
GRANT ALL ON public.sdr_slot_offers TO service_role;
ALTER TABLE public.sdr_slot_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_slot_offers_select ON public.sdr_slot_offers FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.sdr_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  playbook_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  enrollment_id uuid,
  campaign_id uuid,
  host_user_id uuid NOT NULL,
  calendar_account_id uuid NOT NULL,
  provider text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  buffer_before_minutes integer NOT NULL DEFAULT 0,
  buffer_after_minutes integer NOT NULL DEFAULT 0,
  timezone text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','confirmed','failed','reconcile','canceled','rescheduled')),
  provider_event_id text NOT NULL,
  meet_link text,
  attendee_email text,
  lead_id uuid,
  contact_id uuid,
  company_id uuid,
  deal_id uuid,
  activity_id uuid,
  idem_key text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sdr_meetings_idem_active
  ON public.sdr_meetings (idem_key) WHERE status IN ('pending','confirmed','reconcile');
CREATE INDEX IF NOT EXISTS sdr_meetings_cal_idx ON public.sdr_meetings (calendar_account_id, start_at);
CREATE INDEX IF NOT EXISTS sdr_meetings_conv_idx ON public.sdr_meetings (conversation_id, created_at DESC);
GRANT SELECT ON public.sdr_meetings TO authenticated;
GRANT ALL ON public.sdr_meetings TO service_role;
ALTER TABLE public.sdr_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_meetings_select ON public.sdr_meetings FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Reserva com trava por agenda: serializa por calendar_account_id e recusa
-- sobreposição (com buffers) contra reuniões ativas. Idempotente por idem_key.
CREATE OR REPLACE FUNCTION public.sdr_reserve_meeting(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cal uuid := (p->>'calendar_account_id')::uuid;
  v_s timestamptz := (p->>'start_at')::timestamptz;
  v_e timestamptz := (p->>'end_at')::timestamptz;
  v_bb int := coalesce((p->>'buffer_before_minutes')::int, 0);
  v_ba int := coalesce((p->>'buffer_after_minutes')::int, 0);
  v_existing public.sdr_meetings;
  v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(v_cal::text, 0));
  SELECT * INTO v_existing FROM public.sdr_meetings
   WHERE idem_key = p->>'idem_key' AND status IN ('pending','confirmed','reconcile') LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status','exists','id',v_existing.id,'meeting_status',v_existing.status);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sdr_meetings m
     WHERE m.calendar_account_id = v_cal AND m.status IN ('pending','confirmed','reconcile')
       AND m.start_at - make_interval(mins => greatest(m.buffer_before_minutes, v_ba)) < v_e
       AND m.end_at + make_interval(mins => greatest(m.buffer_after_minutes, v_bb)) > v_s
  ) THEN
    RETURN jsonb_build_object('status','conflict');
  END IF;
  INSERT INTO public.sdr_meetings (
    workspace_id, playbook_id, conversation_id, enrollment_id, campaign_id, host_user_id,
    calendar_account_id, provider, start_at, end_at, buffer_before_minutes, buffer_after_minutes,
    timezone, status, provider_event_id, attendee_email, lead_id, contact_id, company_id, deal_id, idem_key)
  VALUES (
    (p->>'workspace_id')::uuid, (p->>'playbook_id')::uuid, (p->>'conversation_id')::uuid,
    nullif(p->>'enrollment_id','')::uuid, nullif(p->>'campaign_id','')::uuid, (p->>'host_user_id')::uuid,
    v_cal, p->>'provider', v_s, v_e, v_bb, v_ba, p->>'timezone', 'pending', p->>'provider_event_id',
    nullif(p->>'attendee_email',''), nullif(p->>'lead_id','')::uuid, nullif(p->>'contact_id','')::uuid,
    nullif(p->>'company_id','')::uuid, nullif(p->>'deal_id','')::uuid, p->>'idem_key')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('status','reserved','id',v_id);
END $$;
REVOKE ALL ON FUNCTION public.sdr_reserve_meeting(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_reserve_meeting(jsonb) TO service_role;