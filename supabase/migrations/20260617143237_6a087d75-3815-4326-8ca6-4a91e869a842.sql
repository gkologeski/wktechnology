ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS summary_status TEXT,
  ADD COLUMN IF NOT EXISTS summary_text TEXT,
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS summary_error TEXT,
  ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ;