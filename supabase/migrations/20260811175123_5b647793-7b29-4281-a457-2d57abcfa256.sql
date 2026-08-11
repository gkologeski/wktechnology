DROP POLICY IF EXISTS "Modules are readable by anyone" ON public.modules;
CREATE POLICY "Modules are readable by authenticated users"
  ON public.modules FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.modules FROM anon;
GRANT SELECT ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;