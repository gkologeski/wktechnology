
-- 1) Standardize is_workspace_admin_v2 to match is_workspace_admin/is_workspace_admin_of
CREATE OR REPLACE FUNCTION public.is_workspace_admin_v2(_workspace uuid, _user uuid)
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

-- 2) landing_pages: replace overly permissive ALL-command member policy
DROP POLICY IF EXISTS lp_member_all ON public.landing_pages;

CREATE POLICY lp_member_select
  ON public.landing_pages
  FOR SELECT
  USING (is_workspace_member(owner_id, auth.uid()));

CREATE POLICY lp_member_insert
  ON public.landing_pages
  FOR INSERT
  WITH CHECK (
    is_workspace_admin_of(owner_id, auth.uid())
    OR can_write_owner(owner_id, auth.uid())
  );

-- 3) profiles: remove phone exposure to workspace peers via column-level privilege
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, avatar_url, notification_preferences, created_at, updated_at)
  ON public.profiles TO authenticated;

-- Allow the user to read their own phone via a security-definer helper.
CREATE OR REPLACE FUNCTION public.get_my_phone()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT phone FROM public.profiles WHERE id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.get_my_phone() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_phone() TO authenticated;
