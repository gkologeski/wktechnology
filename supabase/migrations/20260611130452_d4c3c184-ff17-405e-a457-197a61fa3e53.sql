
-- calendar_accounts
DROP POLICY IF EXISTS "owner_delete_calendar_accounts" ON public.calendar_accounts;
CREATE POLICY "owner_delete_calendar_accounts" ON public.calendar_accounts
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "owner_update_calendar_accounts" ON public.calendar_accounts;
CREATE POLICY "owner_update_calendar_accounts" ON public.calendar_accounts
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- slack_integrations
DROP POLICY IF EXISTS "slack_int select" ON public.slack_integrations;
CREATE POLICY "slack_int select" ON public.slack_integrations
  FOR SELECT TO authenticated USING (is_workspace_admin_v2(workspace_id, auth.uid()));

-- wa_business_accounts
DROP POLICY IF EXISTS "ws_select_wa_business_accounts" ON public.wa_business_accounts;
CREATE POLICY "ws_select_wa_business_accounts" ON public.wa_business_accounts
  FOR SELECT TO authenticated USING (is_workspace_admin_v2(workspace_id, auth.uid()));

-- meetings
DROP POLICY IF EXISTS "ws_select_meetings" ON public.meetings;
CREATE POLICY "ws_select_meetings" ON public.meetings
  FOR SELECT TO authenticated
  USING ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

DROP POLICY IF EXISTS "ws_insert_meetings" ON public.meetings;
CREATE POLICY "ws_insert_meetings" ON public.meetings
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

DROP POLICY IF EXISTS "ws_update_meetings" ON public.meetings;
CREATE POLICY "ws_update_meetings" ON public.meetings
  FOR UPDATE TO authenticated
  USING ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

DROP POLICY IF EXISTS "ws_delete_meetings" ON public.meetings;
CREATE POLICY "ws_delete_meetings" ON public.meetings
  FOR DELETE TO authenticated
  USING ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

-- meeting_participants
DROP POLICY IF EXISTS "ws_select_meeting_participants" ON public.meeting_participants;
CREATE POLICY "ws_select_meeting_participants" ON public.meeting_participants
  FOR SELECT TO authenticated
  USING ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

DROP POLICY IF EXISTS "ws_insert_meeting_participants" ON public.meeting_participants;
CREATE POLICY "ws_insert_meeting_participants" ON public.meeting_participants
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

DROP POLICY IF EXISTS "ws_update_meeting_participants" ON public.meeting_participants;
CREATE POLICY "ws_update_meeting_participants" ON public.meeting_participants
  FOR UPDATE TO authenticated
  USING ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

DROP POLICY IF EXISTS "ws_delete_meeting_participants" ON public.meeting_participants;
CREATE POLICY "ws_delete_meeting_participants" ON public.meeting_participants
  FOR DELETE TO authenticated
  USING ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

-- meeting_summaries
DROP POLICY IF EXISTS "ws_select_meeting_summaries" ON public.meeting_summaries;
CREATE POLICY "ws_select_meeting_summaries" ON public.meeting_summaries
  FOR SELECT TO authenticated
  USING ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

DROP POLICY IF EXISTS "ws_insert_meeting_summaries" ON public.meeting_summaries;
CREATE POLICY "ws_insert_meeting_summaries" ON public.meeting_summaries
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

DROP POLICY IF EXISTS "ws_update_meeting_summaries" ON public.meeting_summaries;
CREATE POLICY "ws_update_meeting_summaries" ON public.meeting_summaries
  FOR UPDATE TO authenticated
  USING ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));

DROP POLICY IF EXISTS "ws_delete_meeting_summaries" ON public.meeting_summaries;
CREATE POLICY "ws_delete_meeting_summaries" ON public.meeting_summaries
  FOR DELETE TO authenticated
  USING ((workspace_id IN (SELECT current_user_workspaces())) OR (workspace_id IS NULL AND is_workspace_member(owner_id, auth.uid())));
