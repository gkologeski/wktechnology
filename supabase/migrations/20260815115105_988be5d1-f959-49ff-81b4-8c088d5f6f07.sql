-- 1. kb_articles: remove cross-tenant published read
DROP POLICY IF EXISTS "kb_auth_read" ON public.kb_articles;
DROP POLICY IF EXISTS "kb_member_read" ON public.kb_articles;
CREATE POLICY "kb_member_read" ON public.kb_articles
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(owner_id, auth.uid()));

-- 2. kb_categories: scope reads to workspace members only
DROP POLICY IF EXISTS "kbcat_public_read" ON public.kb_categories;
CREATE POLICY "kbcat_member_read" ON public.kb_categories
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(owner_id, auth.uid()));

-- 3. public-role policies on user-scoped tables -> authenticated
DROP POLICY IF EXISTS "own search_pinned" ON public.search_pinned;
CREATE POLICY "own search_pinned" ON public.search_pinned
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own search_recent" ON public.search_recent;
CREATE POLICY "own search_recent" ON public.search_recent
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner manages unipile_accounts" ON public.unipile_accounts;
CREATE POLICY "owner manages unipile_accounts" ON public.unipile_accounts
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "owner manages unipile_message_log" ON public.unipile_message_log;
CREATE POLICY "owner manages unipile_message_log" ON public.unipile_message_log
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners manage their workflow_time_cursors" ON public.workflow_time_cursors;
CREATE POLICY "Owners manage their workflow_time_cursors" ON public.workflow_time_cursors
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners manage their workflow_approvals" ON public.workflow_approvals;
CREATE POLICY "Owners manage their workflow_approvals" ON public.workflow_approvals
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "ws_update_prospecting_scripts" ON public.prospecting_scripts;
CREATE POLICY "ws_update_prospecting_scripts" ON public.prospecting_scripts
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspaces()));

-- 4. storage policies for people-documents -> authenticated
DROP POLICY IF EXISTS "people_documents_bucket_select" ON storage.objects;
CREATE POLICY "people_documents_bucket_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'people-documents' AND public.is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid()));

DROP POLICY IF EXISTS "people_documents_bucket_insert" ON storage.objects;
CREATE POLICY "people_documents_bucket_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'people-documents' AND public.is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid()));

DROP POLICY IF EXISTS "people_documents_bucket_update" ON storage.objects;
CREATE POLICY "people_documents_bucket_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'people-documents' AND public.is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid()))
  WITH CHECK (bucket_id = 'people-documents' AND public.is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid()));

DROP POLICY IF EXISTS "people_documents_bucket_delete" ON storage.objects;
CREATE POLICY "people_documents_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'people-documents' AND public.is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid()));