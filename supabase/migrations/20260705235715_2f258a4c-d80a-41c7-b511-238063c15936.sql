DROP POLICY IF EXISTS chat_members_insert ON public.chat_conversation_members;

CREATE POLICY chat_members_insert
  ON public.chat_conversation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND c.created_by = auth.uid()
    )
  );