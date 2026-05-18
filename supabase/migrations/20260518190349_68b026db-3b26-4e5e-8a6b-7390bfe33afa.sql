
-- ============ email_accounts ============
CREATE TABLE public.email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'gmail',
  email text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  history_id text,
  status text NOT NULL DEFAULT 'connected',
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, provider, email)
);
CREATE INDEX email_accounts_owner_idx ON public.email_accounts(owner_id);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_accounts owner select" ON public.email_accounts
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "email_accounts owner insert" ON public.email_accounts
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "email_accounts owner update" ON public.email_accounts
  FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "email_accounts owner delete" ON public.email_accounts
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER email_accounts_set_updated_at BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ email_threads ============
CREATE TABLE public.email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  provider_thread_id text NOT NULL,
  subject text,
  snippet text,
  last_message_at timestamptz,
  message_count integer NOT NULL DEFAULT 0,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider_thread_id)
);
CREATE INDEX email_threads_owner_idx ON public.email_threads(owner_id);
CREATE INDEX email_threads_contact_idx ON public.email_threads(contact_id);
CREATE INDEX email_threads_lead_idx ON public.email_threads(lead_id);
CREATE INDEX email_threads_deal_idx ON public.email_threads(deal_id);
CREATE INDEX email_threads_last_msg_idx ON public.email_threads(last_message_at DESC);

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_threads owner all" ON public.email_threads
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER email_threads_set_updated_at BEFORE UPDATE ON public.email_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ email_messages ============
CREATE TABLE public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.email_threads(id) ON DELETE CASCADE,
  provider_message_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  from_email text,
  from_name text,
  to_emails text[] NOT NULL DEFAULT '{}',
  cc_emails text[] NOT NULL DEFAULT '{}',
  bcc_emails text[] NOT NULL DEFAULT '{}',
  subject text,
  body_html text,
  body_text text,
  snippet text,
  in_reply_to text,
  message_id_header text,
  headers jsonb,
  has_attachments boolean NOT NULL DEFAULT false,
  attachments jsonb,
  sent_at timestamptz,
  received_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  first_opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider_message_id)
);
CREATE INDEX email_messages_owner_idx ON public.email_messages(owner_id);
CREATE INDEX email_messages_thread_idx ON public.email_messages(thread_id);
CREATE INDEX email_messages_sent_idx ON public.email_messages(sent_at DESC);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_messages owner all" ON public.email_messages
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER email_messages_set_updated_at BEFORE UPDATE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ email_tracking_events ============
CREATE TABLE public.email_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('open','click')),
  url text,
  user_agent text,
  ip text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_tracking_message_idx ON public.email_tracking_events(message_id);
CREATE INDEX email_tracking_occurred_idx ON public.email_tracking_events(occurred_at DESC);

ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;
-- Tracking events are written by public endpoints (pixel/redirect) using service role,
-- and read by the owner of the related message.
CREATE POLICY "email_tracking owner select" ON public.email_tracking_events
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
