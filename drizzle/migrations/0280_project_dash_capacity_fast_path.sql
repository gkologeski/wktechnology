DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.project_dash_capacity_base(text,jsonb)'::regprocedure);
  d := replace(d, 'v_full boolean;', 'v_full boolean; v_tfull boolean; v_pws uuid;');
  d := replace(d, '  v_full := public.project_dash_full(v_ws);',
    '  v_full := public.project_dash_full(v_ws);' || chr(10)
    || '  v_tfull := coalesce(tc->>''workspace'' = v_ws::text AND tc->>''actor'' IS NOT NULL AND (tc->''time_grants'') ? ''view.workspace'', false);' || chr(10)
    || '  v_pws := public.work_view_full_workspace(''techprojects.projects'');');
  d := replace(d, 'work_time_context_access(tc,e.workspace_id,e.project_id,e.user_id,''view'')',
                  '(v_tfull OR work_time_context_access(tc,e.workspace_id,e.project_id,e.user_id,''view''))');
  d := replace(d, 'AND work_record_context_access(c,''techprojects.projects'',p.id,''view'')',
                  'AND (p.workspace_id = v_pws OR work_record_context_access(c,''techprojects.projects'',p.id,''view''))');
  IF position('v_tfull :=' IN d) = 0 OR position('(v_tfull OR' IN d) = 0 OR position('p.workspace_id = v_pws OR' IN d) = 0 THEN
    RAISE EXCEPTION 'capacity_base: troca incompleta';
  END IF;
  EXECUTE d;
END $mig$;