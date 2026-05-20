ALTER TABLE public.segments
  ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz,
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS refresh_interval_minutes integer NOT NULL DEFAULT 60;

CREATE INDEX IF NOT EXISTS idx_segments_owner_entity ON public.segments(owner_id, entity);

-- pg_cron tick for dynamic segment refresh (hourly)
DO $$
DECLARE v_url text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    v_url := 'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/segments-tick';
    PERFORM cron.unschedule('segments-tick');
    PERFORM cron.schedule(
      'segments-tick',
      '*/15 * * * *',
      format($cmd$select net.http_post(url := %L, headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb) as r$cmd$, v_url)
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;