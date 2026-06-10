
-- Remove duplicate/buggy policies on meeting_summaries and meeting_participants
DROP POLICY IF EXISTS "Workspace members can view meeting summaries" ON public.meeting_summaries;
DROP POLICY IF EXISTS "Workspace members can create meeting summaries" ON public.meeting_summaries;
DROP POLICY IF EXISTS "Workspace members can update meeting summaries" ON public.meeting_summaries;
DROP POLICY IF EXISTS "Workspace members can delete meeting summaries" ON public.meeting_summaries;

DROP POLICY IF EXISTS "Workspace members can view meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Workspace members can create meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Workspace members can update meeting participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Workspace members can delete meeting participants" ON public.meeting_participants;

-- Restrict sensitive credential reads to workspace admins
DROP POLICY IF EXISTS "slack_int select" ON public.slack_integrations;
CREATE POLICY "slack_int select" ON public.slack_integrations
  FOR SELECT
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "ws_select_wa_business_accounts" ON public.wa_business_accounts;
CREATE POLICY "ws_select_wa_business_accounts" ON public.wa_business_accounts
  FOR SELECT
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));
