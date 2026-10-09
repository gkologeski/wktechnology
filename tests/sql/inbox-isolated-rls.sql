-- Teste ISOLADO (banco local descartável, nunca o banco compartilhado).
-- Réplica mínima das políticas SELECT reais de 09/10/2026 para email_threads,
-- whatsapp_conversations, live_chat_sessions, email_messages, contacts e leads,
-- com helpers simplificados (current_user_workspaces, rep_restricted_workspaces).
-- Depois aplica a função REAL de drizzle/migrations/0095_inbox_unified_page.sql.
-- Uso: psql -v ON_ERROR_STOP=1 -f este_arquivo -f 0095.sql -f inbox-isolated-rls-asserts.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;

CREATE TABLE public.members (workspace_id uuid, user_id uuid, restricted boolean DEFAULT false);
CREATE FUNCTION public.current_user_workspaces() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT workspace_id FROM public.members WHERE user_id = auth.uid() $$;
CREATE FUNCTION public.rep_restricted_workspaces() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT workspace_id FROM public.members WHERE user_id = auth.uid() AND restricted $$;

CREATE TABLE public.email_accounts (id uuid PRIMARY KEY, owner_id uuid);
CREATE TABLE public.contacts (id uuid PRIMARY KEY, workspace_id uuid, owner_id uuid, assigned_to uuid,
  first_name text, last_name text, email text);
CREATE TABLE public.leads (id uuid PRIMARY KEY, workspace_id uuid, owner_id uuid, assigned_to uuid,
  assigned_user_id uuid, first_name text, last_name text, email text);
CREATE TABLE public.email_threads (id uuid PRIMARY KEY, workspace_id uuid, account_id uuid, contact_id uuid,
  lead_id uuid, subject text, snippet text, last_message_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.email_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid, owner_id uuid,
  from_email text, direction text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.whatsapp_conversations (id uuid PRIMARY KEY, workspace_id uuid, contact_phone text,
  last_message_preview text, last_message_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  status text, contact_id uuid, lead_id uuid);
CREATE TABLE public.live_chat_sessions (id uuid PRIMARY KEY, workspace_id uuid, visitor_name text, visitor_email text,
  last_message_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), status text, contact_id uuid, lead_id uuid);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['email_accounts','contacts','leads','email_threads','email_messages','whatsapp_conversations','live_chat_sessions','members'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['contacts','leads','email_threads','email_messages','whatsapp_conversations','live_chat_sessions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE POLICY ws_select_contacts ON public.contacts FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY rep_scope_select_contacts ON public.contacts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT (workspace_id IN (SELECT public.rep_restricted_workspaces())) OR owner_id = auth.uid() OR assigned_to = auth.uid());
CREATE POLICY ws_select_leads ON public.leads FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY rep_scope_select_leads ON public.leads AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT (workspace_id IN (SELECT public.rep_restricted_workspaces())) OR owner_id = auth.uid()
    OR assigned_to = auth.uid() OR assigned_user_id = auth.uid());
CREATE POLICY ws_select_email_threads ON public.email_threads FOR SELECT TO authenticated
  USING ((contact_id IS NOT NULL AND workspace_id IN (SELECT public.current_user_workspaces()))
    OR EXISTS (SELECT 1 FROM public.email_accounts a WHERE a.id = email_threads.account_id AND a.owner_id = auth.uid()));
CREATE POLICY ws_select_email_messages ON public.email_messages FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.email_threads t JOIN public.email_accounts a ON a.id = t.account_id
    WHERE t.id = email_messages.thread_id AND a.owner_id = auth.uid()));
CREATE POLICY ws_select_whatsapp_conversations ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));
CREATE POLICY live_chat_sessions_ws_select ON public.live_chat_sessions FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces()));

-- Identidades sintéticas.
-- A1 admin do workspace A (dono da caixa de e-mail), A2 membro restrito (escopo próprio) em A,
-- A3 membro "equipe" em A (sem restrição), B1 membro do workspace B (outro tenant).
INSERT INTO public.members VALUES
  ('aaaaaaaa-0000-0000-0000-000000000000','a1000000-0000-0000-0000-000000000001',false),
  ('aaaaaaaa-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000002',true),
  ('aaaaaaaa-0000-0000-0000-000000000000','a3000000-0000-0000-0000-000000000003',false),
  ('bbbbbbbb-0000-0000-0000-000000000000','b1000000-0000-0000-0000-000000000001',false);
INSERT INTO public.email_accounts VALUES
  ('acc0000a-0000-0000-0000-000000000000','a1000000-0000-0000-0000-000000000001'),
  ('acc0000b-0000-0000-0000-000000000000','b1000000-0000-0000-0000-000000000001');

-- 200 contatos em A: metade do A2 (próprios), metade de outros. 20 em B.
INSERT INTO public.contacts
SELECT ('c0000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, 'aaaaaaaa-0000-0000-0000-000000000000',
  CASE WHEN g % 2 = 0 THEN 'a2000000-0000-0000-0000-000000000002'::uuid ELSE 'a1000000-0000-0000-0000-000000000001'::uuid END,
  NULL, 'Cliente', 'Numero'||g, 'cliente'||g||'@exemplo.test' FROM generate_series(1,200) g;
INSERT INTO public.contacts
SELECT ('c1000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, 'bbbbbbbb-0000-0000-0000-000000000000',
  'b1000000-0000-0000-0000-000000000001', NULL, 'Segredo', 'TenantB'||g, 'b'||g||'@outro.test' FROM generate_series(1,20) g;

-- 180 threads de e-mail em A (todas com contato), muitas com o MESMO horário (empates).
INSERT INTO public.email_threads
SELECT ('e0000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, 'aaaaaaaa-0000-0000-0000-000000000000',
  'acc0000a-0000-0000-0000-000000000000', ('c0000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, NULL,
  'Assunto '||g, CASE WHEN g = 177 THEN 'agulha-unica no palheiro' ELSE 'trecho '||g END,
  timestamptz '2026-10-01 12:00+00' - ((g / 10) * interval '1 hour'), timestamptz '2026-09-01 00:00+00'
FROM generate_series(1,180) g;
-- Thread sem last_message_at: ordena por created_at.
INSERT INTO public.email_threads VALUES ('e0000000-0000-0000-0000-000000009999','aaaaaaaa-0000-0000-0000-000000000000',
  'acc0000a-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000001',NULL,'Sem data',NULL,NULL,timestamptz '2026-01-01 00:00+00');
-- Duas mensagens por thread: inbound antiga e outbound recente; último remetente inbound = mais recente inbound.
INSERT INTO public.email_messages (thread_id, owner_id, from_email, direction, created_at)
SELECT t.id, 'a1000000-0000-0000-0000-000000000001', 'antigo@exemplo.test', 'inbound', timestamptz '2026-08-01 00:00+00' FROM public.email_threads t;
INSERT INTO public.email_messages (thread_id, owner_id, from_email, direction, created_at)
SELECT t.id, 'a1000000-0000-0000-0000-000000000001', 'recente@exemplo.test', 'inbound', timestamptz '2026-08-02 00:00+00' FROM public.email_threads t;
INSERT INTO public.email_messages (thread_id, owner_id, from_email, direction, created_at)
SELECT t.id, 'a1000000-0000-0000-0000-000000000001', 'eu@empresa.test', 'outbound', timestamptz '2026-08-03 00:00+00' FROM public.email_threads t;

-- 170 conversas WhatsApp e 160 chats em A, com horários empatando com o e-mail.
INSERT INTO public.whatsapp_conversations
SELECT ('d0000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, 'aaaaaaaa-0000-0000-0000-000000000000',
  '+5500000'||lpad(g::text,4,'0'), 'oi '||g, timestamptz '2026-10-01 12:00+00' - ((g / 10) * interval '1 hour'),
  now(), 'open', NULL, NULL FROM generate_series(1,170) g;
INSERT INTO public.live_chat_sessions
SELECT ('f0000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, 'aaaaaaaa-0000-0000-0000-000000000000',
  'Visitante '||g, NULL, timestamptz '2026-10-01 12:00+00' - ((g / 10) * interval '1 hour'), now(), 'open', NULL, NULL
FROM generate_series(1,160) g;
-- Outro tenant: 30 threads/wa/chat em B.
INSERT INTO public.email_threads
SELECT ('e1000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid, 'bbbbbbbb-0000-0000-0000-000000000000',
  'acc0000b-0000-0000-0000-000000000000', ('c1000000-0000-0000-0000-'||lpad(((g%20)+1)::text,12,'0'))::uuid, NULL,
  'Confidencial B '||g, 'agulha-unica tenant B', now(), now() FROM generate_series(1,30) g;
INSERT INTO public.whatsapp_conversations
SELECT gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000000', '+5599'||g, 'b', now(), now(), 'open', NULL, NULL FROM generate_series(1,30) g;
