
-- Fix 1: contacts update/delete policies should pass owner_id (not workspace_id) to user_can_act
DROP POLICY IF EXISTS ws_update_contacts ON public.contacts;
DROP POLICY IF EXISTS ws_delete_contacts ON public.contacts;

CREATE POLICY ws_update_contacts ON public.contacts
FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND user_can_act('contacts', 'edit', owner_id, assigned_user_id)
)
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND user_can_act('contacts', 'edit', owner_id, assigned_user_id)
);

CREATE POLICY ws_delete_contacts ON public.contacts
FOR DELETE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND user_can_act('contacts', 'delete', owner_id, assigned_user_id)
);

-- Fix 2: outbound_webhooks — restrict SELECT/UPDATE/DELETE to workspace admins only
-- (matches slack_integrations / wa_business_accounts pattern) to prevent
-- non-admin team members from reading the HMAC signing secret.
DROP POLICY IF EXISTS outbound_webhooks_admin_select ON public.outbound_webhooks;
DROP POLICY IF EXISTS outbound_webhooks_team_update ON public.outbound_webhooks;
DROP POLICY IF EXISTS outbound_webhooks_team_delete ON public.outbound_webhooks;

CREATE POLICY outbound_webhooks_admin_select ON public.outbound_webhooks
FOR SELECT TO authenticated
USING (is_workspace_admin_of(owner_id, auth.uid()));
