
DROP POLICY IF EXISTS ws_delete_leads ON public.leads;
CREATE POLICY ws_delete_leads ON public.leads FOR DELETE TO authenticated USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('leads','delete', owner_id, assigned_user_id));

DROP POLICY IF EXISTS ws_update_leads ON public.leads;
CREATE POLICY ws_update_leads ON public.leads FOR UPDATE TO authenticated USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('leads','edit', owner_id, assigned_user_id));

DROP POLICY IF EXISTS ws_delete_tickets ON public.tickets;
CREATE POLICY ws_delete_tickets ON public.tickets FOR DELETE TO authenticated USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('tickets','delete', owner_id, assignee_id));

DROP POLICY IF EXISTS ws_update_tickets ON public.tickets;
CREATE POLICY ws_update_tickets ON public.tickets FOR UPDATE TO authenticated USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('tickets','edit', owner_id, assignee_id));

DROP POLICY IF EXISTS ws_delete_companies ON public.companies;
CREATE POLICY ws_delete_companies ON public.companies FOR DELETE TO authenticated USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('companies','delete', owner_id, assigned_user_id));

DROP POLICY IF EXISTS ws_update_companies ON public.companies;
CREATE POLICY ws_update_companies ON public.companies FOR UPDATE TO authenticated USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('companies','edit', owner_id, assigned_user_id));

DROP POLICY IF EXISTS ws_delete_contacts ON public.contacts;
CREATE POLICY ws_delete_contacts ON public.contacts FOR DELETE TO authenticated USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('contacts','delete', owner_id, assigned_user_id));

DROP POLICY IF EXISTS ws_update_contacts ON public.contacts;
CREATE POLICY ws_update_contacts ON public.contacts FOR UPDATE TO authenticated USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('contacts','edit', owner_id, assigned_user_id));

DROP POLICY IF EXISTS ws_delete_deals ON public.deals;
CREATE POLICY ws_delete_deals ON public.deals FOR DELETE TO authenticated USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('deals','delete', owner_id, assigned_user_id));

DROP POLICY IF EXISTS ws_update_deals ON public.deals;
CREATE POLICY ws_update_deals ON public.deals FOR UPDATE TO authenticated USING ((workspace_id IN (SELECT current_user_workspaces())) AND user_can_act('deals','edit', owner_id, assigned_user_id));

DROP POLICY IF EXISTS owner_delete_email_accounts ON public.email_accounts;
CREATE POLICY owner_delete_email_accounts ON public.email_accounts FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_update_email_accounts ON public.email_accounts;
CREATE POLICY owner_update_email_accounts ON public.email_accounts FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
