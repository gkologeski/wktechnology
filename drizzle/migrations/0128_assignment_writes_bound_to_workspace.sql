-- 0128: escrita de atribuições (user_job_roles / user_permission_sets) presa ao workspace
-- canônico da própria linha. Fecha o vetor em que o administrador de OUTRO workspace
-- inseria linhas na WK usando owner_id = UID do ator (can_manage_access_scope só exigia
-- _owner = auth.uid()), e libera o admin legítimo que grava owner_id = workspace_id.

CREATE TABLE IF NOT EXISTS public.rbac_policy_backup_2026_10 (
  id bigserial PRIMARY KEY,
  taken_at timestamptz NOT NULL DEFAULT now(),
  table_name text NOT NULL,
  policy_name text NOT NULL,
  permissive text,
  cmd text,
  roles text,
  qual text,
  with_check text
);
GRANT SELECT ON public.rbac_policy_backup_2026_10 TO authenticated;
GRANT ALL ON public.rbac_policy_backup_2026_10 TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rbac_policy_backup_2026_10_id_seq TO service_role;
ALTER TABLE public.rbac_policy_backup_2026_10 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rbac_policy_backup_read ON public.rbac_policy_backup_2026_10;
CREATE POLICY rbac_policy_backup_read ON public.rbac_policy_backup_2026_10
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

INSERT INTO public.rbac_policy_backup_2026_10
  (table_name, policy_name, permissive, cmd, roles, qual, with_check)
SELECT tablename, policyname, permissive, cmd, roles::text, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('user_job_roles','user_permission_sets')
   AND NOT EXISTS (
     SELECT 1 FROM public.rbac_policy_backup_2026_10 b
      WHERE b.table_name = pg_policies.tablename
        AND b.policy_name = pg_policies.policyname
   );

CREATE OR REPLACE FUNCTION public.is_active_workspace_admin(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _workspace IS NOT NULL
     AND _user IS NOT NULL
     AND (
       EXISTS (
         SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = _workspace
            AND wm.user_id = _user
            AND wm.role IN ('owner','admin')
            AND wm.status = 'active'
       )
       OR EXISTS (
         SELECT 1 FROM public.workspaces w
          WHERE w.id = _workspace AND w.created_by = _user
       )
     );
$$;
REVOKE ALL ON FUNCTION public.is_active_workspace_admin(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_workspace_admin(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_active_workspace_member_of(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _workspace IS NOT NULL AND _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _workspace
       AND wm.user_id = _user
       AND wm.status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_workspace_member_of(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_workspace_member_of(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.job_role_usable_in_workspace(_role uuid, _workspace uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_roles r
     WHERE r.id = _role
       AND (r.workspace_id = _workspace OR (r.workspace_id IS NULL AND r.is_system))
  );
$$;
REVOKE ALL ON FUNCTION public.job_role_usable_in_workspace(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.job_role_usable_in_workspace(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.permission_set_usable_in_workspace(_set uuid, _workspace uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permission_sets s
     WHERE s.id = _set
       AND (s.workspace_id = _workspace OR (s.workspace_id IS NULL AND s.is_system))
  );
$$;
REVOKE ALL ON FUNCTION public.permission_set_usable_in_workspace(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.permission_set_usable_in_workspace(uuid, uuid) TO authenticated, service_role;

-- ---------------- user_job_roles ----------------
DROP POLICY IF EXISTS ujr_write ON public.user_job_roles;
DROP POLICY IF EXISTS ujr_read ON public.user_job_roles;

CREATE POLICY ujr_read ON public.user_job_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_active_workspace_admin(workspace_id, auth.uid())
  );

CREATE POLICY ujr_write ON public.user_job_roles
  FOR ALL TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS ujr_canonical_ins ON public.user_job_roles;
CREATE POLICY ujr_canonical_ins ON public.user_job_roles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IS NOT NULL
    AND owner_id = workspace_id
    AND public.is_active_workspace_admin(workspace_id, auth.uid())
    AND public.is_active_workspace_member_of(workspace_id, user_id)
    AND public.job_role_usable_in_workspace(role_id, workspace_id)
  );

DROP POLICY IF EXISTS ujr_canonical_upd ON public.user_job_roles;
CREATE POLICY ujr_canonical_upd ON public.user_job_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (
    workspace_id IS NOT NULL
    AND owner_id = workspace_id
    AND public.is_active_workspace_admin(workspace_id, auth.uid())
    AND public.is_active_workspace_member_of(workspace_id, user_id)
    AND public.job_role_usable_in_workspace(role_id, workspace_id)
  );

DROP POLICY IF EXISTS ujr_canonical_del ON public.user_job_roles;
CREATE POLICY ujr_canonical_del ON public.user_job_roles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

-- ---------------- user_permission_sets ----------------
DROP POLICY IF EXISTS ups_write ON public.user_permission_sets;
DROP POLICY IF EXISTS ups_read ON public.user_permission_sets;

CREATE POLICY ups_read ON public.user_permission_sets
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_active_workspace_admin(workspace_id, auth.uid())
  );

CREATE POLICY ups_write ON public.user_permission_sets
  FOR ALL TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_active_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS ups_canonical_ins ON public.user_permission_sets;
CREATE POLICY ups_canonical_ins ON public.user_permission_sets
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IS NOT NULL
    AND owner_id = workspace_id
    AND public.is_active_workspace_admin(workspace_id, auth.uid())
    AND public.is_active_workspace_member_of(workspace_id, user_id)
    AND public.permission_set_usable_in_workspace(set_id, workspace_id)
  );

DROP POLICY IF EXISTS ups_canonical_upd ON public.user_permission_sets;
CREATE POLICY ups_canonical_upd ON public.user_permission_sets
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (
    workspace_id IS NOT NULL
    AND owner_id = workspace_id
    AND public.is_active_workspace_admin(workspace_id, auth.uid())
    AND public.is_active_workspace_member_of(workspace_id, user_id)
    AND public.permission_set_usable_in_workspace(set_id, workspace_id)
  );

DROP POLICY IF EXISTS ups_canonical_del ON public.user_permission_sets;
CREATE POLICY ups_canonical_del ON public.user_permission_sets
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_active_workspace_admin(workspace_id, auth.uid()));

COMMENT ON FUNCTION public.can_manage_access_scope(uuid) IS
  'DEPRECADO para atribuições: só verifica _owner = auth.uid(). Escrita de user_job_roles/user_permission_sets usa is_active_workspace_admin(workspace_id, auth.uid()) desde 0128.';
