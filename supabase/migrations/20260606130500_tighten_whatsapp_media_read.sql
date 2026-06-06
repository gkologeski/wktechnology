-- Tighten whatsapp_media_workspace_read: require the file to actually belong to
-- a whatsapp_messages row in the caller's workspace, rather than trusting the
-- first folder segment of the object path.
DROP POLICY IF EXISTS whatsapp_media_workspace_read ON storage.objects;

CREATE POLICY whatsapp_media_workspace_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND EXISTS (
    SELECT 1
      FROM public.whatsapp_messages m
     WHERE m.media_url LIKE '%/' || storage.objects.name
       AND m.workspace_id IN (SELECT public.current_user_workspaces())
  )
);
