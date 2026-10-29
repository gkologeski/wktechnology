-- Importador ClickUp -> TechProjects (aditivo). Leitura do ClickUp no servidor, staging privado,
-- revisão humana e gravação/desfazer somente por RPCs que conferem a permissão no banco.

INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system) VALUES
('techprojects.clickup_import.view.workspace','techprojects','clickup_import','view','workspace','Visualizar importador ClickUp — workspace',true),
('techprojects.clickup_import.manage.workspace','techprojects','clickup_import','manage','workspace','Gerenciar importador ClickUp — workspace',true)
ON CONFLICT(key) DO NOTHING;

-- Acesso: membro ativo do workspace, chave efetiva (deny prevalece) via work_subject_context.
CREATE OR REPLACE FUNCTION public.clickup_import_access(p_ws uuid, p_user uuid, p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE c jsonb;
BEGIN
  IF p_ws IS NULL OR p_user IS NULL OR p_action NOT IN ('view','manage') THEN RETURN false; END IF;
  c := work_subject_context(p_ws, p_user);
  IF c IS NULL OR c->>'actor' IS NULL THEN RETURN false; END IF;
  IF p_action = 'view' THEN
    RETURN COALESCE(c->'keys' ? 'techprojects.clickup_import.view.workspace'
                 OR c->'keys' ? 'techprojects.clickup_import.manage.workspace', false);
  END IF;
  RETURN COALESCE(c->'keys' ? 'techprojects.clickup_import.manage.workspace', false);
END $$;
REVOKE ALL ON FUNCTION public.clickup_import_access(uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clickup_import_access(uuid,uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.clickup_import_require(p_ws uuid, p_action text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.clickup_import_access(p_ws, auth.uid(), p_action) THEN
    RAISE EXCEPTION 'Sem permissão para o importador do ClickUp.' USING ERRCODE='42501';
  END IF;
  IF p_action = 'manage' AND public.is_read_only_view() THEN
    RAISE EXCEPTION 'Modo somente leitura: a importação não pode ser alterada.' USING ERRCODE='42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.clickup_import_require(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clickup_import_require(uuid,text) TO authenticated, service_role;

-- 1) Execuções
CREATE TABLE public.clickup_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting','planned','applying','applied','rolling_back','rolled_back','discarded','failed')),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  requested_by uuid NOT NULL,
  confirmed_by uuid,
  confirmed_at timestamptz,
  applied_at timestamptz,
  rolled_back_by uuid,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clickup_import_runs_ws_idx ON public.clickup_import_runs (workspace_id, created_at DESC);
CREATE UNIQUE INDEX clickup_import_runs_one_open ON public.clickup_import_runs (workspace_id)
  WHERE status IN ('collecting','planned','applying','rolling_back');
GRANT SELECT ON public.clickup_import_runs TO authenticated;
GRANT ALL ON public.clickup_import_runs TO service_role;
ALTER TABLE public.clickup_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY clickup_runs_read ON public.clickup_import_runs FOR SELECT TO authenticated
  USING (public.clickup_import_access(workspace_id, (SELECT auth.uid()), 'view'));

-- 2) Grupos = listas do ClickUp com o destino proposto/decidido
CREATE TABLE public.clickup_import_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.clickup_import_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  team_id text NOT NULL, team_name text NOT NULL,
  space_ext_id text NOT NULL, space_name text NOT NULL,
  folder_ext_id text, folder_name text,
  list_ext_id text NOT NULL, list_name text NOT NULL,
  task_count integer NOT NULL DEFAULT 0,
  closed_count integer NOT NULL DEFAULT 0,
  clockify_refs integer NOT NULL DEFAULT 0,
  action text NOT NULL DEFAULT 'import' CHECK (action IN ('import','skip')),
  reason text,
  target_space_id uuid REFERENCES public.project_spaces(id) ON DELETE SET NULL,
  new_space_name text,
  target_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  new_project_name text,
  new_project_status public.project_status,
  erp_list_name text NOT NULL,
  erp_space_id uuid, erp_project_id uuid, erp_list_id uuid,
  decided_by uuid, decided_at timestamptz,
  UNIQUE (run_id, list_ext_id),
  CHECK (action = 'skip' OR ((target_space_id IS NOT NULL OR nullif(btrim(new_space_name),'') IS NOT NULL)
     AND (target_project_id IS NOT NULL OR nullif(btrim(new_project_name),'') IS NOT NULL)))
);
CREATE INDEX clickup_import_groups_run_idx ON public.clickup_import_groups (run_id);
GRANT SELECT ON public.clickup_import_groups TO authenticated;
GRANT ALL ON public.clickup_import_groups TO service_role;
ALTER TABLE public.clickup_import_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY clickup_groups_read ON public.clickup_import_groups FOR SELECT TO authenticated
  USING (public.clickup_import_access(workspace_id, (SELECT auth.uid()), 'view'));

-- 3) Tarefas lidas (somente campos usados; staging privado)
CREATE TABLE public.clickup_import_tasks (
  run_id uuid NOT NULL REFERENCES public.clickup_import_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  external_id text NOT NULL CHECK (external_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  list_ext_id text NOT NULL,
  parent_external_id text,
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, external_id)
);
CREATE INDEX clickup_import_tasks_list_idx ON public.clickup_import_tasks (run_id, list_ext_id);
GRANT SELECT ON public.clickup_import_tasks TO authenticated;
GRANT ALL ON public.clickup_import_tasks TO service_role;
ALTER TABLE public.clickup_import_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY clickup_tasks_read ON public.clickup_import_tasks FOR SELECT TO authenticated
  USING (public.clickup_import_access(workspace_id, (SELECT auth.uid()), 'view'));

-- 4) Responsáveis do ClickUp -> pessoas do workspace (decisão persiste entre execuções)
CREATE TABLE public.clickup_import_people (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  clickup_user_id bigint NOT NULL,
  username text,
  email text,
  task_count integer NOT NULL DEFAULT 0,
  user_id uuid,
  status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('confirmed','suggested','unmatched','ignored')),
  match_reason text,
  decided_by uuid, decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, clickup_user_id),
  CHECK (status NOT IN ('confirmed','suggested') OR user_id IS NOT NULL)
);
GRANT SELECT ON public.clickup_import_people TO authenticated;
GRANT ALL ON public.clickup_import_people TO service_role;
ALTER TABLE public.clickup_import_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY clickup_people_read ON public.clickup_import_people FOR SELECT TO authenticated
  USING (public.clickup_import_access(workspace_id, (SELECT auth.uid()), 'view'));

-- 5) Vínculo idempotente ClickUp -> ERP (nunca duplica entre execuções)
CREATE TABLE public.clickup_import_links (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('task','list')),
  external_id text NOT NULL,
  target_id uuid NOT NULL,
  created_run_id uuid REFERENCES public.clickup_import_runs(id) ON DELETE SET NULL,
  imported_updated_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, entity_type, external_id)
);
CREATE INDEX clickup_import_links_run_idx ON public.clickup_import_links (created_run_id, entity_type);
CREATE INDEX clickup_import_links_target_idx ON public.clickup_import_links (target_id);
GRANT SELECT ON public.clickup_import_links TO authenticated;
GRANT ALL ON public.clickup_import_links TO service_role;
ALTER TABLE public.clickup_import_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY clickup_links_read ON public.clickup_import_links FOR SELECT TO authenticated
  USING (public.clickup_import_access(workspace_id, (SELECT auth.uid()), 'view'));

-- 6) Estrutura criada pela execução (para desfazer)
CREATE TABLE public.clickup_import_created (
  run_id uuid NOT NULL REFERENCES public.clickup_import_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  target_table text NOT NULL CHECK (target_table IN ('project_spaces','projects','project_lists')),
  target_id uuid NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, target_table, target_id)
);
GRANT SELECT ON public.clickup_import_created TO authenticated;
GRANT ALL ON public.clickup_import_created TO service_role;
ALTER TABLE public.clickup_import_created ENABLE ROW LEVEL SECURITY;
CREATE POLICY clickup_created_read ON public.clickup_import_created FOR SELECT TO authenticated
  USING (public.clickup_import_access(workspace_id, (SELECT auth.uid()), 'view'));

-- RPC: iniciar leitura (descarta prévia anterior ainda não aplicada)
CREATE OR REPLACE FUNCTION public.clickup_import_start(p_ws uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM clickup_import_require(p_ws, 'manage');
  IF EXISTS (SELECT 1 FROM clickup_import_runs WHERE workspace_id=p_ws AND status IN ('applying','rolling_back')) THEN
    RAISE EXCEPTION 'Há uma importação em andamento. Conclua ou desfaça antes de ler de novo.';
  END IF;
  UPDATE clickup_import_runs SET status='discarded', updated_at=now()
   WHERE workspace_id=p_ws AND status IN ('collecting','planned');
  INSERT INTO clickup_import_runs(workspace_id, requested_by) VALUES (p_ws, auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- RPC: gravar lote lido (grupos, tarefas, pessoas)
CREATE OR REPLACE FUNCTION public.clickup_import_stage(p_run uuid, p_groups jsonb, p_tasks jsonb, p_people jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r clickup_import_runs; g jsonb; t jsonb; p jsonb; ng int:=0; nt int:=0; np int:=0;
BEGIN
  SELECT * INTO r FROM clickup_import_runs WHERE id=p_run;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Importação não encontrada.'; END IF;
  PERFORM clickup_import_require(r.workspace_id, 'manage');
  IF r.status <> 'collecting' THEN RAISE EXCEPTION 'A leitura desta importação já terminou.'; END IF;
  IF jsonb_array_length(coalesce(p_tasks,'[]'))>500 OR jsonb_array_length(coalesce(p_groups,'[]'))>500 THEN
    RAISE EXCEPTION 'Lote grande demais.';
  END IF;
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p_groups,'[]')) LOOP
    INSERT INTO clickup_import_groups(run_id, workspace_id, team_id, team_name, space_ext_id, space_name,
      folder_ext_id, folder_name, list_ext_id, list_name, task_count, closed_count, clockify_refs, action, reason,
      target_space_id, new_space_name, target_project_id, new_project_name, new_project_status, erp_list_name)
    VALUES (p_run, r.workspace_id, g->>'team_id', g->>'team_name', g->>'space_ext_id', g->>'space_name',
      g->>'folder_ext_id', g->>'folder_name', g->>'list_ext_id', g->>'list_name',
      coalesce((g->>'task_count')::int,0), coalesce((g->>'closed_count')::int,0), coalesce((g->>'clockify_refs')::int,0),
      coalesce(g->>'action','import'), g->>'reason',
      (SELECT id FROM project_spaces WHERE id=nullif(g->>'target_space_id','')::uuid AND workspace_id=r.workspace_id),
      g->>'new_space_name',
      (SELECT id FROM projects WHERE id=nullif(g->>'target_project_id','')::uuid AND workspace_id=r.workspace_id),
      g->>'new_project_name', nullif(g->>'new_project_status','')::project_status, g->>'erp_list_name')
    ON CONFLICT (run_id, list_ext_id) DO UPDATE SET task_count=EXCLUDED.task_count, closed_count=EXCLUDED.closed_count,
      clockify_refs=EXCLUDED.clockify_refs;
    ng := ng+1;
  END LOOP;
  FOR t IN SELECT * FROM jsonb_array_elements(coalesce(p_tasks,'[]')) LOOP
    INSERT INTO clickup_import_tasks(run_id, workspace_id, external_id, list_ext_id, parent_external_id, payload)
    VALUES (p_run, r.workspace_id, t->>'id', t->>'list_ext_id', nullif(t->>'parent',''), t->'payload')
    ON CONFLICT (run_id, external_id) DO UPDATE SET payload=EXCLUDED.payload, list_ext_id=EXCLUDED.list_ext_id,
      parent_external_id=EXCLUDED.parent_external_id;
    nt := nt+1;
  END LOOP;
  FOR p IN SELECT * FROM jsonb_array_elements(coalesce(p_people,'[]')) LOOP
    INSERT INTO clickup_import_people(workspace_id, clickup_user_id, username, email, task_count)
    VALUES (r.workspace_id, (p->>'id')::bigint, p->>'username', lower(nullif(btrim(p->>'email'),'')), coalesce((p->>'task_count')::int,0))
    ON CONFLICT (workspace_id, clickup_user_id) DO UPDATE SET username=EXCLUDED.username, email=EXCLUDED.email,
      task_count=EXCLUDED.task_count, updated_at=now();
    np := np+1;
  END LOOP;
  RETURN jsonb_build_object('groups',ng,'tasks',nt,'people',np);
END $$;

-- RPC: fim da leitura -> prévia; sugere responsáveis (e-mail exato confirma; parte local só sugere)
CREATE OR REPLACE FUNCTION public.clickup_import_finish_collect(p_run uuid, p_counts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r clickup_import_runs;
BEGIN
  SELECT * INTO r FROM clickup_import_runs WHERE id=p_run FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Importação não encontrada.'; END IF;
  PERFORM clickup_import_require(r.workspace_id, 'manage');
  IF r.status <> 'collecting' THEN RAISE EXCEPTION 'A leitura desta importação já terminou.'; END IF;

  WITH m AS (
    SELECT wm.user_id, lower(u.email) em FROM workspace_members wm JOIN auth.users u ON u.id=wm.user_id
     WHERE wm.workspace_id=r.workspace_id
  )
  UPDATE clickup_import_people cp SET user_id=m.user_id, status='confirmed', match_reason='email', updated_at=now()
    FROM m WHERE cp.workspace_id=r.workspace_id AND cp.decided_by IS NULL AND cp.status<>'confirmed'
     AND cp.email IS NOT NULL AND cp.email=m.em;

  WITH pe AS (
    SELECT lower(pp.email) em, min(pp.profile_id::text)::uuid uid, count(DISTINCT pp.profile_id) n
      FROM people pp JOIN workspace_members wm ON wm.workspace_id=pp.workspace_id AND wm.user_id=pp.profile_id
     WHERE pp.workspace_id=r.workspace_id AND pp.email IS NOT NULL AND pp.profile_id IS NOT NULL
     GROUP BY lower(pp.email)
  )
  UPDATE clickup_import_people cp SET user_id=pe.uid, status='confirmed', match_reason='techpeople_email', updated_at=now()
    FROM pe WHERE cp.workspace_id=r.workspace_id AND cp.decided_by IS NULL AND cp.status<>'confirmed'
     AND pe.n=1 AND cp.email=pe.em;

  WITH lp AS (
    SELECT split_part(lower(u.email),'@',1) lp, min(wm.user_id::text)::uuid uid, count(*) n
      FROM workspace_members wm JOIN auth.users u ON u.id=wm.user_id
     WHERE wm.workspace_id=r.workspace_id GROUP BY 1
  )
  UPDATE clickup_import_people cp SET user_id=lp.uid, status='suggested', match_reason='local_part', updated_at=now()
    FROM lp WHERE cp.workspace_id=r.workspace_id AND cp.decided_by IS NULL AND cp.status='unmatched'
     AND cp.email IS NOT NULL AND lp.n=1 AND split_part(cp.email,'@',1)=lp.lp;

  UPDATE clickup_import_runs SET status='planned', counts=coalesce(p_counts,'{}'::jsonb), updated_at=now() WHERE id=p_run;
  RETURN jsonb_build_object('status','planned');
END $$;

-- RPC: decisão por lista (destino)
CREATE OR REPLACE FUNCTION public.clickup_import_set_group(p_group uuid, p_action text, p_space uuid, p_new_space text,
  p_project uuid, p_new_project text, p_list_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE g clickup_import_groups; r clickup_import_runs;
BEGIN
  SELECT * INTO g FROM clickup_import_groups WHERE id=p_group FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'Lista não encontrada.'; END IF;
  SELECT * INTO r FROM clickup_import_runs WHERE id=g.run_id;
  PERFORM clickup_import_require(r.workspace_id, 'manage');
  IF r.status <> 'planned' THEN RAISE EXCEPTION 'A prévia não pode mais ser alterada.'; END IF;
  IF p_action NOT IN ('import','skip') THEN RAISE EXCEPTION 'Ação inválida.'; END IF;
  IF p_space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM project_spaces WHERE id=p_space AND workspace_id=r.workspace_id) THEN
    RAISE EXCEPTION 'Espaço de outro workspace.' USING ERRCODE='42501'; END IF;
  IF p_project IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects WHERE id=p_project AND workspace_id=r.workspace_id) THEN
    RAISE EXCEPTION 'Projeto de outro workspace.' USING ERRCODE='42501'; END IF;
  UPDATE clickup_import_groups SET action=p_action,
    target_space_id=p_space, new_space_name=CASE WHEN p_space IS NULL THEN left(nullif(btrim(p_new_space),''),120) END,
    target_project_id=p_project, new_project_name=CASE WHEN p_project IS NULL THEN left(nullif(btrim(p_new_project),''),200) END,
    erp_list_name=coalesce(left(nullif(btrim(p_list_name),''),120), erp_list_name),
    decided_by=auth.uid(), decided_at=now()
  WHERE id=p_group;
END $$;

-- RPC: decisão por responsável
CREATE OR REPLACE FUNCTION public.clickup_import_set_person(p_ws uuid, p_clickup_user bigint, p_user uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  PERFORM clickup_import_require(p_ws, 'manage');
  IF p_status NOT IN ('confirmed','ignored','unmatched') THEN RAISE EXCEPTION 'Situação inválida.'; END IF;
  IF p_status='confirmed' AND (p_user IS NULL OR NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id=p_ws AND user_id=p_user)) THEN
    RAISE EXCEPTION 'A pessoa precisa ser membro deste workspace.' USING ERRCODE='42501';
  END IF;
  UPDATE clickup_import_people SET status=p_status, user_id=CASE WHEN p_status='confirmed' THEN p_user END,
    match_reason=CASE WHEN p_status='confirmed' THEN 'manual' ELSE match_reason END,
    decided_by=auth.uid(), decided_at=now(), updated_at=now()
  WHERE workspace_id=p_ws AND clickup_user_id=p_clickup_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Responsável do ClickUp não encontrado.'; END IF;
END $$;

-- Responsáveis confirmados de uma tarefa (membros do workspace, em qualquer situação)
CREATE OR REPLACE FUNCTION public.clickup_import_assignees(p_ws uuid, p_payload jsonb)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT coalesce(array_agg(DISTINCT cp.user_id), '{}')
    FROM jsonb_array_elements_text(coalesce(p_payload->'assignees','[]')) a(x)
    JOIN clickup_import_people cp ON cp.workspace_id=p_ws AND cp.clickup_user_id=a.x::bigint AND cp.status='confirmed'
    JOIN workspace_members wm ON wm.workspace_id=p_ws AND wm.user_id=cp.user_id
$$;
REVOKE ALL ON FUNCTION public.clickup_import_assignees(uuid,jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_assignees(uuid,jsonb) TO service_role;

-- RPC: aplicar em etapas (estrutura, depois tarefas; pais antes de subtarefas). Sem workflows.
CREATE OR REPLACE FUNCTION public.clickup_import_apply_step(p_run uuid, p_limit integer DEFAULT 300)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r clickup_import_runs; g record; t record; v_space uuid; v_proj uuid; v_list uuid; v_id uuid; v_parent uuid;
  v_ass uuid[]; v_n int:=0; v_rem int; v_lim int := least(greatest(coalesce(p_limit,300),1),1000); pl jsonb;
BEGIN
  SELECT * INTO r FROM clickup_import_runs WHERE id=p_run FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Importação não encontrada.'; END IF;
  PERFORM clickup_import_require(r.workspace_id, 'manage');
  IF r.status NOT IN ('planned','applying') THEN RAISE EXCEPTION 'Esta importação não está pronta para aplicar.'; END IF;
  PERFORM set_config('app.clockify_import','on',true);
  IF r.status='planned' THEN
    UPDATE clickup_import_runs SET status='applying', confirmed_by=auth.uid(), confirmed_at=now(), updated_at=now() WHERE id=p_run;
  END IF;

  FOR g IN SELECT * FROM clickup_import_groups WHERE run_id=p_run AND action='import' AND erp_list_id IS NULL
           ORDER BY team_name, space_name, folder_name NULLS FIRST, list_name LOOP
    v_space := g.target_space_id;
    IF v_space IS NULL THEN
      SELECT id INTO v_space FROM project_spaces WHERE workspace_id=r.workspace_id AND archived_at IS NULL
        AND lower(btrim(name))=lower(btrim(g.new_space_name)) ORDER BY created_at LIMIT 1;
      IF v_space IS NULL THEN
        INSERT INTO project_spaces(workspace_id, name, created_by) VALUES (r.workspace_id, g.new_space_name, auth.uid())
          RETURNING id INTO v_space;
        INSERT INTO clickup_import_created(run_id, workspace_id, target_table, target_id, label)
          VALUES (p_run, r.workspace_id, 'project_spaces', v_space, g.new_space_name);
      END IF;
    END IF;
    v_list := NULL; v_proj := NULL;
    SELECT l.target_id, pl2.project_id INTO v_list, v_proj FROM clickup_import_links l
      JOIN project_lists pl2 ON pl2.id=l.target_id
     WHERE l.workspace_id=r.workspace_id AND l.entity_type='list' AND l.external_id=g.list_ext_id;
    IF v_list IS NULL THEN
      v_proj := g.target_project_id;
      IF v_proj IS NULL THEN
        SELECT c.target_id INTO v_proj FROM clickup_import_created c JOIN projects p ON p.id=c.target_id
         WHERE c.run_id=p_run AND c.target_table='projects' AND lower(btrim(p.name))=lower(btrim(g.new_project_name)) LIMIT 1;
      END IF;
      IF v_proj IS NULL THEN
        INSERT INTO projects(workspace_id, owner_id, name, status, metadata)
        VALUES (r.workspace_id, auth.uid(), g.new_project_name, coalesce(g.new_project_status,'active'),
          jsonb_build_object('clickup', jsonb_build_object('run_id', p_run, 'team', g.team_name, 'space', g.space_name,
            'folder', g.folder_name)))
        RETURNING id INTO v_proj;
        INSERT INTO clickup_import_created(run_id, workspace_id, target_table, target_id, label)
          VALUES (p_run, r.workspace_id, 'projects', v_proj, g.new_project_name);
      END IF;
      INSERT INTO project_lists(workspace_id, space_id, project_id, name, created_by)
        VALUES (r.workspace_id, v_space, v_proj, g.erp_list_name, auth.uid()) RETURNING id INTO v_list;
      INSERT INTO clickup_import_created(run_id, workspace_id, target_table, target_id, label)
        VALUES (p_run, r.workspace_id, 'project_lists', v_list, g.erp_list_name);
      INSERT INTO clickup_import_links(workspace_id, entity_type, external_id, target_id, created_run_id, meta)
        VALUES (r.workspace_id, 'list', g.list_ext_id, v_list, p_run,
          jsonb_build_object('team', g.team_name, 'space', g.space_name, 'folder', g.folder_name, 'list', g.list_name))
      ON CONFLICT (workspace_id, entity_type, external_id) DO UPDATE SET target_id=EXCLUDED.target_id,
        created_run_id=EXCLUDED.created_run_id, meta=EXCLUDED.meta;
    END IF;
    UPDATE clickup_import_groups SET erp_space_id=v_space, erp_project_id=v_proj, erp_list_id=v_list WHERE id=g.id;
  END LOOP;

  FOR t IN
    SELECT ct.external_id, ct.parent_external_id, ct.payload, g.erp_project_id, g.erp_list_id
      FROM clickup_import_tasks ct
      JOIN clickup_import_groups g ON g.run_id=ct.run_id AND g.list_ext_id=ct.list_ext_id
     WHERE ct.run_id=p_run AND g.action='import' AND g.erp_list_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM clickup_import_links l WHERE l.workspace_id=r.workspace_id
             AND l.entity_type='task' AND l.external_id=ct.external_id)
       AND (ct.parent_external_id IS NULL
         OR EXISTS (SELECT 1 FROM clickup_import_links l2 WHERE l2.workspace_id=r.workspace_id
             AND l2.entity_type='task' AND l2.external_id=ct.parent_external_id)
         OR NOT EXISTS (SELECT 1 FROM clickup_import_tasks pt JOIN clickup_import_groups pg
             ON pg.run_id=pt.run_id AND pg.list_ext_id=pt.list_ext_id AND pg.action='import'
             WHERE pt.run_id=p_run AND pt.external_id=ct.parent_external_id))
     ORDER BY (ct.parent_external_id IS NOT NULL), ct.external_id
     LIMIT v_lim
  LOOP
    pl := t.payload;
    v_parent := NULL;
    IF t.parent_external_id IS NOT NULL THEN
      SELECT pt.id INTO v_parent FROM clickup_import_links l JOIN project_tasks pt ON pt.id=l.target_id
       WHERE l.workspace_id=r.workspace_id AND l.entity_type='task' AND l.external_id=t.parent_external_id
         AND pt.project_id=t.erp_project_id;
    END IF;
    v_ass := clickup_import_assignees(r.workspace_id, pl);
    INSERT INTO project_tasks(workspace_id, project_id, list_id, parent_task_id, title, description, status, priority,
      due_at, start_at, tags, assignee_id, assignee_ids, created_at, sort_order)
    VALUES (r.workspace_id, t.erp_project_id, t.erp_list_id, v_parent, left(coalesce(nullif(btrim(pl->>'title'),''),'(sem título)'),500),
      nullif(pl->>'description',''), coalesce(nullif(pl->>'status','')::project_task_status,'todo'),
      coalesce(nullif(pl->>'priority','')::project_task_priority,'normal'),
      nullif(pl->>'due_at','')::date, nullif(pl->>'start_at','')::date,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(pl->'tags','[]'))),'{}'),
      v_ass[1], v_ass, coalesce(nullif(pl->>'created_at','')::timestamptz, now()), coalesce((pl->>'order')::int,0))
    RETURNING id INTO v_id;
    INSERT INTO clickup_import_links(workspace_id, entity_type, external_id, target_id, created_run_id, meta)
      VALUES (r.workspace_id, 'task', t.external_id, v_id, p_run,
        jsonb_build_object('url', pl->>'url', 'status_name', pl->>'status_name', 'clockify_refs', coalesce((pl->>'clockify_refs')::int,0)));
    v_n := v_n+1;
  END LOOP;

  SELECT count(*) INTO v_rem FROM clickup_import_tasks ct
    JOIN clickup_import_groups g ON g.run_id=ct.run_id AND g.list_ext_id=ct.list_ext_id AND g.action='import'
   WHERE ct.run_id=p_run AND NOT EXISTS (SELECT 1 FROM clickup_import_links l WHERE l.workspace_id=r.workspace_id
           AND l.entity_type='task' AND l.external_id=ct.external_id);
  IF v_n=0 AND v_rem>0 THEN
    RAISE EXCEPTION 'Restam % tarefas que não puderam ser importadas.', v_rem;
  END IF;
  IF v_rem=0 THEN
    UPDATE clickup_import_runs SET status='applied', applied_at=now(), updated_at=now(),
      counts = counts || jsonb_build_object(
        'tasks_created', (SELECT count(*) FROM clickup_import_links WHERE created_run_id=p_run AND entity_type='task'),
        'lists_created', (SELECT count(*) FROM clickup_import_created WHERE run_id=p_run AND target_table='project_lists'),
        'projects_created', (SELECT count(*) FROM clickup_import_created WHERE run_id=p_run AND target_table='projects'),
        'spaces_created', (SELECT count(*) FROM clickup_import_created WHERE run_id=p_run AND target_table='project_spaces'))
    WHERE id=p_run;
  END IF;
  RETURN jsonb_build_object('created', v_n, 'remaining', v_rem, 'done', v_rem=0);
END $$;

-- RPC: completar responsáveis depois de confirmar pessoas (só tarefas sem responsável e não editadas)
CREATE OR REPLACE FUNCTION public.clickup_import_sync_assignees(p_run uuid, p_limit integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r clickup_import_runs; x record; v_ass uuid[]; v_n int:=0; v_lim int := least(greatest(coalesce(p_limit,500),1),2000);
BEGIN
  SELECT * INTO r FROM clickup_import_runs WHERE id=p_run;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Importação não encontrada.'; END IF;
  PERFORM clickup_import_require(r.workspace_id, 'manage');
  IF r.status NOT IN ('applying','applied') THEN RAISE EXCEPTION 'Importação não aplicada.'; END IF;
  PERFORM set_config('app.clockify_import','on',true);
  FOR x IN
    SELECT l.external_id, pt.id, ct.payload FROM clickup_import_links l
      JOIN project_tasks pt ON pt.id=l.target_id
      JOIN clickup_import_tasks ct ON ct.run_id=p_run AND ct.external_id=l.external_id
     WHERE l.workspace_id=r.workspace_id AND l.entity_type='task' AND l.created_run_id=p_run
       AND pt.updated_at <= l.imported_updated_at
       AND pt.assignee_id IS NULL AND coalesce(cardinality(pt.assignee_ids),0)=0
       AND jsonb_array_length(coalesce(ct.payload->'assignees','[]'))>0
       AND NOT coalesce((l.meta->>'assignees_checked')::boolean,false)
     LIMIT v_lim
  LOOP
    v_ass := clickup_import_assignees(r.workspace_id, x.payload);
    IF cardinality(v_ass)>0 THEN
      UPDATE project_tasks SET assignee_id=v_ass[1], assignee_ids=v_ass WHERE id=x.id;
      UPDATE clickup_import_links SET imported_updated_at=now() WHERE workspace_id=r.workspace_id AND entity_type='task' AND external_id=x.external_id;
      v_n := v_n+1;
    ELSE
      UPDATE clickup_import_links SET meta=meta||'{"assignees_checked":true}' WHERE workspace_id=r.workspace_id AND entity_type='task' AND external_id=x.external_id;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('updated', v_n, 'scanned_batch', v_lim);
END $$;

-- RPC: desfazer em etapas. Remove só o que a execução criou e ninguém alterou depois;
-- tarefa editada, com horas ou com subtarefa mantida fica e é contada como mantida.
CREATE OR REPLACE FUNCTION public.clickup_import_rollback_step(p_run uuid, p_limit integer DEFAULT 500)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r clickup_import_runs; x record; v_del int:=0; v_kept int:=0; v_lim int := least(greatest(coalesce(p_limit,500),1),2000);
BEGIN
  SELECT * INTO r FROM clickup_import_runs WHERE id=p_run FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Importação não encontrada.'; END IF;
  PERFORM clickup_import_require(r.workspace_id, 'manage');
  IF r.status NOT IN ('applying','applied','rolling_back') THEN RAISE EXCEPTION 'Nada para desfazer nesta importação.'; END IF;
  PERFORM set_config('app.clockify_import','on',true);
  IF r.status <> 'rolling_back' THEN
    UPDATE clickup_import_runs SET status='rolling_back', rolled_back_by=auth.uid(), updated_at=now() WHERE id=p_run;
  END IF;
  DELETE FROM clickup_import_links l WHERE l.workspace_id=r.workspace_id AND l.created_run_id=p_run AND l.entity_type='task'
    AND NOT EXISTS (SELECT 1 FROM project_tasks pt WHERE pt.id=l.target_id);

  FOR x IN
    SELECT l.external_id, pt.id, (pt.updated_at > l.imported_updated_at
        OR EXISTS (SELECT 1 FROM project_time_entries te WHERE te.task_id=pt.id)) AS keep
      FROM clickup_import_links l JOIN project_tasks pt ON pt.id=l.target_id
     WHERE l.workspace_id=r.workspace_id AND l.entity_type='task' AND l.created_run_id=p_run
       AND NOT coalesce((l.meta->>'kept')::boolean,false)
       AND NOT EXISTS (SELECT 1 FROM project_tasks c WHERE c.parent_task_id=pt.id
             AND NOT EXISTS (SELECT 1 FROM clickup_import_links lc WHERE lc.target_id=c.id AND lc.created_run_id=p_run
                   AND NOT coalesce((lc.meta->>'kept')::boolean,false)) )
       AND NOT EXISTS (SELECT 1 FROM project_tasks c2 JOIN clickup_import_links lc2 ON lc2.target_id=c2.id
             AND lc2.created_run_id=p_run AND NOT coalesce((lc2.meta->>'kept')::boolean,false)
             WHERE c2.parent_task_id=pt.id)
     LIMIT v_lim
  LOOP
    IF x.keep OR EXISTS (SELECT 1 FROM project_tasks c WHERE c.parent_task_id=x.id) THEN
      UPDATE clickup_import_links SET meta=meta||'{"kept":true}' WHERE workspace_id=r.workspace_id AND entity_type='task' AND external_id=x.external_id;
      v_kept := v_kept+1;
    ELSE
      BEGIN
        DELETE FROM project_tasks WHERE id=x.id;
        DELETE FROM clickup_import_links WHERE workspace_id=r.workspace_id AND entity_type='task' AND external_id=x.external_id;
        v_del := v_del+1;
      EXCEPTION WHEN foreign_key_violation THEN
        UPDATE clickup_import_links SET meta=meta||'{"kept":true}' WHERE workspace_id=r.workspace_id AND entity_type='task' AND external_id=x.external_id;
        v_kept := v_kept+1;
      END;
    END IF;
  END LOOP;

  IF v_del=0 AND v_kept=0 THEN
    -- Tarefas acabaram: estrutura vazia criada pela execução sai; o resto fica.
    FOR x IN SELECT target_id FROM clickup_import_created WHERE run_id=p_run AND target_table='project_lists' LOOP
      IF NOT EXISTS (SELECT 1 FROM project_tasks WHERE list_id=x.target_id) THEN
        BEGIN
          DELETE FROM project_lists WHERE id=x.target_id;
          DELETE FROM clickup_import_links WHERE workspace_id=r.workspace_id AND entity_type='list' AND target_id=x.target_id;
          DELETE FROM clickup_import_created WHERE run_id=p_run AND target_table='project_lists' AND target_id=x.target_id;
        EXCEPTION WHEN foreign_key_violation THEN NULL; END;
      END IF;
    END LOOP;
    FOR x IN SELECT target_id FROM clickup_import_created WHERE run_id=p_run AND target_table='projects' LOOP
      IF NOT EXISTS (SELECT 1 FROM project_tasks WHERE project_id=x.target_id)
         AND NOT EXISTS (SELECT 1 FROM project_time_entries WHERE project_id=x.target_id)
         AND NOT EXISTS (SELECT 1 FROM project_lists WHERE project_id=x.target_id) THEN
        BEGIN
          DELETE FROM project_members WHERE project_id=x.target_id;
          DELETE FROM projects WHERE id=x.target_id;
          DELETE FROM clickup_import_created WHERE run_id=p_run AND target_table='projects' AND target_id=x.target_id;
        EXCEPTION WHEN foreign_key_violation THEN NULL; END;
      END IF;
    END LOOP;
    FOR x IN SELECT target_id FROM clickup_import_created WHERE run_id=p_run AND target_table='project_spaces' LOOP
      IF NOT EXISTS (SELECT 1 FROM project_lists WHERE space_id=x.target_id)
         AND NOT EXISTS (SELECT 1 FROM project_folders WHERE space_id=x.target_id) THEN
        BEGIN
          DELETE FROM project_spaces WHERE id=x.target_id;
          DELETE FROM clickup_import_created WHERE run_id=p_run AND target_table='project_spaces' AND target_id=x.target_id;
        EXCEPTION WHEN foreign_key_violation THEN NULL; END;
      END IF;
    END LOOP;
    UPDATE clickup_import_runs SET status='rolled_back', rolled_back_at=now(), updated_at=now(),
      counts = counts || jsonb_build_object(
        'kept_tasks', (SELECT count(*) FROM clickup_import_links WHERE created_run_id=p_run AND entity_type='task'),
        'kept_structure', (SELECT count(*) FROM clickup_import_created WHERE run_id=p_run))
    WHERE id=p_run;
    RETURN jsonb_build_object('deleted',0,'kept',0,'done',true);
  END IF;
  RETURN jsonb_build_object('deleted', v_del, 'kept', v_kept, 'done', false);
END $$;

REVOKE ALL ON FUNCTION public.clickup_import_start(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.clickup_import_stage(uuid,jsonb,jsonb,jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.clickup_import_finish_collect(uuid,jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.clickup_import_set_group(uuid,text,uuid,text,uuid,text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.clickup_import_set_person(uuid,bigint,uuid,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.clickup_import_apply_step(uuid,integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.clickup_import_sync_assignees(uuid,integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.clickup_import_rollback_step(uuid,integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clickup_import_start(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_stage(uuid,jsonb,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_finish_collect(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_set_group(uuid,text,uuid,text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_set_person(uuid,bigint,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_apply_step(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_sync_assignees(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clickup_import_rollback_step(uuid,integer) TO authenticated;