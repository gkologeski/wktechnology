DROP POLICY IF EXISTS "Workspace admins can delete loss reasons" ON public.deal_loss_reasons;
DROP POLICY IF EXISTS "Workspace admins can insert loss reasons" ON public.deal_loss_reasons;
DROP POLICY IF EXISTS "Workspace admins can update loss reasons" ON public.deal_loss_reasons;
DROP POLICY IF EXISTS "Workspace members can view loss reasons" ON public.deal_loss_reasons;

CREATE POLICY "Workspace admins can delete loss reasons" ON public.deal_loss_reasons
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_workspace_admin_v2(workspace_id, auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Workspace admins can insert loss reasons" ON public.deal_loss_reasons
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_workspace_admin_v2(workspace_id, auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Workspace admins can update loss reasons" ON public.deal_loss_reasons
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_workspace_admin_v2(workspace_id, auth.uid()))
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_workspace_admin_v2(workspace_id, auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Workspace members can view loss reasons" ON public.deal_loss_reasons
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );