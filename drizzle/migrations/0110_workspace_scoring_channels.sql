-- Scoring and channel writers preserve source workspace; line items are browser-only.
-- Cursor is independent for each workspace/owner pair. No foreign keys reference its old PK.
ALTER TABLE public.scoring_cursors DROP CONSTRAINT IF EXISTS scoring_cursors_pkey;
ALTER TABLE public.scoring_cursors ADD CONSTRAINT scoring_cursors_pkey PRIMARY KEY (workspace_id, owner_id);
ALTER TABLE public.score_events ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.scoring_cursors ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.tickets ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.whatsapp_messages ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
ALTER TABLE public.deal_line_items ALTER COLUMN workspace_id SET DEFAULT public.default_workspace_for_user(auth.uid());
