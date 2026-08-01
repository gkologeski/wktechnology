-- Atividades: aplicar escopos own/team/workspace nas regras de acesso
DROP POLICY IF EXISTS ws_select_activities ON public.activities;
CREATE POLICY ws_select_activities ON public.activities
FOR SELECT TO authenticated
USING (
  workspace_id IN (SELECT public.current_user_workspaces())
  AND (
    public.is_workspace_admin_of(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.view.workspace')
    OR (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.view.team')
      AND (owner_id = auth.uid() OR public.shares_team_with(owner_id, auth.uid()))
    )
    OR (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.view.own')
      AND owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS ws_update_activities ON public.activities;
CREATE POLICY ws_update_activities ON public.activities
FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT public.current_user_workspaces())
  AND (
    public.is_workspace_admin_of(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.workspace')
    OR (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.team')
      AND (owner_id = auth.uid() OR public.shares_team_with(owner_id, auth.uid()))
    )
    OR (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.own')
      AND owner_id = auth.uid()
    )
  )
)
WITH CHECK (
  workspace_id IN (SELECT public.current_user_workspaces())
  AND (
    public.is_workspace_admin_of(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.workspace')
    OR (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.team')
      AND (owner_id = auth.uid() OR public.shares_team_with(owner_id, auth.uid()))
    )
    OR (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.own')
      AND owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS ws_delete_activities ON public.activities;
CREATE POLICY ws_delete_activities ON public.activities
FOR DELETE TO authenticated
USING (
  workspace_id IN (SELECT public.current_user_workspaces())
  AND (
    public.is_workspace_admin_of(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.delete.workspace')
    OR (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.delete.team')
      AND (owner_id = auth.uid() OR public.shares_team_with(owner_id, auth.uid()))
    )
    OR (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.delete.own')
      AND owner_id = auth.uid()
    )
  )
);
