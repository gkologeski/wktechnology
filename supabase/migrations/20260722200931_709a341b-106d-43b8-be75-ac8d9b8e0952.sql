
DROP POLICY IF EXISTS sla_policies_insert ON public.sla_policies;
CREATE POLICY sla_policies_insert ON public.sla_policies FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND is_workspace_admin_v2(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS sla_policies_update ON public.sla_policies;
CREATE POLICY sla_policies_update ON public.sla_policies FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND is_workspace_admin_v2(workspace_id, auth.uid())
)
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND is_workspace_admin_v2(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS sla_policies_delete ON public.sla_policies;
CREATE POLICY sla_policies_delete ON public.sla_policies FOR DELETE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND is_workspace_admin_v2(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS sla_policies_admin_update ON public.sla_policies;
CREATE POLICY sla_policies_admin_update ON public.sla_policies FOR UPDATE TO authenticated
USING (is_workspace_admin_v2(workspace_id, auth.uid()))
WITH CHECK (is_workspace_admin_v2(workspace_id, auth.uid()));

DROP POLICY IF EXISTS sla_policies_admin_delete ON public.sla_policies;
CREATE POLICY sla_policies_admin_delete ON public.sla_policies FOR DELETE TO authenticated
USING (is_workspace_admin_v2(workspace_id, auth.uid()));

DROP POLICY IF EXISTS sla_policies_admin_select ON public.sla_policies;
CREATE POLICY sla_policies_admin_select ON public.sla_policies FOR SELECT TO authenticated
USING (is_workspace_admin_v2(workspace_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));
