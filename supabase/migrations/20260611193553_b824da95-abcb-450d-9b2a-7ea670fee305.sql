CREATE OR REPLACE FUNCTION public.get_workspace_plan(_workspace uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT ws.plan_code
        FROM public.workspaces w
        JOIN public.workspace_subscriptions ws
          ON ws.workspace_owner_id = w.created_by
       WHERE w.id = _workspace
       LIMIT 1
    ),
    (
      SELECT plan_code
        FROM public.workspace_subscriptions
       WHERE workspace_owner_id = _workspace
       LIMIT 1
    ),
    'free'
  );
$function$;