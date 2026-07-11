
-- 1. Tighten ATS jobs shared select policy: restrict to hiring team, not all workspace members
DROP POLICY IF EXISTS ats_jobs_workspace_shared_select ON public.ats_jobs;
CREATE POLICY ats_jobs_workspace_shared_select ON public.ats_jobs
  FOR SELECT TO authenticated
  USING (
    hiring_manager_id = auth.uid()
    OR recruiter_id = auth.uid()
  );

-- 2. Add explicit WITH CHECK to media storage update policy
DROP POLICY IF EXISTS media_storage_update ON storage.objects;
CREATE POLICY media_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'media'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

-- 3. Restrict public-role policies to authenticated role for defense-in-depth
DROP POLICY IF EXISTS ws_update_wa_ad_slugs ON public.wa_ad_slugs;
CREATE POLICY ws_update_wa_ad_slugs ON public.wa_ad_slugs
  FOR UPDATE TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS ws_update_customer_invoices ON public.customer_invoices;
CREATE POLICY ws_update_customer_invoices ON public.customer_invoices
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_customer_payments ON public.customer_payments;
CREATE POLICY ws_update_customer_payments ON public.customer_payments
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_nfse_invoices ON public.nfse_invoices;
CREATE POLICY ws_update_nfse_invoices ON public.nfse_invoices
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_dunning_runs ON public.dunning_runs;
CREATE POLICY ws_update_dunning_runs ON public.dunning_runs
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_pca ON public.prospecting_call_attempts;
CREATE POLICY ws_update_pca ON public.prospecting_call_attempts
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_pcv ON public.prospecting_campaign_variants;
CREATE POLICY ws_update_pcv ON public.prospecting_campaign_variants
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_prospecting_campaigns ON public.prospecting_campaigns;
CREATE POLICY ws_update_prospecting_campaigns ON public.prospecting_campaigns
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_vas ON public.voice_agent_settings;
CREATE POLICY ws_update_vas ON public.voice_agent_settings
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS chat_members_delete ON public.chat_conversation_members;
CREATE POLICY chat_members_delete ON public.chat_conversation_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
