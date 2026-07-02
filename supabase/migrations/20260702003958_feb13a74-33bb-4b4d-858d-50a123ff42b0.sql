ALTER TABLE public.ats_applications
  ADD COLUMN IF NOT EXISTS provider text NULL,
  ADD COLUMN IF NOT EXISTS provider_applicant_id text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ats_applications_provider_unique_idx
  ON public.ats_applications (job_id, provider, provider_applicant_id)
  WHERE provider IS NOT NULL AND provider_applicant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ats_job_postings_provider_sync_idx
  ON public.ats_job_postings (provider, status, last_synced_at)
  WHERE is_mock = false AND external_id IS NOT NULL;

DO $$
DECLARE
  v_secret text;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cm1odHphZW9uemptYmdiYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM4ODcsImV4cCI6MjA5NDM4OTg4N30.NZt1xBOm8e8Bcl6LKDRsfBBCY2sg_JXtMBjx8hb7sBg';
  v_headers text;
BEGIN
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'cron_secret';
  IF v_secret IS NULL THEN RETURN; END IF;
  v_headers := format('{"Content-Type":"application/json","apikey":"%s","Authorization":"Bearer %s"}', v_anon, v_secret);

  BEGIN PERFORM cron.unschedule('linkedin-applicants-sync'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule(
    'linkedin-applicants-sync',
    '0 * * * *',
    format($cmd$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb);$cmd$,
      'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/linkedin-applicants-sync',
      v_headers)
  );
END $$;