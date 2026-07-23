
-- customer_invoices: enforce owner_id = auth.uid()
DROP POLICY IF EXISTS ws_insert_customer_invoices ON public.customer_invoices;
CREATE POLICY ws_insert_customer_invoices ON public.customer_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND owner_id = auth.uid()
  );

-- customer_payments: admin-only inserts (webhook uses service_role and bypasses RLS)
DROP POLICY IF EXISTS ws_insert_customer_payments ON public.customer_payments;
CREATE POLICY ws_insert_customer_payments ON public.customer_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_workspace_admin_v2(workspace_id, auth.uid())
  );

-- nfse_invoices: admin-only inserts
DROP POLICY IF EXISTS ws_insert_nfse_invoices ON public.nfse_invoices;
CREATE POLICY ws_insert_nfse_invoices ON public.nfse_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    is_workspace_admin_v2(workspace_id, auth.uid())
  );
