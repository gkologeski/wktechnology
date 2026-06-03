-- Path layout: {workspace_id}/{conversation_id}/{message_id}/{filename}
-- Conversation id is segment 2 (split_part(name, '/', 2))

CREATE POLICY "chat_att_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_chat_member( (split_part(name, '/', 2))::uuid, auth.uid() )
  );

CREATE POLICY "chat_att_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.is_chat_member( (split_part(name, '/', 2))::uuid, auth.uid() )
  );

CREATE POLICY "chat_att_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_chat_member( (split_part(name, '/', 2))::uuid, auth.uid() )
  );