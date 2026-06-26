CREATE TABLE IF NOT EXISTS public.ats_job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.ats_jobs(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  external_id text,
  external_url text,
  is_mock boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, provider)
);

CREATE INDEX IF NOT EXISTS ats_job_postings_owner_idx ON public.ats_job_postings (owner_id);
CREATE INDEX IF NOT EXISTS ats_job_postings_job_idx ON public.ats_job_postings (job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_job_postings TO authenticated;
GRANT ALL ON public.ats_job_postings TO service_role;

ALTER TABLE public.ats_job_postings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ats_job_postings_owner_all ON public.ats_job_postings;
CREATE POLICY ats_job_postings_owner_all ON public.ats_job_postings
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS ats_job_postings_team_select ON public.ats_job_postings;
CREATE POLICY ats_job_postings_team_select ON public.ats_job_postings
  FOR SELECT TO authenticated
  USING (public.can_access_ats_job(job_id));

DROP TRIGGER IF EXISTS update_ats_job_postings_updated_at ON public.ats_job_postings;
CREATE TRIGGER update_ats_job_postings_updated_at
  BEFORE UPDATE ON public.ats_job_postings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();