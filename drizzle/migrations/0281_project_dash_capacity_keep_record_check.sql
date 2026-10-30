DO $mig$
DECLARE d text;
BEGIN
  -- work_record_context_access também confere o espaço/pasta pai: a via rápida por workspace não é equivalente aqui.
  d := pg_get_functiondef('public.project_dash_capacity_base(text,jsonb)'::regprocedure);
  d := replace(d, 'AND (p.workspace_id = v_pws OR work_record_context_access(c,''techprojects.projects'',p.id,''view''))',
                  'AND work_record_context_access(c,''techprojects.projects'',p.id,''view'')');
  d := replace(d, chr(10) || '  v_pws := public.work_view_full_workspace(''techprojects.projects'');', '');
  d := replace(d, ' v_pws uuid;', '');
  IF position('v_pws' IN d) > 0 THEN RAISE EXCEPTION 'capacity_base: reversão incompleta'; END IF;
  EXECUTE d;
END $mig$;
COMMENT ON FUNCTION public.project_dash_capacity_base(text, jsonb) IS 'Painel: capacidade; via rápida de horas por workspace; projetos pela regra completa (inclui espaço/pasta).';
