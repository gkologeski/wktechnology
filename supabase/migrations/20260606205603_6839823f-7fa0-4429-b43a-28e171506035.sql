-- Revoke SELECT on sensitive token/secret columns from the authenticated role.
-- RLS policies still allow row access, but PostgREST will refuse to return these
-- columns to the client. Server code uses service_role and is unaffected.

REVOKE SELECT (access_token, refresh_token, sync_token) ON public.calendar_accounts FROM authenticated;
REVOKE SELECT (access_token, refresh_token)              ON public.email_accounts    FROM authenticated;
REVOKE SELECT (secret)                                   ON public.outbound_webhooks FROM authenticated;
REVOKE SELECT (oauth_tokens)                             ON public.integrations      FROM authenticated;

-- Make sure server role keeps full access (idempotent).
GRANT ALL ON public.calendar_accounts TO service_role;
GRANT ALL ON public.email_accounts    TO service_role;
GRANT ALL ON public.outbound_webhooks TO service_role;
GRANT ALL ON public.integrations      TO service_role;