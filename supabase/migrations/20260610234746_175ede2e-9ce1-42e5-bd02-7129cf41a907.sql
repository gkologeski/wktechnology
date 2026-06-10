
-- slack_integrations: split the permissive ALL policy into admin-only INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "slack_int write" ON public.slack_integrations;

CREATE POLICY "slack_int insert"
  ON public.slack_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "slack_int update"
  ON public.slack_integrations
  FOR UPDATE
  TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "slack_int delete"
  ON public.slack_integrations
  FOR DELETE
  TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

-- wa_business_accounts: tighten INSERT/UPDATE to admins only
DROP POLICY IF EXISTS ws_insert_wa_business_accounts ON public.wa_business_accounts;
DROP POLICY IF EXISTS ws_update_wa_business_accounts ON public.wa_business_accounts;

CREATE POLICY ws_insert_wa_business_accounts
  ON public.wa_business_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY ws_update_wa_business_accounts
  ON public.wa_business_accounts
  FOR UPDATE
  TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));
