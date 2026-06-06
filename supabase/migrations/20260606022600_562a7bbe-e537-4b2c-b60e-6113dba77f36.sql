
-- ============= NOTIFICATIONS (in-app, per user) =============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  entity text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, read_at, created_at DESC);
CREATE INDEX notifications_owner_idx ON public.notifications(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============= KNOWLEDGE BASE =============
CREATE TABLE public.kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_categories TO authenticated;
GRANT SELECT ON public.kb_categories TO anon;
GRANT ALL ON public.kb_categories TO service_role;
ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kbcat_public_read" ON public.kb_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "kbcat_member_write" ON public.kb_categories FOR ALL TO authenticated
  USING (public.is_workspace_member(owner_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(owner_id, auth.uid()));

CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  category_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text,
  body text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  views int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);
CREATE INDEX kb_articles_owner_pub_idx ON public.kb_articles(owner_id, published, published_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT SELECT ON public.kb_articles TO anon;
GRANT ALL ON public.kb_articles TO service_role;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_anon_read_published" ON public.kb_articles FOR SELECT TO anon USING (published = true);
CREATE POLICY "kb_auth_read" ON public.kb_articles FOR SELECT TO authenticated
  USING (published = true OR public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY "kb_member_write" ON public.kb_articles FOR ALL TO authenticated
  USING (public.is_workspace_member(owner_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(owner_id, auth.uid()));
CREATE TRIGGER kb_articles_set_updated_at BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= LIVE CHAT WIDGET =============
CREATE TABLE public.live_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  visitor_id text NOT NULL,
  visitor_name text,
  visitor_email text,
  visitor_url text,
  status text NOT NULL DEFAULT 'open',
  assignee_id uuid,
  contact_id uuid,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_chat_sessions_owner_idx ON public.live_chat_sessions(owner_id, last_message_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_chat_sessions TO authenticated;
GRANT ALL ON public.live_chat_sessions TO service_role;
ALTER TABLE public.live_chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lcs_member_read" ON public.live_chat_sessions FOR SELECT TO authenticated
  USING (public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY "lcs_member_update" ON public.live_chat_sessions FOR UPDATE TO authenticated
  USING (public.is_workspace_member(owner_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(owner_id, auth.uid()));
CREATE TRIGGER lcs_set_updated_at BEFORE UPDATE ON public.live_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_sessions;

CREATE TABLE public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_chat_sessions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  direction text NOT NULL,
  author_user_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_chat_messages_session_idx ON public.live_chat_messages(session_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_chat_messages TO authenticated;
GRANT ALL ON public.live_chat_messages TO service_role;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lcm_member_read" ON public.live_chat_messages FOR SELECT TO authenticated
  USING (public.is_workspace_member(owner_id, auth.uid()));
CREATE POLICY "lcm_member_insert" ON public.live_chat_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(owner_id, auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
