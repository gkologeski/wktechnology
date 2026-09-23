DROP POLICY IF EXISTS quote_line_items_baseline_owner_or_admin ON public.quote_line_items;
DROP POLICY IF EXISTS quote_line_items_baseline_owner_or_admin_del ON public.quote_line_items;
DROP POLICY IF EXISTS quote_line_items_baseline_owner_or_admin_ins ON public.quote_line_items;
DROP POLICY IF EXISTS deal_line_items_baseline_owner_or_admin_del ON public.deal_line_items;
DROP POLICY IF EXISTS deal_line_items_baseline_owner_or_admin_ins ON public.deal_line_items;

CREATE POLICY quote_line_items_baseline_ws_upd ON public.quote_line_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY quote_line_items_baseline_ws_del ON public.quote_line_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY quote_line_items_baseline_ws_ins ON public.quote_line_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY quote_line_items_admin_all ON public.quote_line_items FOR ALL TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY deal_line_items_baseline_ws_del ON public.deal_line_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY deal_line_items_baseline_ws_ins ON public.deal_line_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY deal_line_items_admin_all ON public.deal_line_items FOR ALL TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));