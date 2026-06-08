-- Segurança no workspace
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS security_settings jsonb NOT NULL DEFAULT jsonb_build_object(
    'ip_allowlist', '[]'::jsonb,
    'ip_allowlist_enabled', false,
    'session_timeout_minutes', 720,
    'require_mfa', false,
    'force_sso', false
  ),
  ADD COLUMN IF NOT EXISTS data_region text NOT NULL DEFAULT 'BR' CHECK (data_region IN ('US','EU','BR'));

-- SCIM tokens (provisionamento Okta/Azure)
CREATE TABLE IF NOT EXISTS public.scim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  token_prefix text NOT NULL,
  last_used_at timestamptz,
  created_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scim_tokens TO authenticated;
GRANT ALL ON public.scim_tokens TO service_role;
ALTER TABLE public.scim_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scim_tokens_admin_select" ON public.scim_tokens FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE POLICY "scim_tokens_admin_insert" ON public.scim_tokens FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE POLICY "scim_tokens_admin_update" ON public.scim_tokens FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE POLICY "scim_tokens_admin_delete" ON public.scim_tokens FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_scim_tokens_ws ON public.scim_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scim_tokens_hash ON public.scim_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE TRIGGER trg_scim_tokens_set_updated_at BEFORE UPDATE ON public.scim_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Exportação de audit logs
CREATE TABLE IF NOT EXISTS public.audit_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  destination text NOT NULL CHECK (destination IN ('s3','webhook','email')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  format text NOT NULL DEFAULT 'json' CHECK (format IN ('json','csv')),
  schedule_cron text NOT NULL DEFAULT '0 2 * * *',
  hmac_secret text,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_exports TO authenticated;
GRANT ALL ON public.audit_exports TO service_role;
ALTER TABLE public.audit_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_exports_admin_select" ON public.audit_exports FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE POLICY "audit_exports_admin_insert" ON public.audit_exports FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE POLICY "audit_exports_admin_update" ON public.audit_exports FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE POLICY "audit_exports_admin_delete" ON public.audit_exports FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_audit_exports_ws ON public.audit_exports(workspace_id);
CREATE TRIGGER trg_audit_exports_set_updated_at BEFORE UPDATE ON public.audit_exports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.audit_export_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  export_id uuid NOT NULL REFERENCES public.audit_exports(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  records_count integer DEFAULT 0,
  error_message text,
  output_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_export_runs TO authenticated;
GRANT ALL ON public.audit_export_runs TO service_role;
ALTER TABLE public.audit_export_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_export_runs_admin_select" ON public.audit_export_runs FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_audit_export_runs_export ON public.audit_export_runs(export_id, started_at DESC);

-- Log de bloqueios de IP
CREATE TABLE IF NOT EXISTS public.ip_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid,
  ip_address inet NOT NULL,
  user_agent text,
  blocked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ip_access_log TO authenticated;
GRANT ALL ON public.ip_access_log TO service_role;
ALTER TABLE public.ip_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ip_access_log_admin_select" ON public.ip_access_log FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_ip_access_log_ws ON public.ip_access_log(workspace_id, created_at DESC);