-- Fecha lacuna (pré-existente em shares_team_with e herdada pela 0117): colega de grupo só conta se
-- o grupo for de um workspace onde o chamador é membro ATIVO, e somente no MESMO workspace da atividade.
-- Só reduz acesso; reproduzido no isolado (grupo residual WB: antiga/0117 = visível, corrigida = invisível).
CREATE OR REPLACE FUNCTION public.my_team_member_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT b.user_id FROM public.user_group_members a
  JOIN public.user_groups g ON g.id = a.group_id
  JOIN public.user_group_members b ON b.group_id = a.group_id
  WHERE a.user_id = auth.uid() AND b.user_id IS NOT NULL
    AND public.is_workspace_member(g.workspace_id, auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.my_team_member_pairs()
RETURNS TABLE(workspace_id uuid, user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT g.workspace_id, b.user_id FROM public.user_group_members a
  JOIN public.user_groups g ON g.id = a.group_id
  JOIN public.user_group_members b ON b.group_id = a.group_id
  WHERE a.user_id = auth.uid() AND b.user_id IS NOT NULL AND g.workspace_id IS NOT NULL
    AND public.is_workspace_member(g.workspace_id, auth.uid())
$$;
REVOKE ALL ON FUNCTION public.my_team_member_pairs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_team_member_pairs() TO authenticated, service_role;
ALTER POLICY ws_select_activities ON public.activities
USING (workspace_id IN (SELECT public.current_user_workspaces()) AND (
  workspace_id IN (SELECT w FROM public.current_user_workspaces() w
     WHERE public.is_workspace_admin_of(w, (SELECT auth.uid()))
        OR public.user_has_permission((SELECT auth.uid()), w, 'techsales.activities.view.workspace'))
  OR (workspace_id IN (SELECT w FROM public.current_user_workspaces() w
        WHERE public.user_has_permission((SELECT auth.uid()), w, 'techsales.activities.view.team'))
      AND (public.is_own_record(owner_id, assigned_to)
           OR (owner_id IS NOT NULL AND (workspace_id, owner_id) IN (SELECT p.workspace_id, p.user_id FROM public.my_team_member_pairs() p))))
  OR (workspace_id IN (SELECT w FROM public.current_user_workspaces() w
        WHERE public.user_has_permission((SELECT auth.uid()), w, 'techsales.activities.view.own'))
      AND public.is_own_record(owner_id, assigned_to))));