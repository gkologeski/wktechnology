UPDATE storage.buckets SET public = false WHERE id = 'whatsapp-media';

DROP POLICY IF EXISTS "WhatsApp media public read" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp-media public read" ON storage.objects;
DROP POLICY IF EXISTS "Public can read whatsapp-media" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_owner_delete" ON storage.objects;

CREATE POLICY "whatsapp_media_owner_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "whatsapp_media_owner_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "whatsapp_media_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "whatsapp_media_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);