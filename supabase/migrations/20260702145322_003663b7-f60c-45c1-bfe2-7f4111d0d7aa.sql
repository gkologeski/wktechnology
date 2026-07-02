
REVOKE EXECUTE ON FUNCTION public.user_has_permission(uuid, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.user_field_visibility(uuid, text, text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at_perm() FROM public, anon;
