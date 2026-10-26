-- Disposable CI platform/schema scaffold; no project data, network or credentials.
-- Permission decisions/functions are loaded verbatim from the real migrations.
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE techerp_api_subject NOLOGIN NOSUPERUSER NOBYPASSRLS INHERIT;
GRANT authenticated TO techerp_api_subject;
CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA techerp_api;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
CREATE TABLE workspaces(id uuid PRIMARY KEY,created_by uuid,status text DEFAULT 'active');
CREATE TABLE profiles(id uuid PRIMARY KEY,active_workspace_id uuid);
CREATE TABLE workspace_members(workspace_id uuid,user_id uuid,role text DEFAULT 'member',status text DEFAULT 'active',PRIMARY KEY(workspace_id,user_id));
CREATE TABLE permissions(key text PRIMARY KEY,module text,resource text,action text,scope text,label_pt text,description text,is_system boolean);
CREATE TABLE job_roles(id uuid PRIMARY KEY,workspace_id uuid);
CREATE TABLE user_job_roles(role_id uuid,user_id uuid,workspace_id uuid,owner_id uuid);
CREATE TABLE permission_sets(id uuid PRIMARY KEY,workspace_id uuid,module text);
CREATE TABLE user_permission_sets(user_id uuid,set_id uuid,workspace_id uuid,owner_id uuid);
CREATE TABLE permission_set_items(set_id uuid,permission_key text);
CREATE TABLE job_role_sets(role_id uuid,set_id uuid);
CREATE TABLE job_role_set_replacements(workspace_id uuid,role_id uuid,set_id uuid,replacement_set_id uuid);
CREATE TABLE job_role_permission_overrides(workspace_id uuid,role_id uuid,permission_key text,effect text,created_by uuid,PRIMARY KEY(workspace_id,role_id,permission_key));
CREATE TABLE user_groups(id uuid PRIMARY KEY,workspace_id uuid);
CREATE TABLE user_group_members(group_id uuid,user_id uuid);
CREATE TABLE view_as_sessions(session_id uuid,mode text,ended_at timestamptz);
CREATE TABLE techerp_api.subject_sessions(txid bigint,user_id uuid,workspace_id uuid,api_key_id uuid);
CREATE TABLE macros(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,name text,body text);
CREATE TABLE subscription_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,name text,description text);
CREATE TABLE api_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,name text,prefix text,key_hash text,scopes text[],last_used_at timestamptz,expires_at timestamptz,revoked_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE people(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,profile_id uuid,manager_id uuid,assigned_to uuid,created_by uuid);
CREATE TABLE people_documents(id uuid PRIMARY KEY,workspace_id uuid,person_id uuid,created_by uuid,assigned_to uuid,status text);
CREATE TABLE contacts(id uuid PRIMARY KEY,workspace_id uuid);
CREATE TABLE deals(id uuid PRIMARY KEY,workspace_id uuid);
CREATE TABLE recurring_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,name text);
CREATE TABLE subscriptions(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,contact_id uuid,plan_id uuid,deal_id uuid,name text);
CREATE TABLE subscription_invoices(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,subscription_id uuid,notes text);
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON people,people_documents TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON macros,subscription_types,api_keys,recurring_plans,subscriptions,subscription_invoices TO authenticated;
-- The original API-key table already has RLS enabled (also verified in the
-- production metadata). Preserve that baseline before applying its new policies.
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
