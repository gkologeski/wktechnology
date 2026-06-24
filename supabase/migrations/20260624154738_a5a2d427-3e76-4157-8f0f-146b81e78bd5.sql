
-- 1) Templates de scorecard
CREATE TABLE public.ats_scorecards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  job_id UUID REFERENCES public.ats_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ key, label, weight }]
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ats_scorecards_owner_idx ON public.ats_scorecards(owner_id);
CREATE INDEX ats_scorecards_job_idx ON public.ats_scorecards(job_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_scorecards TO authenticated;
GRANT ALL ON public.ats_scorecards TO service_role;

ALTER TABLE public.ats_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ats_scorecards_owner_all" ON public.ats_scorecards
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER ats_scorecards_updated_at
  BEFORE UPDATE ON public.ats_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Respostas / avaliações preenchidas
CREATE TABLE public.ats_scorecard_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  scorecard_id UUID NOT NULL REFERENCES public.ats_scorecards(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.ats_applications(id) ON DELETE CASCADE,
  evaluator_id UUID,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb, -- { [criterion_key]: number 1-5 }
  total_score NUMERIC,
  recommendation TEXT, -- 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ats_scorecard_resp_app_idx ON public.ats_scorecard_responses(application_id);
CREATE INDEX ats_scorecard_resp_owner_idx ON public.ats_scorecard_responses(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_scorecard_responses TO authenticated;
GRANT ALL ON public.ats_scorecard_responses TO service_role;

ALTER TABLE public.ats_scorecard_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ats_scorecard_resp_owner_all" ON public.ats_scorecard_responses
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER ats_scorecard_responses_updated_at
  BEFORE UPDATE ON public.ats_scorecard_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
