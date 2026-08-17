-- ats_jobs: políticas RESTRICTIVE passam a aceitar o gate de workspace/RBAC
DROP POLICY IF EXISTS ats_jobs_perm_select ON public.ats_jobs;
CREATE POLICY ats_jobs_perm_select ON public.ats_jobs
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.jobs.view.workspace')
    OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.view.workspace')
  );

DROP POLICY IF EXISTS ats_jobs_perm_update ON public.ats_jobs;
CREATE POLICY ats_jobs_perm_update ON public.ats_jobs
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.jobs.update.workspace')
    OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.jobs.update.own'))
    OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.workspace')
    OR (owner_id = auth.uid() AND public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.own'))
  );

DROP POLICY IF EXISTS ats_jobs_perm_delete ON public.ats_jobs;
CREATE POLICY ats_jobs_perm_delete ON public.ats_jobs
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.jobs.delete.workspace')
    OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.delete.workspace')
  );

-- ats_candidates
DROP POLICY IF EXISTS ats_candidates_perm_select ON public.ats_candidates;
CREATE POLICY ats_candidates_perm_select ON public.ats_candidates
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.candidates.view.workspace')
    OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.view.workspace')
  );

DROP POLICY IF EXISTS ats_candidates_perm_update ON public.ats_candidates;
CREATE POLICY ats_candidates_perm_update ON public.ats_candidates
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.candidates.update.workspace')
    OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.update.workspace')
  );

DROP POLICY IF EXISTS ats_candidates_perm_delete ON public.ats_candidates;
CREATE POLICY ats_candidates_perm_delete ON public.ats_candidates
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.candidates.delete.workspace')
    OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.candidates.delete.workspace')
  );