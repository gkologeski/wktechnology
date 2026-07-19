ALTER TABLE public.bank_charges RENAME COLUMN owner_id TO workspace_id;
ALTER INDEX idx_bank_charges_owner RENAME TO idx_bank_charges_workspace;

DROP POLICY IF EXISTS "bank_charges_select_own" ON public.bank_charges;
DROP POLICY IF EXISTS "bank_charges_insert_own" ON public.bank_charges;
DROP POLICY IF EXISTS "bank_charges_update_own" ON public.bank_charges;
DROP POLICY IF EXISTS "bank_charges_delete_own" ON public.bank_charges;

CREATE POLICY "ws_bank_charges_select" ON public.bank_charges
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()) AND is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "ws_bank_charges_write" ON public.bank_charges
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()) AND is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND is_workspace_admin_v2(workspace_id, auth.uid()));
