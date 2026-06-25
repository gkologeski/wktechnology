
-- 1) ats_offers: drop broad anon SELECT
DROP POLICY IF EXISTS offers_public_read_by_token ON public.ats_offers;

-- 2) ats_interviews: drop broad anon SELECT
DROP POLICY IF EXISTS ats_interviews_public_token_select ON public.ats_interviews;

-- 3) ats_async_video_responses: drop broad anon SELECT (insert via interview stays)
DROP POLICY IF EXISTS ats_avr_public_select_via_interview ON public.ats_async_video_responses;

-- 4) module_branding: drop unrestricted public SELECT
DROP POLICY IF EXISTS "Public can read module branding" ON public.module_branding;

-- 5) WhatsApp media: replace dead join policy with workspace-membership check
DROP POLICY IF EXISTS whatsapp_media_workspace_read ON storage.objects;
CREATE POLICY whatsapp_media_workspace_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND EXISTS (
      SELECT 1
        FROM public.workspace_members me
        JOIN public.workspace_members uploader
          ON uploader.workspace_id = me.workspace_id
       WHERE me.user_id = auth.uid()
         AND uploader.user_id::text = (storage.foldername(name))[1]
    )
  );
