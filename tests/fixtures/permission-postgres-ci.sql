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
CREATE TABLE workspaces(id uuid PRIMARY KEY,created_by uuid,status text DEFAULT 'active',default_phone_country text DEFAULT 'BR',phone_strict_e164 boolean DEFAULT true);
CREATE TABLE profiles(id uuid PRIMARY KEY,active_workspace_id uuid);
CREATE TABLE workspace_members(workspace_id uuid,user_id uuid,role text DEFAULT 'member',status text DEFAULT 'active',PRIMARY KEY(workspace_id,user_id));
CREATE TYPE public.perm_action AS ENUM('view','create','update','delete','manage','export','assign','approve');
CREATE TABLE permissions(key text PRIMARY KEY,module text,resource text,action public.perm_action,scope text,label_pt text,description text,is_system boolean);
CREATE TYPE public.data_scope AS ENUM('own','team','workspace','custom');
CREATE TABLE job_roles(id uuid PRIMARY KEY,workspace_id uuid,data_scope public.data_scope DEFAULT 'own');
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
CREATE TABLE techerp_api.subject_sessions(txid bigint,user_id uuid,workspace_id uuid,api_key_id uuid,prev_claims text);
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

CREATE TABLE leads(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid);
CREATE TABLE companies(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid,assigned_to uuid);
ALTER TABLE contacts ADD COLUMN owner_id uuid,ADD COLUMN assigned_to uuid;
ALTER TABLE deals ADD COLUMN owner_id uuid,ADD COLUMN assigned_to uuid;
CREATE TABLE sales_resource_catalog(table_name name PRIMARY KEY,resource text,responsibles text[],shared boolean,parent_table name,parent_column name,id_column name);
INSERT INTO sales_resource_catalog SELECT x::name,'techsales.'||x,ARRAY['assigned_to','owner_id'],false,NULL,NULL,'id' FROM unnest(ARRAY['leads','contacts','companies','deals'])x;
CREATE TABLE field_permission_rules(resource text,field text,mode text,workspace_id uuid,role_id uuid,set_id uuid);
CREATE TABLE shared_field_catalog(resource text,table_name name,field name,configurable boolean,guard_fields text[]);
INSERT INTO shared_field_catalog VALUES('techsales.leads','leads','score',true,ARRAY['score']);
GRANT SELECT ON shared_field_catalog TO authenticated;
CREATE TABLE audit_logs(id uuid PRIMARY KEY,workspace_owner_id uuid,actor_user_id uuid,entity text,entity_id uuid,action text,before jsonb,after jsonb,metadata jsonb,module_id text,created_at timestamptz DEFAULT now(),session_id uuid);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON audit_logs TO authenticated;

CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
GRANT USAGE,CREATE ON SCHEMA techerp_api TO techerp_api_subject;
GRANT SELECT,INSERT,DELETE ON techerp_api.subject_sessions TO techerp_api_subject;
CREATE TABLE audit_exports(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid,workspace_id uuid,name text,destination text,config jsonb DEFAULT '{}',format text DEFAULT 'json',schedule_cron text DEFAULT '0 2 * * *',hmac_secret text,enabled boolean DEFAULT true,last_run_at timestamptz,last_status text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE audit_export_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid,workspace_id uuid,export_id uuid,started_at timestamptz DEFAULT now(),finished_at timestamptz,status text,records_count integer,error_message text,output_url text,created_at timestamptz DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON audit_exports,audit_export_runs TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

CREATE TABLE phone_normalization_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,normalizer_version text,mode text,status text,criteria text,counts jsonb DEFAULT '{}',notes text,created_at timestamptz DEFAULT now(),finished_at timestamptz,parent_run_id uuid);
CREATE TABLE phone_normalization_items(id bigserial PRIMARY KEY,run_id uuid,workspace_id uuid,table_name text,row_id uuid,column_name text,original_value text,proposed_value text,proposed_ext text,classification text,reason text,applied_at timestamptz,rolled_back_at timestamptz,review_kind text,reviewed_by uuid,resolved_at timestamptz,correction_run_id uuid);
ALTER TABLE phone_normalization_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_normalization_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON phone_normalization_runs,phone_normalization_items TO authenticated;
GRANT SELECT,UPDATE ON workspaces TO authenticated;

CREATE TABLE access_audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,actor_id uuid,details jsonb);
ALTER TABLE access_audit_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON access_audit_log TO authenticated;
