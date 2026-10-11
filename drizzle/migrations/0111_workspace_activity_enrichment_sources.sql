-- Remaining activity, enrichment job and credit writers explicitly supply source workspace.
-- SQL activities_spawn_recurrence already inserts NEW.workspace_id.
ALTER TABLE public.activities ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.enrichment_jobs ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.credit_ledger ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
