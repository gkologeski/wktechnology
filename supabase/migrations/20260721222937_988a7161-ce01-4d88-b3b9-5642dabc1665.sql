
DROP POLICY IF EXISTS onb_tpl_ws_admin_write ON public.people_onboarding_templates;
CREATE POLICY onb_tpl_ws_admin_write ON public.people_onboarding_templates FOR ALL TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));
