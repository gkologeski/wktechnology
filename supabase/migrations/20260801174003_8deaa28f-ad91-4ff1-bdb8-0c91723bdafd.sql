DROP POLICY IF EXISTS macros_perm_insert ON public.macros;
CREATE POLICY macros_perm_insert ON public.macros AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    is_workspace_admin_v2(workspace_id, auth.uid())
    OR user_has_permission(auth.uid(), workspace_id, 'techservice.macros.create.own')
  )
);

DROP POLICY IF EXISTS people_perm_insert ON public.people;
CREATE POLICY people_perm_insert ON public.people AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  is_workspace_admin_of(owner_id, auth.uid())
  OR (
    is_workspace_member(resolve_workspace_id(owner_id), auth.uid())
    AND user_has_permission(auth.uid(), resolve_workspace_id(owner_id), 'techpeople.people.create.own')
  )
);