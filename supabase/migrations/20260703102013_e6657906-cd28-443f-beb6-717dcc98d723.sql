DROP POLICY IF EXISTS ws_insert_email_accounts ON public.email_accounts;
CREATE POLICY ws_insert_email_accounts ON public.email_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (workspace_id IS NULL OR workspace_id IN (SELECT current_user_workspaces()))
  );