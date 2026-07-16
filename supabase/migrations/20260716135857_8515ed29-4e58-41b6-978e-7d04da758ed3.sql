
-- =========================================================================
-- FIX 1: profiles.phone — remove column read from authenticated (peers)
-- =========================================================================
REVOKE SELECT (phone) ON public.profiles FROM authenticated;
-- anon has no grants on profiles; service_role retains ALL.
-- Owner-side and admin-side reads use supabaseAdmin (bypasses column grants).

-- =========================================================================
-- FIX 2: ats_candidates — consolidate to canonical ws_* policy set
-- =========================================================================
DROP POLICY IF EXISTS ats_candidates_admin_delete ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_admin_select ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_admin_update ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_owner_all ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_team_delete ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_team_select ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_team_update ON public.ats_candidates;
DROP POLICY IF EXISTS ats_candidates_workspace_admin_select ON public.ats_candidates;

CREATE POLICY ats_candidates_ws_select ON public.ats_candidates
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.ats_applications a
      WHERE a.candidate_id = ats_candidates.id
        AND public.can_access_ats_job(a.job_id)
    )
  );

CREATE POLICY ats_candidates_ws_insert ON public.ats_candidates
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY ats_candidates_ws_update ON public.ats_candidates
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
  );

CREATE POLICY ats_candidates_ws_delete ON public.ats_candidates
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
  );
-- RESTRICTIVE RBAC policies (rbac_insert/update/delete) remain in place.

-- =========================================================================
-- FIX 3: user_has_permission — scope every 2-arg call to the workspace
-- Rewrite policies on: activities, tickets, quotes, deal_line_items,
-- quote_line_items, meetings.
-- =========================================================================

-- ---- activities ----
DROP POLICY IF EXISTS ws_delete_activities ON public.activities;
DROP POLICY IF EXISTS ws_insert_activities ON public.activities;
DROP POLICY IF EXISTS ws_update_activities ON public.activities;

CREATE POLICY ws_insert_activities ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.create.own')
  );

CREATE POLICY ws_update_activities ON public.activities
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.own') AND owner_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.own') AND owner_id = auth.uid())
    )
  );

CREATE POLICY ws_delete_activities ON public.activities
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.delete.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.activities.update.own') AND owner_id = auth.uid())
    )
  );

-- ---- tickets ----
DROP POLICY IF EXISTS ws_delete_tickets ON public.tickets;
DROP POLICY IF EXISTS ws_insert_tickets ON public.tickets;
DROP POLICY IF EXISTS ws_update_tickets ON public.tickets;

CREATE POLICY ws_insert_tickets ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.create.own')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.manage.workspace')
    )
  );

CREATE POLICY ws_update_tickets ON public.tickets
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.update.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.manage.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.update.own') AND (owner_id = auth.uid() OR assignee_id = auth.uid()))
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.update.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.manage.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.update.own') AND (owner_id = auth.uid() OR assignee_id = auth.uid()))
    )
  );

CREATE POLICY ws_delete_tickets ON public.tickets
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.delete.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.tickets.manage.workspace')
    )
  );

-- ---- quotes ----
DROP POLICY IF EXISTS ws_delete_quotes ON public.quotes;
DROP POLICY IF EXISTS ws_insert_quotes ON public.quotes;
DROP POLICY IF EXISTS ws_update_quotes ON public.quotes;

CREATE POLICY ws_insert_quotes ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.create.own')
  );

CREATE POLICY ws_update_quotes ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  );

CREATE POLICY ws_delete_quotes ON public.quotes
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.delete.workspace')
  );

-- ---- deal_line_items ----
DROP POLICY IF EXISTS ws_delete_deal_line_items ON public.deal_line_items;
DROP POLICY IF EXISTS ws_insert_deal_line_items ON public.deal_line_items;
DROP POLICY IF EXISTS ws_update_deal_line_items ON public.deal_line_items;

CREATE POLICY ws_insert_deal_line_items ON public.deal_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.team')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.own')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.create.own')
    )
  );

CREATE POLICY ws_update_deal_line_items ON public.deal_line_items
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.team')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.own')
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.team')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.own')
    )
  );

CREATE POLICY ws_delete_deal_line_items ON public.deal_line_items
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.team')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.update.own')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.deals.delete.workspace')
    )
  );

-- ---- quote_line_items ----
DROP POLICY IF EXISTS quote_line_items_write_delete ON public.quote_line_items;
DROP POLICY IF EXISTS quote_line_items_write_update ON public.quote_line_items;
DROP POLICY IF EXISTS ws_insert_quote_line_items ON public.quote_line_items;

CREATE POLICY ws_insert_quote_line_items ON public.quote_line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.create.own')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  );

CREATE POLICY quote_line_items_write_update ON public.quote_line_items
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  );

CREATE POLICY quote_line_items_write_delete ON public.quote_line_items
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.workspace')
      OR public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.delete.workspace')
      OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.quotes.update.own') AND owner_id = auth.uid())
    )
  );

-- ---- meetings ----
-- Meetings may have workspace_id IS NULL. When NULL, restrict to
-- workspace admins of the owner; permission checks require a workspace.
DROP POLICY IF EXISTS ws_insert_meetings ON public.meetings;
DROP POLICY IF EXISTS meetings_write_update ON public.meetings;
DROP POLICY IF EXISTS meetings_write_delete ON public.meetings;

CREATE POLICY ws_insert_meetings ON public.meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      workspace_id IN (SELECT public.current_user_workspaces())
      AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.meetings.create.own')
    )
    OR (
      workspace_id IS NULL
      AND public.is_workspace_admin_of(owner_id, auth.uid())
    )
  );

CREATE POLICY meetings_write_update ON public.meetings
  FOR UPDATE TO authenticated
  USING (
    public.is_workspace_admin_of(owner_id, auth.uid())
    OR (
      workspace_id IN (SELECT public.current_user_workspaces())
      AND (
        public.user_has_permission(auth.uid(), workspace_id, 'techsales.meetings.update.workspace')
        OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.meetings.update.own') AND public.can_write_owner(owner_id, auth.uid()))
      )
    )
  )
  WITH CHECK (
    public.is_workspace_admin_of(owner_id, auth.uid())
    OR (
      workspace_id IN (SELECT public.current_user_workspaces())
      AND (
        public.user_has_permission(auth.uid(), workspace_id, 'techsales.meetings.update.workspace')
        OR (public.user_has_permission(auth.uid(), workspace_id, 'techsales.meetings.update.own') AND public.can_write_owner(owner_id, auth.uid()))
      )
    )
  );

CREATE POLICY meetings_write_delete ON public.meetings
  FOR DELETE TO authenticated
  USING (
    public.is_workspace_admin_of(owner_id, auth.uid())
    OR (
      workspace_id IN (SELECT public.current_user_workspaces())
      AND public.user_has_permission(auth.uid(), workspace_id, 'techsales.meetings.delete.workspace')
    )
  );
