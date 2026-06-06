
-- 1) push_subscriptions: scope per-user, not per-workspace
DROP POLICY IF EXISTS ws_select_push_subscriptions ON public.push_subscriptions;
DROP POLICY IF EXISTS ws_update_push_subscriptions ON public.push_subscriptions;
DROP POLICY IF EXISTS ws_delete_push_subscriptions ON public.push_subscriptions;
DROP POLICY IF EXISTS ws_insert_push_subscriptions ON public.push_subscriptions;

CREATE POLICY user_select_push_subscriptions ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY user_insert_push_subscriptions ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY user_update_push_subscriptions ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY user_delete_push_subscriptions ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2) esign_signers: restrict to document owner (workspace owner / admin only)
DROP POLICY IF EXISTS ws_select_esign_signers ON public.esign_signers;
DROP POLICY IF EXISTS ws_update_esign_signers ON public.esign_signers;
DROP POLICY IF EXISTS ws_delete_esign_signers ON public.esign_signers;

CREATE POLICY owner_select_esign_signers ON public.esign_signers
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  );
CREATE POLICY owner_update_esign_signers ON public.esign_signers
  FOR UPDATE TO authenticated USING (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  ) WITH CHECK (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  );
CREATE POLICY owner_delete_esign_signers ON public.esign_signers
  FOR DELETE TO authenticated USING (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  );

-- 3) esign_audit: restrict SELECT to owner/admin (IP addresses, user agents)
DROP POLICY IF EXISTS ws_select_esign_audit ON public.esign_audit;
DROP POLICY IF EXISTS ws_update_esign_audit ON public.esign_audit;
DROP POLICY IF EXISTS ws_delete_esign_audit ON public.esign_audit;

CREATE POLICY owner_select_esign_audit ON public.esign_audit
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  );
CREATE POLICY owner_update_esign_audit ON public.esign_audit
  FOR UPDATE TO authenticated USING (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  ) WITH CHECK (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  );
CREATE POLICY owner_delete_esign_audit ON public.esign_audit
  FOR DELETE TO authenticated USING (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  );

-- 4) survey_responses: restrict to owner/admin (tokens)
DROP POLICY IF EXISTS ws_select_survey_responses ON public.survey_responses;
DROP POLICY IF EXISTS ws_update_survey_responses ON public.survey_responses;
DROP POLICY IF EXISTS ws_delete_survey_responses ON public.survey_responses;

CREATE POLICY owner_select_survey_responses ON public.survey_responses
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  );
CREATE POLICY owner_update_survey_responses ON public.survey_responses
  FOR UPDATE TO authenticated USING (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  ) WITH CHECK (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  );
CREATE POLICY owner_delete_survey_responses ON public.survey_responses
  FOR DELETE TO authenticated USING (
    owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid())
  );

-- 5) contacts.portal_token: column-level revoke from authenticated/anon.
--    Server functions that read portal_token use supabaseAdmin (service_role),
--    which keeps full access.
REVOKE SELECT ON public.contacts FROM authenticated;
GRANT SELECT (
  id, owner_id, company_id, first_name, last_name, email, phone, job_title,
  notes, created_at, updated_at, score, label, marketing_status, legal_basis,
  consent_date, external_ids, hs_raw, mobile_phone, country, address, cep,
  city, state, website, company_name, lifecyclestage, hs_lead_status,
  hubspot_owner_id, hs_object_id, hs_createdate, hs_lastmodifieddate,
  linkedin_url, twitter_handle, custom_fields, portal_enabled, workspace_id,
  deleted_at, assigned_user_id
) ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
