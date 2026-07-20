
-- 1) ats_referrals: replace legacy has_role with is_workspace_admin_of
DROP POLICY IF EXISTS ats_referrals_self_select ON public.ats_referrals;
CREATE POLICY ats_referrals_self_select ON public.ats_referrals
  FOR SELECT TO authenticated
  USING (
    referrer_user_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
  );

-- 2) ats_talent_pools: add WITH CHECK to workspace_update
DROP POLICY IF EXISTS ats_talent_pools_workspace_update ON public.ats_talent_pools;
CREATE POLICY ats_talent_pools_workspace_update ON public.ats_talent_pools
  FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid()) OR public.is_workspace_member(owner_id, auth.uid()))
  WITH CHECK ((owner_id = auth.uid()) OR public.is_workspace_member(owner_id, auth.uid()));

-- 3) ats_talent_pool_members: add WITH CHECK to workspace_update
DROP POLICY IF EXISTS ats_talent_pool_members_workspace_update ON public.ats_talent_pool_members;
CREATE POLICY ats_talent_pool_members_workspace_update ON public.ats_talent_pool_members
  FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid()) OR public.is_workspace_member(owner_id, auth.uid()))
  WITH CHECK ((owner_id = auth.uid()) OR public.is_workspace_member(owner_id, auth.uid()));

-- 4) customer_invoices: tighten SELECT to admins or owner (protects PIX/boleto codes)
DROP POLICY IF EXISTS ws_select_customer_invoices ON public.customer_invoices;
CREATE POLICY ws_select_customer_invoices ON public.customer_invoices
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(workspace_id, auth.uid())
    OR public.user_has_permission(auth.uid(), 'finance.invoices.view')
  );
