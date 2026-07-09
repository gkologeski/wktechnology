
-- =========================================================
-- 1) Drop legacy dual RLS policy sets on core CRM tables
-- =========================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'activities','companies','contacts','deals','leads',
    'pipelines','products','proposals','quotes','tickets','workflows'
  ];
  suffixes text[] := ARRAY[
    'admin_delete','admin_select','admin_update','team_delete','team_update'
  ];
  s text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOREACH s IN ARRAY suffixes LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_' || s, t);
    END LOOP;
  END LOOP;
END $$;

-- =========================================================
-- 2) Rename workspace_id -> owner_id on access-control tables
--    and recreate their RLS policies to use the new column.
-- =========================================================

-- job_roles
DROP POLICY IF EXISTS jr_read ON public.job_roles;
DROP POLICY IF EXISTS jr_write ON public.job_roles;
ALTER TABLE public.job_roles RENAME COLUMN workspace_id TO owner_id;
CREATE POLICY jr_read ON public.job_roles
  FOR SELECT USING (
    is_system
    OR owner_id = auth.uid()
    OR shares_workspace_with(owner_id)
  );
CREATE POLICY jr_write ON public.job_roles
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
COMMENT ON COLUMN public.job_roles.owner_id IS
  'Workspace owner (auth.uid of the workspace creator). Not a workspaces.id.';

-- permission_sets
DROP POLICY IF EXISTS psets_read ON public.permission_sets;
DROP POLICY IF EXISTS psets_write ON public.permission_sets;
ALTER TABLE public.permission_sets RENAME COLUMN workspace_id TO owner_id;
CREATE POLICY psets_read ON public.permission_sets
  FOR SELECT USING (
    is_system
    OR owner_id = auth.uid()
    OR shares_workspace_with(owner_id)
  );
CREATE POLICY psets_write ON public.permission_sets
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
COMMENT ON COLUMN public.permission_sets.owner_id IS
  'Workspace owner (auth.uid of the workspace creator). Not a workspaces.id.';

-- field_permission_rules
DROP POLICY IF EXISTS fpr_read ON public.field_permission_rules;
DROP POLICY IF EXISTS fpr_write ON public.field_permission_rules;
ALTER TABLE public.field_permission_rules RENAME COLUMN workspace_id TO owner_id;
CREATE POLICY fpr_read ON public.field_permission_rules
  FOR SELECT USING (
    is_system
    OR owner_id = auth.uid()
    OR shares_workspace_with(owner_id)
  );
CREATE POLICY fpr_write ON public.field_permission_rules
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
COMMENT ON COLUMN public.field_permission_rules.owner_id IS
  'Workspace owner (auth.uid of the workspace creator). Not a workspaces.id.';

-- user_job_roles
DROP POLICY IF EXISTS ujr_read ON public.user_job_roles;
DROP POLICY IF EXISTS ujr_write ON public.user_job_roles;
ALTER TABLE public.user_job_roles RENAME COLUMN workspace_id TO owner_id;
CREATE POLICY ujr_read ON public.user_job_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR owner_id = auth.uid()
    OR shares_workspace_with(owner_id)
  );
CREATE POLICY ujr_write ON public.user_job_roles
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
COMMENT ON COLUMN public.user_job_roles.owner_id IS
  'Workspace owner (auth.uid of the workspace creator). Not a workspaces.id.';

-- user_permission_sets
DROP POLICY IF EXISTS ups_read ON public.user_permission_sets;
DROP POLICY IF EXISTS ups_write ON public.user_permission_sets;
ALTER TABLE public.user_permission_sets RENAME COLUMN workspace_id TO owner_id;
CREATE POLICY ups_read ON public.user_permission_sets
  FOR SELECT USING (
    user_id = auth.uid()
    OR owner_id = auth.uid()
    OR shares_workspace_with(owner_id)
  );
CREATE POLICY ups_write ON public.user_permission_sets
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
COMMENT ON COLUMN public.user_permission_sets.owner_id IS
  'Workspace owner (auth.uid of the workspace creator). Not a workspaces.id.';

-- Update RPC functions that referenced ujr.workspace_id / ups.workspace_id.
CREATE OR REPLACE FUNCTION public.user_data_scope(_user_id uuid, _workspace_id uuid)
 RETURNS data_scope
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_created_by uuid;
  v_scope public.data_scope;
BEGIN
  SELECT created_by INTO v_created_by FROM public.workspaces WHERE id = _workspace_id;
  IF v_created_by = _user_id THEN RETURN 'workspace'; END IF;

  SELECT role INTO v_role FROM public.workspace_members
   WHERE workspace_id = _workspace_id AND user_id = _user_id LIMIT 1;
  IF v_role IN ('owner','admin') THEN RETURN 'workspace'; END IF;

  SELECT jr.data_scope INTO v_scope
    FROM public.user_job_roles ujr
    JOIN public.job_roles jr ON jr.id = ujr.role_id
   WHERE ujr.user_id = _user_id AND ujr.owner_id = _workspace_id
   ORDER BY CASE jr.data_scope
     WHEN 'workspace' THEN 1
     WHEN 'team' THEN 2
     WHEN 'custom' THEN 3
     WHEN 'own' THEN 4
   END
   LIMIT 1;

  RETURN COALESCE(v_scope, 'own');
END $function$;

CREATE OR REPLACE FUNCTION public.user_effective_permissions(_user_id uuid, _workspace_id uuid)
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.key
    FROM public.permissions p
   WHERE EXISTS (
           SELECT 1 FROM public.workspaces w
            WHERE w.id = _workspace_id AND w.created_by = _user_id
         )
      OR EXISTS (
           SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = _workspace_id
              AND wm.user_id = _user_id
              AND wm.role IN ('owner','admin')
         )
  UNION
  SELECT psi.permission_key
    FROM public.user_job_roles ujr
    JOIN public.job_role_sets jrs ON jrs.role_id = ujr.role_id
    JOIN public.permission_set_items psi ON psi.set_id = jrs.set_id
   WHERE ujr.user_id = _user_id
     AND ujr.owner_id = _workspace_id
  UNION
  SELECT psi.permission_key
    FROM public.user_permission_sets ups
    JOIN public.permission_set_items psi ON psi.set_id = ups.set_id
   WHERE ups.user_id = _user_id
     AND ups.owner_id = _workspace_id;
$function$;

-- =========================================================
-- 3) landing_page_events: remove anonymous INSERT policy.
--    Ingestion now goes exclusively through the trackLpEvent
--    server function (supabaseAdmin + Zod validation).
-- =========================================================
DROP POLICY IF EXISTS lpe_anon_insert ON public.landing_page_events;
