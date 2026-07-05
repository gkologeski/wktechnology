DROP POLICY IF EXISTS chat_members_delete ON public.chat_conversation_members;
DROP POLICY IF EXISTS chat_members_insert ON public.chat_conversation_members;

CREATE POLICY chat_members_delete ON public.chat_conversation_members
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY chat_members_insert ON public.chat_conversation_members
  FOR INSERT WITH CHECK (user_id = auth.uid());