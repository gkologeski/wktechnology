-- Background writers preserve source tenant; authenticated integration configuration validates active membership.
-- SQL enqueue_workflow_event already inserts v_ws from the originating row explicitly.
ALTER TABLE public.subscriptions ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.message_sentiments ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.integrations ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.hubspot_sync_state ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.workflow_events ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
