ALTER TABLE public.prospecting_call_attempts
  ADD COLUMN IF NOT EXISTS meeting_status text,
  ADD COLUMN IF NOT EXISTS meeting_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS meeting_link text,
  ADD COLUMN IF NOT EXISTS meeting_event_id text,
  ADD COLUMN IF NOT EXISTS meeting_offers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meeting_error text,
  ADD COLUMN IF NOT EXISTS meeting_whatsapp_status text;
ALTER TABLE public.prospecting_call_attempts
  ADD CONSTRAINT prospecting_call_attempts_meeting_status_chk
  CHECK (meeting_status IS NULL OR meeting_status IN ('booking','booked','failed'));