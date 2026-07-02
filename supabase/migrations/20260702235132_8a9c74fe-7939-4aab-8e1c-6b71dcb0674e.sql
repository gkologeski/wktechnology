
-- Tighten notes-attachments INSERT: require folder prefix to be a workspace the user belongs to
DROP POLICY IF EXISTS notes_attachments_owner_insert ON storage.objects;

CREATE POLICY notes_attachments_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'notes-attachments'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

-- Tighten media bucket INSERT: require valid uuid folder and membership (or personal folder)
DROP POLICY IF EXISTS media_storage_insert ON storage.objects;

CREATE POLICY media_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );
