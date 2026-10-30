-- Performance only: identical access results, fewer per-row evaluations on the largest TechSales tables.
-- (1) sales_full_grants() lists "<workspace>:<resource>" pairs the caller can see regardless of the row's
--     responsible (the ".workspace" key path of sales_context_access). It is computed once per query and
--     checked with a hashed subplan. When it does not match, the original per-row sales_context_access()
--     still decides, so A OR B is equivalent to B because A implies B.
-- (2) auth.uid() inside rep_scope_* becomes an InitPlan, as already done for activities.
CREATE OR REPLACE FUNCTION public.sales_full_grants(_resources text[], _action text)
RETURNS SETOF text LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp' AS $$
  WITH ctx AS (SELECT public.sales_policy_context(_resources) AS c)
  SELECT (ctx.c->>'workspace') || ':' || r.res
    FROM ctx, unnest(_resources) AS r(res)
   WHERE ctx.c->>'workspace' IS NOT NULL
     AND public.sales_context_access(ctx.c, (ctx.c->>'workspace')::uuid, r.res, _action, ARRAY[]::uuid[])
$$;
REVOKE ALL ON FUNCTION public.sales_full_grants(text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_full_grants(text[], text) TO authenticated, service_role;

ALTER POLICY sales_view ON public.contacts
USING (((workspace_id::text || ':techsales.contacts') IN (SELECT public.sales_full_grants('{techsales.contacts}'::text[], 'view')))
  OR public.sales_context_access((SELECT public.sales_policy_context('{techsales.contacts}'::text[])), workspace_id, 'techsales.contacts'::text, 'view'::text, ARRAY[COALESCE(assigned_to, owner_id)]));

ALTER POLICY sales_view ON public.companies
USING (((workspace_id::text || ':techsales.companies') IN (SELECT public.sales_full_grants('{techsales.companies}'::text[], 'view')))
  OR public.sales_context_access((SELECT public.sales_policy_context('{techsales.companies}'::text[])), workspace_id, 'techsales.companies'::text, 'view'::text, ARRAY[COALESCE(assigned_to, owner_id)]));

ALTER POLICY sales_view ON public.leads
USING (((workspace_id::text || ':techsales.leads') IN (SELECT public.sales_full_grants('{techsales.leads}'::text[], 'view')))
  OR public.sales_context_access((SELECT public.sales_policy_context('{techsales.leads}'::text[])), workspace_id, 'techsales.leads'::text, 'view'::text, ARRAY[COALESCE(assigned_to, owner_id)]));

ALTER POLICY sales_view ON public.deals
USING (((workspace_id::text || ':techsales.deals') IN (SELECT public.sales_full_grants('{techsales.deals}'::text[], 'view')))
  OR public.sales_context_access((SELECT public.sales_policy_context('{techsales.deals}'::text[])), workspace_id, 'techsales.deals'::text, 'view'::text, ARRAY[COALESCE(assigned_to, owner_id)]));

ALTER POLICY sales_view ON public.activities
USING (((workspace_id::text || ':' || CASE WHEN ((type)::text = 'note'::text) THEN 'techsales.notes'::text WHEN ((type)::text = 'task'::text) THEN 'techsales.tasks'::text ELSE 'techsales.activities'::text END)
          IN (SELECT public.sales_full_grants('{techsales.activities,techsales.notes,techsales.tasks}'::text[], 'view')))
  OR public.sales_context_access((SELECT public.sales_policy_context('{techsales.activities,techsales.notes,techsales.tasks}'::text[])), workspace_id,
       CASE WHEN ((type)::text = 'note'::text) THEN 'techsales.notes'::text WHEN ((type)::text = 'task'::text) THEN 'techsales.tasks'::text ELSE 'techsales.activities'::text END,
       'view'::text, ARRAY[COALESCE(assigned_to, owner_id)]));

ALTER POLICY rep_scope_select_contacts ON public.contacts
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces_for('contacts'::text, 'view'::text))))
  OR (owner_id = (SELECT auth.uid())) OR (assigned_to = (SELECT auth.uid()))
  OR (id IN (SELECT public.rep_visible_contact_ids()))
  OR ((workspace_id IN (SELECT public.my_perm_workspaces('techsales.contacts.view.team'::text)))
      AND ((owner_id IN (SELECT public.my_team_member_ids())) OR (assigned_to IN (SELECT public.my_team_member_ids())))));

ALTER POLICY rep_scope_select_companies ON public.companies
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces_for('companies'::text, 'view'::text))))
  OR (owner_id = (SELECT auth.uid())) OR (assigned_to = (SELECT auth.uid()))
  OR (id IN (SELECT public.rep_visible_company_ids()))
  OR ((workspace_id IN (SELECT public.my_perm_workspaces('techsales.companies.view.team'::text)))
      AND ((owner_id IN (SELECT public.my_team_member_ids())) OR (assigned_to IN (SELECT public.my_team_member_ids())))));

ALTER POLICY rep_scope_select_deals ON public.deals
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces_for('deals'::text, 'view'::text))))
  OR (owner_id = (SELECT auth.uid())) OR (assigned_to = (SELECT auth.uid()))
  OR ((workspace_id IN (SELECT public.my_perm_workspaces('techsales.deals.view.team'::text)))
      AND ((owner_id IN (SELECT public.my_team_member_ids())) OR (assigned_to IN (SELECT public.my_team_member_ids())))));

ALTER POLICY rep_scope_select_leads ON public.leads
USING ((NOT (workspace_id IN (SELECT public.rep_restricted_workspaces_for('leads'::text, 'view'::text))))
  OR (owner_id = (SELECT auth.uid())) OR (assigned_to = (SELECT auth.uid())) OR (assigned_user_id = (SELECT auth.uid()))
  OR ((workspace_id IN (SELECT public.my_perm_workspaces('techsales.leads.view.team'::text)))
      AND ((owner_id IN (SELECT public.my_team_member_ids())) OR (assigned_to IN (SELECT public.my_team_member_ids())))));