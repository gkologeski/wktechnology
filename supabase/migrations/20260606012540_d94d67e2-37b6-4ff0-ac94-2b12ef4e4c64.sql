-- Two-way sync HubSpot: watermarks e detecção de conflitos
ALTER TABLE public.hubspot_sync_state
  ADD COLUMN IF NOT EXISTS local_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remote_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conflict_status TEXT NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS conflict_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_pushed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_hubspot_sync_state_conflict
  ON public.hubspot_sync_state(owner_id, conflict_status)
  WHERE conflict_status <> 'ok';

CREATE INDEX IF NOT EXISTS idx_hubspot_sync_state_entity_local
  ON public.hubspot_sync_state(owner_id, entity, local_id);
