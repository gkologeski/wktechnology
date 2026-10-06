-- SDR de IA na Prospecção: estruturas aditivas.

CREATE TABLE public.sdr_workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  auto_send_enabled boolean NOT NULL DEFAULT false,
  default_playbook_id uuid REFERENCES public.sdr_playbooks(id) ON DELETE SET NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  quiet_hours_start smallint NOT NULL DEFAULT 19,
  quiet_hours_end smallint NOT NULL DEFAULT 8,
  daily_send_limit integer NOT NULL DEFAULT 50,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sdr_workspace_settings TO authenticated;
GRANT ALL ON public.sdr_workspace_settings TO service_role;
ALTER TABLE public.sdr_workspace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_ws_settings_select ON public.sdr_workspace_settings FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY sdr_ws_settings_write ON public.sdr_workspace_settings FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE TABLE public.sdr_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  offer_key text NOT NULL,
  parent_key text,
  name text NOT NULL,
  service_catalog_id uuid REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  summary text NOT NULL DEFAULT '',
  fit_signals text[] NOT NULL DEFAULT '{}',
  discovery_questions text[] NOT NULL DEFAULT '{}',
  commercial_notes text NOT NULL DEFAULT '',
  pricing_policy text NOT NULL DEFAULT 'Não informar valores. Encaminhar para proposta com especialista.',
  source_url text,
  source_excerpt text,
  approved_at timestamptz,
  approved_by uuid,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, offer_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_offers TO authenticated;
GRANT ALL ON public.sdr_offers TO service_role;
ALTER TABLE public.sdr_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_offers_select ON public.sdr_offers FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY sdr_offers_write ON public.sdr_offers FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE TABLE public.sdr_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'link' CHECK (kind IN ('link','file')),
  url text,
  media_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  mime text,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_materials TO authenticated;
GRANT ALL ON public.sdr_materials TO service_role;
ALTER TABLE public.sdr_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_materials_select ON public.sdr_materials FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY sdr_materials_write ON public.sdr_materials FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

CREATE TABLE public.sdr_material_offers (
  material_id uuid NOT NULL REFERENCES public.sdr_materials(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.sdr_offers(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  PRIMARY KEY (material_id, offer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_material_offers TO authenticated;
GRANT ALL ON public.sdr_material_offers TO service_role;
ALTER TABLE public.sdr_material_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_material_offers_select ON public.sdr_material_offers FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY sdr_material_offers_write ON public.sdr_material_offers FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

ALTER TABLE public.sdr_playbooks
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'supervised' CHECK (mode IN ('supervised','auto')),
  ADD COLUMN IF NOT EXISTS questionnaire_id uuid REFERENCES public.prospecting_questionnaires(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_page_id uuid REFERENCES public.booking_pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS max_follow_ups integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS opportunity_min_score integer NOT NULL DEFAULT 60;

ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS sdr_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sdr_playbook_id uuid REFERENCES public.sdr_playbooks(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS sdr_enrollment_id uuid REFERENCES public.sdr_enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_owner text CHECK (ai_owner IN ('ai','human','paused')),
  ADD COLUMN IF NOT EXISTS ai_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origin_campaign_id uuid REFERENCES public.whatsapp_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_template_name text,
  ADD COLUMN IF NOT EXISTS origin_wa_message_id text;

ALTER TABLE public.sdr_enrollments
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.whatsapp_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS commercial_stage text NOT NULL DEFAULT 'awaiting_reply',
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meeting_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS offers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS sdr_enrollments_campaign_phone_uidx
  ON public.sdr_enrollments (workspace_id, campaign_id, contact_phone)
  WHERE campaign_id IS NOT NULL AND contact_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS sdr_enrollments_followup_idx
  ON public.sdr_enrollments (follow_up_at) WHERE follow_up_at IS NOT NULL;

CREATE TABLE public.sdr_turn_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.sdr_enrollments(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'reply' CHECK (kind IN ('reply','follow_up')),
  idem_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','drafted','sent','discarded','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  conversation_version integer,
  inbound_message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  draft_text text,
  draft_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idem_key)
);
CREATE INDEX sdr_turn_jobs_status_idx ON public.sdr_turn_jobs (status, created_at);
CREATE INDEX sdr_turn_jobs_conv_idx ON public.sdr_turn_jobs (conversation_id, status);
GRANT SELECT ON public.sdr_turn_jobs TO authenticated;
GRANT ALL ON public.sdr_turn_jobs TO service_role;
ALTER TABLE public.sdr_turn_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_turn_jobs_select ON public.sdr_turn_jobs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE public.sdr_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.sdr_enrollments(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.sdr_turn_jobs(id) ON DELETE SET NULL,
  kind text NOT NULL,
  status text NOT NULL,
  provider_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sdr_actions_enrollment_idx ON public.sdr_actions (enrollment_id, created_at DESC);
GRANT SELECT ON public.sdr_actions TO authenticated;
GRANT ALL ON public.sdr_actions TO service_role;
ALTER TABLE public.sdr_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_actions_select ON public.sdr_actions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE public.sdr_qualification_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.sdr_enrollments(id) ON DELETE CASCADE,
  field text NOT NULL,
  value text NOT NULL,
  source_message_id uuid NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  excerpt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, field, source_message_id)
);
GRANT SELECT ON public.sdr_qualification_evidence TO authenticated;
GRANT ALL ON public.sdr_qualification_evidence TO service_role;
ALTER TABLE public.sdr_qualification_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY sdr_qual_evidence_select ON public.sdr_qualification_evidence FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Reivindica trabalhos com lease, no máximo um em execução por conversa.
-- Não mantém transação aberta durante a chamada de IA: só marca e devolve.
CREATE OR REPLACE FUNCTION public.sdr_claim_jobs(p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.sdr_turn_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT DISTINCT ON (j.conversation_id) j.id
    FROM public.sdr_turn_jobs j
    WHERE (j.status = 'queued' OR (j.status = 'running' AND j.lease_until < now()))
      AND j.attempts < 3
      AND NOT EXISTS (
        SELECT 1 FROM public.sdr_turn_jobs r
        WHERE r.conversation_id = j.conversation_id
          AND r.id <> j.id
          AND r.status = 'running'
          AND r.lease_until >= now()
      )
    ORDER BY j.conversation_id, j.created_at
    LIMIT GREATEST(1, LEAST(p_limit, 50))
  ), locked AS (
    SELECT j.id FROM public.sdr_turn_jobs j
    JOIN candidates c ON c.id = j.id
    FOR UPDATE OF j SKIP LOCKED
  )
  UPDATE public.sdr_turn_jobs t
  SET status = 'running',
      lease_token = gen_random_uuid(),
      lease_until = now() + make_interval(secs => GREATEST(30, p_lease_seconds)),
      attempts = t.attempts + 1,
      updated_at = now()
  FROM locked
  WHERE t.id = locked.id
  RETURNING t.*;
END;
$$;
REVOKE ALL ON FUNCTION public.sdr_claim_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_claim_jobs(integer, integer) TO service_role;

-- Troca do dono da conversa com controle de versão (descarta trabalho obsoleto).
CREATE OR REPLACE FUNCTION public.sdr_set_conversation_owner(p_conversation uuid, p_owner text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_version integer;
BEGIN
  IF p_owner NOT IN ('ai','human','paused') THEN RAISE EXCEPTION 'invalid owner'; END IF;
  UPDATE public.whatsapp_conversations
     SET ai_owner = p_owner, ai_version = ai_version + 1, updated_at = now()
   WHERE id = p_conversation
   RETURNING ai_version INTO v_version;
  IF p_owner <> 'ai' THEN
    UPDATE public.sdr_turn_jobs
       SET status = 'discarded', error = 'owner_changed', updated_at = now()
     WHERE conversation_id = p_conversation AND status IN ('queued','running','drafted');
  END IF;
  RETURN v_version;
END;
$$;
REVOKE ALL ON FUNCTION public.sdr_set_conversation_owner(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_set_conversation_owner(uuid, text) TO service_role;
