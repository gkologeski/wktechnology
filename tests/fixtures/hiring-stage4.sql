-- Stage-4 platform scaffold only; production migrations/functions are loaded verbatim.
CREATE SCHEMA techerp_api;
CREATE TYPE people_employment_type AS ENUM('pj','clt','contractor','intern','other');
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
ALTER TABLE workspaces ADD COLUMN created_by uuid;
ALTER TABLE workspace_members ADD COLUMN invited_by uuid,ADD COLUMN is_test_user boolean DEFAULT false;
CREATE UNIQUE INDEX fixture_membership ON workspace_members(workspace_id,user_id);
CREATE TABLE job_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,name text,owner_id uuid);
CREATE TABLE user_job_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,workspace_id uuid,owner_id uuid,role_id uuid,is_primary boolean);
CREATE TABLE permission_sets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,module text,name text,description text,is_system boolean);
CREATE TABLE permission_set_items(set_id uuid,permission_key text,PRIMARY KEY(set_id,permission_key));
CREATE TABLE user_permission_sets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,user_id uuid,set_id uuid);
CREATE TABLE job_role_sets(role_id uuid,set_id uuid);
CREATE TABLE job_role_set_replacements(workspace_id uuid,role_id uuid,set_id uuid,replacement_set_id uuid);
CREATE TABLE job_role_permission_overrides(workspace_id uuid,role_id uuid,permission_key text,effect text);
CREATE TABLE ats_candidates(id uuid PRIMARY KEY,workspace_id uuid,full_name text,email text,phone text,location text);
ALTER TABLE ats_applications ADD COLUMN candidate_id uuid;
CREATE TABLE people(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,assigned_to uuid,created_by uuid,candidate_id uuid,profile_id uuid,manager_id uuid,full_name text,email text,phone text,location text,cnpj text,employment_type people_employment_type,status text DEFAULT 'active',role_title text,hire_date date,archived boolean DEFAULT false,updated_at timestamptz);
CREATE TABLE people_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,assigned_to uuid,person_id uuid,project_id uuid,contract_id uuid,purchase_contract_id uuid,starts_at date,ends_at date,allocation_pct numeric,status text,can_track_time boolean DEFAULT true,notes text,updated_at timestamptz);
CREATE TABLE people_onboarding_plans(id uuid);
CREATE TABLE project_tasks(id uuid PRIMARY KEY,workspace_id uuid,project_id uuid);
CREATE TABLE project_time_entries(id uuid PRIMARY KEY,workspace_id uuid,project_id uuid);
CREATE TABLE project_members(project_id uuid,user_id uuid,can_track_time boolean);
CREATE TABLE workspace_invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,email text,role text,token text UNIQUE,invited_by uuid,permission_set_id uuid,expires_at timestamptz DEFAULT now()+interval '7 days',accepted_at timestamptz);
ALTER TABLE contracts ADD COLUMN assigned_to uuid,ADD COLUMN metadata jsonb DEFAULT '{}';
ALTER TABLE contracts ALTER COLUMN id SET DEFAULT gen_random_uuid();
CREATE FUNCTION is_workspace_admin_v2(w uuid,u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=w AND user_id=u AND role IN('owner','admin') AND status='active') $$;
CREATE FUNCTION get_entitlement_limit(w uuid,k text) RETURNS integer LANGUAGE sql AS $$ SELECT 100 $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.uid',true),''))::uuid $$;
CREATE OR REPLACE FUNCTION hr_record_access(r text,a text,j uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT is_workspace_member((SELECT active_workspace_id FROM profiles WHERE id=auth.uid()),auth.uid()) AND EXISTS(SELECT 1 FROM grants WHERE user_id=auth.uid() AND key='fixture.hr' AND effect='grant') AND NOT EXISTS(SELECT 1 FROM grants WHERE user_id=auth.uid() AND key='fixture.hr' AND effect='deny') $$;
CREATE OR REPLACE FUNCTION work_record_access(r text,i uuid,a text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM profiles p JOIN grants g ON g.user_id=p.id WHERE p.id=auth.uid() AND g.key='fixture.work' AND g.effect='grant' AND (EXISTS(SELECT 1 FROM contracts WHERE id=i AND workspace_id=p.active_workspace_id) OR EXISTS(SELECT 1 FROM projects WHERE id=i AND workspace_id=p.active_workspace_id))) $$;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;ALTER TABLE project_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_project_broad ON projects FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY fixture_task_broad ON project_tasks FOR ALL TO authenticated USING(true) WITH CHECK(true);
CREATE POLICY fixture_time_broad ON project_time_entries FOR ALL TO authenticated USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON projects,project_tasks,project_time_entries TO authenticated;
ALTER TABLE contracts ADD COLUMN monthly_value numeric;

ALTER TABLE contracts ADD CONSTRAINT fixture_contract_owner FOREIGN KEY(owner_id) REFERENCES auth.users(id);

ALTER TABLE permission_sets ADD CONSTRAINT fixture_set_name UNIQUE(owner_id,module,name);
ALTER TABLE user_permission_sets ADD CONSTRAINT fixture_assignment UNIQUE(user_id,owner_id,set_id);
ALTER TABLE permission_set_items ADD CONSTRAINT fixture_permission_key FOREIGN KEY(permission_key) REFERENCES permissions(key);

CREATE TABLE field_permission_rules(workspace_id uuid,resource text,field text,mode text,role_id uuid,set_id uuid);
CREATE TABLE shared_field_catalog(resource text,field text,table_name text,configurable boolean);
CREATE OR REPLACE FUNCTION work_access_context() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('workspace',active_workspace_id,'actor',id,'read_only',false) FROM profiles WHERE id=auth.uid() $$;
