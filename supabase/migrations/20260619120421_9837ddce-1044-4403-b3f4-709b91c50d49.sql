CREATE INDEX IF NOT EXISTS activities_workspace_type_created_at_idx
ON public.activities (workspace_id, type, created_at DESC)
WHERE deleted_at IS NULL;