DROP POLICY IF EXISTS onb_templates_workspace_admin_manage ON public.onboarding_templates;
CREATE POLICY onb_templates_workspace_admin_manage ON public.onboarding_templates
  FOR ALL TO authenticated
  USING (public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin_v2(workspace_id, auth.uid()));