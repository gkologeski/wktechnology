-- calendar_accounts
CREATE TABLE IF NOT EXISTS public.calendar_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google','microsoft')),
  email TEXT NOT NULL,
  primary_calendar_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}'::text[],
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sync_token TEXT,
  last_synced_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, provider, email)
);

ALTER TABLE public.calendar_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_accounts_owner_all" ON public.calendar_accounts
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER calendar_accounts_updated BEFORE UPDATE ON public.calendar_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS calendar_accounts_owner_idx ON public.calendar_accounts(owner_id);

-- calendar_events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  calendar_account_id UUID NOT NULL REFERENCES public.calendar_accounts(id) ON DELETE CASCADE,
  provider_event_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  html_link TEXT,
  related_activity_id UUID,
  status TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (calendar_account_id, provider_event_id)
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_events_owner_all" ON public.calendar_events
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER calendar_events_updated BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS calendar_events_owner_idx ON public.calendar_events(owner_id);
CREATE INDEX IF NOT EXISTS calendar_events_start_idx ON public.calendar_events(start_at);
CREATE INDEX IF NOT EXISTS calendar_events_account_idx ON public.calendar_events(calendar_account_id);

-- pg_cron tick a cada 15 minutos
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'calendar-tick') THEN
    PERFORM cron.unschedule('calendar-tick');
  END IF;
END $$;

SELECT cron.schedule(
  'calendar-tick',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/calendar-tick',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cm1odHphZW9uemptYmdiYWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTM4ODcsImV4cCI6MjA5NDM4OTg4N30.NZt1xBOm8e8Bcl6LKDRsfBBCY2sg_JXtMBjx8hb7sBg'),
    body := '{}'::jsonb
  );
  $$
);