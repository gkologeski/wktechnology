
-- 1. Revogar colunas sensíveis do papel authenticated
REVOKE SELECT (access_token, refresh_token) ON public.ads_accounts FROM authenticated;
REVOKE SELECT (public_token) ON public.esign_signers FROM authenticated;
REVOKE SELECT (secret) ON public.outbound_webhooks FROM authenticated;
REVOKE SELECT (access_token) ON public.slack_integrations FROM authenticated;
REVOKE SELECT (access_token) ON public.wa_business_accounts FROM authenticated;

-- 2. Corrigir policies de meetings/meeting_summaries/meeting_participants
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['meetings','meeting_summaries','meeting_participants'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Workspace members can view %s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Workspace members can create %s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Workspace members can update %s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Workspace members can delete %s" ON public.%I', t, t);
  END LOOP;
END $$;

CREATE POLICY "ws_select_meetings" ON public.meetings FOR SELECT
  USING (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));
CREATE POLICY "ws_insert_meetings" ON public.meetings FOR INSERT
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));
CREATE POLICY "ws_update_meetings" ON public.meetings FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));
CREATE POLICY "ws_delete_meetings" ON public.meetings FOR DELETE
  USING (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));

CREATE POLICY "ws_select_meeting_summaries" ON public.meeting_summaries FOR SELECT
  USING (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));
CREATE POLICY "ws_insert_meeting_summaries" ON public.meeting_summaries FOR INSERT
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));
CREATE POLICY "ws_update_meeting_summaries" ON public.meeting_summaries FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));
CREATE POLICY "ws_delete_meeting_summaries" ON public.meeting_summaries FOR DELETE
  USING (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));

CREATE POLICY "ws_select_meeting_participants" ON public.meeting_participants FOR SELECT
  USING (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));
CREATE POLICY "ws_insert_meeting_participants" ON public.meeting_participants FOR INSERT
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));
CREATE POLICY "ws_update_meeting_participants" ON public.meeting_participants FOR UPDATE
  USING (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));
CREATE POLICY "ws_delete_meeting_participants" ON public.meeting_participants FOR DELETE
  USING (workspace_id IN (SELECT current_user_workspaces()) OR (workspace_id IS NULL AND public.is_workspace_member(owner_id, auth.uid())));

-- 3. Restringir leitura pública de kb_categories a categorias com artigos publicados
DROP POLICY IF EXISTS kbcat_public_read ON public.kb_categories;
CREATE POLICY kbcat_public_read ON public.kb_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kb_articles a
      WHERE a.category_id = kb_categories.id AND a.published = true
    )
    OR public.is_workspace_member(owner_id, auth.uid())
  );
