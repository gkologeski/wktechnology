DO $mig$
DECLARE d text;
BEGIN
  -- Meu trabalho/Equipe: people_allocations não tem created_by; a regra de alocações usa owner_id (migration 0195).
  d := pg_get_functiondef('public.project_dash_capacity_base(text,jsonb)'::regprocedure);
  IF position('a.created_by,a.assigned_to' IN d) = 0 THEN RAISE EXCEPTION 'capacity_base: trecho esperado não encontrado'; END IF;
  EXECUTE replace(d, '''techpeople.allocations'',''view'',a.created_by,a.assigned_to', '''techpeople.allocations'',''view'',a.owner_id,a.assigned_to');

  -- Tarefas: via rápida por workspace antes da regra por linha (mesmo resultado).
  d := pg_get_functiondef('public.project_dash_ds_tasks(text,jsonb)'::regprocedure);
  IF position('AND public.work_context_access(b.work_ctx,t.workspace_id' IN d) = 0 THEN RAISE EXCEPTION 'ds_tasks: trecho esperado não encontrado'; END IF;
  d := replace(d, 'public.work_access_context() AS work_ctx FROM', 'public.work_access_context() AS work_ctx, public.work_view_full_workspace(''techprojects.tasks'') AS full_ws FROM');
  d := replace(d, 'AND public.work_context_access(b.work_ctx,t.workspace_id,''techprojects.tasks'',''view'',array_append(coalesce(t.assignee_ids,''{}''),t.assignee_id))',
                  'AND (t.workspace_id = b.full_ws OR public.work_context_access(b.work_ctx,t.workspace_id,''techprojects.tasks'',''view'',array_append(coalesce(t.assignee_ids,''{}''),t.assignee_id)))');
  IF position('t.workspace_id = b.full_ws OR' IN d) = 0 THEN RAISE EXCEPTION 'ds_tasks: troca não aplicada'; END IF;
  EXECUTE d;

  -- Projetos: idem.
  d := pg_get_functiondef('public.project_dash_ds_projects(text,jsonb)'::regprocedure);
  d := replace(d, 'public.work_access_context() AS work_ctx FROM', 'public.work_access_context() AS work_ctx, public.work_view_full_workspace(''techprojects.projects'') AS full_ws FROM');
  d := replace(d, 'AND public.work_context_access(b.work_ctx,p.workspace_id,''techprojects.projects'',''view'',ARRAY[coalesce(p.assigned_to,p.owner_id)])',
                  'AND (p.workspace_id = b.full_ws OR public.work_context_access(b.work_ctx,p.workspace_id,''techprojects.projects'',''view'',ARRAY[coalesce(p.assigned_to,p.owner_id)]))');
  IF position('p.workspace_id = b.full_ws OR' IN d) = 0 THEN RAISE EXCEPTION 'ds_projects: troca não aplicada'; END IF;
  EXECUTE d;
END $mig$;