
DROP POLICY IF EXISTS ws_update_pcv ON public.prospecting_campaign_variants;
CREATE POLICY ws_update_pcv ON public.prospecting_campaign_variants
  FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_prospecting_campaigns ON public.prospecting_campaigns;
CREATE POLICY ws_update_prospecting_campaigns ON public.prospecting_campaigns
  FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_prospecting_scripts ON public.prospecting_scripts;
CREATE POLICY ws_update_prospecting_scripts ON public.prospecting_scripts
  FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

DROP POLICY IF EXISTS ws_update_wa_ad_slugs ON public.wa_ad_slugs;
CREATE POLICY ws_update_wa_ad_slugs ON public.wa_ad_slugs
  FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));
