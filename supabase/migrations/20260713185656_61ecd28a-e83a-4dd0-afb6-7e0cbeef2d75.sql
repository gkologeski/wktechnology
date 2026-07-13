
-- 1) Nova tabela de índice reverso meet_code -> arquivo do Drive
CREATE TABLE public.meet_recording_index (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  meet_code TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_url TEXT NOT NULL,
  mime_type TEXT,
  file_name TEXT,
  file_created_at TIMESTAMPTZ,
  discovered_by UUID REFERENCES public.calendar_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meet_recording_index_owner_code_uk UNIQUE (owner_id, meet_code)
);

CREATE INDEX meet_recording_index_owner_id_idx ON public.meet_recording_index (owner_id);
CREATE INDEX meet_recording_index_meet_code_idx ON public.meet_recording_index (meet_code);

GRANT SELECT ON public.meet_recording_index TO authenticated;
GRANT ALL ON public.meet_recording_index TO service_role;

ALTER TABLE public.meet_recording_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meet_recording_index_owner_select"
  ON public.meet_recording_index
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.meet_recording_index_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER meet_recording_index_updated_at
  BEFORE UPDATE ON public.meet_recording_index
  FOR EACH ROW EXECUTE FUNCTION public.meet_recording_index_touch_updated_at();

-- 2) Cursor de paginação incremental na conta de calendário
ALTER TABLE public.calendar_accounts
  ADD COLUMN IF NOT EXISTS meet_index_cursor TIMESTAMPTZ;

-- 3) Backfill: reprocessa eventos que estavam como not_found para tentar novo matcher
UPDATE public.calendar_events
SET recording_status = NULL,
    recording_last_error = NULL,
    recording_attempts = 0
WHERE recording_status = 'not_found'
  AND recording_drive_file_id IS NULL;
