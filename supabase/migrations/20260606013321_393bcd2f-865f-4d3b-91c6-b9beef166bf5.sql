
-- Tighten UPDATE/DELETE on calendar_accounts to the owner only (prevents OAuth token hijack by workspace peers)
DROP POLICY IF EXISTS ws_update_calendar_accounts ON public.calendar_accounts;
DROP POLICY IF EXISTS ws_delete_calendar_accounts ON public.calendar_accounts;
CREATE POLICY owner_update_calendar_accounts ON public.calendar_accounts
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY owner_delete_calendar_accounts ON public.calendar_accounts
  FOR DELETE USING (owner_id = auth.uid());

-- Same for email_accounts
DROP POLICY IF EXISTS ws_update_email_accounts ON public.email_accounts;
DROP POLICY IF EXISTS ws_delete_email_accounts ON public.email_accounts;
CREATE POLICY owner_update_email_accounts ON public.email_accounts
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY owner_delete_email_accounts ON public.email_accounts
  FOR DELETE USING (owner_id = auth.uid());

-- Scope workspace_invites read/update/delete to the admin who created the invite,
-- so other admins cannot read or reuse pending invite tokens.
DROP POLICY IF EXISTS wi_select_admin ON public.workspace_invites;
DROP POLICY IF EXISTS wi_update_admin ON public.workspace_invites;
DROP POLICY IF EXISTS wi_delete_admin ON public.workspace_invites;
CREATE POLICY wi_select_own_admin ON public.workspace_invites
  FOR SELECT USING (
    is_workspace_admin_v2(workspace_id, auth.uid()) AND invited_by = auth.uid()
  );
CREATE POLICY wi_update_own_admin ON public.workspace_invites
  FOR UPDATE USING (
    is_workspace_admin_v2(workspace_id, auth.uid()) AND invited_by = auth.uid()
  ) WITH CHECK (
    is_workspace_admin_v2(workspace_id, auth.uid()) AND invited_by = auth.uid()
  );
CREATE POLICY wi_delete_own_admin ON public.workspace_invites
  FOR DELETE USING (
    is_workspace_admin_v2(workspace_id, auth.uid()) AND invited_by = auth.uid()
  );
