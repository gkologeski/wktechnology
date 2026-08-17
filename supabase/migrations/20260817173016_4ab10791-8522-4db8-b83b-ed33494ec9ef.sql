update public.workflow_events
set processed_at = now()
where processed_at is null
  and entity = 'leads'
  and event_type = 'updated'
  and created_at >= '2026-08-17 15:00:00+00'
  and created_at < '2026-08-17 16:00:00+00';