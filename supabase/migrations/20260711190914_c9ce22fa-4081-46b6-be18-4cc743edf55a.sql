
-- Helper: RBAC gate compatível com legado
CREATE OR REPLACE FUNCTION public.techhire_rbac_gate(_user uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user IS NOT NULL AND (
      -- Legado: usuário sem nenhum cargo/permission set atribuído
      NOT EXISTS (SELECT 1 FROM public.user_job_roles WHERE user_id = _user)
      AND NOT EXISTS (SELECT 1 FROM public.user_permission_sets WHERE user_id = _user)
    )
    OR public.user_has_permission(_user, _perm)
$$;

-- Macros de conveniência via políticas RESTRICTIVE (combinam com permissivas existentes)

-- ats_jobs
DROP POLICY IF EXISTS ats_jobs_rbac_insert ON public.ats_jobs;
CREATE POLICY ats_jobs_rbac_insert ON public.ats_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.jobs.create.own'));

DROP POLICY IF EXISTS ats_jobs_rbac_update ON public.ats_jobs;
CREATE POLICY ats_jobs_rbac_update ON public.ats_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.jobs.update.own') OR public.techhire_rbac_gate(auth.uid(), 'techhire.jobs.update.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.jobs.update.own') OR public.techhire_rbac_gate(auth.uid(), 'techhire.jobs.update.workspace'));

DROP POLICY IF EXISTS ats_jobs_rbac_delete ON public.ats_jobs;
CREATE POLICY ats_jobs_rbac_delete ON public.ats_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.jobs.delete.workspace'));

-- ats_candidates
DROP POLICY IF EXISTS ats_candidates_rbac_insert ON public.ats_candidates;
CREATE POLICY ats_candidates_rbac_insert ON public.ats_candidates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.candidates.create.own'));

DROP POLICY IF EXISTS ats_candidates_rbac_update ON public.ats_candidates;
CREATE POLICY ats_candidates_rbac_update ON public.ats_candidates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.candidates.update.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.candidates.update.workspace'));

DROP POLICY IF EXISTS ats_candidates_rbac_delete ON public.ats_candidates;
CREATE POLICY ats_candidates_rbac_delete ON public.ats_candidates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.candidates.delete.workspace'));

-- ats_applications
DROP POLICY IF EXISTS ats_applications_rbac_insert ON public.ats_applications;
CREATE POLICY ats_applications_rbac_insert ON public.ats_applications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.candidates.create.own'));

DROP POLICY IF EXISTS ats_applications_rbac_update ON public.ats_applications;
CREATE POLICY ats_applications_rbac_update ON public.ats_applications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.candidates.update.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.candidates.update.workspace'));

DROP POLICY IF EXISTS ats_applications_rbac_delete ON public.ats_applications;
CREATE POLICY ats_applications_rbac_delete ON public.ats_applications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.candidates.delete.workspace'));

-- ats_interviews
DROP POLICY IF EXISTS ats_interviews_rbac_insert ON public.ats_interviews;
CREATE POLICY ats_interviews_rbac_insert ON public.ats_interviews AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.interviews.schedule.workspace'));

DROP POLICY IF EXISTS ats_interviews_rbac_update ON public.ats_interviews;
CREATE POLICY ats_interviews_rbac_update ON public.ats_interviews AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.interviews.schedule.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.interviews.schedule.workspace'));

DROP POLICY IF EXISTS ats_interviews_rbac_delete ON public.ats_interviews;
CREATE POLICY ats_interviews_rbac_delete ON public.ats_interviews AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.interviews.schedule.workspace'));

-- ats_offers
DROP POLICY IF EXISTS ats_offers_rbac_insert ON public.ats_offers;
CREATE POLICY ats_offers_rbac_insert ON public.ats_offers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.offers.create.workspace'));

DROP POLICY IF EXISTS ats_offers_rbac_update ON public.ats_offers;
CREATE POLICY ats_offers_rbac_update ON public.ats_offers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.offers.create.workspace') OR public.techhire_rbac_gate(auth.uid(), 'techhire.offers.approve.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.offers.create.workspace') OR public.techhire_rbac_gate(auth.uid(), 'techhire.offers.approve.workspace'));

DROP POLICY IF EXISTS ats_offers_rbac_delete ON public.ats_offers;
CREATE POLICY ats_offers_rbac_delete ON public.ats_offers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.offers.approve.workspace'));

-- ats_job_postings (publicação)
DROP POLICY IF EXISTS ats_job_postings_rbac_insert ON public.ats_job_postings;
CREATE POLICY ats_job_postings_rbac_insert ON public.ats_job_postings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.jobs.publish.workspace'));

DROP POLICY IF EXISTS ats_job_postings_rbac_update ON public.ats_job_postings;
CREATE POLICY ats_job_postings_rbac_update ON public.ats_job_postings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.jobs.publish.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.jobs.publish.workspace'));

DROP POLICY IF EXISTS ats_job_postings_rbac_delete ON public.ats_job_postings;
CREATE POLICY ats_job_postings_rbac_delete ON public.ats_job_postings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.jobs.publish.workspace'));

-- Sourcing (sequences + enrollments)
DROP POLICY IF EXISTS ats_sourcing_sequences_rbac_write ON public.ats_sourcing_sequences;
CREATE POLICY ats_sourcing_sequences_rbac_write ON public.ats_sourcing_sequences AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.sourcing.manage.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.sourcing.manage.workspace'));

DROP POLICY IF EXISTS ats_sourcing_enrollments_rbac_write ON public.ats_sourcing_enrollments;
CREATE POLICY ats_sourcing_enrollments_rbac_write ON public.ats_sourcing_enrollments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), 'techhire.sourcing.manage.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), 'techhire.sourcing.manage.workspace'));
