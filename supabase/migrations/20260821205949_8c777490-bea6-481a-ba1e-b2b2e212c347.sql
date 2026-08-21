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
   WHERE ujr.user_id = _user_id
     AND (ujr.owner_id = _workspace_id
          OR ujr.workspace_id = _workspace_id
          OR ujr.owner_id = v_created_by)
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
  WITH ws AS (
    SELECT w.id, w.created_by FROM public.workspaces w WHERE w.id = _workspace_id
  ), base_permissions AS (
    SELECT p.key
      FROM public.permissions p
     WHERE EXISTS (SELECT 1 FROM ws WHERE ws.created_by = _user_id)
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
       AND (ujr.owner_id = _workspace_id
            OR ujr.workspace_id = _workspace_id
            OR ujr.owner_id = (SELECT created_by FROM ws))
    UNION
    SELECT psi.permission_key AS key
      FROM public.user_permission_sets ups
      JOIN public.permission_set_items psi ON psi.set_id = ups.set_id
     WHERE ups.user_id = _user_id
       AND (ups.owner_id = _workspace_id
            OR ups.owner_id = (SELECT created_by FROM ws))
  ), role_grants AS (
    SELECT o.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_permission_overrides o ON o.role_id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.owner_id = _workspace_id
            OR ujr.workspace_id = _workspace_id
            OR ujr.owner_id = (SELECT created_by FROM ws))
       AND o.workspace_id = _workspace_id
       AND o.effect = 'grant'
  ), denied AS (
    SELECT o.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_permission_overrides o ON o.role_id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.owner_id = _workspace_id
            OR ujr.workspace_id = _workspace_id
            OR ujr.owner_id = (SELECT created_by FROM ws))
       AND o.workspace_id = _workspace_id
       AND o.effect = 'deny'
  )
  SELECT DISTINCT key
    FROM (
      SELECT key FROM base_permissions
      UNION
      SELECT key FROM role_grants
    ) effective
   WHERE NOT EXISTS (SELECT 1 FROM denied d WHERE d.key = effective.key)
$function$;