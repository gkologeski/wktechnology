CREATE OR REPLACE FUNCTION public.rep_restricted_workspaces_for(_res text, _act text)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT w FROM public.rep_restricted_workspaces() w
  EXCEPT
  SELECT public.my_perm_workspaces('techsales.' || _res || '.' || _act || '.workspace');
$$;
REVOKE ALL ON FUNCTION public.rep_restricted_workspaces_for(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rep_restricted_workspaces_for(text, text) TO authenticated, service_role;

DO $mig$
DECLARE
  r record; v_res text; v_act text; v_q text; v_team text; v_resp text;
BEGIN
  FOR r IN SELECT tablename, policyname, cmd, qual FROM pg_policies
           WHERE schemaname='public' AND policyname LIKE 'rep_scope_%' LOOP
    v_res := CASE r.tablename
      WHEN 'activities' THEN 'activities' WHEN 'calendar_events' THEN 'activities'
      WHEN 'companies' THEN 'companies' WHEN 'contacts' THEN 'contacts'
      WHEN 'deals' THEN 'deals' WHEN 'leads' THEN 'leads' WHEN 'quotes' THEN 'quotes'
      WHEN 'email_threads' THEN 'inbox.email' WHEN 'email_messages' THEN 'inbox.email'
      WHEN 'live_chat_sessions' THEN 'inbox.chat'
      WHEN 'whatsapp_conversations' THEN 'inbox.whatsapp' WHEN 'whatsapp_messages' THEN 'inbox.whatsapp'
      ELSE NULL END;
    CONTINUE WHEN v_res IS NULL OR position('rep_restricted_workspaces()' in r.qual) = 0;
    v_act := CASE r.cmd WHEN 'SELECT' THEN 'view' WHEN 'UPDATE' THEN 'update' WHEN 'DELETE' THEN 'delete' END;
    CONTINUE WHEN v_act IS NULL;
    v_q := replace(r.qual, 'rep_restricted_workspaces()',
                   format('rep_restricted_workspaces_for(%L, %L)', v_res, v_act));
    v_resp := CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.tablename AND column_name='assigned_to') THEN 'assigned_to'
      WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.tablename AND column_name='assignee_id') THEN 'assignee_id'
      ELSE NULL END;
    v_team := format('(workspace_id IN (SELECT public.my_perm_workspaces(%L)) AND (owner_id IN (SELECT public.my_team_member_ids())%s))',
      'techsales.' || v_res || '.' || v_act || '.team',
      CASE WHEN v_resp IS NULL THEN '' ELSE format(' OR %I IN (SELECT public.my_team_member_ids())', v_resp) END);
    EXECUTE format('ALTER POLICY %I ON public.%I USING ((%s) OR %s)', r.policyname, r.tablename, v_q, v_team);
  END LOOP;
END $mig$;