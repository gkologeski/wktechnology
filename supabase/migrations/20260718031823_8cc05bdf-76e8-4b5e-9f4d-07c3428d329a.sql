CREATE TABLE IF NOT EXISTS public.cron_run_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cron_run_logs_job_started ON public.cron_run_logs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_run_logs_status_errors ON public.cron_run_logs (started_at DESC) WHERE status = 'error';

GRANT SELECT ON public.cron_run_logs TO authenticated;
GRANT ALL ON public.cron_run_logs TO service_role;

ALTER TABLE public.cron_run_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform admins read cron logs" ON public.cron_run_logs;
CREATE POLICY "platform admins read cron logs" ON public.cron_run_logs
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));