
ALTER TABLE public.people_onboarding_tasks
  ADD COLUMN IF NOT EXISTS is_critical BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revocation_system TEXT;

CREATE INDEX IF NOT EXISTS idx_people_onb_tasks_critical
  ON public.people_onboarding_tasks (plan_id)
  WHERE is_critical = true;
