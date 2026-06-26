-- Allow workspace admins to view candidates owned by users in the same workspace.
-- This complements the existing per-job team_select policy by enabling admins
-- to search the full candidate pool of their workspace, while keeping access
-- limited to admins of the OWNER's workspace (not arbitrary admins).
CREATE POLICY "ats_candidates_workspace_admin_select"
  ON public.ats_candidates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members owner_wm
      WHERE owner_wm.user_id = ats_candidates.owner_id
        AND public.is_workspace_admin_v2(owner_wm.workspace_id, auth.uid())
    )
  );

-- Symmetric workspace access for WhatsApp media: peers who can already READ
-- media uploaded by a colleague (via whatsapp_media_workspace_read) should
-- also be able to UPDATE/DELETE the object to keep ownership consistent
-- within a workspace.
CREATE POLICY "whatsapp_media_workspace_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members me
      JOIN public.workspace_members uploader
        ON uploader.workspace_id = me.workspace_id
      WHERE me.user_id = auth.uid()
        AND (uploader.user_id)::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "whatsapp_media_workspace_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members me
      JOIN public.workspace_members uploader
        ON uploader.workspace_id = me.workspace_id
      WHERE me.user_id = auth.uid()
        AND (uploader.user_id)::text = (storage.foldername(name))[1]
    )
  );