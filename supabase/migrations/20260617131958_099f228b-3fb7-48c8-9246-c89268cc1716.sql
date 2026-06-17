-- Add link/recording/conference columns to calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS related_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conference_id text,
  ADD COLUMN IF NOT EXISTS hangout_link text,
  ADD COLUMN IF NOT EXISTS recording_drive_file_id text,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS recording_mime_type text,
  ADD COLUMN IF NOT EXISTS recording_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_status text;

CREATE INDEX IF NOT EXISTS calendar_events_related_contact_idx
  ON public.calendar_events(related_contact_id);
CREATE INDEX IF NOT EXISTS calendar_events_conference_idx
  ON public.calendar_events(conference_id);

-- Backfill related_contact_id by matching attendee emails to contacts (per workspace)
WITH ev_attendees AS (
  SELECT e.id AS event_id,
         e.owner_id,
         lower(att->>'email') AS email
    FROM public.calendar_events e
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(e.attendees, '[]'::jsonb)) AS att
   WHERE e.related_contact_id IS NULL
     AND att ? 'email'
),
matches AS (
  SELECT DISTINCT ON (ea.event_id)
         ea.event_id,
         c.id AS contact_id
    FROM ev_attendees ea
    JOIN public.contacts c
      ON c.owner_id = ea.owner_id
     AND lower(c.email) = ea.email
     AND c.deleted_at IS NULL
   ORDER BY ea.event_id, c.created_at
)
UPDATE public.calendar_events e
   SET related_contact_id = m.contact_id
  FROM matches m
 WHERE e.id = m.event_id;