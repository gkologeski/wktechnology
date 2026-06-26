-- ============================================================================
-- Onda 5 / Slice 2 / Fase 2: Sourcing Sequences
-- ============================================================================

CREATE TABLE public.ats_sourcing_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  pool_id UUID REFERENCES public.ats_talent_pools(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ats_sourcing_sequences_owner_idx ON public.ats_sourcing_sequences(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_sourcing_sequences TO authenticated;
GRANT ALL ON public.ats_sourcing_sequences TO service_role;
ALTER TABLE public.ats_sourcing_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY seq_workspace_select ON public.ats_sourcing_sequences FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY seq_workspace_insert ON public.ats_sourcing_sequences FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY seq_workspace_update ON public.ats_sourcing_sequences FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY seq_workspace_delete ON public.ats_sourcing_sequences FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));

CREATE TRIGGER trg_ats_sourcing_sequences_updated_at
  BEFORE UPDATE ON public.ats_sourcing_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Steps
CREATE TABLE public.ats_sourcing_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.ats_sourcing_sequences(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  step_order INT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp','linkedin_task','wait')),
  delay_days INT NOT NULL DEFAULT 0,
  subject TEXT,
  body TEXT,
  task_instructions TEXT,
  template_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, step_order)
);
CREATE INDEX ats_seq_steps_seq_idx ON public.ats_sourcing_sequence_steps(sequence_id, step_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_sourcing_sequence_steps TO authenticated;
GRANT ALL ON public.ats_sourcing_sequence_steps TO service_role;
ALTER TABLE public.ats_sourcing_sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY seq_steps_workspace_all ON public.ats_sourcing_sequence_steps FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));

-- Enrollments
CREATE TABLE public.ats_sourcing_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES public.ats_sourcing_sequences(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','replied','completed','stopped')),
  current_step INT NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ,
  started_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, candidate_id)
);
CREATE INDEX ats_seq_enroll_owner_idx ON public.ats_sourcing_enrollments(owner_id, status);
CREATE INDEX ats_seq_enroll_due_idx ON public.ats_sourcing_enrollments(next_run_at)
  WHERE status = 'active' AND next_run_at IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_sourcing_enrollments TO authenticated;
GRANT ALL ON public.ats_sourcing_enrollments TO service_role;
ALTER TABLE public.ats_sourcing_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY seq_enroll_workspace_all ON public.ats_sourcing_enrollments FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));

CREATE TRIGGER trg_ats_sourcing_enrollments_updated_at
  BEFORE UPDATE ON public.ats_sourcing_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Step log
CREATE TABLE public.ats_sourcing_step_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.ats_sourcing_enrollments(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  step_order INT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','skipped','failed','task_created','task_completed','replied','opened')),
  error TEXT,
  ref_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ats_seq_log_enroll_idx ON public.ats_sourcing_step_log(enrollment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_sourcing_step_log TO authenticated;
GRANT ALL ON public.ats_sourcing_step_log TO service_role;
ALTER TABLE public.ats_sourcing_step_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY seq_log_workspace_select ON public.ats_sourcing_step_log FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY seq_log_workspace_insert ON public.ats_sourcing_step_log FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));

-- Feature flag
INSERT INTO public.feature_flags (owner_id, key, enabled, rollout_percentage, description, metadata)
SELECT DISTINCT owner_id, 'ats.sourcing.sequences', false, 0,
       'Cadências de sourcing multi-canal (email/WhatsApp/LinkedIn tarefa).',
       '{}'::jsonb
  FROM public.ats_candidates
 ON CONFLICT (owner_id, key) DO NOTHING;

-- ============================================================================
-- Onda 5 / Slice 2 / Fase 4: Referrals
-- ============================================================================

CREATE TABLE public.ats_referral_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  default_bonus_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  eligibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  terms_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ats_referral_programs_owner_idx ON public.ats_referral_programs(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_referral_programs TO authenticated;
GRANT ALL ON public.ats_referral_programs TO service_role;
ALTER TABLE public.ats_referral_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ref_prog_workspace_select ON public.ats_referral_programs FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY ref_prog_admin_write ON public.ats_referral_programs FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(owner_id, auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(owner_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_ats_referral_programs_updated_at
  BEFORE UPDATE ON public.ats_referral_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ats_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  program_id UUID REFERENCES public.ats_referral_programs(id) ON DELETE SET NULL,
  referrer_user_id UUID NOT NULL,
  candidate_id UUID REFERENCES public.ats_candidates(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.ats_jobs(id) ON DELETE SET NULL,
  candidate_name TEXT,
  candidate_email TEXT,
  candidate_phone TEXT,
  candidate_linkedin TEXT,
  relationship TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','accepted','interviewing','hired','rejected','paid','expired')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  hired_at TIMESTAMPTZ,
  bonus_cents BIGINT NOT NULL DEFAULT 0,
  bonus_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (bonus_status IN ('pending','eligible','approved','paid','forfeited')),
  bonus_paid_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ats_referrals_owner_idx ON public.ats_referrals(owner_id, status);
CREATE INDEX ats_referrals_referrer_idx ON public.ats_referrals(referrer_user_id);
CREATE INDEX ats_referrals_candidate_idx ON public.ats_referrals(candidate_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_referrals TO authenticated;
GRANT ALL ON public.ats_referrals TO service_role;
ALTER TABLE public.ats_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY ats_referrals_self_select ON public.ats_referrals FOR SELECT TO authenticated
  USING (
    referrer_user_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.has_role(owner_id, auth.uid(), 'admin')
  );

CREATE POLICY ats_referrals_member_insert ON public.ats_referrals FOR INSERT TO authenticated
  WITH CHECK (
    referrer_user_id = auth.uid()
    AND (owner_id = auth.uid() OR public.is_workspace_member(owner_id, auth.uid()))
  );

CREATE POLICY ats_referrals_admin_update ON public.ats_referrals FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(owner_id, auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(owner_id, auth.uid(), 'admin'));

CREATE POLICY ats_referrals_admin_delete ON public.ats_referrals FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(owner_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_ats_referrals_updated_at
  BEFORE UPDATE ON public.ats_referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: aplicação ligada a uma referral muda para hired → marca elegível
CREATE OR REPLACE FUNCTION public.ats_referrals_on_application_hired()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_lower TEXT := lower(coalesce(NEW.stage_value, ''));
BEGIN
  IF v_stage_lower NOT LIKE '%hired%' AND NEW.status <> 'hired' THEN
    RETURN NEW;
  END IF;
  UPDATE public.ats_referrals
     SET status = 'hired',
         hired_at = COALESCE(hired_at, now()),
         bonus_status = CASE WHEN bonus_status = 'pending' THEN 'eligible' ELSE bonus_status END
   WHERE candidate_id = NEW.candidate_id
     AND owner_id = NEW.owner_id
     AND status IN ('submitted','under_review','accepted','interviewing');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ats_referrals_on_hire ON public.ats_applications;
CREATE TRIGGER trg_ats_referrals_on_hire
  AFTER UPDATE ON public.ats_applications
  FOR EACH ROW EXECUTE FUNCTION public.ats_referrals_on_application_hired();

-- Feature flag
INSERT INTO public.feature_flags (owner_id, key, enabled, rollout_percentage, description, metadata)
SELECT DISTINCT owner_id, 'ats.sourcing.referrals', false, 0,
       'Programa de indicações com tracking de bônus.',
       '{}'::jsonb
  FROM public.ats_candidates
 ON CONFLICT (owner_id, key) DO NOTHING;