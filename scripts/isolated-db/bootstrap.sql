-- Camada mínima compatível com a plataforma (Supabase) para o banco ISOLADO de testes.
-- Só cria o que a plataforma gerenciada fornece e o projeto não versiona:
-- papéis, schema auth (funções idênticas às da plataforma: leem request.jwt.claims),
-- storage/cron/net/vault como stubs inertes (sem rede, sem agendamento) e a publicação.
-- Divergências declaradas em docs/architecture/performance-cycle-9-isolated-validation.md.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator NOINHERIT LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN CREATE ROLE supabase_admin SUPERUSER; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_storage_admin') THEN CREATE ROLE supabase_storage_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_realtime_admin') THEN CREATE ROLE supabase_realtime_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dashboard_user') THEN CREATE ROLE dashboard_user NOLOGIN; END IF;
END $$;
GRANT anon, authenticated, service_role TO authenticator;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER DATABASE postgres SET search_path = "$user", public, extensions;
SET search_path = "$user", public, extensions;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- ===== auth (formato da plataforma) =====
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid, id uuid PRIMARY KEY, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, invited_at timestamptz, confirmation_token text, recovery_token text,
  last_sign_in_at timestamptz, raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb, is_super_admin boolean, created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(), phone text, phone_confirmed_at timestamptz,
  confirmed_at timestamptz, banned_until timestamptz, deleted_at timestamptz, is_anonymous boolean DEFAULT false,
  is_sso_user boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS auth.sessions (
  id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), not_after timestamptz
);
CREATE TABLE IF NOT EXISTS auth.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text, identity_data jsonb, email text, created_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')::text $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                  nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role(), auth.email(), auth.jwt() TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO service_role;

-- ===== storage (estrutura; sem servidor de arquivos) =====
CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY, name text NOT NULL, owner uuid, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id), name text,
  owner uuid, owner_id text, metadata jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
CREATE OR REPLACE FUNCTION storage.filename(name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT reverse(split_part(reverse(name), '.', 1)) $$;

-- ===== cron / net / vault: stubs INERTES (nada agenda, nada sai para a rede) =====
CREATE SCHEMA IF NOT EXISTS cron;
CREATE TABLE IF NOT EXISTS cron.job (jobid bigserial PRIMARY KEY, jobname text UNIQUE, schedule text, command text, active boolean DEFAULT true);
CREATE TABLE IF NOT EXISTS cron.job_run_details (runid bigserial PRIMARY KEY, jobid bigint, status text, return_message text, start_time timestamptz, end_time timestamptz);
CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job(jobname, schedule, command) VALUES (job_name, schedule, command)
  ON CONFLICT (jobname) DO UPDATE SET schedule = excluded.schedule, command = excluded.command RETURNING jobid $$;
CREATE OR REPLACE FUNCTION cron.schedule(schedule text, command text) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job(schedule, command) VALUES (schedule, command) RETURNING jobid $$;
CREATE OR REPLACE FUNCTION cron.unschedule(job_name text) RETURNS boolean LANGUAGE sql AS $$
  WITH d AS (DELETE FROM cron.job WHERE jobname = job_name RETURNING 1) SELECT count(*) > 0 FROM d $$;
CREATE OR REPLACE FUNCTION cron.unschedule(job_id bigint) RETURNS boolean LANGUAGE sql AS $$
  WITH d AS (DELETE FROM cron.job WHERE jobid = job_id RETURNING 1) SELECT count(*) > 0 FROM d $$;
CREATE OR REPLACE FUNCTION cron.alter_job(job_id bigint, schedule text DEFAULT NULL, command text DEFAULT NULL,
  database text DEFAULT NULL, username text DEFAULT NULL, active boolean DEFAULT NULL) RETURNS void LANGUAGE sql AS $$ SELECT $$;

CREATE SCHEMA IF NOT EXISTS net;
CREATE TABLE IF NOT EXISTS net.blocked_requests (id bigserial PRIMARY KEY, url text, body jsonb, created_at timestamptz DEFAULT now());
-- Bloqueado: registra a tentativa localmente e não faz requisição.
CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds integer DEFAULT 5000) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO net.blocked_requests(url, body) VALUES (url, body) RETURNING id $$;
CREATE OR REPLACE FUNCTION net.http_get(url text, params jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO net.blocked_requests(url) VALUES (url) RETURNING id $$;

CREATE SCHEMA IF NOT EXISTS vault;
CREATE TABLE IF NOT EXISTS vault.secrets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE, secret text);
CREATE OR REPLACE VIEW vault.decrypted_secrets AS SELECT id, name, secret AS decrypted_secret FROM vault.secrets;
CREATE OR REPLACE FUNCTION vault.create_secret(new_secret text, new_name text DEFAULT NULL, new_description text DEFAULT '')
  RETURNS uuid LANGUAGE sql AS $$ INSERT INTO vault.secrets(name, secret) VALUES (new_name, new_secret) RETURNING id $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.__isolated_marker (id int PRIMARY KEY, label text NOT NULL, created_at timestamptz DEFAULT now());
INSERT INTO public.__isolated_marker VALUES (1, 'techerp-isolated-harness') ON CONFLICT DO NOTHING;
REVOKE ALL ON public.__isolated_marker FROM anon, authenticated;

-- ===== realtime (só a tabela/funcão que as policies versionadas referenciam; sem servidor) =====
CREATE SCHEMA IF NOT EXISTS realtime;
GRANT USAGE ON SCHEMA realtime TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS realtime.messages (
  id bigserial PRIMARY KEY, topic text NOT NULL, extension text NOT NULL DEFAULT 'broadcast',
  payload jsonb, event text, private boolean DEFAULT true, inserted_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON realtime.messages TO authenticated;
CREATE OR REPLACE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('realtime.topic', true), '')::text $$;
GRANT EXECUTE ON FUNCTION realtime.topic() TO anon, authenticated;
