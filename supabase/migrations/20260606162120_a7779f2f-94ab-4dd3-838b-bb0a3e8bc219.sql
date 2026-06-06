
-- 1. exports bucket: add INSERT/UPDATE/DELETE policies scoped to user's own folder
CREATE POLICY "exports_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exports' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "exports_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "exports_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- 2. whatsapp-media workspace_read: require a matching whatsapp_messages row visible to caller
DROP POLICY IF EXISTS "whatsapp_media_workspace_read" ON storage.objects;
CREATE POLICY "whatsapp_media_workspace_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND EXISTS (
      SELECT 1 FROM public.whatsapp_messages wm
      WHERE is_workspace_member(wm.owner_id, auth.uid())
        AND (
          wm.media_url LIKE '%' || storage.objects.name
          OR wm.media_url LIKE '%' || storage.objects.name || '%'
        )
    )
  );

-- 3. workspace_invites: restrict policies to authenticated role only
DROP POLICY IF EXISTS "wi_select_own_admin" ON public.workspace_invites;
DROP POLICY IF EXISTS "wi_delete_own_admin" ON public.workspace_invites;
DROP POLICY IF EXISTS "wi_update_own_admin" ON public.workspace_invites;

CREATE POLICY "wi_select_own_admin" ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "wi_delete_own_admin" ON public.workspace_invites
  FOR DELETE TO authenticated
  USING (is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE POLICY "wi_update_own_admin" ON public.workspace_invites
  FOR UPDATE TO authenticated
  USING (is_workspace_admin_v2(workspace_id, auth.uid()));
