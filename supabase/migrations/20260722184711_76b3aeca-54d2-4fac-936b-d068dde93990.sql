CREATE OR REPLACE FUNCTION public.user_has_permission(_user uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH candidate_workspaces AS (
    SELECT w.id AS workspace_id
      FROM public.workspaces w
     WHERE w.created_by = _user
    UNION
    SELECT wm.workspace_id
      FROM public.workspace_members wm
     WHERE wm.user_id = _user
    UNION
    SELECT ujr.owner_id AS workspace_id
      FROM public.user_job_roles ujr
     WHERE ujr.user_id = _user
    UNION
    SELECT ups.owner_id AS workspace_id
      FROM public.user_permission_sets ups
     WHERE ups.user_id = _user
  )
  SELECT EXISTS (
    SELECT 1
      FROM candidate_workspaces cw
     WHERE EXISTS (
       SELECT 1
         FROM public.user_effective_permissions(_user, cw.workspace_id) k
        WHERE k = _perm
     )
  );
$function$;