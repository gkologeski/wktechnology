CREATE OR REPLACE FUNCTION public.techhire_rbac_gate(_user uuid, _perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user IS NOT NULL AND public.user_has_permission(_user, _perm)
$function$;