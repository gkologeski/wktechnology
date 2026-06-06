
-- 1) Explicit deny-all on app_settings for anon and authenticated.
--    Service role bypasses RLS, so cron jobs / edge functions still work.
DROP POLICY IF EXISTS app_settings_deny_all ON public.app_settings;
CREATE POLICY app_settings_deny_all
  ON public.app_settings
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 2) Restrict whatsapp_media_workspace_read to authenticated role only.
DROP POLICY IF EXISTS whatsapp_media_workspace_read ON storage.objects;
CREATE POLICY whatsapp_media_workspace_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND EXISTS (
      SELECT 1
        FROM public.whatsapp_messages wm
       WHERE public.is_workspace_member(wm.owner_id, auth.uid())
         AND (wm.media_url = objects.name OR wm.media_url LIKE '%/' || objects.name)
    )
  );
