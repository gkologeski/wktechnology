DROP POLICY IF EXISTS "hubspot_owners write admin" ON public.hubspot_owners;
CREATE POLICY "hubspot_owners write auth" ON public.hubspot_owners
  FOR ALL TO authenticated USING (true) WITH CHECK (true);