
-- EVENT BUS v2 -------------------------------------------------------------
CREATE TABLE public.domain_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  entity_type TEXT,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  processed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, dedupe_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.domain_events TO authenticated;
GRANT ALL ON public.domain_events TO service_role;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_events_owner_all" ON public.domain_events
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX domain_events_owner_idx ON public.domain_events(owner_id);
CREATE INDEX domain_events_unprocessed_idx ON public.domain_events(occurred_at) WHERE processed_at IS NULL;
CREATE INDEX domain_events_name_idx ON public.domain_events(owner_id, event_name);

-- updated_at helper --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ATS Pipelines ------------------------------------------------------------
CREATE TABLE public.ats_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_pipelines TO authenticated;
GRANT ALL ON public.ats_pipelines TO service_role;
ALTER TABLE public.ats_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ats_pipelines_owner_all" ON public.ats_pipelines
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX ats_pipelines_owner_idx ON public.ats_pipelines(owner_id);
CREATE TRIGGER ats_pipelines_updated_at BEFORE UPDATE ON public.ats_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ATS Jobs -----------------------------------------------------------------
CREATE TABLE public.ats_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  pipeline_id UUID REFERENCES public.ats_pipelines(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  requirements TEXT,
  seniority TEXT,
  employment_type TEXT,
  location TEXT,
  remote_mode TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'draft',
  deal_id UUID,
  company_id UUID,
  hiring_manager_id UUID,
  recruiter_id UUID,
  opened_at TIMESTAMPTZ,
  filled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_jobs TO authenticated;
GRANT ALL ON public.ats_jobs TO service_role;
ALTER TABLE public.ats_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ats_jobs_owner_all" ON public.ats_jobs
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX ats_jobs_owner_idx ON public.ats_jobs(owner_id);
CREATE INDEX ats_jobs_status_idx ON public.ats_jobs(owner_id, status);
CREATE INDEX ats_jobs_deal_idx ON public.ats_jobs(deal_id);
CREATE UNIQUE INDEX ats_jobs_owner_slug_idx ON public.ats_jobs(owner_id, slug) WHERE slug IS NOT NULL;
CREATE TRIGGER ats_jobs_updated_at BEFORE UPDATE ON public.ats_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ATS Candidates (avoid reserved word "current_role") ---------------------
CREATE TABLE public.ats_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  location TEXT,
  current_position TEXT,
  current_company TEXT,
  cv_url TEXT,
  cv_parsed JSONB,
  skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source TEXT NOT NULL DEFAULT 'manual',
  score NUMERIC,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_candidates TO authenticated;
GRANT ALL ON public.ats_candidates TO service_role;
ALTER TABLE public.ats_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ats_candidates_owner_all" ON public.ats_candidates
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX ats_candidates_owner_idx ON public.ats_candidates(owner_id);
CREATE INDEX ats_candidates_email_idx ON public.ats_candidates(owner_id, lower(email));
CREATE TRIGGER ats_candidates_updated_at BEFORE UPDATE ON public.ats_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ATS Applications --------------------------------------------------------
CREATE TABLE public.ats_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  candidate_id UUID NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.ats_jobs(id) ON DELETE CASCADE,
  stage_value TEXT NOT NULL DEFAULT 'applied',
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'manual',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rejection_reason TEXT,
  position INT NOT NULL DEFAULT 0,
  ai_match_score NUMERIC,
  ai_match_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_applications TO authenticated;
GRANT ALL ON public.ats_applications TO service_role;
ALTER TABLE public.ats_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ats_applications_owner_all" ON public.ats_applications
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX ats_applications_owner_idx ON public.ats_applications(owner_id);
CREATE INDEX ats_applications_job_idx ON public.ats_applications(job_id, stage_value, position);
CREATE INDEX ats_applications_candidate_idx ON public.ats_applications(candidate_id);
CREATE TRIGGER ats_applications_updated_at BEFORE UPDATE ON public.ats_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ENTITLEMENTS ------------------------------------------------------------
INSERT INTO public.plan_entitlements (plan_code, key, enabled, limit_int) VALUES
  ('free',   'feature.ats',                 false, NULL),
  ('bronze', 'feature.ats',                 false, NULL),
  ('prata',  'feature.ats',                 true,  5),
  ('ouro',   'feature.ats',                 true,  NULL),
  ('free',   'feature.ats_cv_parsing',      false, NULL),
  ('bronze', 'feature.ats_cv_parsing',      false, NULL),
  ('prata',  'feature.ats_cv_parsing',      true,  50),
  ('ouro',   'feature.ats_cv_parsing',      true,  NULL),
  ('free',   'feature.ats_linkedin_apply',  false, NULL),
  ('bronze', 'feature.ats_linkedin_apply',  false, NULL),
  ('prata',  'feature.ats_linkedin_apply',  false, NULL),
  ('ouro',   'feature.ats_linkedin_apply',  true,  NULL),
  ('free',   'feature.workflows_v2',        false, NULL),
  ('bronze', 'feature.workflows_v2',        false, NULL),
  ('prata',  'feature.workflows_v2',        true,  10),
  ('ouro',   'feature.workflows_v2',        true,  NULL)
ON CONFLICT (plan_code, key) DO UPDATE
  SET enabled = EXCLUDED.enabled, limit_int = EXCLUDED.limit_int;
