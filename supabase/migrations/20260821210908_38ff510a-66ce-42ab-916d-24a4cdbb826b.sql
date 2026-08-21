-- 1) access_profiles + filhos: leitura para membros do workspace
DROP POLICY IF EXISTS ap_member_select ON public.access_profiles;
CREATE POLICY ap_member_select ON public.access_profiles
  FOR SELECT TO authenticated
  USING (
    workspace_owner_id = auth.uid()
    OR public.is_workspace_member(workspace_owner_id, auth.uid())
  );

DROP POLICY IF EXISTS app_perm_member_select ON public.access_profile_permissions;
CREATE POLICY app_perm_member_select ON public.access_profile_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.access_profiles p
    WHERE p.id = access_profile_permissions.profile_id
      AND (p.workspace_owner_id = auth.uid() OR public.is_workspace_member(p.workspace_owner_id, auth.uid()))
  ));

DROP POLICY IF EXISTS app_tool_member_select ON public.access_profile_tools;
CREATE POLICY app_tool_member_select ON public.access_profile_tools
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.access_profiles p
    WHERE p.id = access_profile_tools.profile_id
      AND (p.workspace_owner_id = auth.uid() OR public.is_workspace_member(p.workspace_owner_id, auth.uid()))
  ));

-- 2) module_branding: leitura para membros do workspace
CREATE POLICY module_branding_member_select ON public.module_branding
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

-- 3) ML: leitura por workspace, escrita segue do dono
CREATE POLICY ml_forecast_workspace_select ON public.ml_forecast_scores
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR workspace_id IN (SELECT public.current_user_workspaces())
  );

CREATE POLICY ml_models_workspace_select ON public.ml_scoring_models
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR workspace_id IN (SELECT public.current_user_workspaces())
  );

-- 4) bug_reports (chamados internos): admins do workspace e da plataforma
CREATE POLICY bug_reports_admin_select ON public.bug_reports
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IS NOT NULL
        AND workspace_id IN (SELECT public.current_user_workspaces())
        AND public.is_workspace_admin_of(workspace_id, auth.uid()))
  );

CREATE POLICY bug_reports_admin_update ON public.bug_reports
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IS NOT NULL
        AND workspace_id IN (SELECT public.current_user_workspaces())
        AND public.is_workspace_admin_of(workspace_id, auth.uid()))
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (workspace_id IS NOT NULL
        AND workspace_id IN (SELECT public.current_user_workspaces())
        AND public.is_workspace_admin_of(workspace_id, auth.uid()))
  );