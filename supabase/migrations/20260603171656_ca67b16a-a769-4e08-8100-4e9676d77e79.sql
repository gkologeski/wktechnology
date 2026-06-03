-- Conversations
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('dm','group')),
  title text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Members
CREATE TABLE public.chat_conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  muted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversation_members TO authenticated;
GRANT ALL ON public.chat_conversation_members TO service_role;
ALTER TABLE public.chat_conversation_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX chat_conv_members_user_idx ON public.chat_conversation_members(user_id);

-- Messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  workspace_owner_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX chat_messages_conv_created_idx ON public.chat_messages(conversation_id, created_at DESC);

-- Attachments
CREATE TABLE public.chat_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_message_attachments TO authenticated;
GRANT ALL ON public.chat_message_attachments TO service_role;
ALTER TABLE public.chat_message_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX chat_attachments_message_idx ON public.chat_message_attachments(message_id);

-- Security definer helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_chat_member(_conv uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversation_members
     WHERE conversation_id = _conv AND user_id = _user
  );
$$;

-- Policies: conversations
CREATE POLICY "chat_conv_select"
  ON public.chat_conversations FOR SELECT TO authenticated
  USING (public.is_chat_member(id, auth.uid()));

CREATE POLICY "chat_conv_insert"
  ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_workspace_member(workspace_owner_id, auth.uid())
  );

CREATE POLICY "chat_conv_update"
  ON public.chat_conversations FOR UPDATE TO authenticated
  USING (public.is_chat_member(id, auth.uid()))
  WITH CHECK (public.is_chat_member(id, auth.uid()));

-- Policies: members
CREATE POLICY "chat_members_select"
  ON public.chat_conversation_members FOR SELECT TO authenticated
  USING (public.is_chat_member(conversation_id, auth.uid()));

CREATE POLICY "chat_members_insert"
  ON public.chat_conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    -- Either I'm adding myself when creating a conv, or I'm already a member adding someone
    user_id = auth.uid()
    OR public.is_chat_member(conversation_id, auth.uid())
  );

CREATE POLICY "chat_members_update_self"
  ON public.chat_conversation_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_members_delete"
  ON public.chat_conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_member(conversation_id, auth.uid()));

-- Policies: messages
CREATE POLICY "chat_msg_select"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_chat_member(conversation_id, auth.uid()));

CREATE POLICY "chat_msg_insert"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND public.is_chat_member(conversation_id, auth.uid())
  );

CREATE POLICY "chat_msg_update_own"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (sender_user_id = auth.uid())
  WITH CHECK (sender_user_id = auth.uid());

-- Policies: attachments
CREATE POLICY "chat_att_select"
  ON public.chat_message_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_messages m
     WHERE m.id = chat_message_attachments.message_id
       AND public.is_chat_member(m.conversation_id, auth.uid())
  ));

CREATE POLICY "chat_att_insert"
  ON public.chat_message_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chat_messages m
     WHERE m.id = chat_message_attachments.message_id
       AND m.sender_user_id = auth.uid()
  ));

-- Trigger: update last_message_at + updated_at on new message
CREATE OR REPLACE FUNCTION public.chat_after_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations
     SET last_message_at = NEW.created_at,
         updated_at = NEW.created_at
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER chat_messages_after_insert
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_after_message_insert();

CREATE TRIGGER chat_conversations_set_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_attachments;