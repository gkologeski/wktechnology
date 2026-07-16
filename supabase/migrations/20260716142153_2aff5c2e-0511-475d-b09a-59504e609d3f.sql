-- Restrict exports bucket read to workspace admins to match audit_export_runs SELECT policy
DROP POLICY IF EXISTS exports_workspace_read ON storage.objects;
CREATE POLICY exports_workspace_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'exports'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR is_workspace_admin_v2(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);