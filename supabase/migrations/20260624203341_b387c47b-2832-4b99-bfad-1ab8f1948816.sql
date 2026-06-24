
-- Owner full-access dentro do próprio prefixo
CREATE POLICY "ats_async_videos_owner_all"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'ats-async-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'ats-async-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Candidato anon: upload se existe entrevista async com token para o owner indicado no path
CREATE POLICY "ats_async_videos_anon_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'ats-async-videos'
    AND EXISTS (
      SELECT 1 FROM public.ats_interviews i
      WHERE i.owner_id::text = (storage.foldername(name))[1]
        AND i.id::text = (storage.foldername(name))[2]
        AND i.self_schedule_token IS NOT NULL
        AND i.kind = 'async'
    )
  );

-- Candidato anon: leitura (signed URL ou direct) só de arquivos atrelados a entrevista válida
CREATE POLICY "ats_async_videos_anon_select"
  ON storage.objects FOR SELECT
  TO anon
  USING (
    bucket_id = 'ats-async-videos'
    AND EXISTS (
      SELECT 1 FROM public.ats_interviews i
      WHERE i.owner_id::text = (storage.foldername(name))[1]
        AND i.id::text = (storage.foldername(name))[2]
        AND i.self_schedule_token IS NOT NULL
    )
  );
