DROP POLICY IF EXISTS ws_contract_approvals_select ON public.contract_approvals;
CREATE POLICY ws_contract_approvals_select
ON public.contract_approvals FOR SELECT TO authenticated
USING (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_contract_events_select ON public.contract_events;
CREATE POLICY ws_contract_events_select
ON public.contract_events FOR SELECT TO authenticated
USING (workspace_id IN (SELECT current_user_workspaces()));