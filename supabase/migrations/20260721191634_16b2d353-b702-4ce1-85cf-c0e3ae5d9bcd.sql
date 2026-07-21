
-- TechPeople Sprint 2: Metas, One-on-Ones e Avaliações do tomador
-- Tabelas: people_goals, people_one_on_ones, people_reviews

-- ============================================================
-- 1) people_goals
-- ============================================================
CREATE TABLE public.people_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL DEFAULT 'kpi' CHECK (metric_type IN ('kpi','okr','task')),
  unit TEXT,
  target_value NUMERIC,
  current_value NUMERIC NOT NULL DEFAULT 0,
  progress_pct NUMERIC NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','done','canceled')),
  weight NUMERIC NOT NULL DEFAULT 1,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_people_goals_person ON public.people_goals(person_id);
CREATE INDEX idx_people_goals_owner ON public.people_goals(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_goals TO authenticated;
GRANT ALL ON public.people_goals TO service_role;
ALTER TABLE public.people_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "people_goals_select" ON public.people_goals FOR SELECT
  TO authenticated USING (public.can_view_person_sensitive(person_id));
CREATE POLICY "people_goals_insert" ON public.people_goals FOR INSERT
  TO authenticated WITH CHECK (public.can_manage_person(person_id));
CREATE POLICY "people_goals_update" ON public.people_goals FOR UPDATE
  TO authenticated USING (public.can_manage_person(person_id))
  WITH CHECK (public.can_manage_person(person_id));
CREATE POLICY "people_goals_delete" ON public.people_goals FOR DELETE
  TO authenticated USING (public.can_manage_person(person_id));

CREATE TRIGGER trg_people_goals_updated_at
BEFORE UPDATE ON public.people_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) people_one_on_ones
-- ============================================================
CREATE TABLE public.people_one_on_ones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  manager_id UUID,
  scheduled_at TIMESTAMPTZ,
  held_at TIMESTAMPTZ,
  duration_min INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','held','skipped','canceled')),
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  agenda TEXT,
  notes TEXT,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  private_notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_people_one_on_ones_person ON public.people_one_on_ones(person_id);
CREATE INDEX idx_people_one_on_ones_owner ON public.people_one_on_ones(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_one_on_ones TO authenticated;
GRANT ALL ON public.people_one_on_ones TO service_role;
ALTER TABLE public.people_one_on_ones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "people_1on1_select" ON public.people_one_on_ones FOR SELECT
  TO authenticated USING (public.can_view_person_sensitive(person_id));
CREATE POLICY "people_1on1_insert" ON public.people_one_on_ones FOR INSERT
  TO authenticated WITH CHECK (public.can_manage_person(person_id));
CREATE POLICY "people_1on1_update" ON public.people_one_on_ones FOR UPDATE
  TO authenticated USING (public.can_manage_person(person_id))
  WITH CHECK (public.can_manage_person(person_id));
CREATE POLICY "people_1on1_delete" ON public.people_one_on_ones FOR DELETE
  TO authenticated USING (public.can_manage_person(person_id));

CREATE TRIGGER trg_people_1on1_updated_at
BEFORE UPDATE ON public.people_one_on_ones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) people_reviews (avaliação do tomador/contratante)
-- Períodica (mensal/trimestral) com ratings por dimensão.
-- ============================================================
CREATE TABLE public.people_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  reviewer_id UUID,
  reviewer_name TEXT,
  reviewer_role TEXT,
  cadence TEXT NOT NULL DEFAULT 'monthly' CHECK (cadence IN ('monthly','quarterly','semiannual','annual','ad_hoc')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  ratings JSONB NOT NULL DEFAULT '{}'::jsonb, -- {delivery:4, quality:5, communication:4, ...}
  overall_score NUMERIC CHECK (overall_score >= 0 AND overall_score <= 5),
  strengths TEXT,
  improvements TEXT,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','acknowledged')),
  submitted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_people_reviews_person ON public.people_reviews(person_id);
CREATE INDEX idx_people_reviews_period ON public.people_reviews(person_id, period_end DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_reviews TO authenticated;
GRANT ALL ON public.people_reviews TO service_role;
ALTER TABLE public.people_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "people_reviews_select" ON public.people_reviews FOR SELECT
  TO authenticated USING (public.can_view_person_sensitive(person_id));
CREATE POLICY "people_reviews_insert" ON public.people_reviews FOR INSERT
  TO authenticated WITH CHECK (public.can_manage_person(person_id));
CREATE POLICY "people_reviews_update" ON public.people_reviews FOR UPDATE
  TO authenticated USING (public.can_manage_person(person_id))
  WITH CHECK (public.can_manage_person(person_id));
CREATE POLICY "people_reviews_delete" ON public.people_reviews FOR DELETE
  TO authenticated USING (public.can_manage_person(person_id));

CREATE TRIGGER trg_people_reviews_updated_at
BEFORE UPDATE ON public.people_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
