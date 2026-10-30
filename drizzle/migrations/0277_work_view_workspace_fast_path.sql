-- Via rápida: quando o usuário tem a chave ".workspace" de leitura, o resultado de
-- work_context_access se reduz a workspace_id = workspace do contexto. Calculado uma vez por consulta.
CREATE OR REPLACE FUNCTION public.work_view_full_workspace(r text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN c->>'actor' IS NOT NULL AND c->>'workspace' IS NOT NULL
     AND (c->'keys') ? (public.work_action_prefix(r, 'view') || '.workspace')
    THEN (c->>'workspace')::uuid END
  FROM (SELECT public.work_access_context() AS c) x
$$;
REVOKE ALL ON FUNCTION public.work_view_full_workspace(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.work_view_full_workspace(text) TO authenticated, service_role;

DROP POLICY IF EXISTS work_view ON public.project_tasks;
CREATE POLICY work_view ON public.project_tasks FOR SELECT TO authenticated USING (
  workspace_id = (SELECT public.work_view_full_workspace('techprojects.tasks'))
  OR public.work_context_access((SELECT public.work_access_context()), workspace_id, 'techprojects.tasks', 'view', array_append(COALESCE(assignee_ids, '{}'::uuid[]), assignee_id))
);

DROP POLICY IF EXISTS work_view ON public.projects;
CREATE POLICY work_view ON public.projects FOR SELECT TO authenticated USING (
  workspace_id = (SELECT public.work_view_full_workspace('techprojects.projects'))
  OR public.work_context_access((SELECT public.work_access_context()), workspace_id, 'techprojects.projects', 'view', ARRAY[COALESCE(assigned_to, owner_id)])
);