
-- Sprint 8 Phase 2: RLS hardening

-- FINANCIAL ENTRIES
DROP POLICY IF EXISTS ws_financial_entries_select ON public.financial_entries;
CREATE POLICY ws_financial_entries_select ON public.financial_entries
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      is_workspace_admin_v2(workspace_id, auth.uid())
      OR owner_id = auth.uid()
      OR user_has_permission(auth.uid(), workspace_id, 'finance.read')
    )
  );

DROP POLICY IF EXISTS ws_financial_entries_update ON public.financial_entries;
CREATE POLICY ws_financial_entries_update ON public.financial_entries
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (is_workspace_admin_v2(workspace_id, auth.uid()) OR owner_id = auth.uid())
  )
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_financial_entries_delete ON public.financial_entries;
CREATE POLICY ws_financial_entries_delete ON public.financial_entries
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  );

-- FINANCIAL PAYMENTS
DROP POLICY IF EXISTS ws_financial_payments_select ON public.financial_payments;
CREATE POLICY ws_financial_payments_select ON public.financial_payments
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      is_workspace_admin_v2(workspace_id, auth.uid())
      OR user_has_permission(auth.uid(), workspace_id, 'finance.read')
    )
  );

DROP POLICY IF EXISTS ws_financial_payments_insert ON public.financial_payments;
CREATE POLICY ws_financial_payments_insert ON public.financial_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS ws_financial_payments_update ON public.financial_payments;
CREATE POLICY ws_financial_payments_update ON public.financial_payments
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  )
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_financial_payments_delete ON public.financial_payments;
CREATE POLICY ws_financial_payments_delete ON public.financial_payments
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  );

-- FINANCIAL BANK ACCOUNTS
DROP POLICY IF EXISTS ws_financial_bank_accounts_select ON public.financial_bank_accounts;
CREATE POLICY ws_financial_bank_accounts_select ON public.financial_bank_accounts
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND is_workspace_admin_v2(workspace_id, auth.uid())
  );

-- CONTRACTS
DROP POLICY IF EXISTS ws_contracts_update ON public.contracts;
CREATE POLICY ws_contracts_update ON public.contracts
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (owner_id = auth.uid() OR is_workspace_admin_v2(workspace_id, auth.uid()))
  )
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_contracts_delete ON public.contracts;
CREATE POLICY ws_contracts_delete ON public.contracts
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (owner_id = auth.uid() OR is_workspace_admin_v2(workspace_id, auth.uid()))
  );

-- SERVICES
DROP POLICY IF EXISTS ws_services_update ON public.services;
CREATE POLICY ws_services_update ON public.services
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (owner_id = auth.uid() OR is_workspace_admin_v2(workspace_id, auth.uid()))
  )
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_services_delete ON public.services;
CREATE POLICY ws_services_delete ON public.services
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (owner_id = auth.uid() OR is_workspace_admin_v2(workspace_id, auth.uid()))
  );

-- CONTRACT APPROVALS
DROP POLICY IF EXISTS ws_contract_approvals_insert ON public.contract_approvals;
CREATE POLICY ws_contract_approvals_insert ON public.contract_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      is_workspace_admin_v2(workspace_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_approvals.contract_id
          AND c.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS ws_contract_approvals_update ON public.contract_approvals;
CREATE POLICY ws_contract_approvals_update ON public.contract_approvals
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (approver_id = auth.uid() OR is_workspace_admin_v2(workspace_id, auth.uid()))
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND (approver_id = auth.uid() OR is_workspace_admin_v2(workspace_id, auth.uid()))
  );

DROP POLICY IF EXISTS ws_contract_approvals_delete ON public.contract_approvals;
CREATE POLICY ws_contract_approvals_delete ON public.contract_approvals
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND (
      is_workspace_admin_v2(workspace_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_approvals.contract_id
          AND c.owner_id = auth.uid()
      )
    )
  );

-- CONTRACT EVENTS (append-only, actor must be the caller)
DROP POLICY IF EXISTS ws_contract_events_insert ON public.contract_events;
CREATE POLICY ws_contract_events_insert ON public.contract_events
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND actor_id = auth.uid()
  );
