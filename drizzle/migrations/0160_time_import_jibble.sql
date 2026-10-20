-- Infraestrutura multi-provedor de importação de horas (Jibble agora; Clockify segue nas suas
-- tabelas até migrar sem interromper a importação ativa). Chave de destino:
-- workspace + provider + organização de origem + entidade + id externo.

CREATE TABLE public.time_import_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('jibble')),
  credentials_ciphertext text,
  client_id_hint text,
  secret_last4 text,
  source_org_id text CHECK (source_org_id IS NULL OR source_org_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  source_org_name text,
  source_person_id text,
  source_role text,
  source_access text CHECK (source_access IS NULL OR source_access IN ('owner','admin','not_admin','unknown')),
  source_verified_at timestamptz,
  status text NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('not_configured','configured','connecting','connected','failed','disabled')),
  last_error text,
  last_tested_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);
GRANT ALL ON public.time_import_connections TO service_role;
ALTER TABLE public.time_import_connections ENABLE ROW LEVEL SECURITY;
-- Sem política para authenticated: credenciais cifradas nunca saem do servidor.

CREATE TABLE public.time_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('jibble')),
  source_org_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('dry_run','import','rollback')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','paused','cancel_requested','cancelled','completed','failed')),
  phase text NOT NULL DEFAULT 'start',
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  report jsonb,
  error text,
  requested_by uuid NOT NULL,
  preview_run_id uuid REFERENCES public.time_import_runs(id) ON DELETE SET NULL,
  target_run_id uuid REFERENCES public.time_import_runs(id) ON DELETE SET NULL,
  preview_confirmed_at timestamptz,
  preview_confirmed_by uuid,
  lease_until timestamptz,
  heartbeat_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX time_import_runs_one_active ON public.time_import_runs (workspace_id, provider)
  WHERE status IN ('queued','running','paused','cancel_requested');
CREATE INDEX time_import_runs_ws_idx ON public.time_import_runs (workspace_id, provider, created_at DESC);
GRANT SELECT ON public.time_import_runs TO authenticated;
GRANT ALL ON public.time_import_runs TO service_role;
ALTER TABLE public.time_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY time_import_runs_admin_read ON public.time_import_runs FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

CREATE TABLE public.time_import_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('jibble')),
  source_org_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN (
    'organization','person','position','group','client','project','activity','location',
    'schedule','pay_period_definition','pay_period','time_entry','hour_entry','timesheet_day',
    'time_off_policy','time_off','calendar','calendar_day','screenshot','interval')),
  external_id text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 200),
  person_external_id text,
  period date,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged','ready','imported','pending_review','unsupported','rejected','skipped')),
  reason_code text,
  reason_detail text,
  last_run_id uuid REFERENCES public.time_import_runs(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, source_org_id, entity_type, external_id)
);
CREATE INDEX time_import_staging_person_idx ON public.time_import_staging
  (workspace_id, provider, source_org_id, entity_type, person_external_id, period);
CREATE INDEX time_import_staging_status_idx ON public.time_import_staging
  (workspace_id, provider, source_org_id, entity_type, status);
GRANT SELECT ON public.time_import_staging TO authenticated;
GRANT ALL ON public.time_import_staging TO service_role;
ALTER TABLE public.time_import_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY time_import_staging_admin_read ON public.time_import_staging FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

CREATE TABLE public.time_import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('jibble')),
  source_org_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('person','client','project')),
  external_id text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 200),
  label text,
  target_id uuid,
  method text NOT NULL DEFAULT 'none' CHECK (method IN ('email','external_id','manual','created','none')),
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('auto','confirmed','create','ignore','pending')),
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, source_org_id, entity_type, external_id)
);
GRANT SELECT ON public.time_import_mappings TO authenticated;
GRANT ALL ON public.time_import_mappings TO service_role;
ALTER TABLE public.time_import_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY time_import_mappings_admin_read ON public.time_import_mappings FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.time_import_mappings_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.target_id IS NOT NULL AND NOT public.clockify_target_in_workspace(
       CASE NEW.entity_type WHEN 'person' THEN 'workspace_members'
                            WHEN 'client' THEN 'companies' ELSE 'projects' END,
       NEW.target_id, NEW.workspace_id) THEN
    RAISE EXCEPTION 'Destino do mapeamento fora do workspace.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER time_import_mappings_validate_trg BEFORE INSERT OR UPDATE ON public.time_import_mappings
  FOR EACH ROW EXECUTE FUNCTION public.time_import_mappings_validate();

CREATE TABLE public.time_import_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('jibble')),
  source_org_id text NOT NULL,
  entity_type text NOT NULL,
  external_id text NOT NULL,
  segment integer NOT NULL DEFAULT 0,
  target_table text NOT NULL CHECK (target_table IN ('projects','project_tasks','project_members','project_time_entries')),
  target_id uuid NOT NULL,
  link_kind text NOT NULL DEFAULT 'created' CHECK (link_kind IN ('created','matched_existing')),
  source_hash text NOT NULL,
  imported_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_seconds bigint,
  source_start_utc timestamptz,
  source_end_utc timestamptz,
  source_offset text,
  local_date date,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_run_id uuid REFERENCES public.time_import_runs(id) ON DELETE SET NULL,
  last_run_id uuid REFERENCES public.time_import_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, source_org_id, entity_type, external_id, segment)
);
CREATE INDEX time_import_links_target_idx ON public.time_import_links (workspace_id, target_table, target_id);
CREATE INDEX time_import_links_run_idx ON public.time_import_links (created_run_id);
GRANT SELECT ON public.time_import_links TO authenticated;
GRANT ALL ON public.time_import_links TO service_role;
ALTER TABLE public.time_import_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY time_import_links_admin_read ON public.time_import_links FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

CREATE TABLE public.time_import_duplicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('jibble')),
  source_org_id text NOT NULL,
  external_id text NOT NULL,
  segment integer NOT NULL DEFAULT 0,
  existing_entry_id uuid NOT NULL,
  existing_source text,
  existing_external_id text,
  overlap_seconds integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('exact','overlap')),
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','same_event','distinct')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, source_org_id, external_id, segment, existing_entry_id)
);
GRANT SELECT ON public.time_import_duplicates TO authenticated;
GRANT ALL ON public.time_import_duplicates TO service_role;
ALTER TABLE public.time_import_duplicates ENABLE ROW LEVEL SECURITY;
CREATE POLICY time_import_duplicates_admin_read ON public.time_import_duplicates FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

-- Desfaz apenas o que uma execução criou: apontamentos importados pelo Jibble e, depois,
-- tarefas/projetos/membros criados por ela que não tenham mais nada pendurado.
CREATE OR REPLACE FUNCTION public.time_import_rollback(
  p_workspace uuid, p_entries uuid[], p_members uuid[], p_tasks uuid[], p_projects uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_e int := 0; n_m int := 0; n_t int := 0; n_p int := 0;
BEGIN
  PERFORM set_config('app.clockify_import', 'on', true);
  DELETE FROM public.project_time_entries
   WHERE workspace_id = p_workspace AND id = ANY(COALESCE(p_entries, '{}'))
     AND source = 'import' AND external_id LIKE 'jibble:%';
  GET DIAGNOSTICS n_e = ROW_COUNT;
  DELETE FROM public.project_tasks t
   WHERE t.workspace_id = p_workspace AND t.id = ANY(COALESCE(p_tasks, '{}'))
     AND NOT EXISTS (SELECT 1 FROM public.project_time_entries e WHERE e.task_id = t.id);
  GET DIAGNOSTICS n_t = ROW_COUNT;
  DELETE FROM public.project_members m
   WHERE m.workspace_id = p_workspace AND m.id = ANY(COALESCE(p_members, '{}'))
     AND NOT EXISTS (SELECT 1 FROM public.project_time_entries e
                      WHERE e.project_id = m.project_id AND e.user_id = m.user_id);
  GET DIAGNOSTICS n_m = ROW_COUNT;
  DELETE FROM public.projects p
   WHERE p.workspace_id = p_workspace AND p.id = ANY(COALESCE(p_projects, '{}'))
     AND NOT EXISTS (SELECT 1 FROM public.project_time_entries e WHERE e.project_id = p.id)
     AND NOT EXISTS (SELECT 1 FROM public.project_tasks t WHERE t.project_id = p.id);
  GET DIAGNOSTICS n_p = ROW_COUNT;
  RETURN jsonb_build_object('entries', n_e, 'members', n_m, 'tasks', n_t, 'projects', n_p);
END $$;
REVOKE ALL ON FUNCTION public.time_import_rollback(uuid, uuid[], uuid[], uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.time_import_rollback(uuid, uuid[], uuid[], uuid[], uuid[]) TO service_role;