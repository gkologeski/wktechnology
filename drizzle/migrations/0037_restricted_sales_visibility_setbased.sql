-- Versão em conjunto (avaliada uma vez por consulta) das regras do cargo restrito.
CREATE OR REPLACE FUNCTION public.rep_restricted_workspaces()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT coalesce(ujr.workspace_id, jr.workspace_id)
  FROM public.user_job_roles ujr
  JOIN public.job_roles jr ON jr.id = ujr.role_id
  WHERE ujr.user_id = auth.uid() AND jr.restricted_visibility
    AND coalesce(ujr.workspace_id, jr.workspace_id) IS NOT NULL
    AND NOT public.is_workspace_admin_of(coalesce(ujr.workspace_id, jr.workspace_id), auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.rep_my_lead_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.leads WHERE owner_id = auth.uid()
  UNION SELECT id FROM public.leads WHERE assigned_to = auth.uid()
  UNION SELECT id FROM public.leads WHERE assigned_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.rep_my_deal_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.deals WHERE owner_id = auth.uid()
  UNION SELECT id FROM public.deals WHERE assigned_to = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.rep_visible_company_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.companies WHERE owner_id = auth.uid() OR assigned_to = auth.uid()
  UNION SELECT company_id FROM public.leads
    WHERE company_id IS NOT NULL AND id IN (SELECT public.rep_my_lead_ids())
  UNION SELECT company_id FROM public.deals
    WHERE company_id IS NOT NULL AND id IN (SELECT public.rep_my_deal_ids())
  UNION SELECT company_id FROM public.contacts
    WHERE company_id IS NOT NULL AND (owner_id = auth.uid() OR assigned_to = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.rep_visible_contact_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.contacts WHERE owner_id = auth.uid() OR assigned_to = auth.uid()
  UNION SELECT id FROM public.contacts
    WHERE company_id IN (SELECT public.rep_visible_company_ids())
  UNION SELECT contact_id FROM public.deal_contacts
    WHERE deal_id IN (SELECT public.rep_my_deal_ids());
$$;

DROP POLICY IF EXISTS rep_scope_select_leads ON public.leads;
DROP POLICY IF EXISTS rep_scope_update_leads ON public.leads;
DROP POLICY IF EXISTS rep_scope_delete_leads ON public.leads;
DROP POLICY IF EXISTS rep_scope_select_deals ON public.deals;
DROP POLICY IF EXISTS rep_scope_update_deals ON public.deals;
DROP POLICY IF EXISTS rep_scope_delete_deals ON public.deals;
DROP POLICY IF EXISTS rep_scope_select_companies ON public.companies;
DROP POLICY IF EXISTS rep_scope_update_companies ON public.companies;
DROP POLICY IF EXISTS rep_scope_delete_companies ON public.companies;
DROP POLICY IF EXISTS rep_scope_select_contacts ON public.contacts;
DROP POLICY IF EXISTS rep_scope_update_contacts ON public.contacts;
DROP POLICY IF EXISTS rep_scope_delete_contacts ON public.contacts;
DROP POLICY IF EXISTS rep_scope_select_activities ON public.activities;
DROP POLICY IF EXISTS rep_scope_update_activities ON public.activities;
DROP POLICY IF EXISTS rep_scope_delete_activities ON public.activities;
DROP POLICY IF EXISTS rep_scope_select_quotes ON public.quotes;
DROP POLICY IF EXISTS rep_scope_update_quotes ON public.quotes;
DROP POLICY IF EXISTS rep_scope_delete_quotes ON public.quotes;

CREATE POLICY rep_scope_select_leads ON public.leads AS RESTRICTIVE FOR SELECT TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid() OR assigned_user_id = auth.uid());
CREATE POLICY rep_scope_update_leads ON public.leads AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid() OR assigned_user_id = auth.uid());
CREATE POLICY rep_scope_delete_leads ON public.leads AS RESTRICTIVE FOR DELETE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces()) OR owner_id = auth.uid());

CREATE POLICY rep_scope_select_deals ON public.deals AS RESTRICTIVE FOR SELECT TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY rep_scope_update_deals ON public.deals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY rep_scope_delete_deals ON public.deals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces()) OR owner_id = auth.uid());

CREATE POLICY rep_scope_select_companies ON public.companies AS RESTRICTIVE FOR SELECT TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR id IN (SELECT public.rep_visible_company_ids()));
CREATE POLICY rep_scope_update_companies ON public.companies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY rep_scope_delete_companies ON public.companies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces()) OR owner_id = auth.uid());

CREATE POLICY rep_scope_select_contacts ON public.contacts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR id IN (SELECT public.rep_visible_contact_ids()));
CREATE POLICY rep_scope_update_contacts ON public.contacts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY rep_scope_delete_contacts ON public.contacts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces()) OR owner_id = auth.uid());

CREATE POLICY rep_scope_select_activities ON public.activities AS RESTRICTIVE FOR SELECT TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid()
         OR related_lead_id IN (SELECT public.rep_my_lead_ids())
         OR related_deal_id IN (SELECT public.rep_my_deal_ids())
         OR related_contact_id IN (SELECT public.rep_visible_contact_ids())
         OR related_company_id IN (SELECT public.rep_visible_company_ids()));
CREATE POLICY rep_scope_update_activities ON public.activities AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY rep_scope_delete_activities ON public.activities AS RESTRICTIVE FOR DELETE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY rep_scope_select_quotes ON public.quotes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid()
         OR deal_id IN (SELECT public.rep_my_deal_ids()));
CREATE POLICY rep_scope_update_quotes ON public.quotes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces())
         OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY rep_scope_delete_quotes ON public.quotes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (workspace_id NOT IN (SELECT public.rep_restricted_workspaces()));

DROP FUNCTION IF EXISTS public.rep_can_see_contact(uuid);
DROP FUNCTION IF EXISTS public.rep_can_see_company(uuid);
DROP FUNCTION IF EXISTS public.rep_can_see_deal(uuid);
DROP FUNCTION IF EXISTS public.rep_can_see_lead(uuid);
DROP FUNCTION IF EXISTS public.rep_is_mine(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_sales_restricted(uuid);
