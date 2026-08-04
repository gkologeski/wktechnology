ALTER TABLE public.ats_jobs
  ADD COLUMN IF NOT EXISTS linkedin_publish_mode text,
  ADD COLUMN IF NOT EXISTS linkedin_budget_period text,
  ADD COLUMN IF NOT EXISTS linkedin_budget_amount numeric,
  ADD COLUMN IF NOT EXISTS linkedin_budget_currency text;

ALTER TABLE public.ats_jobs
  DROP CONSTRAINT IF EXISTS ats_jobs_linkedin_publish_mode_chk;
ALTER TABLE public.ats_jobs
  ADD CONSTRAINT ats_jobs_linkedin_publish_mode_chk
  CHECK (linkedin_publish_mode IS NULL OR linkedin_publish_mode IN ('FREE','PROMOTED'));

ALTER TABLE public.ats_jobs
  DROP CONSTRAINT IF EXISTS ats_jobs_linkedin_budget_period_chk;
ALTER TABLE public.ats_jobs
  ADD CONSTRAINT ats_jobs_linkedin_budget_period_chk
  CHECK (linkedin_budget_period IS NULL OR linkedin_budget_period IN ('total','daily'));