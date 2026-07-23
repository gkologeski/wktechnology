
DROP POLICY IF EXISTS ws_legal_entities_write ON public.legal_entities;
CREATE POLICY ws_legal_entities_write ON public.legal_entities
  FOR ALL
  USING ((workspace_id IN (SELECT current_user_workspaces())) AND is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND is_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS ws_insert_sequence_enrollments ON public.sequence_enrollments;
CREATE POLICY ws_insert_sequence_enrollments ON public.sequence_enrollments
  FOR INSERT
  WITH CHECK ((workspace_id IN (SELECT current_user_workspaces())) AND owner_id = auth.uid());
