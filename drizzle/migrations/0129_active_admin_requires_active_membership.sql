CREATE OR REPLACE FUNCTION public.is_active_workspace_admin(_workspace uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _workspace IS NOT NULL AND _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _workspace AND wm.user_id = _user AND wm.status = 'active'
       AND (wm.role IN ('owner','admin')
            OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = _workspace AND w.created_by = _user)));
$$;
REVOKE ALL ON FUNCTION public.is_active_workspace_admin(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_workspace_admin(uuid, uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.is_active_workspace_admin(uuid, uuid) IS 'Admin do workspace somente com participação ativa (owner/admin ou criador com participação ativa).';