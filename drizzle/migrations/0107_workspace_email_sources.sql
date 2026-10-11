-- Email writers inherit workspace from the connected account, campaign or workflow.
-- Catalog audit: no direct SQL INSERT writers for these four tables.
ALTER TABLE public.email_threads ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.email_messages ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.email_unsubscribes ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.email_broadcast_recipients ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
