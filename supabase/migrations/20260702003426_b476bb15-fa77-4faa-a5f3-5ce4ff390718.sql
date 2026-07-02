
-- Track provider/applicant_id for external sourcing (LinkedIn via Unipile, etc.)
ALTER TABLE public.ats_applications
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_applicant_id text;

CREATE UNIQUE INDEX IF NOT EXISTS ats_applications_provider_applicant_uniq
  ON public.ats_applications (job_id, provider, provider_applicant_id)
  WHERE provider IS NOT NULL AND provider_applicant_id IS NOT NULL;
