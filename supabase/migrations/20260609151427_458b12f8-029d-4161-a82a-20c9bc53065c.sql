
-- Revoke column-level SELECT on sensitive columns from the authenticated role.
-- service_role retains full access for server-side code.

REVOKE SELECT (access_token, refresh_token) ON public.ads_accounts FROM authenticated;
REVOKE SELECT (access_token, refresh_token, sync_token) ON public.calendar_accounts FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.email_accounts FROM authenticated;
REVOKE SELECT (public_token) ON public.esign_signers FROM authenticated;
REVOKE SELECT (oauth_tokens, credentials_secret_ref) ON public.integrations FROM authenticated;
REVOKE SELECT (secret) ON public.outbound_webhooks FROM authenticated;
REVOKE SELECT (public_token) ON public.quotes FROM authenticated;
REVOKE SELECT (access_token) ON public.slack_integrations FROM authenticated;
REVOKE SELECT (access_token) ON public.wa_business_accounts FROM authenticated;
REVOKE SELECT (portal_token) ON public.contacts FROM authenticated;

-- Also revoke from anon to be safe (no-op if not granted).
REVOKE SELECT (access_token, refresh_token) ON public.ads_accounts FROM anon;
REVOKE SELECT (access_token, refresh_token, sync_token) ON public.calendar_accounts FROM anon;
REVOKE SELECT (access_token, refresh_token) ON public.email_accounts FROM anon;
REVOKE SELECT (public_token) ON public.esign_signers FROM anon;
REVOKE SELECT (oauth_tokens, credentials_secret_ref) ON public.integrations FROM anon;
REVOKE SELECT (secret) ON public.outbound_webhooks FROM anon;
REVOKE SELECT (public_token) ON public.quotes FROM anon;
REVOKE SELECT (access_token) ON public.slack_integrations FROM anon;
REVOKE SELECT (access_token) ON public.wa_business_accounts FROM anon;
REVOKE SELECT (portal_token) ON public.contacts FROM anon;
