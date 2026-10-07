DROP POLICY IF EXISTS rep_scope_select_companies ON public.companies;
CREATE POLICY rep_scope_select_companies ON public.companies
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT (workspace_id IN (SELECT public.rep_restricted_workspaces()))
    OR owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR id IN (SELECT public.rep_visible_company_ids())
  );

DROP POLICY IF EXISTS rep_scope_select_contacts ON public.contacts;
CREATE POLICY rep_scope_select_contacts ON public.contacts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT (workspace_id IN (SELECT public.rep_restricted_workspaces()))
    OR owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR id IN (SELECT public.rep_visible_contact_ids())
  );