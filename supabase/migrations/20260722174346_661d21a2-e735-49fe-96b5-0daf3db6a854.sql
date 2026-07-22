CREATE TABLE public.job_role_default_permissions (
  role_id uuid NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

GRANT SELECT ON public.job_role_default_permissions TO authenticated;
GRANT ALL ON public.job_role_default_permissions TO service_role;

ALTER TABLE public.job_role_default_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read defaults" ON public.job_role_default_permissions
  FOR SELECT TO authenticated USING (true);

-- Snapshot atual dos cargos de sistema como padrão
INSERT INTO public.job_role_default_permissions (role_id, permission_key)
SELECT DISTINCT jrs.role_id, psi.permission_key
FROM public.job_roles jr
JOIN public.job_role_sets jrs ON jrs.role_id = jr.id
JOIN public.permission_set_items psi ON psi.set_id = jrs.set_id
WHERE jr.is_system = true
ON CONFLICT DO NOTHING;