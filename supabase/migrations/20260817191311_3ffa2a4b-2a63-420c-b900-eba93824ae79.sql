-- Leitura por workspace com gate de permissão (techhire_rbac_gate resolve o
-- workspace do dono tanto para criadores quanto para membros convidados).

DROP POLICY IF EXISTS ats_jobs_rbac_select ON public.ats_jobs;
CREATE POLICY ats_jobs_rbac_select ON public.ats_jobs
  FOR SELECT TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.view.workspace'));

DROP POLICY IF EXISTS ats_candidates_rbac_select ON public.ats_candidates;
CREATE POLICY ats_candidates_rbac_select ON public.ats_candidates
  FOR SELECT TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.view.workspace'));

DROP POLICY IF EXISTS ats_applications_rbac_select ON public.ats_applications;
CREATE POLICY ats_applications_rbac_select ON public.ats_applications
  FOR SELECT TO authenticated
  USING (
    public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.view.workspace')
    OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.view.workspace')
  );

DROP POLICY IF EXISTS ats_interviews_rbac_select ON public.ats_interviews;
CREATE POLICY ats_interviews_rbac_select ON public.ats_interviews
  FOR SELECT TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.interviews.view.workspace'));

DROP POLICY IF EXISTS ats_job_postings_rbac_select ON public.ats_job_postings;
CREATE POLICY ats_job_postings_rbac_select ON public.ats_job_postings
  FOR SELECT TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.view.workspace'));

DROP POLICY IF EXISTS ats_offers_rbac_select ON public.ats_offers;
CREATE POLICY ats_offers_rbac_select ON public.ats_offers
  FOR SELECT TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.offers.view.workspace'));

DROP POLICY IF EXISTS ats_pipelines_rbac_select ON public.ats_pipelines;
CREATE POLICY ats_pipelines_rbac_select ON public.ats_pipelines
  FOR SELECT TO authenticated
  USING (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.pipelines.view.workspace'));