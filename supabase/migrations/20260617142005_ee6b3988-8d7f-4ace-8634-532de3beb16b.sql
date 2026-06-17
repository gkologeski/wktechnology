ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS recording_last_error TEXT,
  ADD COLUMN IF NOT EXISTS recording_attempts INTEGER NOT NULL DEFAULT 0;