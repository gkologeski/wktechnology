CREATE TABLE public.message_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','whatsapp')),
  scope_key text NOT NULL,
  to_addr text,
  cc text,
  subject text,
  body_html text,
  body_text text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX message_drafts_owner_channel_scope_key
  ON public.message_drafts (owner_id, channel, scope_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_drafts TO authenticated;
GRANT ALL ON public.message_drafts TO service_role;

ALTER TABLE public.message_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_drafts_select_own" ON public.message_drafts
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "message_drafts_insert_own" ON public.message_drafts
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "message_drafts_update_own" ON public.message_drafts
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "message_drafts_delete_own" ON public.message_drafts
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER update_message_drafts_updated_at
  BEFORE UPDATE ON public.message_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();