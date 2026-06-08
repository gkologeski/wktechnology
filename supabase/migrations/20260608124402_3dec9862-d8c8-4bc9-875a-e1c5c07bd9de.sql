CREATE OR REPLACE FUNCTION public.schedule_platform_alerts_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_secret text;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cm1odHphZW9uemptYmdiYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM4ODcsImV4cCI6MjA5NDM4OTg4N30.NZt1xBOm8e8Bcl6LKDRsfBBCY2sg_JXtMBjx8hb7sBg';
  v_headers text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'cron_secret';
  IF v_secret IS NULL OR length(v_secret) < 8 THEN
    RAISE EXCEPTION 'cron_secret not configured in app_settings';
  END IF;
  v_headers := format('{"Content-Type":"application/json","apikey":"%s","Authorization":"Bearer %s"}', v_anon, v_secret);
  BEGIN PERFORM cron.unschedule('platform-alerts-tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule(
    'platform-alerts-tick',
    '*/5 * * * *',
    format(
      $cmd$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$cmd$,
      'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/platform-alerts-tick',
      v_headers
    )
  );
  RETURN jsonb_build_object('ok', true, 'job', 'platform-alerts-tick', 'schedule', '*/5 * * * *');
END $$;

-- Schedule it now using a one-shot superuser call via the existing reschedule pattern
DO $$
DECLARE v_secret text; v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cm1odHphZW9uemptYmdiYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM4ODcsImV4cCI6MjA5NDM4OTg4N30.NZt1xBOm8e8Bcl6LKDRsfBBCY2sg_JXtMBjx8hb7sBg'; v_headers text;
BEGIN
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'cron_secret';
  IF v_secret IS NULL THEN RETURN; END IF;
  v_headers := format('{"Content-Type":"application/json","apikey":"%s","Authorization":"Bearer %s"}', v_anon, v_secret);
  BEGIN PERFORM cron.unschedule('platform-alerts-tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule(
    'platform-alerts-tick',
    '*/5 * * * *',
    format($cmd$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$cmd$,
      'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/platform-alerts-tick',
      v_headers)
  );
END $$;