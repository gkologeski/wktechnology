
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS recording_sid TEXT,
  ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS recording_channels INTEGER,
  ADD COLUMN IF NOT EXISTS transcription TEXT,
  ADD COLUMN IF NOT EXISTS transcription_status TEXT,
  ADD COLUMN IF NOT EXISTS transcription_model TEXT,
  ADD COLUMN IF NOT EXISTS related_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS activities_related_ticket_id_idx ON public.activities(related_ticket_id);
CREATE INDEX IF NOT EXISTS activities_recording_sid_idx ON public.activities(recording_sid);
CREATE INDEX IF NOT EXISTS activities_call_sid_idx ON public.activities ((external_ids->>'twilio_call_sid')) WHERE external_ids ? 'twilio_call_sid';
