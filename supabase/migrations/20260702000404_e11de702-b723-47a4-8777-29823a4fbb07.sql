
-- 1) ats_interview_kits: remove leitura anônima permissiva.
DROP POLICY IF EXISTS ats_interview_kits_public_when_referenced ON public.ats_interview_kits;

-- 2) landing_page_events: substituir INSERT policies por checagem que valida a landing page.
DROP POLICY IF EXISTS lpe_anon_insert ON public.landing_page_events;
DROP POLICY IF EXISTS lpe_auth_insert ON public.landing_page_events;

CREATE POLICY lpe_anon_insert
  ON public.landing_page_events
  FOR INSERT
  TO anon
  WITH CHECK (
    landing_page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.landing_pages lp
      WHERE lp.id = landing_page_events.landing_page_id
        AND lp.owner_id = landing_page_events.owner_id
        AND lp.status = 'published'
    )
  );

CREATE POLICY lpe_auth_insert
  ON public.landing_page_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    landing_page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.landing_pages lp
      WHERE lp.id = landing_page_events.landing_page_id
        AND lp.owner_id = landing_page_events.owner_id
        AND lp.status = 'published'
    )
  );

-- 3) marketplace_installations: writes restritos a admins do workspace.
DROP POLICY IF EXISTS "mp_inst write" ON public.marketplace_installations;

CREATE POLICY "mp_inst admin write"
  ON public.marketplace_installations
  FOR ALL
  TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));
