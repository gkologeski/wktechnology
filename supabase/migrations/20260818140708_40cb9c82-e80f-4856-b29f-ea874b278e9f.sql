-- 1) ats_jobs: consolidate policy sprawl (16 -> 7), same effective access
DROP POLICY IF EXISTS ats_jobs_owner_all ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_admin_select ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_rbac_select ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_team_select ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_admin_update ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_team_update ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_admin_delete ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_team_delete ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_perm_insert ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_rbac_insert ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_rbac_update ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_rbac_delete ON public.ats_jobs;

CREATE POLICY ats_jobs_select ON public.ats_jobs
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
    OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.view.workspace')
    OR (((hiring_manager_id = auth.uid()) OR (recruiter_id = auth.uid()))
        AND public.is_workspace_member(owner_id, auth.uid()))
  );

CREATE POLICY ats_jobs_insert ON public.ats_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR (public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.jobs.create.own') AND owner_id = auth.uid())
    OR (public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.create.own') AND owner_id = auth.uid())
  );

CREATE POLICY ats_jobs_update ON public.ats_jobs
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
  );

CREATE POLICY ats_jobs_delete ON public.ats_jobs
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
  );

-- Restrictive RBAC gates (merged, preserving previous AND semantics)
CREATE POLICY ats_jobs_update_gate ON public.ats_jobs
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    (
      public.is_workspace_admin_of(owner_id, auth.uid())
      OR public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.jobs.update.workspace')
      OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.jobs.update.own'))
      OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.workspace')
      OR (owner_id = auth.uid() AND public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.own'))
    )
    AND (
      public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.own')
      OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.workspace')
    )
  )
  WITH CHECK (
    public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.own')
    OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.update.workspace')
  );

CREATE POLICY ats_jobs_delete_gate ON public.ats_jobs
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    (
      public.is_workspace_admin_of(owner_id, auth.uid())
      OR public.user_has_permission(auth.uid(), public.resolve_workspace_id(owner_id), 'techhire.jobs.delete.workspace')
      OR public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.delete.workspace')
    )
    AND public.techhire_rbac_gate(auth.uid(), owner_id, 'techhire.jobs.delete.workspace')
  );

DROP POLICY IF EXISTS ats_jobs_perm_update ON public.ats_jobs;
DROP POLICY IF EXISTS ats_jobs_perm_delete ON public.ats_jobs;

-- 2) public role -> authenticated (same conditions)
DROP POLICY IF EXISTS "audit read owner/admin" ON public.access_audit_log;
CREATE POLICY "audit read owner/admin" ON public.access_audit_log
  FOR SELECT TO authenticated
  USING (
    ((workspace_id IS NOT NULL) AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = access_audit_log.workspace_id AND w.created_by = auth.uid()))
    OR ((workspace_id IS NOT NULL) AND EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = access_audit_log.workspace_id AND m.user_id = auth.uid() AND m.role = ANY (ARRAY['owner','admin'])))
    OR EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid())
  );

DROP POLICY IF EXISTS jrs_write ON public.job_role_sets;
CREATE POLICY jrs_write ON public.job_role_sets
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.job_roles r WHERE r.id = job_role_sets.role_id AND r.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.permission_sets s WHERE s.id = job_role_sets.set_id AND s.owner_id = auth.uid() AND s.module = '__bundle__')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.job_roles r WHERE r.id = job_role_sets.role_id AND r.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.permission_sets s WHERE s.id = job_role_sets.set_id AND s.owner_id = auth.uid() AND s.module = '__bundle__')
  );

DROP POLICY IF EXISTS lp_member_insert ON public.landing_pages;
CREATE POLICY lp_member_insert ON public.landing_pages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin_of(owner_id, auth.uid()) OR public.can_write_owner(owner_id, auth.uid()));

DROP POLICY IF EXISTS lp_member_select ON public.landing_pages;
CREATE POLICY lp_member_select ON public.landing_pages
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(owner_id, auth.uid()));

DROP POLICY IF EXISTS ws_legal_entities_write ON public.legal_entities;
CREATE POLICY ws_legal_entities_write ON public.legal_entities
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()) AND public.is_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS ws_legal_entity_groups_select ON public.legal_entity_groups;
CREATE POLICY ws_legal_entity_groups_select ON public.legal_entity_groups
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

DROP POLICY IF EXISTS allocations_ws_delete ON public.people_allocations;
CREATE POLICY allocations_ws_delete ON public.people_allocations
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())
    AND (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()))
  );

DROP POLICY IF EXISTS allocations_ws_update ON public.people_allocations;
CREATE POLICY allocations_ws_update ON public.people_allocations
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())
    AND (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()))
  );

DROP POLICY IF EXISTS onb_plans_ws_admin_write ON public.people_onboarding_plans;
CREATE POLICY onb_plans_ws_admin_write ON public.people_onboarding_plans
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS onb_tasks_ws_admin_write ON public.people_onboarding_tasks;
CREATE POLICY onb_tasks_ws_admin_write ON public.people_onboarding_tasks
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS owner_delete_survey_templates ON public.survey_templates;
CREATE POLICY owner_delete_survey_templates ON public.survey_templates
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()));

DROP POLICY IF EXISTS owner_select_survey_templates ON public.survey_templates;
CREATE POLICY owner_select_survey_templates ON public.survey_templates
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_v2(workspace_id, auth.uid())
    OR workspace_id IN (SELECT public.current_user_workspaces())
  );

DROP POLICY IF EXISTS user_files_owner_all ON public.user_files;
CREATE POLICY user_files_owner_all ON public.user_files
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 3) media_assets: uploads must target a real workspace the user belongs to
DROP POLICY IF EXISTS media_assets_workspace_insert ON public.media_assets;
CREATE POLICY media_assets_workspace_insert ON public.media_assets
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND public.is_workspace_member(workspace_id, auth.uid()));

-- 4) people_incidents: consistent restrictive gates for read/update
CREATE POLICY people_incidents_select_gate ON public.people_incidents
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    ((person_id IS NOT NULL) AND public.can_view_person_sensitive(person_id))
    OR ((person_id IS NULL) AND public.is_workspace_admin_v2(owner_id, auth.uid()))
  );

CREATE POLICY people_incidents_update_gate ON public.people_incidents
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    ((person_id IS NOT NULL) AND public.can_manage_person(person_id))
    OR ((person_id IS NULL) AND public.is_workspace_admin_v2(owner_id, auth.uid()))
  )
  WITH CHECK (
    ((person_id IS NOT NULL) AND public.can_manage_person(person_id))
    OR ((person_id IS NULL) AND public.is_workspace_admin_v2(owner_id, auth.uid()))
  );