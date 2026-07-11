
-- CONTACTS
DROP POLICY IF EXISTS ws_insert_contacts ON public.contacts;
DROP POLICY IF EXISTS ws_update_contacts ON public.contacts;
DROP POLICY IF EXISTS ws_delete_contacts ON public.contacts;

CREATE POLICY ws_insert_contacts ON public.contacts
FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.contacts.create.own')
);

CREATE POLICY ws_update_contacts ON public.contacts
FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.contacts.update.workspace')
)
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.contacts.update.workspace')
);

CREATE POLICY ws_delete_contacts ON public.contacts
FOR DELETE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.contacts.delete.workspace')
);

-- COMPANIES
DROP POLICY IF EXISTS ws_insert_companies ON public.companies;
DROP POLICY IF EXISTS ws_update_companies ON public.companies;
DROP POLICY IF EXISTS ws_delete_companies ON public.companies;

CREATE POLICY ws_insert_companies ON public.companies
FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.companies.manage.workspace')
);

CREATE POLICY ws_update_companies ON public.companies
FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.companies.manage.workspace')
)
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.companies.manage.workspace')
);

CREATE POLICY ws_delete_companies ON public.companies
FOR DELETE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.companies.manage.workspace')
);

-- DEALS
DROP POLICY IF EXISTS ws_insert_deals ON public.deals;
DROP POLICY IF EXISTS ws_update_deals ON public.deals;
DROP POLICY IF EXISTS ws_delete_deals ON public.deals;

CREATE POLICY ws_insert_deals ON public.deals
FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.create.own')
);

CREATE POLICY ws_update_deals ON public.deals
FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.workspace')
    OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.team')
    OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.own')
  )
)
WITH CHECK (
  workspace_id IN (SELECT current_user_workspaces())
  AND (
    public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.workspace')
    OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.team')
    OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.own')
  )
);

CREATE POLICY ws_delete_deals ON public.deals
FOR DELETE TO authenticated
USING (
  workspace_id IN (SELECT current_user_workspaces())
  AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.delete.workspace')
);
