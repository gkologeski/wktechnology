
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draft_actions jsonb,
  ADD COLUMN IF NOT EXISTS draft_trigger jsonb,
  ADD COLUMN IF NOT EXISTS draft_goal_filters jsonb,
  ADD COLUMN IF NOT EXISTS last_published_at timestamptz;

-- Backfill: workflows existentes viram 'published' e ganham draft = espelho da versão viva.
UPDATE public.workflows
SET
  status = 'published',
  published_version = GREATEST(published_version, 1),
  draft_actions = COALESCE(draft_actions, actions),
  draft_trigger = COALESCE(draft_trigger, trigger),
  draft_goal_filters = COALESCE(draft_goal_filters, goal_filters),
  last_published_at = COALESCE(last_published_at, updated_at)
WHERE status = 'draft' AND actions IS NOT NULL;

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS entity text,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS workflow_runs_entity_idx
  ON public.workflow_runs (entity, entity_id, created_at DESC);

-- Backfill entity_id/entity a partir de workflow_events.
UPDATE public.workflow_runs r
SET entity_id = e.entity_id, entity = e.entity
FROM public.workflow_events e
WHERE r.event_id = e.id AND r.entity_id IS NULL;
