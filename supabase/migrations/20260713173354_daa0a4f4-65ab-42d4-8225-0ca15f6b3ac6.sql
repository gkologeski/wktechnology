
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS recording_matched_by text;

COMMENT ON COLUMN public.calendar_events.recording_matched_by IS
  'Como a gravação foi casada com o evento. Somente "meet-code" é aceito hoje. NULL indica vínculo legado sem auditoria.';

-- Limpa os 2 eventos NEXID cujas gravações foram identificadas como incorretas
-- pelo usuário, para permitir novo match estrito pelo cron.
WITH cleared AS (
  UPDATE public.calendar_events
     SET recording_drive_file_id = NULL,
         recording_url = NULL,
         recording_mime_type = NULL,
         recording_synced_at = NULL,
         recording_status = 'pending',
         recording_last_error = NULL,
         recording_attempts = 0,
         recording_matched_by = NULL
   WHERE id IN (
     'a3197b39-6c3e-474e-a361-6a937a626016',
     '44f7cb9e-9985-4d1d-bf0f-7b3bcfd3ec4f'
   )
  RETURNING id
)
UPDATE public.activities a
   SET recording_url = NULL
  FROM cleared c
 WHERE a.recording_url IS NOT NULL
   AND a.external_ids ->> 'calendar_event_id' = c.id::text;
