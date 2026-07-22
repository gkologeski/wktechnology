
-- =========================================================================
-- Fase 1 (Opção C): Restrictive RLS ligada a user_has_permission
-- 5 módulos PSA: TechHire, TechPeople, TechContracts, TechService, TechProjects
--
-- Estratégia: adicionar policies RESTRICTIVE que exigem uma das opções:
--   (a) dono do registro (owner_id = auth.uid())
--   (b) admin do workspace (is_workspace_admin_of ou is_workspace_admin_v2)
--   (c) usuário com a permission_key apropriada
--
-- RESTRICTIVE compõe com AS AND das policies existentes (permissivas),
-- ou seja, tightens sem quebrar acesso de owner/admin.
-- =========================================================================

-- ============ TechHire ============

-- ats_jobs (owner-scoped)
CREATE POLICY "ats_jobs_perm_select" ON public.ats_jobs AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techhire.jobs.view.workspace')
);
CREATE POLICY "ats_jobs_perm_insert" ON public.ats_jobs AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techhire.jobs.create.own')
);
CREATE POLICY "ats_jobs_perm_update" ON public.ats_jobs AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techhire.jobs.update.workspace')
  OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), 'techhire.jobs.update.own'))
);
CREATE POLICY "ats_jobs_perm_delete" ON public.ats_jobs AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techhire.jobs.delete.workspace')
);

-- ats_candidates (owner-scoped)
CREATE POLICY "ats_candidates_perm_select" ON public.ats_candidates AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techhire.candidates.view.workspace')
);
CREATE POLICY "ats_candidates_perm_insert" ON public.ats_candidates AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techhire.candidates.create.own')
);
CREATE POLICY "ats_candidates_perm_update" ON public.ats_candidates AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techhire.candidates.update.workspace')
);
CREATE POLICY "ats_candidates_perm_delete" ON public.ats_candidates AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techhire.candidates.delete.workspace')
);

-- ============ TechPeople ============

-- people (owner-scoped)
CREATE POLICY "people_perm_select" ON public.people AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.people.view.workspace')
);
CREATE POLICY "people_perm_insert" ON public.people AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.people.create.own')
);
CREATE POLICY "people_perm_update" ON public.people AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.people.update.workspace')
  OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), 'techpeople.people.update.own'))
);
CREATE POLICY "people_perm_delete" ON public.people AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.people.delete.workspace')
);

-- people_documents (owner-scoped)
CREATE POLICY "people_docs_perm_select" ON public.people_documents AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.documents.view.workspace')
);
CREATE POLICY "people_docs_perm_insert" ON public.people_documents AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.documents.create.own')
);
CREATE POLICY "people_docs_perm_update" ON public.people_documents AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.documents.update.workspace')
);
CREATE POLICY "people_docs_perm_delete" ON public.people_documents AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.documents.delete.workspace')
);

-- people_goals (owner-scoped)
CREATE POLICY "people_goals_perm_select" ON public.people_goals AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.goals.view.workspace')
  OR public.user_has_permission(auth.uid(), 'techpeople.goals.view.own')
);
CREATE POLICY "people_goals_perm_insert" ON public.people_goals AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.goals.create.own')
);
CREATE POLICY "people_goals_perm_update" ON public.people_goals AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.goals.update.workspace')
  OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), 'techpeople.goals.update.own'))
);
CREATE POLICY "people_goals_perm_delete" ON public.people_goals AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.goals.delete.workspace')
);

-- people_reviews (owner-scoped)
CREATE POLICY "people_reviews_perm_select" ON public.people_reviews AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.reviews.view.workspace')
);
CREATE POLICY "people_reviews_perm_insert" ON public.people_reviews AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.reviews.create.own')
);
CREATE POLICY "people_reviews_perm_update" ON public.people_reviews AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.reviews.update.workspace')
);
CREATE POLICY "people_reviews_perm_delete" ON public.people_reviews AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.reviews.delete.workspace')
);

-- people_incidents (owner-scoped)
CREATE POLICY "people_incidents_perm_select" ON public.people_incidents AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.incidents.view.workspace')
);
CREATE POLICY "people_incidents_perm_insert" ON public.people_incidents AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.incidents.create.own')
);
CREATE POLICY "people_incidents_perm_update" ON public.people_incidents AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.incidents.update.workspace')
);
CREATE POLICY "people_incidents_perm_delete" ON public.people_incidents AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.incidents.delete.workspace')
);

-- people_allocations (workspace-scoped)
CREATE POLICY "people_alloc_perm_select" ON public.people_allocations AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.allocations.view.workspace')
);
CREATE POLICY "people_alloc_perm_insert" ON public.people_allocations AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.allocations.create.own')
);
CREATE POLICY "people_alloc_perm_update" ON public.people_allocations AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.allocations.update.workspace')
);
CREATE POLICY "people_alloc_perm_delete" ON public.people_allocations AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.allocations.delete.workspace')
);

-- people_benefits (owner-scoped)
CREATE POLICY "people_benefits_perm_select" ON public.people_benefits AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.benefits.view.workspace')
);
CREATE POLICY "people_benefits_perm_insert" ON public.people_benefits AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.benefits.create.own')
);
CREATE POLICY "people_benefits_perm_update" ON public.people_benefits AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.benefits.update.workspace')
);
CREATE POLICY "people_benefits_perm_delete" ON public.people_benefits AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.benefits.delete.workspace')
);

-- people_one_on_ones (owner-scoped)
CREATE POLICY "people_1x1_perm_select" ON public.people_one_on_ones AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.one_on_ones.view.workspace')
  OR public.user_has_permission(auth.uid(), 'techpeople.one_on_ones.view.own')
);
CREATE POLICY "people_1x1_perm_insert" ON public.people_one_on_ones AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.one_on_ones.create.own')
);
CREATE POLICY "people_1x1_perm_update" ON public.people_one_on_ones AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), 'techpeople.one_on_ones.update.own'))
);
CREATE POLICY "people_1x1_perm_delete" ON public.people_one_on_ones AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techpeople.one_on_ones.delete.workspace')
);

-- ============ TechContracts ============

-- contracts (workspace-scoped e owner-scoped)
CREATE POLICY "contracts_perm_select" ON public.contracts AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techcontracts.contracts.view.workspace')
  OR public.user_has_permission(auth.uid(), 'techcontracts.contracts.view.own')
);
CREATE POLICY "contracts_perm_insert" ON public.contracts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techcontracts.contracts.create.own')
);
CREATE POLICY "contracts_perm_update" ON public.contracts AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techcontracts.contracts.update.workspace')
  OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), 'techcontracts.contracts.update.own'))
);
CREATE POLICY "contracts_perm_delete" ON public.contracts AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techcontracts.contracts.delete.workspace')
);

-- ============ TechService ============

-- macros (workspace-scoped)
CREATE POLICY "macros_perm_select" ON public.macros AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.macros.view.workspace')
);
CREATE POLICY "macros_perm_insert" ON public.macros AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.macros.create.own')
);
CREATE POLICY "macros_perm_update" ON public.macros AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.macros.update.workspace')
);
CREATE POLICY "macros_perm_delete" ON public.macros AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.macros.delete.workspace')
);

-- sla_policies (workspace-scoped)
CREATE POLICY "sla_perm_select" ON public.sla_policies AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.sla.view.workspace')
);
CREATE POLICY "sla_perm_insert" ON public.sla_policies AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.sla.manage.workspace')
);
CREATE POLICY "sla_perm_update" ON public.sla_policies AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.sla.manage.workspace')
);
CREATE POLICY "sla_perm_delete" ON public.sla_policies AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.sla.manage.workspace')
);

-- kb_articles (owner-scoped; SELECT anon público continua permissivo)
CREATE POLICY "kb_articles_perm_insert" ON public.kb_articles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.kb.create.own')
);
CREATE POLICY "kb_articles_perm_update" ON public.kb_articles AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.kb.update.workspace')
);
CREATE POLICY "kb_articles_perm_delete" ON public.kb_articles AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_of(owner_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techservice.kb.delete.workspace')
);

-- ============ TechProjects ============

-- projects (workspace-scoped)
CREATE POLICY "projects_perm_select" ON public.projects AS RESTRICTIVE FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.projects.view.workspace')
  OR public.user_has_permission(auth.uid(), 'techprojects.projects.view.own')
);
CREATE POLICY "projects_perm_insert" ON public.projects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.projects.create.own')
);
CREATE POLICY "projects_perm_update" ON public.projects AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.projects.update.workspace')
  OR (owner_id = auth.uid() AND public.user_has_permission(auth.uid(), 'techprojects.projects.update.own'))
);
CREATE POLICY "projects_perm_delete" ON public.projects AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.projects.delete.workspace')
);

-- project_tasks (workspace-scoped, com assignee)
CREATE POLICY "project_tasks_perm_select" ON public.project_tasks AS RESTRICTIVE FOR SELECT TO authenticated USING (
  assignee_id = auth.uid()
  OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.tasks.view.workspace')
  OR public.user_has_permission(auth.uid(), 'techprojects.tasks.view.own')
);
CREATE POLICY "project_tasks_perm_insert" ON public.project_tasks AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.tasks.create.own')
);
CREATE POLICY "project_tasks_perm_update" ON public.project_tasks AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.tasks.update.workspace')
  OR (assignee_id = auth.uid() AND public.user_has_permission(auth.uid(), 'techprojects.tasks.update.own'))
);
CREATE POLICY "project_tasks_perm_delete" ON public.project_tasks AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.tasks.delete.workspace')
);

-- project_time_entries (usado por Timesheet TechPeople também)
CREATE POLICY "ptime_perm_select" ON public.project_time_entries AS RESTRICTIVE FOR SELECT TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.time_entries.view.workspace')
  OR public.user_has_permission(auth.uid(), 'techprojects.time_entries.view.own')
  OR public.user_has_permission(auth.uid(), 'techpeople.timesheet.view.workspace')
  OR public.user_has_permission(auth.uid(), 'techpeople.timesheet.view.own')
);
CREATE POLICY "ptime_perm_insert" ON public.project_time_entries AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.time_entries.create.own')
  OR public.user_has_permission(auth.uid(), 'techpeople.timesheet.create.own')
);
CREATE POLICY "ptime_perm_update" ON public.project_time_entries AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.time_entries.update.workspace')
  OR public.user_has_permission(auth.uid(), 'techprojects.time_entries.update.own')
  OR public.user_has_permission(auth.uid(), 'techpeople.timesheet.update.workspace')
  OR public.user_has_permission(auth.uid(), 'techpeople.timesheet.update.own')
);
CREATE POLICY "ptime_perm_delete" ON public.project_time_entries AS RESTRICTIVE FOR DELETE TO authenticated USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.time_entries.delete.workspace')
  OR public.user_has_permission(auth.uid(), 'techpeople.timesheet.delete.workspace')
);

-- project_spaces / folders / lists / milestones (workspace-scoped)
CREATE POLICY "pspaces_perm_write" ON public.project_spaces AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.spaces.view.workspace')
)
WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.spaces.create.own')
  OR public.user_has_permission(auth.uid(), 'techprojects.spaces.update.workspace')
);

CREATE POLICY "pfolders_perm_write" ON public.project_folders AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.folders.view.workspace')
)
WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.folders.create.own')
  OR public.user_has_permission(auth.uid(), 'techprojects.folders.update.workspace')
);

CREATE POLICY "plists_perm_write" ON public.project_lists AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.lists.view.workspace')
)
WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.lists.create.own')
  OR public.user_has_permission(auth.uid(), 'techprojects.lists.update.workspace')
);

CREATE POLICY "pmilestones_perm_write" ON public.project_milestones AS RESTRICTIVE FOR ALL TO authenticated
USING (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.milestones.view.workspace')
)
WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  OR public.user_has_permission(auth.uid(), 'techprojects.milestones.create.own')
  OR public.user_has_permission(auth.uid(), 'techprojects.milestones.update.workspace')
);
