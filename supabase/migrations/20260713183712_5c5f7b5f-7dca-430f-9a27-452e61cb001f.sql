
DROP POLICY IF EXISTS meetings_write_update ON public.meetings;
DROP POLICY IF EXISTS meetings_write_delete ON public.meetings;

CREATE POLICY meetings_write_update ON public.meetings
FOR UPDATE
USING (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (
    (
      (workspace_id IN (SELECT current_user_workspaces()))
      OR ((workspace_id IS NULL) AND is_workspace_member(owner_id, auth.uid()))
    )
    AND (
      user_has_permission(auth.uid(), 'techsales.meetings.update.workspace'::text)
      OR (
        user_has_permission(auth.uid(), 'techsales.meetings.update.own'::text)
        AND can_write_owner(owner_id, auth.uid())
      )
    )
  )
)
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (
    (
      (workspace_id IN (SELECT current_user_workspaces()))
      OR ((workspace_id IS NULL) AND is_workspace_member(owner_id, auth.uid()))
    )
    AND (
      user_has_permission(auth.uid(), 'techsales.meetings.update.workspace'::text)
      OR (
        user_has_permission(auth.uid(), 'techsales.meetings.update.own'::text)
        AND can_write_owner(owner_id, auth.uid())
      )
    )
  )
);

CREATE POLICY meetings_write_delete ON public.meetings
FOR DELETE
USING (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (
    (
      (workspace_id IN (SELECT current_user_workspaces()))
      OR ((workspace_id IS NULL) AND is_workspace_member(owner_id, auth.uid()))
    )
    AND user_has_permission(auth.uid(), 'techsales.meetings.delete.workspace'::text)
  )
);
