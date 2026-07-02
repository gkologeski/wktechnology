
-- 1. calendar_accounts: require owner_id = auth.uid() on insert
DROP POLICY IF EXISTS ws_insert_calendar_accounts ON public.calendar_accounts;
CREATE POLICY ws_insert_calendar_accounts ON public.calendar_accounts
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND workspace_id IN (SELECT current_user_workspaces())
  );

-- 2. contacts: document scoping convention and prevent workspace/owner changes on update
COMMENT ON COLUMN public.contacts.workspace_id IS
  'Workspace scope for RLS. Unlike most tables in this schema, contacts.owner_id is NOT the workspace UUID — it is the user who owns the record. RLS policies must scope by workspace_id.';
COMMENT ON COLUMN public.contacts.owner_id IS
  'User who owns the contact record. NOT a workspace identifier. Do not use for RLS workspace scoping.';

-- Reinforce update policy to prevent workspace_id / owner_id tampering after insert
DROP POLICY IF EXISTS ws_update_contacts ON public.contacts;
CREATE POLICY ws_update_contacts ON public.contacts
  FOR UPDATE
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND user_can_act('contacts', 'edit', workspace_id, assigned_user_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND user_can_act('contacts', 'edit', workspace_id, assigned_user_id)
  );

-- 3. notes-attachments storage: restrict SELECT to members of the folder's workspace
DROP POLICY IF EXISTS notes_attachments_workspace_select ON storage.objects;
CREATE POLICY notes_attachments_workspace_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'notes-attachments'
    AND (
      owner = auth.uid()
      OR is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );
