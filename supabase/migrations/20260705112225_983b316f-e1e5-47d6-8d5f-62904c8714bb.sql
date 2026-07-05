
-- Add WITH CHECK to UPDATE policies to prevent cross-tenant reassignment.

DROP POLICY IF EXISTS ws_update_leads ON public.leads;
CREATE POLICY ws_update_leads ON public.leads FOR UPDATE
  USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('leads','edit', owner_id, assigned_user_id))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('leads','edit', owner_id, assigned_user_id));

DROP POLICY IF EXISTS ws_update_deals ON public.deals;
CREATE POLICY ws_update_deals ON public.deals FOR UPDATE
  USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('deals','edit', owner_id, assigned_user_id))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('deals','edit', owner_id, assigned_user_id));

DROP POLICY IF EXISTS ws_update_companies ON public.companies;
CREATE POLICY ws_update_companies ON public.companies FOR UPDATE
  USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('companies','edit', owner_id, assigned_user_id))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('companies','edit', owner_id, assigned_user_id));

DROP POLICY IF EXISTS ws_update_tickets ON public.tickets;
CREATE POLICY ws_update_tickets ON public.tickets FOR UPDATE
  USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('tickets','edit', owner_id, assignee_id))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('tickets','edit', owner_id, assignee_id));

DROP POLICY IF EXISTS ws_update_customer_invoices ON public.customer_invoices;
CREATE POLICY ws_update_customer_invoices ON public.customer_invoices FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_customer_payments ON public.customer_payments;
CREATE POLICY ws_update_customer_payments ON public.customer_payments FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_dunning_runs ON public.dunning_runs;
CREATE POLICY ws_update_dunning_runs ON public.dunning_runs FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_dunning_policies ON public.dunning_policies;
CREATE POLICY ws_update_dunning_policies ON public.dunning_policies FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_nfse_invoices ON public.nfse_invoices;
CREATE POLICY ws_update_nfse_invoices ON public.nfse_invoices FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_pca ON public.prospecting_call_attempts;
CREATE POLICY ws_update_pca ON public.prospecting_call_attempts FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_vas ON public.voice_agent_settings;
CREATE POLICY ws_update_vas ON public.voice_agent_settings FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
