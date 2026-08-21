-- financial_recurrences
DROP POLICY IF EXISTS "Owner can select own recurrences" ON public.financial_recurrences;
CREATE POLICY "fin_recurrences_select" ON public.financial_recurrences
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      workspace_id IN (SELECT public.current_user_workspaces())
      AND (
        public.is_workspace_admin_of(workspace_id, auth.uid())
        OR public.user_has_permission(auth.uid(), workspace_id, 'techfinance.recurrences.view.workspace')
      )
    )
  );

-- integrations
DROP POLICY IF EXISTS ws_select_integrations ON public.integrations;
CREATE POLICY ws_select_integrations ON public.integrations
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      workspace_id IN (SELECT public.current_user_workspaces())
      AND (
        public.is_workspace_admin_of(workspace_id, auth.uid())
        OR public.user_has_permission(auth.uid(), workspace_id, 'system.integrations.view.workspace')
      )
    )
  );

-- onboarding_runs (mantém gestão do dono, adiciona leitura por permissão)
CREATE POLICY onb_runs_workspace_select ON public.onboarding_runs
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspaces())
    AND (
      public.is_workspace_admin_of(workspace_id, auth.uid())
      OR public.user_has_permission(auth.uid(), workspace_id, 'techpeople.onboarding.view.workspace')
    )
  );

-- meet_recording_index
DROP POLICY IF EXISTS meet_recording_index_owner_select ON public.meet_recording_index;
CREATE POLICY meet_recording_index_select ON public.meet_recording_index
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      workspace_id IN (SELECT public.current_user_workspaces())
      AND (
        public.is_workspace_admin_of(workspace_id, auth.uid())
        OR public.user_has_permission(auth.uid(), workspace_id, 'techhire.notetaker.view.workspace')
      )
    )
  );

-- workflow_approvals (mantém gestão do dono, adiciona leitura por permissão)
CREATE POLICY workflow_approvals_workspace_select ON public.workflow_approvals
  FOR SELECT TO authenticated
  USING (
    approver_user_id = auth.uid()
    OR (
      workspace_id IN (SELECT public.current_user_workspaces())
      AND (
        public.is_workspace_admin_of(workspace_id, auth.uid())
        OR public.user_has_permission(auth.uid(), workspace_id, 'system.workflows.view.workspace')
      )
    )
  );

-- team_members: membros do workspace enxergam a equipe
DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT TO authenticated
  USING (
    workspace_owner_id = auth.uid()
    OR member_user_id = auth.uid()
    OR public.is_workspace_member(workspace_owner_id, auth.uid())
  );

-- api_keys: credenciais seguem restritas ao dono + admins do workspace
DROP POLICY IF EXISTS ws_select_api_keys ON public.api_keys;
CREATE POLICY ws_select_api_keys ON public.api_keys
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR (workspace_id IN (SELECT public.current_user_workspaces())
        AND public.is_workspace_admin_of(workspace_id, auth.uid()))
  );