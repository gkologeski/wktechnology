
-- ats_jobs: add tenant scope to team/shared select policies
DROP POLICY IF EXISTS ats_jobs_team_select ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_workspace_shared_select ON public.ats_jobs;

CREATE POLICY ats_jobs_team_select ON public.ats_jobs
  FOR SELECT
  USING (
    ((hiring_manager_id = auth.uid()) OR (recruiter_id = auth.uid()))
    AND public.is_workspace_member(owner_id, auth.uid())
  );

-- landing_page_events: restrict insert to workspace members of owner
DROP POLICY IF EXISTS lpe_auth_insert ON public.landing_page_events;

CREATE POLICY lpe_auth_insert ON public.landing_page_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    landing_page_id IS NOT NULL
    AND public.is_workspace_member(owner_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.landing_pages lp
      WHERE lp.id = landing_page_events.landing_page_id
        AND lp.owner_id = landing_page_events.owner_id
        AND lp.status = 'published'
    )
  );
