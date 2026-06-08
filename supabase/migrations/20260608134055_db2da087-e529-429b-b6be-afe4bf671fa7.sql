REVOKE SELECT (access_token, refresh_token) ON public.ads_accounts FROM authenticated, anon;
REVOKE SELECT (access_token) ON public.slack_integrations FROM authenticated, anon;
REVOKE SELECT (access_token) ON public.wa_business_accounts FROM authenticated, anon;