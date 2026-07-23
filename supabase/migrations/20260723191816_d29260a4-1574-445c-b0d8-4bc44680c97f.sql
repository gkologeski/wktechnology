-- Workspace lifecycle: soft-delete, restore, purge (platform admin only)

-- 1) deleted_at column
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS workspaces_deleted_idx
  ON public.workspaces (deleted_at)
  WHERE status = 'deleted';

-- 2) Block access to soft-deleted workspaces via existing helpers
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_members m
      JOIN public.workspaces w ON w.id = m.workspace_id
     WHERE m.workspace_id = _workspace
       AND m.user_id = _user
       AND COALESCE(w.status, 'active') <> 'deleted'
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.workspace_members m
      JOIN public.workspaces w ON w.id = m.workspace_id
     WHERE m.workspace_id = _workspace
       AND m.user_id = _user
       AND m.role = 'admin'
       AND COALESCE(w.status, 'active') <> 'deleted'
  )
$function$;

-- 3) Lifecycle RPCs (platform admin only)
CREATE OR REPLACE FUNCTION public.soft_delete_workspace(_workspace uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;
  UPDATE public.workspaces
     SET status = 'deleted',
         deleted_at = now()
   WHERE id = _workspace;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_workspace(_workspace uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;
  UPDATE public.workspaces
     SET status = 'active',
         deleted_at = NULL
   WHERE id = _workspace;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_workspace(_workspace uuid, _confirm_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ws_name text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;
  SELECT name INTO ws_name FROM public.workspaces WHERE id = _workspace;
  IF ws_name IS NULL THEN
    RAISE EXCEPTION 'workspace not found';
  END IF;
  IF _confirm_name IS NULL OR btrim(_confirm_name) <> ws_name THEN
    RAISE EXCEPTION 'confirmation name does not match workspace name';
  END IF;
  DELETE FROM public.workspaces WHERE id = _workspace;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_workspace(uuid) FROM public;
REVOKE ALL ON FUNCTION public.restore_workspace(uuid) FROM public;
REVOKE ALL ON FUNCTION public.purge_workspace(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.soft_delete_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_workspace(uuid, text) TO authenticated;