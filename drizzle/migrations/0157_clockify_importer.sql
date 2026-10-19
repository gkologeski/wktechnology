-- Importador Clockify -> TechProjects (aditivo). Nada aqui altera dados existentes.

-- 1) Conexão por workspace (chave cifrada; só o servidor lê)
CREATE TABLE public.clockify_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_ciphertext text,
  key_last4 text,
  region text NOT NULL DEFAULT 'global' CHECK (region IN ('global','euc1','use2','euw2','apse2')),
  subdomain text CHECK (subdomain IS NULL OR subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  source_workspace_id text CHECK (source_workspace_id IS NULL OR source_workspace_id ~* '^[0-9a-f]{24}$'),
  source_workspace_name text,
  source_plan text,
  status text NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('not_configured','configured','connecting','connected','failed','disabled')),
  last_error text,
  last_tested_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.clockify_connections TO service_role;
ALTER TABLE public.clockify_connections ENABLE ROW LEVEL SECURITY;
-- Sem GRANT/policy para authenticated: a chave cifrada nunca chega ao navegador.

-- 2) Execuções (inventário, prévia, importação)
CREATE TABLE public.clockify_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_workspace_id text NOT NULL CHECK (source_workspace_id ~* '^[0-9a-f]{24}$'),
  kind text NOT NULL CHECK (kind IN ('dry_run','import')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','paused','cancel_requested','cancelled','completed','failed')),
  phase text NOT NULL DEFAULT 'start',
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  report jsonb,
  error text,
  requested_by uuid NOT NULL,
  preview_run_id uuid REFERENCES public.clockify_import_runs(id) ON DELETE SET NULL,
  preview_confirmed_at timestamptz,
  preview_confirmed_by uuid,
  lease_until timestamptz,
  heartbeat_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clockify_import_runs_ws_idx ON public.clockify_import_runs (workspace_id, created_at DESC);
CREATE UNIQUE INDEX clockify_import_runs_one_active
  ON public.clockify_import_runs (workspace_id)
  WHERE status IN ('queued','running','paused','cancel_requested');
GRANT SELECT ON public.clockify_import_runs TO authenticated;
GRANT ALL ON public.clockify_import_runs TO service_role;
ALTER TABLE public.clockify_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY clockify_runs_admin_read ON public.clockify_import_runs
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

-- 3) Staging: tudo que veio do Clockify, inclusive o que o ERP não suporta
CREATE TABLE public.clockify_staging_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_workspace_id text NOT NULL CHECK (source_workspace_id ~* '^[0-9a-f]{24}$'),
  entity_type text NOT NULL CHECK (entity_type IN (
    'workspace','user','group','client','project','task','tag','custom_field',
    'approval_request','time_entry','expense','invoice','holiday','time_off_policy')),
  external_id text NOT NULL CHECK (external_id ~* '^[0-9a-f]{24}$'),
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged','ready','imported','pending_review','unsupported','rejected','skipped')),
  reason_code text,
  reason_detail text,
  last_run_id uuid REFERENCES public.clockify_import_runs(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_workspace_id, entity_type, external_id)
);
CREATE INDEX clockify_staging_status_idx
  ON public.clockify_staging_records (workspace_id, source_workspace_id, entity_type, status);
GRANT SELECT ON public.clockify_staging_records TO authenticated;
GRANT ALL ON public.clockify_staging_records TO service_role;
ALTER TABLE public.clockify_staging_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY clockify_staging_admin_read ON public.clockify_staging_records
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

-- 4) Mapeamentos revisáveis (usuário, cliente, projeto)
CREATE TABLE public.clockify_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_workspace_id text NOT NULL CHECK (source_workspace_id ~* '^[0-9a-f]{24}$'),
  entity_type text NOT NULL CHECK (entity_type IN ('user','client','project')),
  external_id text NOT NULL CHECK (external_id ~* '^[0-9a-f]{24}$'),
  label text,
  target_id uuid,
  method text NOT NULL DEFAULT 'none' CHECK (method IN ('email','manual','created','none')),
  decision text NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('auto','confirmed','create','ignore','pending')),
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_workspace_id, entity_type, external_id)
);
GRANT SELECT ON public.clockify_mappings TO authenticated;
GRANT ALL ON public.clockify_mappings TO service_role;
ALTER TABLE public.clockify_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY clockify_mappings_admin_read ON public.clockify_mappings
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

-- 5) Vínculos idempotentes origem -> ERP (um por segmento diário)
CREATE TABLE public.clockify_import_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_workspace_id text NOT NULL CHECK (source_workspace_id ~* '^[0-9a-f]{24}$'),
  entity_type text NOT NULL CHECK (entity_type IN ('project','task','project_member','time_entry')),
  external_id text NOT NULL CHECK (external_id ~* '^[0-9a-f]{24}$'),
  segment integer NOT NULL DEFAULT 0 CHECK (segment >= 0),
  target_table text NOT NULL
    CHECK (target_table IN ('projects','project_tasks','project_members','project_time_entries')),
  target_id uuid NOT NULL,
  source_hash text NOT NULL,
  imported_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_seconds bigint,
  source_start_utc timestamptz,
  source_end_utc timestamptz,
  source_timezone text,
  local_date date,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_id uuid REFERENCES public.clockify_import_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source_workspace_id, entity_type, external_id, segment)
);
CREATE INDEX clockify_links_target_idx ON public.clockify_import_links (target_table, target_id);
GRANT SELECT ON public.clockify_import_links TO authenticated;
GRANT ALL ON public.clockify_import_links TO service_role;
ALTER TABLE public.clockify_import_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY clockify_links_admin_read ON public.clockify_import_links
  FOR SELECT TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

-- 6) Destinos sempre do mesmo workspace (defesa contra vínculo cruzado)
CREATE OR REPLACE FUNCTION public.clockify_target_in_workspace(p_table text, p_id uuid, p_ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p_table
    WHEN 'projects' THEN EXISTS (SELECT 1 FROM public.projects WHERE id = p_id AND workspace_id = p_ws)
    WHEN 'project_tasks' THEN EXISTS (SELECT 1 FROM public.project_tasks WHERE id = p_id AND workspace_id = p_ws)
    WHEN 'project_members' THEN EXISTS (SELECT 1 FROM public.project_members WHERE id = p_id AND workspace_id = p_ws)
    WHEN 'project_time_entries' THEN EXISTS (SELECT 1 FROM public.project_time_entries WHERE id = p_id AND workspace_id = p_ws)
    WHEN 'companies' THEN EXISTS (SELECT 1 FROM public.companies WHERE id = p_id AND workspace_id = p_ws)
    WHEN 'workspace_members' THEN EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = p_id AND workspace_id = p_ws)
    ELSE false END
$$;
REVOKE EXECUTE ON FUNCTION public.clockify_target_in_workspace(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clockify_target_in_workspace(text, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.clockify_links_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.clockify_target_in_workspace(NEW.target_table, NEW.target_id, NEW.workspace_id) THEN
    RAISE EXCEPTION 'Destino do vínculo Clockify fora do workspace.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER clockify_links_validate_trg BEFORE INSERT OR UPDATE ON public.clockify_import_links
  FOR EACH ROW EXECUTE FUNCTION public.clockify_links_validate();

CREATE OR REPLACE FUNCTION public.clockify_mappings_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.target_id IS NOT NULL AND NOT public.clockify_target_in_workspace(
       CASE NEW.entity_type WHEN 'user' THEN 'workspace_members'
                            WHEN 'client' THEN 'companies' ELSE 'projects' END,
       NEW.target_id, NEW.workspace_id) THEN
    RAISE EXCEPTION 'Destino do mapeamento Clockify fora do workspace.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER clockify_mappings_validate_trg BEFORE INSERT OR UPDATE ON public.clockify_mappings
  FOR EACH ROW EXECUTE FUNCTION public.clockify_mappings_validate();

-- 7) Escritas do importador não disparam workflows nem atualizações automáticas
CREATE OR REPLACE FUNCTION public.clockify_import_suppress()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.clockify_import', true) = 'on' THEN RETURN NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER clockify_import_suppress BEFORE INSERT ON public.workflow_events
  FOR EACH ROW EXECUTE FUNCTION public.clockify_import_suppress();
CREATE TRIGGER clockify_import_suppress BEFORE INSERT ON public.project_updates
  FOR EACH ROW EXECUTE FUNCTION public.clockify_import_suppress();

-- 8) Escrita em lote, linha a linha, com erro por linha (sem desligar validações)
CREATE OR REPLACE FUNCTION public.clockify_import_apply(
  p_workspace uuid, p_table text, p_op text, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb; v jsonb; out jsonb := '[]'::jsonb; v_id uuid; v_key text;
BEGIN
  IF p_table NOT IN ('projects','project_tasks','project_members','project_time_entries') THEN
    RAISE EXCEPTION 'Tabela não permitida.';
  END IF;
  IF p_op NOT IN ('insert','update') THEN RAISE EXCEPTION 'Operação não permitida.'; END IF;
  PERFORM set_config('app.clockify_import', 'on', true);

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_key := r->>'_key';
    v := r->'row';
    v_id := NULL;
    BEGIN
      IF (v ? 'project_id') AND (v->>'project_id') IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM public.projects WHERE id = (v->>'project_id')::uuid AND workspace_id = p_workspace) THEN
        RAISE EXCEPTION 'Projeto fora do workspace.';
      END IF;
      IF (v ? 'task_id') AND (v->>'task_id') IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM public.project_tasks WHERE id = (v->>'task_id')::uuid AND workspace_id = p_workspace) THEN
        RAISE EXCEPTION 'Tarefa fora do workspace.';
      END IF;
      IF (v ? 'user_id') AND (v->>'user_id') IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM public.workspace_members WHERE user_id = (v->>'user_id')::uuid AND workspace_id = p_workspace) THEN
        RAISE EXCEPTION 'Profissional fora do workspace.';
      END IF;

      IF p_op = 'insert' THEN
        IF p_table = 'projects' THEN
          INSERT INTO public.projects (workspace_id, owner_id, name, description, status,
                                       starts_at, due_at, planned_hours, metadata)
          VALUES (p_workspace, (v->>'owner_id')::uuid, v->>'name', v->>'description',
                  COALESCE((v->>'status')::public.project_status, 'active'),
                  (v->>'starts_at')::date, (v->>'due_at')::date,
                  (v->>'planned_hours')::numeric, COALESCE(v->'metadata', '{}'::jsonb))
          RETURNING id INTO v_id;
        ELSIF p_table = 'project_tasks' THEN
          INSERT INTO public.project_tasks (workspace_id, project_id, title, description, status,
                                            estimated_hours, assignee_id, assignee_ids)
          VALUES (p_workspace, (v->>'project_id')::uuid, v->>'title', v->>'description',
                  COALESCE((v->>'status')::public.project_task_status, 'todo'),
                  (v->>'estimated_hours')::numeric, (v->>'assignee_id')::uuid,
                  COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(v->'assignee_ids','[]'::jsonb))::uuid), '{}'))
          RETURNING id INTO v_id;
        ELSIF p_table = 'project_members' THEN
          INSERT INTO public.project_members (workspace_id, project_id, user_id, role_in_project,
                                              cost_rate_hour, bill_rate_hour, can_track_time)
          VALUES (p_workspace, (v->>'project_id')::uuid, (v->>'user_id')::uuid,
                  COALESCE((v->>'role_in_project')::public.project_member_role, 'contributor'),
                  (v->>'cost_rate_hour')::numeric, (v->>'bill_rate_hour')::numeric, true)
          ON CONFLICT (project_id, user_id) DO NOTHING
          RETURNING id INTO v_id;
          IF v_id IS NULL THEN
            SELECT id INTO v_id FROM public.project_members
             WHERE project_id = (v->>'project_id')::uuid AND user_id = (v->>'user_id')::uuid;
          END IF;
        ELSE
          INSERT INTO public.project_time_entries (workspace_id, project_id, task_id, user_id,
            entry_date, start_time, end_time, duration_minutes, description, billable, hourly_rate,
            source, external_id, status, locked_at, created_by, started_at, stopped_at)
          VALUES (p_workspace, (v->>'project_id')::uuid, (v->>'task_id')::uuid, (v->>'user_id')::uuid,
            (v->>'entry_date')::date, (v->>'start_time')::time, (v->>'end_time')::time,
            (v->>'duration_minutes')::int, v->>'description', COALESCE((v->>'billable')::boolean, true),
            (v->>'hourly_rate')::numeric, 'import', v->>'external_id',
            COALESCE(v->>'status', 'locked'),
            CASE WHEN COALESCE(v->>'status','locked') = 'locked' THEN now() END,
            (v->>'created_by')::uuid, (v->>'started_at')::timestamptz, (v->>'stopped_at')::timestamptz)
          RETURNING id INTO v_id;
        END IF;
      ELSE
        IF p_table = 'projects' THEN
          UPDATE public.projects SET name = v->>'name', description = v->>'description',
                 status = COALESCE((v->>'status')::public.project_status, status),
                 planned_hours = (v->>'planned_hours')::numeric,
                 metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(v->'metadata', '{}'::jsonb)
           WHERE id = (r->>'id')::uuid AND workspace_id = p_workspace
          RETURNING id INTO v_id;
        ELSIF p_table = 'project_tasks' THEN
          UPDATE public.project_tasks SET title = v->>'title',
                 status = COALESCE((v->>'status')::public.project_task_status, status),
                 estimated_hours = (v->>'estimated_hours')::numeric
           WHERE id = (r->>'id')::uuid AND workspace_id = p_workspace
          RETURNING id INTO v_id;
        ELSIF p_table = 'project_time_entries' THEN
          UPDATE public.project_time_entries SET project_id = (v->>'project_id')::uuid,
                 task_id = (v->>'task_id')::uuid, entry_date = (v->>'entry_date')::date,
                 start_time = (v->>'start_time')::time, end_time = (v->>'end_time')::time,
                 duration_minutes = (v->>'duration_minutes')::int, description = v->>'description',
                 billable = COALESCE((v->>'billable')::boolean, billable),
                 hourly_rate = (v->>'hourly_rate')::numeric,
                 started_at = (v->>'started_at')::timestamptz, stopped_at = (v->>'stopped_at')::timestamptz
           WHERE id = (r->>'id')::uuid AND workspace_id = p_workspace AND source = 'import'
          RETURNING id INTO v_id;
        ELSE
          RAISE EXCEPTION 'Atualização não permitida nesta tabela.';
        END IF;
        IF v_id IS NULL THEN RAISE EXCEPTION 'Registro de destino não encontrado.'; END IF;
      END IF;
      out := out || jsonb_build_array(jsonb_build_object('_key', v_key, 'id', v_id));
    EXCEPTION WHEN OTHERS THEN
      out := out || jsonb_build_array(jsonb_build_object('_key', v_key, 'error', SQLERRM, 'code', SQLSTATE));
    END;
  END LOOP;
  RETURN out;
END $$;
REVOKE EXECUTE ON FUNCTION public.clockify_import_apply(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clockify_import_apply(uuid, text, text, jsonb) TO service_role;

COMMENT ON TABLE public.clockify_staging_records IS 'Staging privado do Clockify: preserva tudo o que veio da origem, inclusive o que o ERP não suporta.';
COMMENT ON TABLE public.clockify_import_links IS 'Chave idempotente (workspace, origem, entidade, id externo, segmento) para reexecuções sem duplicar.';