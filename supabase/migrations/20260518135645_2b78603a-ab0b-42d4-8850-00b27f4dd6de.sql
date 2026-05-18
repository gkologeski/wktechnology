
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'whatsapp';

CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_phone text NOT NULL,
  twilio_number text NOT NULL,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_phone, twilio_number)
);

CREATE INDEX idx_wa_conv_owner ON public.whatsapp_conversations(owner_id);
CREATE INDEX idx_wa_conv_contact ON public.whatsapp_conversations(contact_id);
CREATE INDEX idx_wa_conv_last_msg ON public.whatsapp_conversations(last_message_at DESC);

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  body text,
  media_url text,
  media_content_type text,
  from_number text NOT NULL,
  to_number text NOT NULL,
  twilio_sid text UNIQUE,
  status text NOT NULL DEFAULT 'queued',
  error_code text,
  error_message text,
  template_name text,
  is_template boolean NOT NULL DEFAULT false,
  sent_by uuid,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_msg_conv ON public.whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX idx_wa_msg_owner ON public.whatsapp_messages(owner_id);
CREATE INDEX idx_wa_msg_sid ON public.whatsapp_messages(twilio_sid);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own conversations"
  ON public.whatsapp_conversations
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners manage own messages"
  ON public.whatsapp_messages
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_wa_conv_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
