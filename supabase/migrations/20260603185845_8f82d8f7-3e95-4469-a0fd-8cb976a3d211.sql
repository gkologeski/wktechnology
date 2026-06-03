-- 1. Tighten row-level SELECT policies to owner-only on sensitive tables.
DROP POLICY IF EXISTS ws_select_api_keys ON public.api_keys;
CREATE POLICY ws_select_api_keys ON public.api_keys
FOR SELECT TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS ws_select_integrations ON public.integrations;
CREATE POLICY ws_select_integrations ON public.integrations
FOR SELECT TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS ws_select_outbound_webhooks ON public.outbound_webhooks;
CREATE POLICY ws_select_outbound_webhooks ON public.outbound_webhooks
FOR SELECT TO authenticated
USING (owner_id = auth.uid());

-- 2. Column-level REVOKE for sensitive fields that must never reach the client.
REVOKE SELECT (portal_token) ON public.contacts FROM authenticated, anon;
REVOKE SELECT (signature_data, ip_address, user_agent) ON public.esign_signers FROM authenticated, anon;