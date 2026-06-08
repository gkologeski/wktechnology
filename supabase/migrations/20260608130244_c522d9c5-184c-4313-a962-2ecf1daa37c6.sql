
-- 1. Replace USING(true)/WITH CHECK(true) "service" ALL policies with explicit role checks
DROP POLICY IF EXISTS "marketplace_apps service all" ON public.marketplace_apps;
CREATE POLICY "marketplace_apps service all" ON public.marketplace_apps
  AS PERMISSIVE FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "mp_inst service" ON public.marketplace_installations;
CREATE POLICY "mp_inst service" ON public.marketplace_installations
  AS PERMISSIVE FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "slack_routes service" ON public.slack_event_routes;
CREATE POLICY "slack_routes service" ON public.slack_event_routes
  AS PERMISSIVE FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "slack_int service" ON public.slack_integrations;
CREATE POLICY "slack_int service" ON public.slack_integrations
  AS PERMISSIVE FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "zap_sub service" ON public.zapier_subscriptions;
CREATE POLICY "zap_sub service" ON public.zapier_subscriptions
  AS PERMISSIVE FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 2. Landing page events: require landing_page_id present (non-trivial check)
DROP POLICY IF EXISTS "lpe_anon_insert" ON public.landing_page_events;
CREATE POLICY "lpe_anon_insert" ON public.landing_page_events
  FOR INSERT TO anon
  WITH CHECK (landing_page_id IS NOT NULL);

DROP POLICY IF EXISTS "lpe_auth_insert" ON public.landing_page_events;
CREATE POLICY "lpe_auth_insert" ON public.landing_page_events
  FOR INSERT TO authenticated
  WITH CHECK (landing_page_id IS NOT NULL);

-- 3. survey_responses INSERT must enforce owner_id = auth.uid()
DROP POLICY IF EXISTS "ws_insert_survey_responses" ON public.survey_responses;
CREATE POLICY "ws_insert_survey_responses" ON public.survey_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND workspace_id IN (SELECT current_user_workspaces())
  );

-- 4. Revoke sensitive columns from authenticated role (service_role still has full access)
REVOKE SELECT (access_token) ON public.slack_integrations FROM authenticated, anon;
REVOKE SELECT (access_token) ON public.wa_business_accounts FROM authenticated, anon;
REVOKE SELECT (hmac_secret) ON public.audit_exports FROM authenticated, anon;
REVOKE SELECT (signature_data, ip_address) ON public.esign_signers FROM authenticated, anon;
