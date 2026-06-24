
-- Helper: workspace owner or team member (hiring manager / recruiter) on a job
CREATE OR REPLACE FUNCTION public.can_access_ats_job(_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ats_jobs j
    WHERE j.id = _job_id
      AND (
        j.owner_id = auth.uid()
        OR j.hiring_manager_id = auth.uid()
        OR j.recruiter_id = auth.uid()
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_access_ats_job(uuid) TO authenticated;

-- Team visibility on jobs (SELECT only; owner keeps full ALL policy)
DROP POLICY IF EXISTS ats_jobs_team_select ON public.ats_jobs;
CREATE POLICY ats_jobs_team_select ON public.ats_jobs
  FOR SELECT TO authenticated
  USING (
    hiring_manager_id = auth.uid()
    OR recruiter_id = auth.uid()
  );

-- Team visibility on applications via parent job
DROP POLICY IF EXISTS ats_applications_team_select ON public.ats_applications;
CREATE POLICY ats_applications_team_select ON public.ats_applications
  FOR SELECT TO authenticated
  USING (public.can_access_ats_job(job_id));

-- Team visibility on candidates that have applications on accessible jobs
DROP POLICY IF EXISTS ats_candidates_team_select ON public.ats_candidates;
CREATE POLICY ats_candidates_team_select ON public.ats_candidates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ats_applications a
      WHERE a.candidate_id = ats_candidates.id
        AND public.can_access_ats_job(a.job_id)
    )
  );

-- Application events visibility for the team
DROP POLICY IF EXISTS ats_application_events_team_select ON public.ats_application_events;
CREATE POLICY ats_application_events_team_select ON public.ats_application_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ats_applications a
      WHERE a.id = ats_application_events.application_id
        AND public.can_access_ats_job(a.job_id)
    )
  );
