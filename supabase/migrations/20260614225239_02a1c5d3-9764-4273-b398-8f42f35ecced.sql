DROP POLICY IF EXISTS ws_select_payment_webhook_events ON public.payment_webhook_events;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.payment_webhook_events FROM authenticated;