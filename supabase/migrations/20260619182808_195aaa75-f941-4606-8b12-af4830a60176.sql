
-- SDR playbooks: workspace read, owner write
DROP POLICY IF EXISTS "sdr_playbooks owner all" ON public.sdr_playbooks;

CREATE POLICY "sdr_playbooks workspace select"
  ON public.sdr_playbooks FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.shares_workspace_with(owner_id));

CREATE POLICY "sdr_playbooks owner insert"
  ON public.sdr_playbooks FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "sdr_playbooks owner update"
  ON public.sdr_playbooks FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "sdr_playbooks owner delete"
  ON public.sdr_playbooks FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- SDR enrollments: workspace read, owner write
DROP POLICY IF EXISTS "sdr_enrollments owner all" ON public.sdr_enrollments;

CREATE POLICY "sdr_enrollments workspace select"
  ON public.sdr_enrollments FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.shares_workspace_with(owner_id));

CREATE POLICY "sdr_enrollments owner insert"
  ON public.sdr_enrollments FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "sdr_enrollments owner update"
  ON public.sdr_enrollments FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "sdr_enrollments owner delete"
  ON public.sdr_enrollments FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- WhatsApp media: fix workspace scoping to use workspace_id (was passing owner_id as workspace id)
DROP POLICY IF EXISTS "whatsapp_media_workspace_read" ON storage.objects;

CREATE POLICY "whatsapp_media_workspace_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND EXISTS (
      SELECT 1 FROM public.whatsapp_messages wm
      WHERE wm.media_url = storage.objects.name
        AND public.is_workspace_member(wm.workspace_id, auth.uid())
    )
  );
