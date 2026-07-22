
CREATE OR REPLACE FUNCTION public.can_view_person_sensitive(_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.people p
    WHERE p.id = _person_id
      AND (
        -- 1) Admins/owners do workspace (comportamento original)
        public.is_workspace_admin_v2(p.owner_id, auth.uid())
        -- 2) Workspaces "pessoais": owner_id igual ao próprio user_id
        OR p.owner_id = auth.uid()
        -- 3) A própria pessoa vinculada
        OR p.profile_id = auth.uid()
        -- 4) RBAC granular via permission sets / job roles
        OR public.user_has_permission(auth.uid(), p.owner_id, 'techpeople.wellbeing.assessments.view.workspace')
        OR public.user_has_permission(auth.uid(), p.owner_id, 'techpeople.wellbeing.incidents.view.workspace')
        OR public.user_has_permission(auth.uid(), p.owner_id, 'techpeople.benefits.view.workspace')
      )
  );
$function$;
