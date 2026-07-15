
-- 1) Restrict role from public to authenticated (recreate policies)

-- ats_async_video_responses
DROP POLICY IF EXISTS ats_avr_owner_delete ON public.ats_async_video_responses;
CREATE POLICY ats_avr_owner_delete ON public.ats_async_video_responses
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS ats_avr_owner_select ON public.ats_async_video_responses;
CREATE POLICY ats_avr_owner_select ON public.ats_async_video_responses
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- ats_interview_kits
DROP POLICY IF EXISTS ats_interview_kits_owner_all ON public.ats_interview_kits;
CREATE POLICY ats_interview_kits_owner_all ON public.ats_interview_kits
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- calendar_accounts
DROP POLICY IF EXISTS ws_insert_calendar_accounts ON public.calendar_accounts;
CREATE POLICY ws_insert_calendar_accounts ON public.calendar_accounts
  FOR INSERT TO authenticated
  WITH CHECK ((owner_id = auth.uid()) AND (workspace_id IN (SELECT current_user_workspaces())));

-- deal_line_items
DROP POLICY IF EXISTS ws_delete_deal_line_items ON public.deal_line_items;
CREATE POLICY ws_delete_deal_line_items ON public.deal_line_items
  FOR DELETE TO authenticated
  USING (
    (workspace_id IN (SELECT current_user_workspaces()))
    AND (
      user_has_permission(auth.uid(), 'techsales.deals.update.workspace')
      OR user_has_permission(auth.uid(), 'techsales.deals.update.team')
      OR user_has_permission(auth.uid(), 'techsales.deals.update.own')
      OR user_has_permission(auth.uid(), 'techsales.deals.delete.workspace')
    )
  );

DROP POLICY IF EXISTS ws_insert_deal_line_items ON public.deal_line_items;
CREATE POLICY ws_insert_deal_line_items ON public.deal_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    (workspace_id IN (SELECT current_user_workspaces()))
    AND (
      user_has_permission(auth.uid(), 'techsales.deals.update.workspace')
      OR user_has_permission(auth.uid(), 'techsales.deals.update.team')
      OR user_has_permission(auth.uid(), 'techsales.deals.update.own')
      OR user_has_permission(auth.uid(), 'techsales.deals.create.own')
    )
  );

-- dunning_policies
DROP POLICY IF EXISTS ws_update_dunning_policies ON public.dunning_policies;
CREATE POLICY ws_update_dunning_policies ON public.dunning_policies
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

-- leads
DROP POLICY IF EXISTS ws_update_leads ON public.leads;
CREATE POLICY ws_update_leads ON public.leads
  FOR UPDATE TO authenticated
  USING (
    (workspace_id IN (SELECT current_user_workspaces()))
    AND user_can_act('leads', 'edit', owner_id, assigned_user_id)
  )
  WITH CHECK (
    (workspace_id IN (SELECT current_user_workspaces()))
    AND user_can_act('leads', 'edit', owner_id, assigned_user_id)
  );

-- meetings
DROP POLICY IF EXISTS meetings_write_delete ON public.meetings;
CREATE POLICY meetings_write_delete ON public.meetings
  FOR DELETE TO authenticated
  USING (
    is_workspace_admin_of(owner_id, auth.uid())
    OR (
      ((workspace_id IN (SELECT current_user_workspaces())) OR ((workspace_id IS NULL) AND is_workspace_member(owner_id, auth.uid())))
      AND user_has_permission(auth.uid(), 'techsales.meetings.delete.workspace')
    )
  );

DROP POLICY IF EXISTS meetings_write_update ON public.meetings;
CREATE POLICY meetings_write_update ON public.meetings
  FOR UPDATE TO authenticated
  USING (
    is_workspace_admin_of(owner_id, auth.uid())
    OR (
      ((workspace_id IN (SELECT current_user_workspaces())) OR ((workspace_id IS NULL) AND is_workspace_member(owner_id, auth.uid())))
      AND (
        user_has_permission(auth.uid(), 'techsales.meetings.update.workspace')
        OR (user_has_permission(auth.uid(), 'techsales.meetings.update.own') AND can_write_owner(owner_id, auth.uid()))
      )
    )
  )
  WITH CHECK (
    is_workspace_admin_of(owner_id, auth.uid())
    OR (
      ((workspace_id IN (SELECT current_user_workspaces())) OR ((workspace_id IS NULL) AND is_workspace_member(owner_id, auth.uid())))
      AND (
        user_has_permission(auth.uid(), 'techsales.meetings.update.workspace')
        OR (user_has_permission(auth.uid(), 'techsales.meetings.update.own') AND can_write_owner(owner_id, auth.uid()))
      )
    )
  );

-- quote_line_items
DROP POLICY IF EXISTS quote_line_items_write_delete ON public.quote_line_items;
CREATE POLICY quote_line_items_write_delete ON public.quote_line_items
  FOR DELETE TO authenticated
  USING (
    (workspace_id IN (SELECT current_user_workspaces()))
    AND (
      user_has_permission(auth.uid(), 'techsales.quotes.update.workspace')
      OR user_has_permission(auth.uid(), 'techsales.quotes.delete.workspace')
      OR (user_has_permission(auth.uid(), 'techsales.quotes.update.own') AND (owner_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS quote_line_items_write_update ON public.quote_line_items;
CREATE POLICY quote_line_items_write_update ON public.quote_line_items
  FOR UPDATE TO authenticated
  USING (
    (workspace_id IN (SELECT current_user_workspaces()))
    AND (
      user_has_permission(auth.uid(), 'techsales.quotes.update.workspace')
      OR (user_has_permission(auth.uid(), 'techsales.quotes.update.own') AND (owner_id = auth.uid()))
    )
  )
  WITH CHECK (
    (workspace_id IN (SELECT current_user_workspaces()))
    AND (
      user_has_permission(auth.uid(), 'techsales.quotes.update.workspace')
      OR (user_has_permission(auth.uid(), 'techsales.quotes.update.own') AND (owner_id = auth.uid()))
    )
  );

-- survey_templates
DROP POLICY IF EXISTS ws_insert_survey_templates ON public.survey_templates;
CREATE POLICY ws_insert_survey_templates ON public.survey_templates
  FOR INSERT TO authenticated
  WITH CHECK ((owner_id = auth.uid()) AND (workspace_id IN (SELECT current_user_workspaces())));

DROP POLICY IF EXISTS owner_update_survey_templates ON public.survey_templates;
CREATE POLICY owner_update_survey_templates ON public.survey_templates
  FOR UPDATE TO authenticated
  USING ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK ((owner_id = auth.uid()) OR is_workspace_admin_v2(workspace_id, auth.uid()));

-- wa_phone_numbers
DROP POLICY IF EXISTS ws_insert_wa_phone_numbers ON public.wa_phone_numbers;
CREATE POLICY ws_insert_wa_phone_numbers ON public.wa_phone_numbers
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_admin_v2(workspace_id, auth.uid()));

DROP POLICY IF EXISTS ws_update_wa_phone_numbers ON public.wa_phone_numbers;
CREATE POLICY ws_update_wa_phone_numbers ON public.wa_phone_numbers
  FOR UPDATE TO authenticated
  USING (is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_admin_v2(workspace_id, auth.uid()));

-- 2) Baseline restrictive owner policy for quote_line_items / deal_line_items
-- Ensures any UPDATE/DELETE requires either the row owner or a workspace admin,
-- even if a broad permission key was granted by mistake.

DROP POLICY IF EXISTS quote_line_items_baseline_owner_or_admin ON public.quote_line_items;
CREATE POLICY quote_line_items_baseline_owner_or_admin ON public.quote_line_items
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR is_workspace_admin_of(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR is_workspace_admin_of(owner_id, auth.uid()));

DROP POLICY IF EXISTS quote_line_items_baseline_owner_or_admin_del ON public.quote_line_items;
CREATE POLICY quote_line_items_baseline_owner_or_admin_del ON public.quote_line_items
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR is_workspace_admin_of(owner_id, auth.uid()));

DROP POLICY IF EXISTS deal_line_items_baseline_owner_or_admin_ins ON public.deal_line_items;
CREATE POLICY deal_line_items_baseline_owner_or_admin_ins ON public.deal_line_items
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR is_workspace_admin_of(owner_id, auth.uid()));

DROP POLICY IF EXISTS deal_line_items_baseline_owner_or_admin_del ON public.deal_line_items;
CREATE POLICY deal_line_items_baseline_owner_or_admin_del ON public.deal_line_items
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR is_workspace_admin_of(owner_id, auth.uid()));
