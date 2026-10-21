-- TechProjects Ciclo 3 — parte 1: política de horas versionada, modelos de entrega por serviço,
-- aprovadores/delegação por projeto, alocação com vigência/capacidade, apontamento por duração
-- em segundos e fuso, guardas do fluxo de aprovação e cronômetro persistente com pausas.
-- Aditiva: nenhuma coluna removida/renomeada; colunas novas nulas ou com default constante
-- (sem reescrita dos 112 mil apontamentos). Importados (`locked`) continuam histórico bloqueado.

-- =========================================================== utilitários de autorização
CREATE OR REPLACE FUNCTION public.project_time_denied(p_user uuid, p_ws uuid, p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_job_roles ujr
      JOIN public.job_role_permission_overrides o ON o.role_id = ujr.role_id
     WHERE ujr.user_id = p_user AND (ujr.workspace_id = p_ws OR ujr.owner_id = p_ws)
       AND o.workspace_id = p_ws AND o.effect = 'deny' AND o.permission_key = p_key) $$;
REVOKE ALL ON FUNCTION public.project_time_denied(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_denied(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_time_assert_actor(p_ws uuid, p_write boolean)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE = '42501'; END IF;
  IF p_ws IS NULL OR NOT public.is_workspace_member(p_ws, auth.uid())
     OR NOT EXISTS (SELECT 1 FROM public.current_user_workspaces() AS w(id) WHERE w.id = p_ws) THEN
    RAISE EXCEPTION 'Disponível apenas para membros ativos do workspace ativo.' USING ERRCODE = '42501';
  END IF;
  IF p_write AND public.is_read_only_view() THEN
    RAISE EXCEPTION 'O modo Ver como é somente leitura.' USING ERRCODE = '42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.project_time_assert_actor(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_assert_actor(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_time_is_config_admin(p_ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.is_workspace_member(p_ws, auth.uid())
     AND (public.is_workspace_admin_v2(p_ws, auth.uid())
          OR public.user_has_permission(auth.uid(), p_ws, 'techprojects.projects.manage.workspace')) $$;
REVOKE ALL ON FUNCTION public.project_time_is_config_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_is_config_admin(uuid) TO authenticated;

-- =========================================================== eventos do fluxo (trilha)
CREATE TABLE public.project_time_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor uuid,
  subject_user_id uuid,
  project_id uuid,
  reason text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.project_time_workflow_events TO authenticated;
GRANT ALL ON public.project_time_workflow_events TO service_role;
ALTER TABLE public.project_time_workflow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ptwe_select ON public.project_time_workflow_events FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid())
         AND workspace_id IN (SELECT public.current_user_workspaces())
         AND (actor = auth.uid() OR subject_user_id = auth.uid()
              OR public.is_workspace_admin_v2(workspace_id, auth.uid())
              OR public.user_has_permission(auth.uid(), workspace_id, 'techprojects.time_entries.view.workspace')));
CREATE INDEX project_time_workflow_events_entity_idx ON public.project_time_workflow_events (entity_type, entity_id);
CREATE INDEX project_time_workflow_events_ws_idx ON public.project_time_workflow_events (workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.project_time_log(p_ws uuid, p_type text, p_id uuid, p_action text,
  p_subject uuid, p_project uuid, p_reason text, p_detail jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.project_time_workflow_events
    (workspace_id, entity_type, entity_id, action, actor, subject_user_id, project_id, reason, detail)
  VALUES (p_ws, p_type, p_id, p_action, auth.uid(), p_subject, p_project, p_reason, coalesce(p_detail, '{}'::jsonb)) $$;
REVOKE ALL ON FUNCTION public.project_time_log(uuid, text, uuid, text, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- =========================================================== política versionada
CREATE TABLE public.project_time_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  rules jsonb NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, version)
);
GRANT SELECT ON public.project_time_policies TO authenticated;
GRANT ALL ON public.project_time_policies TO service_role;
ALTER TABLE public.project_time_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY ptp_select ON public.project_time_policies FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid())
         AND workspace_id IN (SELECT public.current_user_workspaces()));

CREATE OR REPLACE FUNCTION public.project_time_policy_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'allow_self_approval', false,
    'track_requires_link', true,
    'duration_entries_allowed', true,
    'max_daily_seconds', 57600,
    'allocation_max_pct', 100,
    'paid_break_counts_as_productive', false,
    'paid_break_counts_as_presence', true,
    'submit_blocks_on_overlap', true,
    'submit_requires_approver', true,
    'closing_requires_client_acceptance', true) $$;

CREATE OR REPLACE FUNCTION public.project_time_policy_get(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_workspace_member(p_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso à política deste workspace.' USING ERRCODE = '42501';
  END IF;
  SELECT version, rules, created_at INTO v FROM public.project_time_policies
   WHERE workspace_id = p_ws ORDER BY version DESC LIMIT 1;
  RETURN public.project_time_policy_defaults() || coalesce(v.rules, '{}'::jsonb)
    || jsonb_build_object('version', coalesce(v.version, 0), 'saved_at', v.created_at);
END $$;
REVOKE ALL ON FUNCTION public.project_time_policy_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_policy_get(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_time_policy_save(p_ws uuid, p_rules jsonb, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; v_defaults jsonb := public.project_time_policy_defaults(); v_next int; v_rules jsonb := '{}'::jsonb;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, true);
  IF NOT public.is_workspace_admin_v2(p_ws, auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores ativos alteram a política de horas.' USING ERRCODE = '42501';
  END IF;
  IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'object' THEN RAISE EXCEPTION 'Regras inválidas.'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_rules) LOOP
    IF NOT v_defaults ? k THEN RAISE EXCEPTION 'Regra desconhecida: %', k; END IF;
    IF jsonb_typeof(p_rules->k) <> jsonb_typeof(v_defaults->k) THEN RAISE EXCEPTION 'Tipo inválido para %', k; END IF;
    v_rules := v_rules || jsonb_build_object(k, p_rules->k);
  END LOOP;
  IF (v_rules ? 'max_daily_seconds') AND ((v_rules->>'max_daily_seconds')::numeric < 3600 OR (v_rules->>'max_daily_seconds')::numeric > 86400) THEN
    RAISE EXCEPTION 'Limite diário deve ficar entre 1 h e 24 h.';
  END IF;
  IF (v_rules ? 'allocation_max_pct') AND ((v_rules->>'allocation_max_pct')::numeric < 1 OR (v_rules->>'allocation_max_pct')::numeric > 300) THEN
    RAISE EXCEPTION 'Percentual máximo de alocação deve ficar entre 1 e 300.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_time_policy:' || p_ws::text));
  SELECT coalesce(max(version), 0) + 1 INTO v_next FROM public.project_time_policies WHERE workspace_id = p_ws;
  INSERT INTO public.project_time_policies (workspace_id, version, rules, note, created_by)
  VALUES (p_ws, v_next, v_defaults || v_rules, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  PERFORM public.project_time_log(p_ws, 'time_policy', NULL, 'saved', NULL, NULL, p_note,
    jsonb_build_object('version', v_next, 'rules', v_defaults || v_rules));
  RETURN public.project_time_policy_get(p_ws);
END $$;
REVOKE ALL ON FUNCTION public.project_time_policy_save(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_policy_save(uuid, jsonb, text) TO authenticated;

-- =========================================================== modelos de entrega por serviço
CREATE TABLE public.project_delivery_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  delivery_kind text NOT NULL CHECK (delivery_kind IN ('capacity','scope','hunting','package','deliverables')),
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE TABLE public.project_delivery_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  template_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version),
  FOREIGN KEY (workspace_id, template_id) REFERENCES public.project_delivery_templates (workspace_id, id) ON DELETE CASCADE
);
CREATE TABLE public.project_delivery_template_services (
  workspace_id uuid NOT NULL,
  template_id uuid NOT NULL,
  service_catalog_id uuid NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, service_catalog_id),
  FOREIGN KEY (workspace_id, template_id) REFERENCES public.project_delivery_templates (workspace_id, id) ON DELETE CASCADE
);
GRANT SELECT ON public.project_delivery_templates, public.project_delivery_template_versions,
  public.project_delivery_template_services TO authenticated;
GRANT ALL ON public.project_delivery_templates, public.project_delivery_template_versions,
  public.project_delivery_template_services TO service_role;
ALTER TABLE public.project_delivery_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_delivery_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_delivery_template_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY pdt_select ON public.project_delivery_templates FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) AND workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY pdtv_select ON public.project_delivery_template_versions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) AND workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY pdts_select ON public.project_delivery_template_services FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) AND workspace_id IN (SELECT public.current_user_workspaces()));

CREATE OR REPLACE FUNCTION public.project_delivery_template_services_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.service_catalog s WHERE s.id = NEW.service_catalog_id AND s.workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'Serviço do catálogo fora do workspace.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_delivery_template_services_validate BEFORE INSERT OR UPDATE ON public.project_delivery_template_services
  FOR EACH ROW EXECUTE FUNCTION public.project_delivery_template_services_validate();

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS delivery_template_version_id uuid REFERENCES public.project_delivery_template_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS delivery_template_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_template_applied_by uuid,
  ADD COLUMN IF NOT EXISTS client_acceptance_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS template_item_key text;
ALTER TABLE public.project_milestones ADD COLUMN IF NOT EXISTS template_item_key text;
CREATE UNIQUE INDEX IF NOT EXISTS project_tasks_template_item_uniq ON public.project_tasks (project_id, template_item_key) WHERE template_item_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS project_milestones_template_item_uniq ON public.project_milestones (project_id, template_item_key) WHERE template_item_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.project_delivery_template_validate_definition(p_def jsonb)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE e jsonb; v_keys text[] := '{}';
BEGIN
  IF p_def IS NULL OR jsonb_typeof(p_def) <> 'object' THEN RAISE EXCEPTION 'Definição do modelo inválida.'; END IF;
  IF jsonb_typeof(coalesce(p_def->'milestones', '[]'::jsonb)) <> 'array' OR jsonb_typeof(coalesce(p_def->'tasks', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Marcos e tarefas devem ser listas.';
  END IF;
  IF jsonb_array_length(coalesce(p_def->'milestones', '[]'::jsonb)) > 50 OR jsonb_array_length(coalesce(p_def->'tasks', '[]'::jsonb)) > 200 THEN
    RAISE EXCEPTION 'Modelo grande demais (máx. 50 marcos e 200 tarefas).';
  END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(coalesce(p_def->'milestones', '[]'::jsonb))
           UNION ALL SELECT value FROM jsonb_array_elements(coalesce(p_def->'tasks', '[]'::jsonb)) LOOP
    IF coalesce(e->>'key', '') !~ '^[a-z0-9_]{1,40}$' THEN RAISE EXCEPTION 'Cada item precisa de uma chave (a-z, 0-9, _).'; END IF;
    IF length(btrim(coalesce(e->>'name', e->>'title', ''))) < 2 THEN RAISE EXCEPTION 'Item % sem nome.', e->>'key'; END IF;
    IF (e->>'key') = ANY (v_keys) THEN RAISE EXCEPTION 'Chave repetida: %', e->>'key'; END IF;
    v_keys := v_keys || (e->>'key');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.project_delivery_template_save(
  p_ws uuid, p_template uuid, p_name text, p_kind text, p_description text, p_active boolean,
  p_service_ids uuid[], p_definition jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := p_template; v_last record; v_ver int; v_bad int;
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, true);
  IF NOT public.project_time_is_config_admin(p_ws) THEN
    RAISE EXCEPTION 'Sem permissão para configurar modelos de entrega.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.project_delivery_template_validate_definition(p_definition);
  SELECT count(*) INTO v_bad FROM unnest(coalesce(p_service_ids, '{}')) sid
   WHERE NOT EXISTS (SELECT 1 FROM public.service_catalog s WHERE s.id = sid AND s.workspace_id = p_ws AND s.active);
  IF v_bad > 0 THEN RAISE EXCEPTION 'Use apenas serviços ativos do catálogo deste workspace.'; END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.project_delivery_templates (workspace_id, name, delivery_kind, description, active, created_by)
    VALUES (p_ws, btrim(p_name), p_kind, p_description, coalesce(p_active, true), auth.uid()) RETURNING id INTO v_id;
  ELSE
    UPDATE public.project_delivery_templates SET name = btrim(p_name), delivery_kind = p_kind,
           description = p_description, active = coalesce(p_active, active), updated_at = now()
     WHERE id = v_id AND workspace_id = p_ws;
    IF NOT FOUND THEN RAISE EXCEPTION 'Modelo não encontrado neste workspace.'; END IF;
  END IF;
  SELECT version, definition INTO v_last FROM public.project_delivery_template_versions
   WHERE template_id = v_id ORDER BY version DESC LIMIT 1 FOR UPDATE;
  IF v_last.version IS NULL OR v_last.definition IS DISTINCT FROM p_definition THEN
    v_ver := coalesce(v_last.version, 0) + 1;
    INSERT INTO public.project_delivery_template_versions (workspace_id, template_id, version, definition, created_by)
    VALUES (p_ws, v_id, v_ver, p_definition, auth.uid());
  ELSE
    v_ver := v_last.version;
  END IF;
  DELETE FROM public.project_delivery_template_services WHERE workspace_id = p_ws AND template_id = v_id
     AND NOT (service_catalog_id = ANY (coalesce(p_service_ids, '{}')));
  INSERT INTO public.project_delivery_template_services (workspace_id, template_id, service_catalog_id)
  SELECT p_ws, v_id, sid FROM unnest(coalesce(p_service_ids, '{}')) sid
  ON CONFLICT (workspace_id, service_catalog_id) DO UPDATE SET template_id = EXCLUDED.template_id;
  PERFORM public.project_time_log(p_ws, 'delivery_template', v_id, 'saved', NULL, NULL, NULL,
    jsonb_build_object('version', v_ver, 'services', to_jsonb(coalesce(p_service_ids, '{}'))));
  RETURN jsonb_build_object('template_id', v_id, 'version', v_ver);
END $$;
REVOKE ALL ON FUNCTION public.project_delivery_template_save(uuid, uuid, text, text, text, boolean, uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_delivery_template_save(uuid, uuid, text, text, text, boolean, uuid[], jsonb) TO authenticated;

-- Sugestão para o projeto: serviço do catálogo da linha de origem (negócio) — nunca por nome.
CREATE OR REPLACE FUNCTION public.project_delivery_template_suggest(p_project uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v jsonb;
BEGIN
  IF NOT public.project_visible_to_current_user(p_project) THEN RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = '42501'; END IF;
  SELECT pr.id, pr.workspace_id, pr.delivery_template_version_id, pr.delivery_template_applied_at, li.service_catalog_id,
         (SELECT count(*) FROM public.project_time_entries e WHERE e.project_id = pr.id AND e.source = 'import') AS imported_entries,
         (SELECT count(*) FROM public.project_tasks t WHERE t.project_id = pr.id) AS tasks
    INTO p FROM public.projects pr
    LEFT JOIN public.deal_line_items li ON li.id = pr.source_line_item_id AND li.workspace_id = pr.workspace_id
   WHERE pr.id = p_project;
  SELECT jsonb_build_object('template_id', t.id, 'name', t.name, 'kind', t.delivery_kind,
           'version_id', v2.id, 'version', v2.version, 'definition', v2.definition)
    INTO v
    FROM public.project_delivery_template_services s
    JOIN public.project_delivery_templates t ON t.id = s.template_id AND t.active
    JOIN LATERAL (SELECT * FROM public.project_delivery_template_versions x WHERE x.template_id = t.id ORDER BY version DESC LIMIT 1) v2 ON true
   WHERE s.workspace_id = p.workspace_id AND s.service_catalog_id = p.service_catalog_id;
  RETURN jsonb_build_object('applied_version_id', p.delivery_template_version_id, 'applied_at', p.delivery_template_applied_at,
    'service_catalog_id', p.service_catalog_id, 'suggestion', v,
    'imported_entries', p.imported_entries, 'tasks', p.tasks);
END $$;
REVOKE ALL ON FUNCTION public.project_delivery_template_suggest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_delivery_template_suggest(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_delivery_template_apply(p_project uuid, p_version uuid, p_confirm_imported boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v record; e jsonb; v_ms int := 0; v_tk int := 0; v_n int; v_prefix text; v_base date;
BEGIN
  SELECT id, workspace_id, delivery_template_version_id, starts_at INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  PERFORM public.project_time_assert_actor(p.workspace_id, true);
  IF NOT public.project_editable_by_current_user(p_project) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este projeto.' USING ERRCODE = '42501';
  END IF;
  SELECT tv.id, tv.version, tv.definition, t.name, t.delivery_kind, t.active INTO v
    FROM public.project_delivery_template_versions tv JOIN public.project_delivery_templates t ON t.id = tv.template_id
   WHERE tv.id = p_version AND tv.workspace_id = p.workspace_id;
  IF v.id IS NULL OR NOT v.active THEN RAISE EXCEPTION 'Modelo inexistente ou inativo neste workspace.'; END IF;
  IF p.delivery_template_version_id IS NOT NULL THEN
    IF p.delivery_template_version_id = p_version THEN RETURN jsonb_build_object('already_applied', true, 'milestones', 0, 'tasks', 0); END IF;
    RAISE EXCEPTION 'Este projeto já tem outro modelo aplicado; a troca não é automática.';
  END IF;
  IF NOT coalesce(p_confirm_imported, false) AND EXISTS (SELECT 1 FROM public.project_time_entries WHERE project_id = p_project AND source = 'import') THEN
    RAISE EXCEPTION 'Projeto com horas importadas: confirme explicitamente para aplicar o modelo.' USING ERRCODE = 'P0001';
  END IF;
  v_prefix := 'tpl:' || v.id::text || ':';
  v_base := coalesce(p.starts_at, current_date);
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(v.definition->'milestones', '[]'::jsonb)) LOOP
    INSERT INTO public.project_milestones (workspace_id, project_id, name, description, due_at, status, sort_order, template_item_key)
    VALUES (p.workspace_id, p_project, btrim(e->>'name'), e->>'description',
            CASE WHEN (e->>'offset_days') ~ '^\d{1,4}$' THEN v_base + (e->>'offset_days')::int END,
            'pending', coalesce((e->>'order')::int, v_ms), v_prefix || (e->>'key'))
    ON CONFLICT (project_id, template_item_key) WHERE template_item_key IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_ms := v_ms + v_n;
  END LOOP;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(v.definition->'tasks', '[]'::jsonb)) LOOP
    INSERT INTO public.project_tasks (workspace_id, project_id, title, description, status, estimated_hours, milestone_id, sort_order, template_item_key)
    VALUES (p.workspace_id, p_project, btrim(e->>'title'), e->>'description', 'todo',
            CASE WHEN (e->>'estimated_hours') ~ '^\d+(\.\d+)?$' THEN (e->>'estimated_hours')::numeric END,
            (SELECT m.id FROM public.project_milestones m WHERE m.project_id = p_project AND m.template_item_key = v_prefix || (e->>'milestone_key')),
            coalesce((e->>'order')::int, v_tk), v_prefix || (e->>'key'))
    ON CONFLICT (project_id, template_item_key) WHERE template_item_key IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_tk := v_tk + v_n;
  END LOOP;
  UPDATE public.projects SET delivery_template_version_id = p_version, delivery_template_applied_at = now(),
         delivery_template_applied_by = auth.uid(),
         client_acceptance_required = client_acceptance_required OR coalesce((v.definition->>'client_acceptance')::boolean, false)
   WHERE id = p_project;
  PERFORM public.project_time_log(p.workspace_id, 'project', p_project, 'delivery_template_applied', NULL, p_project, NULL,
    jsonb_build_object('version_id', p_version, 'template', v.name, 'version', v.version, 'milestones', v_ms, 'tasks', v_tk));
  RETURN jsonb_build_object('already_applied', false, 'milestones', v_ms, 'tasks', v_tk);
END $$;
REVOKE ALL ON FUNCTION public.project_delivery_template_apply(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_delivery_template_apply(uuid, uuid, boolean) TO authenticated;

-- =========================================================== aprovadores e gestores por projeto
CREATE TABLE public.project_time_approvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('approver','operational_manager')),
  user_id uuid NOT NULL,
  subject_user_id uuid,
  delegate_of uuid REFERENCES public.project_time_approvers(id) ON DELETE CASCADE,
  valid_from date NOT NULL DEFAULT current_date,
  valid_to date,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (delegate_of IS NULL OR length(btrim(coalesce(reason, ''))) >= 3)
);
CREATE INDEX project_time_approvers_project_idx ON public.project_time_approvers (project_id) WHERE revoked_at IS NULL;
CREATE INDEX project_time_approvers_user_idx ON public.project_time_approvers (user_id) WHERE revoked_at IS NULL;
GRANT SELECT ON public.project_time_approvers TO authenticated;
GRANT ALL ON public.project_time_approvers TO service_role;
ALTER TABLE public.project_time_approvers ENABLE ROW LEVEL SECURITY;
CREATE POLICY ptap_select ON public.project_time_approvers FOR SELECT TO authenticated
  USING (public.project_visible_to_current_user(project_id) OR user_id = auth.uid() OR subject_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.project_time_approver_row_active(a public.project_time_approvers, p_day date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.revoked_at IS NULL AND a.valid_from <= p_day AND (a.valid_to IS NULL OR a.valid_to >= p_day)
     AND public.is_workspace_member(a.workspace_id, a.user_id)
     AND (a.delegate_of IS NULL OR EXISTS (
           SELECT 1 FROM public.project_time_approvers o
            WHERE o.id = a.delegate_of AND o.revoked_at IS NULL AND o.valid_from <= p_day
              AND (o.valid_to IS NULL OR o.valid_to >= p_day))) $$;

-- Autorização para decidir um apontamento: aprovador explícito (ou delegado vigente), membro ativo,
-- sem negação de aprovação no cargo, e nunca o próprio profissional (salvo política explícita).
CREATE OR REPLACE FUNCTION public.project_time_can_approve(p_actor uuid, p_project uuid, p_subject uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid; v_pol jsonb;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.projects WHERE id = p_project;
  IF v_ws IS NULL OR p_actor IS NULL OR NOT public.is_workspace_member(v_ws, p_actor) THEN RETURN false; END IF;
  IF public.project_time_denied(p_actor, v_ws, 'techprojects.time_entries.approve.workspace')
     OR public.project_time_denied(p_actor, v_ws, 'techprojects.timesheet.approve.workspace') THEN RETURN false; END IF;
  SELECT public.project_time_policy_defaults() || coalesce((SELECT rules FROM public.project_time_policies
          WHERE workspace_id = v_ws ORDER BY version DESC LIMIT 1), '{}'::jsonb) INTO v_pol;
  IF p_subject IS NOT NULL AND p_actor = p_subject AND NOT coalesce((v_pol->>'allow_self_approval')::boolean, false) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.project_time_approvers a
                  WHERE a.project_id = p_project AND a.role = 'approver' AND a.user_id = p_actor
                    AND (p_subject IS NULL OR a.subject_user_id IS NULL OR a.subject_user_id = p_subject)
                    AND public.project_time_approver_row_active(a, current_date));
END $$;
REVOKE ALL ON FUNCTION public.project_time_can_approve(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_can_approve(uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_time_has_approver(p_project uuid, p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_time_approvers a
                  WHERE a.project_id = p_project AND a.role = 'approver'
                    AND (a.subject_user_id IS NULL OR a.subject_user_id = p_subject)
                    AND a.user_id IS DISTINCT FROM p_subject
                    AND public.project_time_approver_row_active(a, current_date)) $$;

CREATE OR REPLACE FUNCTION public.project_time_approver_set(
  p_project uuid, p_user uuid, p_role text, p_subject uuid, p_from date, p_to date, p_reason text, p_delegate_of uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid; v_id uuid; o record; v_osubj uuid;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.projects WHERE id = p_project;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  PERFORM public.project_time_assert_actor(v_ws, true);
  IF NOT (public.project_time_is_config_admin(v_ws) OR EXISTS (
            SELECT 1 FROM public.project_members m WHERE m.project_id = p_project AND m.user_id = auth.uid() AND m.role_in_project = 'manager')) THEN
    RAISE EXCEPTION 'Apenas gestores do projeto ou administradores configuram aprovadores.' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('approver','operational_manager') THEN RAISE EXCEPTION 'Papel inválido.'; END IF;
  IF NOT public.is_workspace_member(v_ws, p_user) THEN RAISE EXCEPTION 'A pessoa precisa ser membro ativo do workspace.'; END IF;
  IF p_subject IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_ws AND user_id = p_subject) THEN
    RAISE EXCEPTION 'Profissional fora do workspace.';
  END IF;
  IF p_subject IS NOT NULL AND p_subject = p_user THEN RAISE EXCEPTION 'Ninguém é aprovador das próprias horas.'; END IF;
  IF p_delegate_of IS NOT NULL THEN
    SELECT * INTO o FROM public.project_time_approvers WHERE id = p_delegate_of AND project_id = p_project AND revoked_at IS NULL;
    IF o.id IS NULL THEN RAISE EXCEPTION 'Aprovação original não encontrada ou revogada.'; END IF;
    IF o.user_id = p_user THEN RAISE EXCEPTION 'Delegação para a mesma pessoa.'; END IF;
    IF p_to IS NULL THEN RAISE EXCEPTION 'Delegação exige data final.'; END IF;
    IF length(btrim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo da delegação.'; END IF;
    v_osubj := o.subject_user_id;
  END IF;
  INSERT INTO public.project_time_approvers (workspace_id, project_id, role, user_id, subject_user_id, delegate_of,
         valid_from, valid_to, reason, created_by)
  VALUES (v_ws, p_project, p_role, p_user,
          coalesce(p_subject, v_osubj), p_delegate_of,
          coalesce(p_from, current_date), p_to, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.project_time_log(v_ws, 'approver', v_id, CASE WHEN p_delegate_of IS NULL THEN 'assigned' ELSE 'delegated' END,
    p_user, p_project, p_reason, jsonb_build_object('role', p_role, 'subject_user_id', p_subject, 'from', p_from, 'to', p_to, 'delegate_of', p_delegate_of));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.project_time_approver_set(uuid, uuid, text, uuid, date, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_approver_set(uuid, uuid, text, uuid, date, date, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.project_time_approver_revoke(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.project_time_approvers WHERE id = p_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Registro não encontrado.'; END IF;
  PERFORM public.project_time_assert_actor(a.workspace_id, true);
  IF NOT (public.project_time_is_config_admin(a.workspace_id) OR EXISTS (
            SELECT 1 FROM public.project_members m WHERE m.project_id = a.project_id AND m.user_id = auth.uid() AND m.role_in_project = 'manager')) THEN
    RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501';
  END IF;
  IF a.revoked_at IS NOT NULL THEN RETURN; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
  UPDATE public.project_time_approvers SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = btrim(p_reason) WHERE id = p_id;
  PERFORM public.project_time_log(a.workspace_id, 'approver', p_id, 'revoked', a.user_id, a.project_id, p_reason, '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.project_time_approver_revoke(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_approver_revoke(uuid, text) TO authenticated;

-- =========================================================== alocação com vigência e capacidade
ALTER TABLE public.people_allocations
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hours_per_week numeric CHECK (hours_per_week IS NULL OR (hours_per_week > 0 AND hours_per_week <= 168)),
  ADD COLUMN IF NOT EXISTS hours_per_month numeric CHECK (hours_per_month IS NULL OR (hours_per_month > 0 AND hours_per_month <= 744)),
  ADD COLUMN IF NOT EXISTS calendar jsonb,
  ADD COLUMN IF NOT EXISTS can_track_time boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS overbook_justification text;
-- Jornada do People (fonte da capacidade). Nula = não configurada: nenhuma meta é presumida.
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS work_schedule jsonb;
CREATE INDEX IF NOT EXISTS idx_people_allocations_project ON public.people_allocations (project_id) WHERE project_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.project_time_schedule_valid(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p IS NULL OR (jsonb_typeof(p) = 'object' AND NOT EXISTS (
    SELECT 1 FROM jsonb_each(p) kv
     WHERE kv.key NOT IN ('mon','tue','wed','thu','fri','sat','sun','tz')
        OR (kv.key <> 'tz' AND (jsonb_typeof(kv.value) <> 'number' OR (kv.value)::text::numeric < 0 OR (kv.value)::text::numeric > 86400))
        OR (kv.key = 'tz' AND jsonb_typeof(kv.value) <> 'string'))) $$;
ALTER TABLE public.people ADD CONSTRAINT people_work_schedule_valid CHECK (public.project_time_schedule_valid(work_schedule)) NOT VALID;
ALTER TABLE public.people_allocations ADD CONSTRAINT people_allocations_calendar_valid CHECK (public.project_time_schedule_valid(calendar)) NOT VALID;

CREATE OR REPLACE FUNCTION public.people_allocations_cycle3_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid; v_pws uuid; v_contract uuid; v_sum numeric; v_max numeric; v_relevant boolean;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT id, workspace_id, contract_id INTO v_pid, v_pws, v_contract FROM public.projects WHERE id = NEW.project_id;
    IF v_pid IS NULL OR v_pws IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'Projeto da alocação fora do workspace.';
    END IF;
  END IF;
  IF NEW.person_id IS NOT NULL AND NEW.workspace_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.people pe WHERE pe.id = NEW.person_id AND (pe.workspace_id = NEW.workspace_id OR pe.owner_id = NEW.workspace_id)) THEN
    RAISE EXCEPTION 'Pessoa da alocação fora do workspace.';
  END IF;
  IF NEW.service_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.workspace_id = NEW.workspace_id) THEN
      RAISE EXCEPTION 'Serviço da alocação fora do workspace.';
    END IF;
    IF v_contract IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.contract_id = v_contract) THEN
      RAISE EXCEPTION 'O serviço não pertence ao contrato do projeto.';
    END IF;
  END IF;
  IF NEW.ends_at IS NOT NULL AND NEW.starts_at IS NOT NULL AND NEW.ends_at < NEW.starts_at THEN
    RAISE EXCEPTION 'Fim da alocação antes do início.';
  END IF;
  v_relevant := NEW.status = 'active' AND NEW.person_id IS NOT NULL AND (TG_OP = 'INSERT'
    OR NEW.allocation_pct IS DISTINCT FROM OLD.allocation_pct OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
    OR NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.person_id IS DISTINCT FROM OLD.person_id
    OR NEW.status IS DISTINCT FROM OLD.status);
  IF v_relevant THEN
    v_max := coalesce((public.project_time_policy_defaults() || coalesce((SELECT rules FROM public.project_time_policies
               WHERE workspace_id = NEW.workspace_id ORDER BY version DESC LIMIT 1), '{}'::jsonb))->>'allocation_max_pct', '100')::numeric;
    SELECT coalesce(max(day_sum), 0) INTO v_sum FROM (
      SELECT d, sum(coalesce(a.allocation_pct, 100)) AS day_sum
        FROM (SELECT generate_series(coalesce(NEW.starts_at, current_date),
                       coalesce(NEW.ends_at, coalesce(NEW.starts_at, current_date) + 365), interval '1 day')::date AS d) days
        JOIN public.people_allocations a ON a.person_id = NEW.person_id AND a.status = 'active' AND a.id IS DISTINCT FROM NEW.id
         AND (a.starts_at IS NULL OR a.starts_at <= days.d) AND (a.ends_at IS NULL OR a.ends_at >= days.d)
       GROUP BY d) x;
    IF v_sum + coalesce(NEW.allocation_pct, 100) > v_max AND length(btrim(coalesce(NEW.overbook_justification, ''))) < 5 THEN
      RAISE EXCEPTION 'Alocação soma % %% em algum dia (limite % %%). Informe a justificativa para exceder.',
        round(v_sum + coalesce(NEW.allocation_pct, 100)), round(v_max) USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER people_allocations_cycle3_validate BEFORE INSERT OR UPDATE ON public.people_allocations
  FOR EACH ROW EXECUTE FUNCTION public.people_allocations_cycle3_validate();

-- Consulta de capacidade/sobreposição (RLS do chamador nas alocações).
CREATE OR REPLACE FUNCTION public.people_allocation_capacity(p_person uuid, p_from date, p_to date, p_exclude uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH al AS (
    SELECT a.id, a.project_id, a.allocation_pct, a.starts_at, a.ends_at, a.hours_per_week, pr.name AS project_name
      FROM public.people_allocations a LEFT JOIN public.projects pr ON pr.id = a.project_id
     WHERE a.person_id = p_person AND a.status = 'active' AND a.id IS DISTINCT FROM p_exclude
       AND (a.starts_at IS NULL OR a.starts_at <= p_to) AND (a.ends_at IS NULL OR a.ends_at >= p_from)),
  days AS (SELECT generate_series(p_from, p_to, interval '1 day')::date AS d),
  per_day AS (SELECT d, coalesce(sum(coalesce(al.allocation_pct, 100)), 0) AS pct FROM days
                LEFT JOIN al ON (al.starts_at IS NULL OR al.starts_at <= d) AND (al.ends_at IS NULL OR al.ends_at >= d) GROUP BY d)
  SELECT jsonb_build_object(
    'allocations', coalesce((SELECT jsonb_agg(to_jsonb(al) ORDER BY al.starts_at) FROM al), '[]'::jsonb),
    'max_pct', coalesce((SELECT max(pct) FROM per_day), 0),
    'schedule_configured', (SELECT pe.work_schedule IS NOT NULL FROM public.people pe WHERE pe.id = p_person)) $$;
REVOKE ALL ON FUNCTION public.people_allocation_capacity(uuid, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.people_allocation_capacity(uuid, date, date, uuid) TO authenticated;

-- Quem pode apontar em um projeto: membro com apontamento liberado ou alocação ativa vigente na data.
CREATE OR REPLACE FUNCTION public.project_time_can_track(p_user uuid, p_project uuid, p_day date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members m
                  WHERE m.project_id = p_project AND m.user_id = p_user AND m.can_track_time IS NOT FALSE)
      OR EXISTS (SELECT 1 FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
                   JOIN public.projects pr ON pr.id = a.project_id
                  WHERE a.project_id = p_project AND pe.profile_id = p_user AND a.status = 'active' AND a.can_track_time
                    AND a.workspace_id = pr.workspace_id
                    AND (a.starts_at IS NULL OR a.starts_at <= p_day) AND (a.ends_at IS NULL OR a.ends_at >= p_day)) $$;
REVOKE ALL ON FUNCTION public.project_time_can_track(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_time_can_track(uuid, uuid, date) TO authenticated;

-- =========================================================== favoritos de apontamento
CREATE TABLE public.project_time_favorites (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);
GRANT SELECT, INSERT, DELETE ON public.project_time_favorites TO authenticated;
GRANT ALL ON public.project_time_favorites TO service_role;
ALTER TABLE public.project_time_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY ptf_select ON public.project_time_favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY ptf_insert ON public.project_time_favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()) AND NOT public.is_read_only_view()
              AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.workspace_id = project_time_favorites.workspace_id));
CREATE POLICY ptf_delete ON public.project_time_favorites FOR DELETE TO authenticated USING (user_id = auth.uid() AND NOT public.is_read_only_view());

-- =========================================================== apontamento: colunas aditivas
CREATE TABLE public.project_timer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  description text,
  billable boolean NOT NULL DEFAULT true,
  timezone text NOT NULL,
  state text NOT NULL CHECK (state IN ('running','paused','stopped','discarded')),
  started_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  client_request_id text,
  policy_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX project_timer_sessions_one_active ON public.project_timer_sessions (workspace_id, user_id) WHERE state IN ('running','paused');
CREATE UNIQUE INDEX project_timer_sessions_request ON public.project_timer_sessions (workspace_id, user_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE TABLE public.project_timer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.project_timer_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('work','break_paid','break_unpaid')),
  task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX project_timer_segments_one_open ON public.project_timer_segments (session_id) WHERE ended_at IS NULL;
CREATE INDEX project_timer_segments_session_idx ON public.project_timer_segments (session_id, started_at);
GRANT SELECT ON public.project_timer_sessions, public.project_timer_segments TO authenticated;
GRANT ALL ON public.project_timer_sessions, public.project_timer_segments TO service_role;
ALTER TABLE public.project_timer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_timer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ptsess_select ON public.project_timer_sessions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) AND workspace_id IN (SELECT public.current_user_workspaces())
         AND (user_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())));
CREATE POLICY ptseg_select ON public.project_timer_segments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_timer_sessions s WHERE s.id = session_id));

ALTER TABLE public.project_time_entries
  ADD COLUMN IF NOT EXISTS entry_kind text CHECK (entry_kind IS NULL OR entry_kind IN ('interval','duration','timer')),
  ADD COLUMN IF NOT EXISTS duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submission_id uuid,
  ADD COLUMN IF NOT EXISTS period_closing_id uuid,
  ADD COLUMN IF NOT EXISTS client_acceptance_id uuid,
  ADD COLUMN IF NOT EXISTS timer_session_id uuid REFERENCES public.project_timer_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_flags text[];
COMMENT ON COLUMN public.project_time_entries.entry_kind IS 'interval = início/fim informados; duration = só duração (sem posição no dia, sobreposição não verificável); timer = cronômetro (UTC exato). Nulo = registro anterior ao ciclo 3.';
COMMENT ON COLUMN public.project_time_entries.duration_seconds IS 'Duração canônica em segundos para registros novos. Importados preservam started_at/stopped_at e não são reescritos.';
CREATE INDEX IF NOT EXISTS project_time_entries_submission_idx ON public.project_time_entries (submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_time_entries_closing_idx ON public.project_time_entries (period_closing_id) WHERE period_closing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_time_entries_ws_date_idx ON public.project_time_entries (workspace_id, entry_date);

CREATE OR REPLACE FUNCTION public.project_time_tz_valid(p text)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  IF p IS NULL THEN RETURN true; END IF;
  PERFORM now() AT TIME ZONE p;
  RETURN p ~ '^[A-Za-z_]+(/[A-Za-z0-9_+\-]+)*$';
EXCEPTION WHEN others THEN RETURN false;
END $$;
