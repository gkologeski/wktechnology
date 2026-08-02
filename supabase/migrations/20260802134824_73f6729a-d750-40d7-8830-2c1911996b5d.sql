-- 1) exports bucket: remove ambiguous user-id/workspace-id folder interpretation
DROP POLICY IF EXISTS "exports_workspace_read" ON storage.objects;

CREATE POLICY "exports_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Admins may only read files stored under an explicit workspace namespace:
-- workspace/<workspace_id>/...
CREATE POLICY "exports_workspace_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exports'
    AND (storage.foldername(name))[1] = 'workspace'
    AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_workspace_admin_v2(((storage.foldername(name))[2])::uuid, auth.uid())
  );

-- 2) access-control assignment tables: defense-in-depth admin check
CREATE OR REPLACE FUNCTION public.can_manage_access_scope(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _owner IS NOT NULL
     AND _owner = auth.uid()
     -- the scope id must never be a workspace created by somebody else
     AND NOT EXISTS (
       SELECT 1 FROM public.workspaces w
        WHERE w.id = _owner AND w.created_by <> auth.uid()
     )
     -- and the actor must not be a plain member of a workspace whose id collides
     AND NOT EXISTS (
       SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = _owner
          AND wm.user_id = auth.uid()
          AND wm.role NOT IN ('owner','admin')
     );
$$;

REVOKE ALL ON FUNCTION public.can_manage_access_scope(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_access_scope(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "ups_write" ON public.user_permission_sets;
CREATE POLICY "ups_write" ON public.user_permission_sets
  FOR ALL TO authenticated
  USING (public.can_manage_access_scope(owner_id))
  WITH CHECK (public.can_manage_access_scope(owner_id));

DROP POLICY IF EXISTS "ujr_write" ON public.user_job_roles;
CREATE POLICY "ujr_write" ON public.user_job_roles
  FOR ALL TO authenticated
  USING (public.can_manage_access_scope(owner_id))
  WITH CHECK (public.can_manage_access_scope(owner_id));