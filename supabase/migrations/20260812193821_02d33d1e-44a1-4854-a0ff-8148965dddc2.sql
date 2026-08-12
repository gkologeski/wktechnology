-- 1) ats_stage_emails: consolidate duplicated policy sets
DROP POLICY IF EXISTS "own ats_stage_emails select" ON public.ats_stage_emails;
DROP POLICY IF EXISTS "own ats_stage_emails write" ON public.ats_stage_emails;

DROP POLICY IF EXISTS "ats_stage_emails_admin_select" ON public.ats_stage_emails;
CREATE POLICY "ats_stage_emails_select" ON public.ats_stage_emails
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
  );

CREATE POLICY "ats_stage_emails_insert" ON public.ats_stage_emails
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
  );

DROP POLICY IF EXISTS "ats_stage_emails_admin_update" ON public.ats_stage_emails;
DROP POLICY IF EXISTS "ats_stage_emails_team_update" ON public.ats_stage_emails;
CREATE POLICY "ats_stage_emails_update" ON public.ats_stage_emails
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

DROP POLICY IF EXISTS "ats_stage_emails_admin_delete" ON public.ats_stage_emails;
DROP POLICY IF EXISTS "ats_stage_emails_team_delete" ON public.ats_stage_emails;
CREATE POLICY "ats_stage_emails_delete" ON public.ats_stage_emails
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin_of(owner_id, auth.uid())
    OR public.can_write_owner(owner_id, auth.uid())
  );

-- 2) financial_entries: creator-only read now requires an active finance permission
DROP POLICY IF EXISTS "ws_financial_entries_select" ON public.financial_entries;
CREATE POLICY "ws_financial_entries_select" ON public.financial_entries
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_v2(workspace_id, auth.uid())
      OR public.user_has_permission(auth.uid(), workspace_id, 'finance.read')
      OR (
        (owner_id = auth.uid() OR assigned_to = auth.uid())
        AND public.user_has_permission(auth.uid(), workspace_id, 'techfinance.entries.create.own')
      )
    )
  );

-- 3) ats_hunting_captures: explicit per-command policies, strictly per-user
DROP POLICY IF EXISTS "hunting_captures_owner_all" ON public.ats_hunting_captures;
CREATE POLICY "hunting_captures_select" ON public.ats_hunting_captures
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "hunting_captures_insert" ON public.ats_hunting_captures
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND (captured_by IS NULL OR captured_by = auth.uid()));
CREATE POLICY "hunting_captures_update" ON public.ats_hunting_captures
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "hunting_captures_delete" ON public.ats_hunting_captures
  FOR DELETE TO authenticated USING (owner_id = auth.uid());