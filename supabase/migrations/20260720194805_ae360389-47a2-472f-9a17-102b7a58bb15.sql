
-- 1. profiles: remove redundant broad SELECT policy; keep the narrower peer policy
DROP POLICY IF EXISTS profiles_workspace_read ON public.profiles;

-- 2. RBAC tables: restrict SELECT to owner + workspace admins (not any peer)
DROP POLICY IF EXISTS jr_read ON public.job_roles;
CREATE POLICY jr_read ON public.job_roles
  FOR SELECT TO authenticated
  USING (
    is_system
    OR owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
  );

DROP POLICY IF EXISTS psets_read ON public.permission_sets;
CREATE POLICY psets_read ON public.permission_sets
  FOR SELECT TO authenticated
  USING (
    is_system
    OR owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
  );

DROP POLICY IF EXISTS fpr_read ON public.field_permission_rules;
CREATE POLICY fpr_read ON public.field_permission_rules
  FOR SELECT TO authenticated
  USING (
    is_system
    OR owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
  );

-- User-assignment tables: users read own assignments; admins read all in workspace
DROP POLICY IF EXISTS ujr_read ON public.user_job_roles;
CREATE POLICY ujr_read ON public.user_job_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
  );

DROP POLICY IF EXISTS ups_read ON public.user_permission_sets;
CREATE POLICY ups_read ON public.user_permission_sets
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
  );
