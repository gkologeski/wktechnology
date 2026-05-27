
DO $mig$
DECLARE v_ws uuid := '184b9435-0a9b-4334-9e89-8854dc883f5d'; t text;
  v_tables text[] := ARRAY['activities','ai_summaries','api_keys','booking_pages','bookings','calendar_accounts','calendar_events','companies','contact_subscriptions','contacts'];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET DEFAULT %L', t, v_ws);
  END LOOP;
END $mig$;
