DROP POLICY IF EXISTS "notes_attachments_workspace_select" ON storage.objects;
CREATE POLICY "notes_attachments_workspace_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'notes-attachments'
  AND (
    owner = auth.uid()
    OR (
      (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "zap_sub select" ON public.zapier_subscriptions;
CREATE POLICY "zap_sub select"
ON public.zapier_subscriptions FOR SELECT TO authenticated
USING (public.is_workspace_admin_v2(workspace_id, auth.uid()));