
DROP FUNCTION IF EXISTS public.soft_delete_workspace(uuid);
DROP FUNCTION IF EXISTS public.restore_workspace(uuid);
DROP FUNCTION IF EXISTS public.purge_workspace(uuid, text);

CREATE OR REPLACE FUNCTION public.soft_delete_workspace(_workspace uuid, _actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin(_actor) THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;
  UPDATE public.workspaces
     SET status = 'deleted',
         deleted_at = now()
   WHERE id = _workspace;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_workspace(_workspace uuid, _actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_platform_admin(_actor) THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;
  UPDATE public.workspaces
     SET status = 'active',
         deleted_at = NULL
   WHERE id = _workspace;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_workspace(_workspace uuid, _confirm_name text, _actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  IF NOT public.is_platform_admin(_actor) THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;
  SELECT name INTO v_name FROM public.workspaces WHERE id = _workspace;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'workspace not found';
  END IF;
  IF v_name <> _confirm_name THEN
    RAISE EXCEPTION 'confirmation name does not match';
  END IF;
  DELETE FROM public.workspaces WHERE id = _workspace;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.soft_delete_workspace(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_workspace(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_workspace(uuid, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_workspace(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_workspace(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_workspace(uuid, text, uuid) TO service_role;
