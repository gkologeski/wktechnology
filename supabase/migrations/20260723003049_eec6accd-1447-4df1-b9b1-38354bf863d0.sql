
CREATE OR REPLACE FUNCTION public.can_view_person(_person_id uuid)
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
        public.is_workspace_admin_v2(p.owner_id, auth.uid())
        OR p.manager_id = auth.uid()
        OR p.profile_id = auth.uid()
      )
  );
$function$;
