-- Leitura ordenada dos apontamentos de cada pessoa no staging do Clockify.
CREATE INDEX IF NOT EXISTS clockify_staging_entries_user_start_idx
  ON public.clockify_staging_records (workspace_id, source_workspace_id, (payload->>'userId'), ((payload->'timeInterval'->>'start')))
  WHERE entity_type = 'time_entry';