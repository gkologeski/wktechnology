-- Run after the upload-path client is published. Existing permissive policies stay.
ALTER POLICY shared_storage_read ON storage.objects USING(public.shared_storage_object_access(bucket_id,name,'view'));
ALTER POLICY shared_storage_create ON storage.objects WITH CHECK(public.shared_storage_object_access(bucket_id,name,'create'));
ALTER POLICY shared_storage_update ON storage.objects USING(public.shared_storage_object_access(bucket_id,name,'update')) WITH CHECK(public.shared_storage_object_access(bucket_id,name,'update'));
ALTER POLICY shared_storage_delete ON storage.objects USING(public.shared_storage_object_access(bucket_id,name,'delete'));
-- The historical notes INSERT expects workspace/..., while the UI used actor/... .
-- This additional permissive branch accepts only the new actor/workspace path;
-- the restrictive gate still checks the current action and workspace.
CREATE POLICY notes_attachments_scoped_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='notes-attachments' AND (owner=auth.uid() OR owner_id=auth.uid()::text) AND public.shared_storage_object_access(bucket_id,name,'create'));
-- Interview playback uses the authenticated Storage client. The old owner-only
-- branch prevented an otherwise authorized recruiter from viewing a colleague's
-- interview. This branch still requires the canonical interview permission.
CREATE POLICY ats_async_videos_scoped_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='ats-async-videos' AND public.shared_storage_object_access(bucket_id,name,'view'));
