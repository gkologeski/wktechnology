
-- Tighten is_workspace_admin: remove the risky "_workspace = _user" comparison
-- that treated workspace and user identifiers as interchangeable. Now the
-- caller is considered an admin only if they are the workspace creator or an
-- admin member of that workspace. Kept for backwards compatibility with
-- policies on sla_policies / deal_loss_reasons / media_assets / audit_logs,
-- where the first argument is the row's owner_id (a workspace id).
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE w.id = _workspace AND w.created_by = _user
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _workspace
       AND wm.user_id = _user
       AND wm.role IN ('owner','admin')
  );
$function$;

-- Tighten is_workspace_admin_of: remove the two transitive branches that
-- granted admin rights across any shared workspace membership. Access is
-- now scoped to the workspace context of the resource being accessed:
-- either _owner IS the workspace (creator/admin member) or _owner is a
-- user whose workspace the caller directly owns.
CREATE OR REPLACE FUNCTION public.is_workspace_admin_of(_owner uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
     WHERE w.id = _owner AND w.created_by = _user
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _owner
       AND wm.user_id = _user
       AND wm.role IN ('owner','admin')
  );
$function$;
