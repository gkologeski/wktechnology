DO $mig$
DECLARE d text; n int;
BEGIN
  d := pg_get_functiondef('public.project_dash_ds_forecast(text,jsonb)'::regprocedure);
  -- Avaliados uma vez: equivalem a work_time_context_access / work_context_access quando a chave .workspace está presente.
  d := replace(d, 'SELECT v.*,work_time_context() AS time_ctx, public.work_access_context() AS work_ctx FROM public.project_dash_vis() v',
    'SELECT v.*, x.time_ctx, x.work_ctx, '
    || 'coalesce(x.time_ctx->>''workspace'' = v.ws::text AND x.time_ctx->>''actor'' IS NOT NULL AND (x.time_ctx->''time_grants'') ? ''view.workspace'', false) AS time_full, '
    || 'public.work_view_full_workspace(''techprojects.tasks'') AS tasks_ws, public.work_view_full_workspace(''techprojects.milestones'') AS ms_ws '
    || 'FROM public.project_dash_vis() v CROSS JOIN LATERAL (SELECT work_time_context() AS time_ctx, public.work_access_context() AS work_ctx) x');
  d := replace(d, 'AND public.work_context_access(b.work_ctx,t.workspace_id,''techprojects.tasks'',''view'',array_append(coalesce(t.assignee_ids,''{}''),t.assignee_id))',
                  'AND (t.workspace_id = b.tasks_ws OR public.work_context_access(b.work_ctx,t.workspace_id,''techprojects.tasks'',''view'',array_append(coalesce(t.assignee_ids,''{}''),t.assignee_id)))');
  d := replace(d, 'AND work_context_access(b.work_ctx,x.workspace_id,''techprojects.milestones'',''view'',ARRAY[x.assigned_to])',
                  'AND (x.workspace_id = b.ms_ws OR work_context_access(b.work_ctx,x.workspace_id,''techprojects.milestones'',''view'',ARRAY[x.assigned_to]))');
  d := replace(d, 'AND work_time_context_access(b.time_ctx,e.workspace_id,e.project_id,e.user_id,''view'')',
                  'AND (b.time_full OR work_time_context_access(b.time_ctx,e.workspace_id,e.project_id,e.user_id,''view''))');
  n := (length(d) - length(replace(d, 'b.time_full OR', ''))) / length('b.time_full OR');
  IF n < 2 OR position('b.tasks_ws OR' IN d) = 0 OR position('b.ms_ws OR' IN d) = 0 OR position('AS time_full' IN d) = 0 THEN
    RAISE EXCEPTION 'ds_forecast: troca incompleta (%)', n;
  END IF;
  EXECUTE d;
END $mig$;