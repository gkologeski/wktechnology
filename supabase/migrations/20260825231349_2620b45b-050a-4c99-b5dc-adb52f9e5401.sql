GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_accounts TO authenticated;
GRANT ALL ON public.calendar_accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_accounts TO authenticated;
GRANT ALL ON public.email_accounts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbound_webhooks TO authenticated;
GRANT ALL ON public.outbound_webhooks TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT ALL ON public.payment_webhook_events TO service_role;