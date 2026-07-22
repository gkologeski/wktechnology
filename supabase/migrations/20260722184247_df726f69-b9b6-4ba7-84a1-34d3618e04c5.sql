CREATE TABLE IF NOT EXISTS public.job_role_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  effect text NOT NULL CHECK (effect IN ('grant', 'deny')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, role_id, permission_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_role_permission_overrides TO authenticated;
GRANT ALL ON public.job_role_permission_overrides TO service_role;

ALTER TABLE public.job_role_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace admins can read role permission overrides" ON public.job_role_permission_overrides;
DROP POLICY IF EXISTS "Workspace admins can manage role permission overrides" ON public.job_role_permission_overrides;

CREATE POLICY "Workspace admins can read role permission overrides"
ON public.job_role_permission_overrides
FOR SELECT
TO authenticated
USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can manage role permission overrides"
ON public.job_role_permission_overrides
FOR ALL
TO authenticated
USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
WITH CHECK (
  public.is_workspace_admin_v2(workspace_id, auth.uid())
  AND created_by = auth.uid()
);

DROP TRIGGER IF EXISTS update_job_role_permission_overrides_updated_at ON public.job_role_permission_overrides;
CREATE TRIGGER update_job_role_permission_overrides_updated_at
BEFORE UPDATE ON public.job_role_permission_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.user_effective_permissions(_user_id uuid, _workspace_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base_permissions AS (
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
    SELECT psi.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_sets jrs ON jrs.role_id = ujr.role_id
      JOIN public.permission_set_items psi ON psi.set_id = jrs.set_id
     WHERE ujr.user_id = _user_id
       AND ujr.owner_id = _workspace_id
    UNION
    SELECT psi.permission_key AS key
      FROM public.user_permission_sets ups
      JOIN public.permission_set_items psi ON psi.set_id = ups.set_id
     WHERE ups.user_id = _user_id
       AND ups.owner_id = _workspace_id
  ), role_grants AS (
    SELECT o.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_permission_overrides o ON o.role_id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND ujr.owner_id = _workspace_id
       AND o.workspace_id = _workspace_id
       AND o.effect = 'grant'
  ), denied AS (
    SELECT o.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_permission_overrides o ON o.role_id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND ujr.owner_id = _workspace_id
       AND o.workspace_id = _workspace_id
       AND o.effect = 'deny'
  )
  SELECT DISTINCT key
    FROM (
      SELECT key FROM base_permissions
      UNION
      SELECT key FROM role_grants
    ) effective
   WHERE NOT EXISTS (
     SELECT 1 FROM denied d WHERE d.key = effective.key
   );
$function$;