-- 1) Fix is_workspace_admin argument order in 3 policies (was auth.uid(), workspace_id;
--    signature is (_workspace uuid, _user uuid), so args were reversed).
DROP POLICY IF EXISTS ws_legal_entity_groups_write ON public.legal_entity_groups;
CREATE POLICY ws_legal_entity_groups_write ON public.legal_entity_groups
  FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.is_workspace_admin(workspace_id, auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.is_workspace_admin(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS ws_legal_entity_group_members_write ON public.legal_entity_group_members;
CREATE POLICY ws_legal_entity_group_members_write ON public.legal_entity_group_members
  FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.is_workspace_admin(workspace_id, auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.is_workspace_admin(workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS ws_cc_write ON public.financial_cost_centers;
CREATE POLICY ws_cc_write ON public.financial_cost_centers
  FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.is_workspace_admin(workspace_id, auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.is_workspace_admin(workspace_id, auth.uid())
  );

-- 2) profiles: restrict column-level SELECT so workspace peers cannot read
-- phone or notification_preferences via the Data API. Row-level RLS still
-- gates which rows are visible; column privileges further gate which columns
-- are readable. Sensitive columns are only accessed server-side via the
-- service-role client (see src/lib/notifications.functions.ts, workspace-invites).
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, avatar_url, created_at, updated_at, active_workspace_id)
  ON public.profiles TO authenticated;

-- Keep UPDATE grants narrowed to fields the app writes from the client. The
-- RLS UPDATE policy already limits row scope to auth.uid() = id.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, active_workspace_id) ON public.profiles TO authenticated;

-- INSERT/DELETE remain as previously configured (self-insert policy still applies).
GRANT INSERT (id, full_name, avatar_url) ON public.profiles TO authenticated;

-- service_role keeps full access for server-side handlers.
GRANT ALL ON public.profiles TO service_role;