
-- ============================================================================
-- Suíte de Prospecção — tabelas base
-- ============================================================================

-- 1) prospecting_queues
CREATE TABLE public.prospecting_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  entity text NOT NULL CHECK (entity IN ('lead','contact')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_queues TO authenticated;
GRANT ALL ON public.prospecting_queues TO service_role;
ALTER TABLE public.prospecting_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospecting_queues owner all" ON public.prospecting_queues
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 2) prospecting_questionnaires
CREATE TABLE public.prospecting_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  framework text NOT NULL DEFAULT 'custom' CHECK (framework IN ('bant','meddic','champ','gpct','custom')),
  pipeline_id uuid,
  product_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  pass_threshold integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_questionnaires TO authenticated;
GRANT ALL ON public.prospecting_questionnaires TO service_role;
ALTER TABLE public.prospecting_questionnaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospecting_questionnaires owner all" ON public.prospecting_questionnaires
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 3) prospecting_questions
CREATE TABLE public.prospecting_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.prospecting_questionnaires(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  help_text text,
  type text NOT NULL CHECK (type IN ('single','multi','number','text','boolean')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  weight integer NOT NULL DEFAULT 1,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prospecting_questions_questionnaire_idx ON public.prospecting_questions(questionnaire_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_questions TO authenticated;
GRANT ALL ON public.prospecting_questions TO service_role;
ALTER TABLE public.prospecting_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospecting_questions owner all" ON public.prospecting_questions
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 4) prospecting_qualifications
CREATE TABLE public.prospecting_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  questionnaire_id uuid NOT NULL REFERENCES public.prospecting_questionnaires(id) ON DELETE RESTRICT,
  entity text NOT NULL CHECK (entity IN ('lead','contact')),
  entity_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer NOT NULL DEFAULT 0,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','qualified','disqualified','nurture','scheduled')),
  decision_reason text,
  qualified_by uuid,
  qualified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prospecting_qualifications_entity_idx ON public.prospecting_qualifications(entity, entity_id);
CREATE INDEX prospecting_qualifications_owner_idx ON public.prospecting_qualifications(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_qualifications TO authenticated;
GRANT ALL ON public.prospecting_qualifications TO service_role;
ALTER TABLE public.prospecting_qualifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospecting_qualifications owner all" ON public.prospecting_qualifications
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 5) prospecting_cadences
CREATE TABLE public.prospecting_cadences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  scope text NOT NULL DEFAULT 'sales' CHECK (scope IN ('sales','hr')),
  queue_id uuid REFERENCES public.prospecting_queues(id) ON DELETE SET NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  quiet_hours_start integer CHECK (quiet_hours_start IS NULL OR (quiet_hours_start BETWEEN 0 AND 23)),
  quiet_hours_end integer CHECK (quiet_hours_end IS NULL OR (quiet_hours_end BETWEEN 0 AND 23)),
  daily_send_limit integer,
  send_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_cadences TO authenticated;
GRANT ALL ON public.prospecting_cadences TO service_role;
ALTER TABLE public.prospecting_cadences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospecting_cadences owner all" ON public.prospecting_cadences
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 6) prospecting_cadence_steps
CREATE TABLE public.prospecting_cadence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id uuid NOT NULL REFERENCES public.prospecting_cadences(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  step_order integer NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','whatsapp','linkedin_task','linkedin_invite','linkedin_message','call','task','wait','wait_invite_accept')),
  delay_days integer NOT NULL DEFAULT 0,
  subject text,
  body text,
  task_instructions text,
  variant_label text NOT NULL DEFAULT 'A',
  variant_weight integer NOT NULL DEFAULT 1,
  max_wait_days integer,
  poll_interval_hours integer,
  on_timeout text CHECK (on_timeout IN ('skip_messages','end_sequence','continue')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cadence_id, step_order, variant_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_cadence_steps TO authenticated;
GRANT ALL ON public.prospecting_cadence_steps TO service_role;
ALTER TABLE public.prospecting_cadence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospecting_cadence_steps owner all" ON public.prospecting_cadence_steps
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 7) prospecting_enrollments
CREATE TABLE public.prospecting_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id uuid NOT NULL REFERENCES public.prospecting_cadences(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  entity text NOT NULL CHECK (entity IN ('lead','contact','candidate')),
  entity_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','stopped','replied','completed')),
  current_step integer NOT NULL DEFAULT 0,
  next_run_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  last_error text,
  started_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cadence_id, entity, entity_id)
);
CREATE INDEX prospecting_enrollments_owner_idx ON public.prospecting_enrollments(owner_id, next_run_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_enrollments TO authenticated;
GRANT ALL ON public.prospecting_enrollments TO service_role;
ALTER TABLE public.prospecting_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospecting_enrollments owner all" ON public.prospecting_enrollments
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Trigger updated_at para todas as tabelas
CREATE OR REPLACE FUNCTION public.set_prospecting_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER prospecting_queues_updated BEFORE UPDATE ON public.prospecting_queues FOR EACH ROW EXECUTE FUNCTION public.set_prospecting_updated_at();
CREATE TRIGGER prospecting_questionnaires_updated BEFORE UPDATE ON public.prospecting_questionnaires FOR EACH ROW EXECUTE FUNCTION public.set_prospecting_updated_at();
CREATE TRIGGER prospecting_questions_updated BEFORE UPDATE ON public.prospecting_questions FOR EACH ROW EXECUTE FUNCTION public.set_prospecting_updated_at();
CREATE TRIGGER prospecting_qualifications_updated BEFORE UPDATE ON public.prospecting_qualifications FOR EACH ROW EXECUTE FUNCTION public.set_prospecting_updated_at();
CREATE TRIGGER prospecting_cadences_updated BEFORE UPDATE ON public.prospecting_cadences FOR EACH ROW EXECUTE FUNCTION public.set_prospecting_updated_at();
CREATE TRIGGER prospecting_cadence_steps_updated BEFORE UPDATE ON public.prospecting_cadence_steps FOR EACH ROW EXECUTE FUNCTION public.set_prospecting_updated_at();
CREATE TRIGGER prospecting_enrollments_updated BEFORE UPDATE ON public.prospecting_enrollments FOR EACH ROW EXECUTE FUNCTION public.set_prospecting_updated_at();
