CREATE OR REPLACE FUNCTION public.reschedule_lovable_cron(p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $fn$
DECLARE
  v_base_prod text := 'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cm1odHphZW9uemptYmdiYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM4ODcsImV4cCI6MjA5NDM4OTg4N30.NZt1xBOm8e8Bcl6LKDRsfBBCY2sg_JXtMBjx8hb7sBg';
  v_headers text;
  v_results jsonb := '[]'::jsonb;
  v_jobs text[][] := ARRAY[
    ['calendar-tick',                    '*/15 * * * *', '/api/public/hooks/calendar-tick'],
    ['email-broadcast-tick',             '* * * * *',    '/api/public/hooks/email-broadcast-tick'],
    ['gmail-inbound-sync-tick',          '* * * * *',    '/api/public/hooks/email-sync-tick'],
    ['hubspot-import-tick',              '* * * * *',    '/api/public/hooks/hubspot-tick'],
    ['scheduled-exports-tick',           '0 * * * *',    '/api/public/hooks/scheduled-exports-tick'],
    ['scoring-tick-minutely',            '* * * * *',    '/api/public/hooks/scoring-tick'],
    ['sentiment-tick',                   '*/5 * * * *',  '/api/public/hooks/sentiment-tick'],
    ['sequences-tick',                   '* * * * *',    '/api/public/hooks/sequences-tick'],
    ['webhook-dispatch-tick',            '* * * * *',    '/api/public/hooks/webhook-tick'],
    ['whatsapp-campaign-tick',           '* * * * *',    '/api/public/hooks/whatsapp-campaign-tick'],
    ['workflows-tick',                   '* * * * *',    '/api/public/hooks/workflows-tick'],
    ['workflows-time-triggers-tick',     '*/15 * * * *', '/api/public/hooks/workflows-time-triggers-tick'],
    ['ai-summary-tick',                  '*/10 * * * *', '/api/public/hooks/ai-summary-tick'],
    ['sla-tick',                         '*/5 * * * *',  '/api/public/hooks/sla-tick'],
    ['contaazul-tick',                   '0 */6 * * *',  '/api/public/hooks/contaazul-tick']
  ];
  v_name text;
  v_sched text;
  v_path text;
  i int;
BEGIN
  IF p_secret IS NULL OR length(p_secret) < 16 THEN
    RAISE EXCEPTION 'invalid secret';
  END IF;

  v_headers := format(
    '{"Content-Type":"application/json","apikey":"%s","Authorization":"Bearer %s"}',
    v_anon, p_secret
  );

  FOR i IN 1 .. array_length(v_jobs, 1) LOOP
    v_name  := v_jobs[i][1];
    v_sched := v_jobs[i][2];
    v_path  := v_jobs[i][3];

    BEGIN
      PERFORM cron.unschedule(v_name);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      v_name,
      v_sched,
      format(
        $cmd$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb) as request_id;$cmd$,
        v_base_prod || v_path,
        v_headers
      )
    );

    v_results := v_results || jsonb_build_object('job', v_name, 'schedule', v_sched);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'rescheduled', v_results);
END;
$fn$;