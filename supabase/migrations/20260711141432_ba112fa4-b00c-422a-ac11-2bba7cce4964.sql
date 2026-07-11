-- Consolidate duplicated RLS policies: keep a single UPDATE + DELETE per table
-- restricted to workspace admin OR can_write_owner (dono + team leaders).
-- SELECT (ws_*) and INSERT (ws_*) are preserved as-is.
-- Redundant *_admin_select policies (which duplicated the ws_select_* rule) are dropped.

-- Helper: expected predicate for consolidated writes.
-- USING/WITH CHECK: is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid())

-- =========================================================================
-- calendar_events
-- =========================================================================
DROP POLICY IF EXISTS calendar_events_admin_select ON public.calendar_events;
DROP POLICY IF EXISTS calendar_events_admin_update ON public.calendar_events;
DROP POLICY IF EXISTS calendar_events_team_update  ON public.calendar_events;
DROP POLICY IF EXISTS ws_update_calendar_events    ON public.calendar_events;
DROP POLICY IF EXISTS calendar_events_admin_delete ON public.calendar_events;
DROP POLICY IF EXISTS calendar_events_team_delete  ON public.calendar_events;
DROP POLICY IF EXISTS ws_delete_calendar_events    ON public.calendar_events;

CREATE POLICY calendar_events_write_update ON public.calendar_events
  FOR UPDATE TO authenticated
  USING      (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY calendar_events_write_delete ON public.calendar_events
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

-- =========================================================================
-- meetings
-- =========================================================================
DROP POLICY IF EXISTS meetings_admin_select ON public.meetings;
DROP POLICY IF EXISTS meetings_admin_update ON public.meetings;
DROP POLICY IF EXISTS meetings_team_update  ON public.meetings;
DROP POLICY IF EXISTS ws_update_meetings    ON public.meetings;
DROP POLICY IF EXISTS meetings_admin_delete ON public.meetings;
DROP POLICY IF EXISTS meetings_team_delete  ON public.meetings;
DROP POLICY IF EXISTS ws_delete_meetings    ON public.meetings;

CREATE POLICY meetings_write_update ON public.meetings
  FOR UPDATE TO authenticated
  USING      (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY meetings_write_delete ON public.meetings
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

-- =========================================================================
-- email_threads
-- =========================================================================
DROP POLICY IF EXISTS email_threads_admin_select ON public.email_threads;
DROP POLICY IF EXISTS email_threads_admin_update ON public.email_threads;
DROP POLICY IF EXISTS email_threads_team_update  ON public.email_threads;
DROP POLICY IF EXISTS ws_update_email_threads    ON public.email_threads;
DROP POLICY IF EXISTS email_threads_admin_delete ON public.email_threads;
DROP POLICY IF EXISTS email_threads_team_delete  ON public.email_threads;
DROP POLICY IF EXISTS ws_delete_email_threads    ON public.email_threads;

CREATE POLICY email_threads_write_update ON public.email_threads
  FOR UPDATE TO authenticated
  USING      (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY email_threads_write_delete ON public.email_threads
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

-- =========================================================================
-- email_messages
-- =========================================================================
DROP POLICY IF EXISTS email_messages_admin_select ON public.email_messages;
DROP POLICY IF EXISTS email_messages_admin_update ON public.email_messages;
DROP POLICY IF EXISTS email_messages_team_update  ON public.email_messages;
DROP POLICY IF EXISTS ws_update_email_messages    ON public.email_messages;
DROP POLICY IF EXISTS email_messages_admin_delete ON public.email_messages;
DROP POLICY IF EXISTS email_messages_team_delete  ON public.email_messages;
DROP POLICY IF EXISTS ws_delete_email_messages    ON public.email_messages;

CREATE POLICY email_messages_write_update ON public.email_messages
  FOR UPDATE TO authenticated
  USING      (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY email_messages_write_delete ON public.email_messages
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

-- =========================================================================
-- email_broadcasts
-- =========================================================================
DROP POLICY IF EXISTS email_broadcasts_admin_select ON public.email_broadcasts;
DROP POLICY IF EXISTS email_broadcasts_admin_update ON public.email_broadcasts;
DROP POLICY IF EXISTS email_broadcasts_team_update  ON public.email_broadcasts;
DROP POLICY IF EXISTS ws_update_email_broadcasts    ON public.email_broadcasts;
DROP POLICY IF EXISTS email_broadcasts_admin_delete ON public.email_broadcasts;
DROP POLICY IF EXISTS email_broadcasts_team_delete  ON public.email_broadcasts;
DROP POLICY IF EXISTS ws_delete_email_broadcasts    ON public.email_broadcasts;

CREATE POLICY email_broadcasts_write_update ON public.email_broadcasts
  FOR UPDATE TO authenticated
  USING      (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY email_broadcasts_write_delete ON public.email_broadcasts
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

-- =========================================================================
-- whatsapp_conversations
-- =========================================================================
DROP POLICY IF EXISTS whatsapp_conversations_admin_select ON public.whatsapp_conversations;
DROP POLICY IF EXISTS whatsapp_conversations_admin_update ON public.whatsapp_conversations;
DROP POLICY IF EXISTS whatsapp_conversations_team_update  ON public.whatsapp_conversations;
DROP POLICY IF EXISTS ws_update_whatsapp_conversations    ON public.whatsapp_conversations;
DROP POLICY IF EXISTS whatsapp_conversations_admin_delete ON public.whatsapp_conversations;
DROP POLICY IF EXISTS whatsapp_conversations_team_delete  ON public.whatsapp_conversations;
DROP POLICY IF EXISTS ws_delete_whatsapp_conversations    ON public.whatsapp_conversations;

CREATE POLICY whatsapp_conversations_write_update ON public.whatsapp_conversations
  FOR UPDATE TO authenticated
  USING      (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY whatsapp_conversations_write_delete ON public.whatsapp_conversations
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

-- =========================================================================
-- whatsapp_messages
-- =========================================================================
DROP POLICY IF EXISTS whatsapp_messages_admin_select ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_admin_update ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_team_update  ON public.whatsapp_messages;
DROP POLICY IF EXISTS ws_update_whatsapp_messages    ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_admin_delete ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_team_delete  ON public.whatsapp_messages;
DROP POLICY IF EXISTS ws_delete_whatsapp_messages    ON public.whatsapp_messages;

CREATE POLICY whatsapp_messages_write_update ON public.whatsapp_messages
  FOR UPDATE TO authenticated
  USING      (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY whatsapp_messages_write_delete ON public.whatsapp_messages
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

-- =========================================================================
-- whatsapp_campaigns
-- =========================================================================
DROP POLICY IF EXISTS whatsapp_campaigns_admin_select ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS whatsapp_campaigns_admin_update ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS whatsapp_campaigns_team_update  ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS ws_update_whatsapp_campaigns    ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS whatsapp_campaigns_admin_delete ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS whatsapp_campaigns_team_delete  ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS ws_delete_whatsapp_campaigns    ON public.whatsapp_campaigns;

CREATE POLICY whatsapp_campaigns_write_update ON public.whatsapp_campaigns
  FOR UPDATE TO authenticated
  USING      (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY whatsapp_campaigns_write_delete ON public.whatsapp_campaigns
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

-- =========================================================================
-- quote_line_items
-- =========================================================================
DROP POLICY IF EXISTS quote_line_items_admin_select ON public.quote_line_items;
DROP POLICY IF EXISTS quote_line_items_admin_update ON public.quote_line_items;
DROP POLICY IF EXISTS quote_line_items_team_update  ON public.quote_line_items;
DROP POLICY IF EXISTS ws_update_quote_line_items    ON public.quote_line_items;
DROP POLICY IF EXISTS quote_line_items_admin_delete ON public.quote_line_items;
DROP POLICY IF EXISTS quote_line_items_team_delete  ON public.quote_line_items;
DROP POLICY IF EXISTS ws_delete_quote_line_items    ON public.quote_line_items;

CREATE POLICY quote_line_items_write_update ON public.quote_line_items
  FOR UPDATE TO authenticated
  USING      (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY quote_line_items_write_delete ON public.quote_line_items
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

-- =========================================================================
-- quote_templates
-- =========================================================================
DROP POLICY IF EXISTS quote_templates_admin_select ON public.quote_templates;
DROP POLICY IF EXISTS quote_templates_admin_update ON public.quote_templates;
DROP POLICY IF EXISTS quote_templates_team_update  ON public.quote_templates;
DROP POLICY IF EXISTS ws_update_quote_templates    ON public.quote_templates;
DROP POLICY IF EXISTS quote_templates_admin_delete ON public.quote_templates;
DROP POLICY IF EXISTS quote_templates_team_delete  ON public.quote_templates;
DROP POLICY IF EXISTS ws_delete_quote_templates    ON public.quote_templates;

CREATE POLICY quote_templates_write_update ON public.quote_templates
  FOR UPDATE TO authenticated
  USING      (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()))
  WITH CHECK (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));

CREATE POLICY quote_templates_write_delete ON public.quote_templates
  FOR DELETE TO authenticated
  USING (is_workspace_admin_of(owner_id, auth.uid()) OR can_write_owner(owner_id, auth.uid()));
