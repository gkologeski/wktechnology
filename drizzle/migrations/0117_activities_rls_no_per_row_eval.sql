-- activities: mesmas regras, sem avaliação por linha de funções caras. Visibilidade idêntica por usuário no harness isolado.
-- (1) "x IN (lista)" com x NULL dava NULL e forçava avaliar as demais policies; agora dá false (ambos negam).
-- (2) current_role_test_session()/auth.uid() viram InitPlan.
-- (3) permissões por workspace calculadas sobre o conjunto de workspaces do usuário; colegas de equipe lidos uma vez.
CREATE OR REPLACE FUNCTION public.my_team_member_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT b.user_id FROM public.user_group_members a
  JOIN public.user_group_members b ON a.group_id = b.group_id
  WHERE a.user_id = auth.uid() AND b.user_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.my_team_member_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_team_member_ids() TO authenticated, service_role;

ALTER POLICY rep_scope_select_activities ON public.activities
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces())))
  OR owner_id = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid())
  OR (related_lead_id IS NOT NULL AND related_lead_id IN (SELECT public.rep_my_lead_ids()))
  OR (related_deal_id IS NOT NULL AND related_deal_id IN (SELECT public.rep_my_deal_ids()))
  OR (related_contact_id IS NOT NULL AND related_contact_id IN (SELECT public.rep_my_contact_ids()))
  OR (related_company_id IS NOT NULL AND related_company_id IN (SELECT public.rep_my_company_ids())));

ALTER POLICY view_as_hide_test ON public.activities
USING (((SELECT public.current_role_test_session()) IS NOT NULL) OR (NOT (id IN (SELECT public.view_as_test_record_ids()))));

ALTER POLICY ws_select_activities ON public.activities
USING (workspace_id IN (SELECT public.current_user_workspaces()) AND (
  workspace_id IN (SELECT w FROM public.current_user_workspaces() w
     WHERE public.is_workspace_admin_of(w, (SELECT auth.uid()))
        OR public.user_has_permission((SELECT auth.uid()), w, 'techsales.activities.view.workspace'))
  OR (workspace_id IN (SELECT w FROM public.current_user_workspaces() w
        WHERE public.user_has_permission((SELECT auth.uid()), w, 'techsales.activities.view.team'))
      AND (public.is_own_record(owner_id, assigned_to)
           OR (owner_id IS NOT NULL AND owner_id IN (SELECT public.my_team_member_ids()))))
  OR (workspace_id IN (SELECT w FROM public.current_user_workspaces() w
        WHERE public.user_has_permission((SELECT auth.uid()), w, 'techsales.activities.view.own'))
      AND public.is_own_record(owner_id, assigned_to))));