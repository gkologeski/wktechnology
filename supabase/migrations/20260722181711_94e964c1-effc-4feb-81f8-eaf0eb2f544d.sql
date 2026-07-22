DROP POLICY IF EXISTS jrs_write ON public.job_role_sets;

CREATE POLICY jrs_write ON public.job_role_sets
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.job_roles r
          WHERE r.id = job_role_sets.role_id AND r.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.permission_sets s
             WHERE s.id = job_role_sets.set_id
               AND s.owner_id = auth.uid()
               AND s.module = '__bundle__')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.job_roles r
          WHERE r.id = job_role_sets.role_id AND r.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.permission_sets s
             WHERE s.id = job_role_sets.set_id
               AND s.owner_id = auth.uid()
               AND s.module = '__bundle__')
);