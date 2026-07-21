
REVOKE EXECUTE ON FUNCTION public.can_view_person(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_person_sensitive(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_person(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_person(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_person_sensitive(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_person(uuid) TO authenticated, service_role;

ALTER FUNCTION public.people_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.people_log_event() SET search_path = public;
