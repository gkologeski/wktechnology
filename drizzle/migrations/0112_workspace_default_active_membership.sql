-- Legacy browser defaults must follow the same fail-closed membership rule as server functions.
-- An explicitly selected inaccessible workspace never falls back to a different company.
CREATE OR REPLACE FUNCTION public.default_workspace_for_user(_user uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user IS NULL THEN NULL
    WHEN p.active_workspace_id IS NOT NULL THEN
      CASE WHEN EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = _user)
        OR EXISTS (SELECT 1 FROM public.workspace_members wm
          WHERE wm.user_id = _user AND wm.workspace_id = p.active_workspace_id AND wm.status = 'active')
      THEN p.active_workspace_id ELSE NULL END
    ELSE (SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = _user AND wm.status = 'active'
      ORDER BY wm.joined_at ASC NULLS LAST, wm.workspace_id LIMIT 1)
  END
  FROM (SELECT (SELECT active_workspace_id FROM public.profiles WHERE id = _user) AS active_workspace_id) p;
$function$;
