DROP POLICY IF EXISTS ws_insert_customer_invoices ON public.customer_invoices;
CREATE POLICY ws_insert_customer_invoices ON public.customer_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND owner_id = auth.uid()
    AND public.user_has_permission(auth.uid(), workspace_id, 'techfinance.invoices.create.own')
  );

DROP POLICY IF EXISTS ws_financial_entries_insert ON public.financial_entries;
CREATE POLICY ws_financial_entries_insert ON public.financial_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND owner_id = auth.uid()
    AND public.user_has_permission(auth.uid(), workspace_id, 'techfinance.entries.create.own')
  );