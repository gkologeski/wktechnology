
DROP POLICY IF EXISTS ws_contracts_update ON public.contracts;
CREATE POLICY ws_contracts_update ON public.contracts FOR UPDATE
  USING ((workspace_id IN (SELECT current_user_workspaces())) AND ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid())))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid())));

DROP POLICY IF EXISTS ws_services_update ON public.services;
CREATE POLICY ws_services_update ON public.services FOR UPDATE
  USING ((workspace_id IN (SELECT current_user_workspaces())) AND ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid())))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid())));

DROP POLICY IF EXISTS ws_financial_entries_update ON public.financial_entries;
CREATE POLICY ws_financial_entries_update ON public.financial_entries FOR UPDATE
  USING ((workspace_id IN (SELECT current_user_workspaces())) AND (is_workspace_admin_v2(workspace_id, auth.uid()) OR (owner_id = auth.uid())))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND (is_workspace_admin_v2(workspace_id, auth.uid()) OR (owner_id = auth.uid())));

DROP POLICY IF EXISTS ws_financial_payments_update ON public.financial_payments;
CREATE POLICY ws_financial_payments_update ON public.financial_payments FOR UPDATE
  USING ((workspace_id IN (SELECT current_user_workspaces())) AND is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND is_workspace_admin_v2(workspace_id, auth.uid()));

DROP POLICY IF EXISTS ws_update_customer_invoices ON public.customer_invoices;
CREATE POLICY ws_update_customer_invoices ON public.customer_invoices FOR UPDATE
  USING ((workspace_id IN (SELECT current_user_workspaces())) AND ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid())))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid())));
