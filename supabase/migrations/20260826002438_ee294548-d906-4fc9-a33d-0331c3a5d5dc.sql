ALTER TABLE public.cron_run_logs ADD COLUMN IF NOT EXISTS workspace_id uuid;

CREATE INDEX IF NOT EXISTS cron_run_logs_job_workspace_started_idx
  ON public.cron_run_logs (job_name, workspace_id, started_at DESC);