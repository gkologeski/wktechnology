-- Rollback devolve os ids realmente removidos para o motor apagar só os vínculos correspondentes.
CREATE OR REPLACE FUNCTION public.time_import_rollback(
  p_workspace uuid, p_entries uuid[], p_members uuid[], p_tasks uuid[], p_projects uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d_e uuid[]; d_m uuid[]; d_t uuid[]; d_p uuid[];
BEGIN
  PERFORM set_config('app.clockify_import', 'on', true);
  WITH d AS (
    DELETE FROM public.project_time_entries
     WHERE workspace_id = p_workspace AND id = ANY(COALESCE(p_entries, '{}'))
       AND source = 'import' AND external_id LIKE 'jibble:%'
    RETURNING id)
  SELECT COALESCE(array_agg(id), '{}') INTO d_e FROM d;
  WITH d AS (
    DELETE FROM public.project_tasks t
     WHERE t.workspace_id = p_workspace AND t.id = ANY(COALESCE(p_tasks, '{}'))
       AND NOT EXISTS (SELECT 1 FROM public.project_time_entries e WHERE e.task_id = t.id)
    RETURNING id)
  SELECT COALESCE(array_agg(id), '{}') INTO d_t FROM d;
  WITH d AS (
    DELETE FROM public.project_members m
     WHERE m.workspace_id = p_workspace AND m.id = ANY(COALESCE(p_members, '{}'))
       AND NOT EXISTS (SELECT 1 FROM public.project_time_entries e
                        WHERE e.project_id = m.project_id AND e.user_id = m.user_id)
    RETURNING id)
  SELECT COALESCE(array_agg(id), '{}') INTO d_m FROM d;
  WITH d AS (
    DELETE FROM public.projects p
     WHERE p.workspace_id = p_workspace AND p.id = ANY(COALESCE(p_projects, '{}'))
       AND NOT EXISTS (SELECT 1 FROM public.project_time_entries e WHERE e.project_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM public.project_tasks t WHERE t.project_id = p.id)
    RETURNING id)
  SELECT COALESCE(array_agg(id), '{}') INTO d_p FROM d;
  RETURN jsonb_build_object('entries', to_jsonb(d_e), 'members', to_jsonb(d_m),
                            'tasks', to_jsonb(d_t), 'projects', to_jsonb(d_p));
END $$;
REVOKE ALL ON FUNCTION public.time_import_rollback(uuid, uuid[], uuid[], uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.time_import_rollback(uuid, uuid[], uuid[], uuid[], uuid[]) TO service_role;