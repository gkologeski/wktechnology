GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_sets TO authenticated;
GRANT ALL ON public.permission_sets TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_set_items TO authenticated;
GRANT ALL ON public.permission_set_items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_roles TO authenticated;
GRANT ALL ON public.job_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_role_sets TO authenticated;
GRANT ALL ON public.job_role_sets TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_permission_rules TO authenticated;
GRANT ALL ON public.field_permission_rules TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_job_roles TO authenticated;
GRANT ALL ON public.user_job_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_sets TO authenticated;
GRANT ALL ON public.user_permission_sets TO service_role;