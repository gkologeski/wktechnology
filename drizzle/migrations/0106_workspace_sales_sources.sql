-- Sales snapshots and configuration writers now use validated source workspace.
-- No direct SQL INSERT writers found for these six tables in the catalog audit.
-- Saved views are browser-only: legacy omitted workspace is resolved from authenticated session.
ALTER TABLE public.quotes ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.quote_line_items ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.dashboard_widgets ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.record_layouts ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.saved_views ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.sequence_enrollments ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
