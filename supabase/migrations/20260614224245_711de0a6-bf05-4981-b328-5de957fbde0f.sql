GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

DROP POLICY IF EXISTS ws_update_contacts ON public.contacts;
CREATE POLICY ws_update_contacts
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  workspace_id IN (SELECT public.current_user_workspaces())
  AND public.user_can_act('contacts', 'edit', workspace_id, assigned_user_id)
)
WITH CHECK (
  workspace_id IN (SELECT public.current_user_workspaces())
  AND public.user_can_act('contacts', 'edit', workspace_id, assigned_user_id)
);

DROP POLICY IF EXISTS ws_delete_contacts ON public.contacts;
CREATE POLICY ws_delete_contacts
ON public.contacts
FOR DELETE
TO authenticated
USING (
  workspace_id IN (SELECT public.current_user_workspaces())
  AND public.user_can_act('contacts', 'delete', workspace_id, assigned_user_id)
);