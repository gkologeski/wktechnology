
ALTER TABLE public.workflow_events
  ADD COLUMN IF NOT EXISTS run_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resume_workflow_id uuid,
  ADD COLUMN IF NOT EXISTS resume_cursor integer;

CREATE INDEX IF NOT EXISTS workflow_events_run_at_idx
  ON public.workflow_events (run_at)
  WHERE processed_at IS NULL;
