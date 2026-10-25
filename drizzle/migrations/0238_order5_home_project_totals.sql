-- Finite Home KPIs with the exact current work_view predicates. Resolve keys
-- once, rather than copying the full permission JSON for every imported task.
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['projects','project_tasks'] LOOP
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename=t AND cmd IN('SELECT','ALL'))<>1
   OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='work_view' AND cmd='SELECT' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[] AND qual LIKE 'work_context_access(%') THEN
   RAISE EXCEPTION 'Unexpected Home project RLS contract: %',t;
  END IF;
 END LOOP;
END$$;
CREATE OR REPLACE FUNCTION public.shared_home_project_totals(p_from timestamptz,p_to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE hc jsonb:=shared_area_authorize('system.home','view');c jsonb:=work_access_context();
 w uuid:=(hc->>'workspace')::uuid;u uuid:=(hc->>'actor')::uuid;k jsonb:=c->'keys';team_ids uuid[];
 tw boolean;ta boolean;tt boolean;pw boolean;pa boolean;pt boolean;tasks bigint:=0;projects_count bigint:=0;
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from THEN RAISE EXCEPTION 'Período inválido.' USING ERRCODE='22023';END IF;
 IF c->>'workspace' IS DISTINCT FROM w::text OR c->>'actor' IS DISTINCT FROM u::text THEN RAISE EXCEPTION 'Contexto de projetos indisponível.' USING ERRCODE='42501';END IF;
 tw:=coalesce(k?'techprojects.tasks.view.workspace',false);ta:=coalesce(k?'techprojects.tasks.view.own',false);tt:=coalesce(k?'techprojects.tasks.view.team',false);
 pw:=coalesce(k?'techprojects.projects.view.workspace',false);pa:=coalesce(k?'techprojects.projects.view.own',false);pt:=coalesce(k?'techprojects.projects.view.team',false);
 SELECT coalesce(array_agg(t::uuid),'{}'::uuid[]) INTO team_ids FROM jsonb_object_keys(coalesce(c->'team','{}'::jsonb))t;
 IF tw OR ta OR tt THEN
  SELECT count(*) INTO tasks FROM project_tasks t WHERE t.workspace_id=w AND t.status='done' AND t.updated_at>=p_from AND t.updated_at<=p_to
   AND (tw OR (ta AND u=ANY(array_append(coalesce(t.assignee_ids,'{}'::uuid[]),t.assignee_id)))
    OR (tt AND array_append(coalesce(t.assignee_ids,'{}'::uuid[]),t.assignee_id)&&team_ids));
 END IF;
 IF pw OR pa OR pt THEN
  SELECT count(*) INTO projects_count FROM projects p WHERE p.workspace_id=w AND p.status='active'
   AND (pw OR(pa AND coalesce(p.assigned_to,p.owner_id)=u) OR(pt AND coalesce(p.assigned_to,p.owner_id)=ANY(team_ids)));
 END IF;
 RETURN jsonb_build_object('tasks_done',tasks,'active_projects',projects_count);
END $$;
REVOKE ALL ON FUNCTION public.shared_home_project_totals(timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_home_project_totals(timestamptz,timestamptz) TO authenticated;
CREATE INDEX IF NOT EXISTS idx_home_tasks_done_period ON public.project_tasks(workspace_id,updated_at) INCLUDE(assignee_id,assignee_ids) WHERE status='done';
