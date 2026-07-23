
-- 1) kb_articles: replace broad ALL permissive policy with narrow SELECT-only,
-- delegating write authorization to existing scoped/RESTRICTIVE policies.
DROP POLICY IF EXISTS kb_member_write ON public.kb_articles;
CREATE POLICY kb_member_read ON public.kb_articles
  FOR SELECT
  USING (public.is_workspace_member(owner_id, auth.uid()));

-- 2) Fix swapped arg order: is_workspace_admin[_v2] expects (workspace_id, user_id).

-- people_onboarding_plans
DROP POLICY IF EXISTS onb_plans_ws_admin_write ON public.people_onboarding_plans;
CREATE POLICY onb_plans_ws_admin_write ON public.people_onboarding_plans
  FOR ALL
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

-- people_onboarding_tasks
DROP POLICY IF EXISTS onb_tasks_ws_admin_write ON public.people_onboarding_tasks;
CREATE POLICY onb_tasks_ws_admin_write ON public.people_onboarding_tasks
  FOR ALL
  USING (public.is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

-- people_onboarding_templates
DROP POLICY IF EXISTS onb_templates_workspace_admin_manage ON public.people_onboarding_templates;
CREATE POLICY onb_templates_workspace_admin_manage ON public.people_onboarding_templates
  FOR ALL
  USING (workspace_id IS NOT NULL AND public.is_workspace_admin_v2(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_admin_v2(workspace_id, auth.uid()));

-- people_allocations (update/delete)
DROP POLICY IF EXISTS allocations_ws_update ON public.people_allocations;
CREATE POLICY allocations_ws_update ON public.people_allocations
  FOR UPDATE
  USING (
    workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())
    AND (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()))
  );

DROP POLICY IF EXISTS allocations_ws_delete ON public.people_allocations;
CREATE POLICY allocations_ws_delete ON public.people_allocations
  FOR DELETE
  USING (
    workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())
    AND (owner_id = auth.uid() OR public.is_workspace_admin_v2(workspace_id, auth.uid()))
  );

-- Storage: people-documents bucket policies
DROP POLICY IF EXISTS people_documents_bucket_select ON storage.objects;
CREATE POLICY people_documents_bucket_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'people-documents'
    AND public.is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS people_documents_bucket_insert ON storage.objects;
CREATE POLICY people_documents_bucket_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'people-documents'
    AND public.is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS people_documents_bucket_update ON storage.objects;
CREATE POLICY people_documents_bucket_update ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'people-documents'
    AND public.is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'people-documents'
    AND public.is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS people_documents_bucket_delete ON storage.objects;
CREATE POLICY people_documents_bucket_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'people-documents'
    AND public.is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid())
  );
