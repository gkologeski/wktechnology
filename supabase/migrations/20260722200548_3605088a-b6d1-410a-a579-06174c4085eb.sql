
DROP POLICY IF EXISTS ws_insert_activities ON public.activities;
CREATE POLICY ws_insert_activities ON public.activities FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND user_has_permission(auth.uid(), workspace_id, 'techsales.activities.create.own')
  AND owner_id = auth.uid()
);

DROP POLICY IF EXISTS ats_candidates_perm_insert ON public.ats_candidates;
CREATE POLICY ats_candidates_perm_insert ON public.ats_candidates FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techhire.candidates.create.own') AND owner_id = auth.uid())
);
DROP POLICY IF EXISTS ats_candidates_rbac_insert ON public.ats_candidates;
CREATE POLICY ats_candidates_rbac_insert ON public.ats_candidates FOR INSERT TO authenticated
WITH CHECK (techhire_rbac_gate(auth.uid(), 'techhire.candidates.create.own') AND owner_id = auth.uid());

DROP POLICY IF EXISTS ats_jobs_perm_insert ON public.ats_jobs;
CREATE POLICY ats_jobs_perm_insert ON public.ats_jobs FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techhire.jobs.create.own') AND owner_id = auth.uid())
);
DROP POLICY IF EXISTS ats_jobs_rbac_insert ON public.ats_jobs;
CREATE POLICY ats_jobs_rbac_insert ON public.ats_jobs FOR INSERT TO authenticated
WITH CHECK (techhire_rbac_gate(auth.uid(), 'techhire.jobs.create.own') AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_companies ON public.companies;
CREATE POLICY ws_insert_companies ON public.companies FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    user_has_permission(auth.uid(), workspace_id, 'techsales.companies.manage.workspace')
    OR (user_has_permission(auth.uid(), workspace_id, 'techsales.companies.create.own') AND owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS ws_insert_contacts ON public.contacts;
CREATE POLICY ws_insert_contacts ON public.contacts FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND user_has_permission(auth.uid(), workspace_id, 'techsales.contacts.create.own')
  AND owner_id = auth.uid()
);

DROP POLICY IF EXISTS contracts_perm_insert ON public.contracts;
CREATE POLICY contracts_perm_insert ON public.contracts FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_v2(workspace_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techcontracts.contracts.create.own') AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS ws_insert_deals ON public.deals;
CREATE POLICY ws_insert_deals ON public.deals FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND user_has_permission(auth.uid(), workspace_id, 'techsales.deals.create.own')
  AND owner_id = auth.uid()
);

DROP POLICY IF EXISTS kb_articles_perm_insert ON public.kb_articles;
CREATE POLICY kb_articles_perm_insert ON public.kb_articles FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techservice.kb.create.own') AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS people_alloc_perm_insert ON public.people_allocations;
CREATE POLICY people_alloc_perm_insert ON public.people_allocations FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_v2(workspace_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techpeople.allocations.create.own') AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS people_benefits_perm_insert ON public.people_benefits;
CREATE POLICY people_benefits_perm_insert ON public.people_benefits FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techpeople.benefits.create.own') AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS people_docs_perm_insert ON public.people_documents;
CREATE POLICY people_docs_perm_insert ON public.people_documents FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techpeople.documents.create.own') AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS people_goals_perm_insert ON public.people_goals;
CREATE POLICY people_goals_perm_insert ON public.people_goals FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techpeople.goals.create.own') AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS people_incidents_perm_insert ON public.people_incidents;
CREATE POLICY people_incidents_perm_insert ON public.people_incidents FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techpeople.incidents.create.own') AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS people_1x1_perm_insert ON public.people_one_on_ones;
CREATE POLICY people_1x1_perm_insert ON public.people_one_on_ones FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techpeople.one_on_ones.create.own') AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS people_reviews_perm_insert ON public.people_reviews;
CREATE POLICY people_reviews_perm_insert ON public.people_reviews FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techpeople.reviews.create.own') AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS project_tasks_perm_insert ON public.project_tasks;
CREATE POLICY project_tasks_perm_insert ON public.project_tasks FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_v2(workspace_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techprojects.tasks.create.own') AND assignee_id = auth.uid())
);

DROP POLICY IF EXISTS ptime_perm_insert ON public.project_time_entries;
CREATE POLICY ptime_perm_insert ON public.project_time_entries FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_v2(workspace_id, auth.uid())
  OR (
    (user_has_permission(auth.uid(), 'techprojects.time_entries.create.own')
     OR user_has_permission(auth.uid(), 'techpeople.timesheet.create.own'))
    AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS projects_perm_insert ON public.projects;
CREATE POLICY projects_perm_insert ON public.projects FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_v2(workspace_id, auth.uid())
  OR (user_has_permission(auth.uid(), 'techprojects.projects.create.own') AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS ws_insert_quotes ON public.quotes;
CREATE POLICY ws_insert_quotes ON public.quotes FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.create.own')
  AND owner_id = auth.uid()
);

CREATE POLICY quote_line_items_baseline_owner_or_admin_ins
ON public.quote_line_items AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid() OR is_workspace_admin_of(owner_id, auth.uid()));

DROP POLICY IF EXISTS "read defaults" ON public.job_role_default_permissions;
CREATE POLICY jrdp_read_admins ON public.job_role_default_permissions
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()));
