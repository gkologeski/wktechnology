ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS phone_digits text GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '')) STORED,
  ADD COLUMN IF NOT EXISTS mobile_phone_digits text GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(mobile_phone, ''), '[^0-9]', '', 'g'), '')) STORED;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS mobile_phone_digits text GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(mobile_phone, ''), '[^0-9]', '', 'g'), '')) STORED;

CREATE INDEX IF NOT EXISTS contacts_workspace_phone_digits_idx ON public.contacts(workspace_id, phone_digits) WHERE phone_digits IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_workspace_mobile_phone_digits_idx ON public.contacts(workspace_id, mobile_phone_digits) WHERE mobile_phone_digits IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_workspace_email_lower_idx ON public.contacts(workspace_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_workspace_mobile_phone_digits_idx ON public.leads(workspace_id, mobile_phone_digits) WHERE mobile_phone_digits IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_workspace_email_lower_idx ON public.leads(workspace_id, lower(email)) WHERE email IS NOT NULL;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'unresolved' CHECK (identity_status IN ('matched','ambiguous','not_found','unresolved','manual'));

ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'unresolved' CHECK (identity_status IN ('matched','ambiguous','not_found','unresolved','manual'));

ALTER TABLE public.live_chat_sessions
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'unresolved' CHECK (identity_status IN ('matched','ambiguous','not_found','unresolved','manual'));

CREATE INDEX IF NOT EXISTS whatsapp_conversations_lead_idx ON public.whatsapp_conversations(lead_id);
CREATE INDEX IF NOT EXISTS email_threads_lead_identity_idx ON public.email_threads(lead_id, identity_status);
CREATE INDEX IF NOT EXISTS live_chat_sessions_lead_idx ON public.live_chat_sessions(lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_threads TO authenticated;
GRANT ALL ON public.email_threads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_chat_sessions TO authenticated;
GRANT ALL ON public.live_chat_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;