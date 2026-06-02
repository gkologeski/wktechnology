-- Add HubSpot integration columns to tickets so they can be imported/dedup-ed
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hs_raw jsonb,
  ADD COLUMN IF NOT EXISTS hs_object_id text,
  ADD COLUMN IF NOT EXISTS hs_createdate timestamptz,
  ADD COLUMN IF NOT EXISTS hs_lastmodifieddate timestamptz,
  ADD COLUMN IF NOT EXISTS hubspot_owner_id text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS tickets_hs_object_id_idx ON public.tickets (hs_object_id);
CREATE INDEX IF NOT EXISTS idx_tickets_external_ids ON public.tickets USING gin (external_ids);
CREATE INDEX IF NOT EXISTS tickets_hs_raw_gin ON public.tickets USING gin (hs_raw);
CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON public.tickets (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tickets_hs_unique_idx
  ON public.tickets (owner_id, hs_object_id) WHERE hs_object_id IS NOT NULL;

-- Allow tickets to be a pipeline entity for HubSpot ticket pipelines
-- (pipelines.entity is text — no enum changes needed)