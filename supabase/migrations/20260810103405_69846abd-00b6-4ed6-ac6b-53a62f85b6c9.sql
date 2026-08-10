-- 1) ats_talent_pool_members: remover escrita workspace-wide
DROP POLICY IF EXISTS ats_talent_pool_members_workspace_insert ON public.ats_talent_pool_members;
DROP POLICY IF EXISTS ats_talent_pool_members_workspace_update ON public.ats_talent_pool_members;
DROP POLICY IF EXISTS ats_talent_pool_members_workspace_delete ON public.ats_talent_pool_members;

CREATE POLICY ats_talent_pool_members_write_insert ON public.ats_talent_pool_members
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.can_write_owner(owner_id, auth.uid()));

-- 2) gate RBAC com escopo de workspace
CREATE OR REPLACE FUNCTION public.techhire_rbac_gate(_user uuid, _owner uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user IS NOT NULL AND _owner IS NOT NULL AND EXISTS (
    SELECT 1 FROM (
      SELECT w.id AS workspace_id FROM public.workspaces w WHERE w.id = _owner
      UNION
      SELECT w.id FROM public.workspaces w WHERE w.created_by = _owner
      UNION
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = _owner
    ) cw
    WHERE public.user_has_permission(_user, cw.workspace_id, _perm)
  );
$function$;

-- ats_jobs
DROP POLICY IF EXISTS ats_jobs_rbac_update ON public.ats_jobs;
CREATE POLICY ats_jobs_rbac_update ON public.ats_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.own') OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.own') OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.workspace'));
DROP POLICY IF EXISTS ats_jobs_rbac_delete ON public.ats_jobs;
CREATE POLICY ats_jobs_rbac_delete ON public.ats_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.delete.workspace'));
DROP POLICY IF EXISTS ats_jobs_rbac_insert ON public.ats_jobs;
CREATE POLICY ats_jobs_rbac_insert ON public.ats_jobs FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.create.own') AND owner_id = auth.uid());

-- ats_candidates
DROP POLICY IF EXISTS ats_candidates_rbac_update ON public.ats_candidates;
CREATE POLICY ats_candidates_rbac_update ON public.ats_candidates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.update.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.update.workspace'));
DROP POLICY IF EXISTS ats_candidates_rbac_delete ON public.ats_candidates;
CREATE POLICY ats_candidates_rbac_delete ON public.ats_candidates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.delete.workspace'));
DROP POLICY IF EXISTS ats_candidates_rbac_insert ON public.ats_candidates;
CREATE POLICY ats_candidates_rbac_insert ON public.ats_candidates FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.create.own') AND owner_id = auth.uid());

-- ats_applications
DROP POLICY IF EXISTS ats_applications_rbac_insert ON public.ats_applications;
CREATE POLICY ats_applications_rbac_insert ON public.ats_applications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.create.own'));
DROP POLICY IF EXISTS ats_applications_rbac_update ON public.ats_applications;
CREATE POLICY ats_applications_rbac_update ON public.ats_applications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.update.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.update.workspace'));
DROP POLICY IF EXISTS ats_applications_rbac_delete ON public.ats_applications;
CREATE POLICY ats_applications_rbac_delete ON public.ats_applications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.delete.workspace'));

-- ats_interviews
DROP POLICY IF EXISTS ats_interviews_rbac_insert ON public.ats_interviews;
CREATE POLICY ats_interviews_rbac_insert ON public.ats_interviews AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.interviews.schedule.workspace'));
DROP POLICY IF EXISTS ats_interviews_rbac_update ON public.ats_interviews;
CREATE POLICY ats_interviews_rbac_update ON public.ats_interviews AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.interviews.schedule.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.interviews.schedule.workspace'));
DROP POLICY IF EXISTS ats_interviews_rbac_delete ON public.ats_interviews;
CREATE POLICY ats_interviews_rbac_delete ON public.ats_interviews AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.interviews.schedule.workspace'));

-- ats_offers
DROP POLICY IF EXISTS ats_offers_rbac_insert ON public.ats_offers;
CREATE POLICY ats_offers_rbac_insert ON public.ats_offers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.offers.create.workspace'));
DROP POLICY IF EXISTS ats_offers_rbac_update ON public.ats_offers;
CREATE POLICY ats_offers_rbac_update ON public.ats_offers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.offers.create.workspace') OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.offers.approve.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.offers.create.workspace') OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.offers.approve.workspace'));
DROP POLICY IF EXISTS ats_offers_rbac_delete ON public.ats_offers;
CREATE POLICY ats_offers_rbac_delete ON public.ats_offers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.offers.approve.workspace'));

-- ats_job_postings
DROP POLICY IF EXISTS ats_job_postings_rbac_insert ON public.ats_job_postings;
CREATE POLICY ats_job_postings_rbac_insert ON public.ats_job_postings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.publish.workspace'));
DROP POLICY IF EXISTS ats_job_postings_rbac_update ON public.ats_job_postings;
CREATE POLICY ats_job_postings_rbac_update ON public.ats_job_postings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.publish.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.publish.workspace'));
DROP POLICY IF EXISTS ats_job_postings_rbac_delete ON public.ats_job_postings;
CREATE POLICY ats_job_postings_rbac_delete ON public.ats_job_postings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.publish.workspace'));

-- ats_sourcing_*
DROP POLICY IF EXISTS ats_sourcing_sequences_rbac_write ON public.ats_sourcing_sequences;
CREATE POLICY ats_sourcing_sequences_rbac_write ON public.ats_sourcing_sequences AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.sourcing.manage.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.sourcing.manage.workspace'));
DROP POLICY IF EXISTS ats_sourcing_enrollments_rbac_write ON public.ats_sourcing_enrollments;
CREATE POLICY ats_sourcing_enrollments_rbac_write ON public.ats_sourcing_enrollments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.sourcing.manage.workspace'))
  WITH CHECK (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.sourcing.manage.workspace'));