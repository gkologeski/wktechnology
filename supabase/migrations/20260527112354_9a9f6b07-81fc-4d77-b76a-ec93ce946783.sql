-- Tighten workspace_invites RLS to admin-only access
DROP POLICY IF EXISTS "ws_select_workspace_invites" ON public.workspace_invites;
DROP POLICY IF EXISTS "ws_insert_workspace_invites" ON public.workspace_invites;
DROP POLICY IF EXISTS "ws_update_workspace_invites" ON public.workspace_invites;
DROP POLICY IF EXISTS "ws_delete_workspace_invites" ON public.workspace_invites;

CREATE POLICY "wi_select_admin" ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "wi_insert_admin" ON public.workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "wi_update_admin" ON public.workspace_invites
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "wi_delete_admin" ON public.workspace_invites
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));