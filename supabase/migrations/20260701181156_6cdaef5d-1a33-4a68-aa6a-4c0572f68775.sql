
ALTER TABLE public.ats_jobs
  ADD COLUMN IF NOT EXISTS linkedin_company_id text,
  ADD COLUMN IF NOT EXISTS linkedin_company_name text,
  ADD COLUMN IF NOT EXISTS linkedin_location_id text,
  ADD COLUMN IF NOT EXISTS linkedin_location_name text,
  ADD COLUMN IF NOT EXISTS linkedin_workplace text,
  ADD COLUMN IF NOT EXISTS linkedin_employment_status text,
  ADD COLUMN IF NOT EXISTS linkedin_apply_type text DEFAULT 'linkedin',
  ADD COLUMN IF NOT EXISTS linkedin_apply_url text,
  ADD COLUMN IF NOT EXISTS linkedin_notification_email text;

ALTER TABLE public.ats_jobs
  DROP CONSTRAINT IF EXISTS ats_jobs_linkedin_workplace_check;
ALTER TABLE public.ats_jobs
  ADD CONSTRAINT ats_jobs_linkedin_workplace_check
  CHECK (linkedin_workplace IS NULL OR linkedin_workplace IN ('REMOTE','HYBRID','ON_SITE'));

ALTER TABLE public.ats_jobs
  DROP CONSTRAINT IF EXISTS ats_jobs_linkedin_employment_status_check;
ALTER TABLE public.ats_jobs
  ADD CONSTRAINT ats_jobs_linkedin_employment_status_check
  CHECK (linkedin_employment_status IS NULL OR linkedin_employment_status IN (
    'FULL_TIME','PART_TIME','CONTRACT','INTERNSHIP','TEMPORARY','VOLUNTEER','OTHER'
  ));

ALTER TABLE public.ats_jobs
  DROP CONSTRAINT IF EXISTS ats_jobs_linkedin_apply_type_check;
ALTER TABLE public.ats_jobs
  ADD CONSTRAINT ats_jobs_linkedin_apply_type_check
  CHECK (linkedin_apply_type IS NULL OR linkedin_apply_type IN ('linkedin','external'));
