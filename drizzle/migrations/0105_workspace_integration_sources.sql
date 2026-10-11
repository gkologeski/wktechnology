-- Integration writers preserve the source record or signed OAuth workspace.
-- Catalog audit found no SQL INSERT writers for these seven tables.
ALTER TABLE public.ai_summaries ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.bookings ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.calendar_events ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.email_tracking_events ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.webhook_deliveries ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.calendar_accounts ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.email_accounts ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
