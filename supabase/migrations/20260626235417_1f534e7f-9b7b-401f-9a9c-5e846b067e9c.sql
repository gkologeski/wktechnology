DO $$
DECLARE
  v_secret TEXT;
  v_anon TEXT;
  v_headers TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  SELECT decrypted_secret INTO v_anon FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;
  IF v_secret IS NULL THEN RETURN; END IF;
  v_headers := format('{"Content-Type":"application/json","apikey":"%s","Authorization":"Bearer %s"}', v_anon, v_secret);
  BEGIN PERFORM cron.unschedule('sourcing-tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule(
    'sourcing-tick',
    '* * * * *',
    format($cmd$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$cmd$,
      'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/sourcing-tick',
      v_headers)
  );
END $$;