REVOKE ALL ON FUNCTION public.seed_access_profiles(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_access_profiles(UUID) TO authenticated, service_role;