DROP POLICY IF EXISTS "permissions_read" ON public.permissions;
CREATE POLICY "permissions_read" ON public.permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.user_id = (SELECT auth.uid()) AND wm.status = 'active'));
DROP POLICY IF EXISTS "Authenticated can read channel health" ON public.channel_health_checks;
CREATE POLICY "Authenticated can read channel health" ON public.channel_health_checks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.user_id = (SELECT auth.uid()) AND wm.status = 'active'));