
-- Enums
CREATE TYPE public.voice_provider AS ENUM ('elevenlabs', 'vapi_default');
CREATE TYPE public.prospecting_campaign_status AS ENUM ('draft', 'running', 'paused', 'done');
CREATE TYPE public.prospecting_assignment_mode AS ENUM ('weighted', 'segment');
CREATE TYPE public.prospecting_source_type AS ENUM ('segment', 'saved_view', 'manual');
CREATE TYPE public.prospecting_call_status AS ENUM ('queued','ringing','in_progress','completed','failed','no_answer','busy','canceled');

-- prospecting_scripts
CREATE TABLE public.prospecting_scripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  system_prompt text NOT NULL DEFAULT '',
  first_message text NOT NULL DEFAULT '',
  objective text,
  voice_id text,
  voice_provider public.voice_provider NOT NULL DEFAULT 'elevenlabs',
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prospecting_scripts_workspace ON public.prospecting_scripts(workspace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_scripts TO authenticated;
GRANT ALL ON public.prospecting_scripts TO service_role;
ALTER TABLE public.prospecting_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_prospecting_scripts ON public.prospecting_scripts FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_insert_prospecting_scripts ON public.prospecting_scripts FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_update_prospecting_scripts ON public.prospecting_scripts FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_delete_prospecting_scripts ON public.prospecting_scripts FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE TRIGGER trg_set_workspace_prospecting_scripts BEFORE INSERT ON public.prospecting_scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_on_insert();
CREATE TRIGGER trg_set_updated_at_prospecting_scripts BEFORE UPDATE ON public.prospecting_scripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- prospecting_campaigns
CREATE TABLE public.prospecting_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  status public.prospecting_campaign_status NOT NULL DEFAULT 'draft',
  assignment_mode public.prospecting_assignment_mode NOT NULL DEFAULT 'weighted',
  dialing_window jsonb NOT NULL DEFAULT '{"start":"09:00","end":"18:00","timezone":"America/Sao_Paulo","days":[1,2,3,4,5]}'::jsonb,
  max_attempts int NOT NULL DEFAULT 3,
  retry_interval_minutes int NOT NULL DEFAULT 240,
  source_type public.prospecting_source_type NOT NULL DEFAULT 'manual',
  source_ref uuid,
  lead_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prospecting_campaigns_workspace ON public.prospecting_campaigns(workspace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_campaigns TO authenticated;
GRANT ALL ON public.prospecting_campaigns TO service_role;
ALTER TABLE public.prospecting_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_prospecting_campaigns ON public.prospecting_campaigns FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_insert_prospecting_campaigns ON public.prospecting_campaigns FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_update_prospecting_campaigns ON public.prospecting_campaigns FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_delete_prospecting_campaigns ON public.prospecting_campaigns FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE TRIGGER trg_set_workspace_prospecting_campaigns BEFORE INSERT ON public.prospecting_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_on_insert();
CREATE TRIGGER trg_set_updated_at_prospecting_campaigns BEFORE UPDATE ON public.prospecting_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- prospecting_campaign_variants
CREATE TABLE public.prospecting_campaign_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.prospecting_campaigns(id) ON DELETE CASCADE,
  script_id uuid NOT NULL REFERENCES public.prospecting_scripts(id) ON DELETE RESTRICT,
  weight int NOT NULL DEFAULT 50,
  segment_id uuid,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prospecting_campaign_variants_campaign ON public.prospecting_campaign_variants(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_campaign_variants TO authenticated;
GRANT ALL ON public.prospecting_campaign_variants TO service_role;
ALTER TABLE public.prospecting_campaign_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_pcv ON public.prospecting_campaign_variants FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_insert_pcv ON public.prospecting_campaign_variants FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_update_pcv ON public.prospecting_campaign_variants FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_delete_pcv ON public.prospecting_campaign_variants FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE TRIGGER trg_set_workspace_pcv BEFORE INSERT ON public.prospecting_campaign_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_on_insert();

-- prospecting_call_attempts
CREATE TABLE public.prospecting_call_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.prospecting_campaigns(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.prospecting_campaign_variants(id) ON DELETE SET NULL,
  script_id uuid REFERENCES public.prospecting_scripts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  vapi_call_id text UNIQUE,
  status public.prospecting_call_status NOT NULL DEFAULT 'queued',
  attempt_number int NOT NULL DEFAULT 1,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  cost_usd numeric(10,4),
  recording_url text,
  transcript text,
  summary text,
  success_evaluation text,
  ended_reason text,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pca_workspace ON public.prospecting_call_attempts(workspace_id);
CREATE INDEX idx_pca_campaign ON public.prospecting_call_attempts(campaign_id);
CREATE INDEX idx_pca_variant ON public.prospecting_call_attempts(variant_id);
CREATE INDEX idx_pca_lead ON public.prospecting_call_attempts(lead_id);
CREATE INDEX idx_pca_status_sched ON public.prospecting_call_attempts(status, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_call_attempts TO authenticated;
GRANT ALL ON public.prospecting_call_attempts TO service_role;
ALTER TABLE public.prospecting_call_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_pca ON public.prospecting_call_attempts FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_insert_pca ON public.prospecting_call_attempts FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_update_pca ON public.prospecting_call_attempts FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_delete_pca ON public.prospecting_call_attempts FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE TRIGGER trg_set_workspace_pca BEFORE INSERT ON public.prospecting_call_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_on_insert();
CREATE TRIGGER trg_set_updated_at_pca BEFORE UPDATE ON public.prospecting_call_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Voice agent settings (per workspace)
CREATE TABLE public.voice_agent_settings (
  workspace_id uuid NOT NULL PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  vapi_phone_number_id text,
  default_voice_id text,
  default_voice_provider public.voice_provider NOT NULL DEFAULT 'elevenlabs',
  llm_model text NOT NULL DEFAULT 'gpt-4o-mini',
  language text NOT NULL DEFAULT 'pt-BR',
  speed numeric(3,2) NOT NULL DEFAULT 1.0,
  stability numeric(3,2) NOT NULL DEFAULT 0.5,
  similarity_boost numeric(3,2) NOT NULL DEFAULT 0.75,
  first_message text,
  max_duration_seconds int NOT NULL DEFAULT 600,
  allowed_hours jsonb NOT NULL DEFAULT '{"start":"09:00","end":"18:00","timezone":"America/Sao_Paulo","days":[1,2,3,4,5]}'::jsonb,
  custom_voices jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_agent_settings TO authenticated;
GRANT ALL ON public.voice_agent_settings TO service_role;
ALTER TABLE public.voice_agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select_vas ON public.voice_agent_settings FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_insert_vas ON public.voice_agent_settings FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_update_vas ON public.voice_agent_settings FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY ws_delete_vas ON public.voice_agent_settings FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE TRIGGER trg_set_updated_at_vas BEFORE UPDATE ON public.voice_agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
