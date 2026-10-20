-- Papel verificado da chave no workspace de origem do Clockify (owner/admin/not_admin/unknown).
ALTER TABLE public.clockify_connections
  ADD COLUMN IF NOT EXISTS source_access text,
  ADD COLUMN IF NOT EXISTS source_verified_at timestamptz;
ALTER TABLE public.clockify_connections
  DROP CONSTRAINT IF EXISTS clockify_connections_source_access_check;
ALTER TABLE public.clockify_connections
  ADD CONSTRAINT clockify_connections_source_access_check
  CHECK (source_access IS NULL OR source_access IN ('owner','admin','not_admin','unknown'));