
-- Enforce owner_id = auth.uid() on ws_insert_* policies to prevent misattribution.
-- Applies to explicit findings + broad pattern tables.

-- calendar_events
DROP POLICY IF EXISTS ws_insert_calendar_events ON public.calendar_events;
CREATE POLICY ws_insert_calendar_events ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

-- email_messages
DROP POLICY IF EXISTS ws_insert_email_messages ON public.email_messages;
CREATE POLICY ws_insert_email_messages ON public.email_messages FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

-- esign_documents
DROP POLICY IF EXISTS ws_insert_esign_documents ON public.esign_documents;
CREATE POLICY ws_insert_esign_documents ON public.esign_documents FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

-- esign_attachments
DROP POLICY IF EXISTS ws_insert_esign_attachments ON public.esign_attachments;
CREATE POLICY ws_insert_esign_attachments ON public.esign_attachments FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

-- leads
DROP POLICY IF EXISTS ws_insert_leads ON public.leads;
CREATE POLICY ws_insert_leads ON public.leads FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

-- Broad pattern tables
DROP POLICY IF EXISTS ws_insert_dashboards ON public.dashboards;
CREATE POLICY ws_insert_dashboards ON public.dashboards FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_dashboard_widgets ON public.dashboard_widgets;
CREATE POLICY ws_insert_dashboard_widgets ON public.dashboard_widgets FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_custom_reports ON public.custom_reports;
CREATE POLICY ws_insert_custom_reports ON public.custom_reports FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_saved_views ON public.saved_views;
CREATE POLICY ws_insert_saved_views ON public.saved_views FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_record_layouts ON public.record_layouts;
CREATE POLICY ws_insert_record_layouts ON public.record_layouts FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_custom_object_records ON public.custom_object_records;
CREATE POLICY ws_insert_custom_object_records ON public.custom_object_records FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_playbooks ON public.playbooks;
CREATE POLICY ws_insert_playbooks ON public.playbooks FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_sequences ON public.sequences;
CREATE POLICY ws_insert_sequences ON public.sequences FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_forms ON public.forms;
CREATE POLICY ws_insert_forms ON public.forms FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_macros ON public.macros;
CREATE POLICY ws_insert_macros ON public.macros FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_task_queues ON public.task_queues;
CREATE POLICY ws_insert_task_queues ON public.task_queues FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_meeting_participants ON public.meeting_participants;
CREATE POLICY ws_insert_meeting_participants ON public.meeting_participants FOR INSERT TO authenticated
  WITH CHECK (
    (
      (workspace_id IN (SELECT current_user_workspaces()))
      OR ((workspace_id IS NULL) AND is_workspace_member(owner_id, auth.uid()))
    )
    AND owner_id = auth.uid()
  );

DROP POLICY IF EXISTS ws_insert_pca ON public.prospecting_call_attempts;
CREATE POLICY ws_insert_pca ON public.prospecting_call_attempts FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_pcv ON public.prospecting_campaign_variants;
CREATE POLICY ws_insert_pcv ON public.prospecting_campaign_variants FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_prospecting_campaigns ON public.prospecting_campaigns;
CREATE POLICY ws_insert_prospecting_campaigns ON public.prospecting_campaigns FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_prospecting_results ON public.prospecting_results;
CREATE POLICY ws_insert_prospecting_results ON public.prospecting_results FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_prospecting_scripts ON public.prospecting_scripts;
CREATE POLICY ws_insert_prospecting_scripts ON public.prospecting_scripts FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());

DROP POLICY IF EXISTS ws_insert_prospecting_searches ON public.prospecting_searches;
CREATE POLICY ws_insert_prospecting_searches ON public.prospecting_searches FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) AND owner_id = auth.uid());
