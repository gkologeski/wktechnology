-- outbound_webhooks: remove owner-only policies, add admin insert
DROP POLICY IF EXISTS "ws_insert_outbound_webhooks" ON public.outbound_webhooks;
DROP POLICY IF EXISTS "ws_select_outbound_webhooks" ON public.outbound_webhooks;
DROP POLICY IF EXISTS "ws_update_outbound_webhooks" ON public.outbound_webhooks;
DROP POLICY IF EXISTS "ws_delete_outbound_webhooks" ON public.outbound_webhooks;

CREATE POLICY "outbound_webhooks_admin_insert"
  ON public.outbound_webhooks FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin_of(owner_id, auth.uid()));

-- zapier_subscriptions: replace permissive write with admin-only write
DROP POLICY IF EXISTS "zap_sub write" ON public.zapier_subscriptions;

CREATE POLICY "zap_sub admin insert"
  ON public.zapier_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "zap_sub admin update"
  ON public.zapier_subscriptions FOR UPDATE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "zap_sub admin delete"
  ON public.zapier_subscriptions FOR DELETE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

-- contact_subscriptions: enforce owner_id = auth.uid() on insert
DROP POLICY IF EXISTS "ws_insert_contact_subscriptions" ON public.contact_subscriptions;

CREATE POLICY "ws_insert_contact_subscriptions"
  ON public.contact_subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND workspace_id IN (SELECT public.current_user_workspaces())
  );

-- marketplace_installations: restrict SELECT to workspace admins
DROP POLICY IF EXISTS "mp_inst select" ON public.marketplace_installations;

CREATE POLICY "mp_inst admin select"
  ON public.marketplace_installations FOR SELECT TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));