-- Add canonical meeting_key column for dedup, no time-based matching
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS meeting_key text;

-- Helper: strip Google recurring instance suffix like "_20260715T170000Z" from provider_event_id
CREATE OR REPLACE FUNCTION public.gcal_base_event_id(provider_event_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN provider_event_id IS NULL THEN NULL
    ELSE regexp_replace(provider_event_id, '_\d{8}T\d{6}Z?$', '')
  END;
$$;

-- Backfill meeting_key for existing google_calendar activities
WITH src AS (
  SELECT a.id AS activity_id,
         a.workspace_id,
         a.subject,
         (a.external_ids->>'calendar_event_id') AS cal_id,
         (a.external_ids->>'provider_event_id') AS pev_id,
         ce.conference_id,
         ce.provider_event_id AS ce_pev,
         ce.title AS ce_title
  FROM public.activities a
  LEFT JOIN public.calendar_events ce
    ON ce.id::text = (a.external_ids->>'calendar_event_id')
  WHERE a.type = 'meeting'
    AND (a.external_ids->>'source') = 'google_calendar'
)
UPDATE public.activities a
SET meeting_key = COALESCE(
  CASE WHEN NULLIF(TRIM(src.conference_id), '') IS NOT NULL
       THEN 'meet:' || lower(TRIM(src.conference_id)) END,
  CASE WHEN NULLIF(public.gcal_base_event_id(COALESCE(src.ce_pev, src.pev_id)), '') IS NOT NULL
       THEN 'gcal:' || public.gcal_base_event_id(COALESCE(src.ce_pev, src.pev_id)) END,
  CASE WHEN NULLIF(TRIM(COALESCE(src.ce_title, src.subject)), '') IS NOT NULL
       THEN 'title:' || lower(regexp_replace(TRIM(COALESCE(src.ce_title, src.subject)), '\s+', ' ', 'g')) END
)
FROM src
WHERE a.id = src.activity_id;

-- Merge duplicates: for each (workspace_id, meeting_key), keep oldest; coalesce fields; redirect calendar_events; delete losers
DO $$
DECLARE
  grp RECORD;
  keep_id uuid;
  loser RECORD;
BEGIN
  FOR grp IN
    SELECT workspace_id, meeting_key
    FROM public.activities
    WHERE meeting_key IS NOT NULL AND type = 'meeting'
    GROUP BY workspace_id, meeting_key
    HAVING count(*) > 1
  LOOP
    SELECT id INTO keep_id
    FROM public.activities
    WHERE workspace_id = grp.workspace_id
      AND meeting_key = grp.meeting_key
      AND type = 'meeting'
    ORDER BY created_at ASC
    LIMIT 1;

    FOR loser IN
      SELECT id, subject, body, recording_url, meeting_location, attachments, external_ids
      FROM public.activities
      WHERE workspace_id = grp.workspace_id
        AND meeting_key = grp.meeting_key
        AND type = 'meeting'
        AND id <> keep_id
    LOOP
      -- Coalesce fields into the surviving activity (only fill nulls/empties)
      UPDATE public.activities a
      SET subject = COALESCE(NULLIF(a.subject, ''), loser.subject),
          body = COALESCE(NULLIF(a.body, ''), loser.body),
          recording_url = COALESCE(a.recording_url, loser.recording_url),
          meeting_location = COALESCE(NULLIF(a.meeting_location, ''), loser.meeting_location),
          attachments = CASE
            WHEN a.attachments IS NULL OR a.attachments = '{}'::jsonb OR a.attachments = 'null'::jsonb
              THEN loser.attachments
            ELSE a.attachments
          END,
          external_ids = COALESCE(a.external_ids, '{}'::jsonb) || COALESCE(loser.external_ids, '{}'::jsonb)
      WHERE a.id = keep_id;

      -- Redirect calendar_events pointing at the loser
      UPDATE public.calendar_events
      SET related_activity_id = keep_id
      WHERE related_activity_id = loser.id;

      -- Delete the loser
      DELETE FROM public.activities WHERE id = loser.id;
    END LOOP;
  END LOOP;
END $$;

-- Unique index enforcing single activity per (workspace_id, meeting_key) for meetings
CREATE UNIQUE INDEX IF NOT EXISTS activities_meeting_key_unique
  ON public.activities (workspace_id, meeting_key)
  WHERE meeting_key IS NOT NULL AND type = 'meeting';