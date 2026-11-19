-- Package 4 batch A: production-shaped execution tables over the formalization fixture.
-- Only tenant/authorization dependencies are stubs; engagement/allocation/start functions are the real SQL.
DO $$ BEGIN IF to_regtype('people_employment_type') IS NULL THEN CREATE TYPE people_employment_type AS ENUM('pj','clt','contractor','intern','other'); END IF; END $$;
DROP TABLE hiring_engagements;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE people ADD COLUMN employment_type people_employment_type,ADD COLUMN hire_date date,ADD COLUMN status text DEFAULT 'active',ADD COLUMN profile_id uuid;
CREATE TABLE ats_jobs(id uuid PRIMARY KEY,workspace_id uuid,hiring_contract_id uuid,recruitment_authorized boolean DEFAULT false);
CREATE TABLE hiring_engagements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,person_id uuid NOT NULL REFERENCES people(id),application_id uuid UNIQUE,job_id uuid NOT NULL REFERENCES ats_jobs(id),
 purpose text NOT NULL CHECK(purpose IN('client','internal','shared_management')),employment_type people_employment_type NOT NULL,legal_entity_id uuid NOT NULL REFERENCES legal_entities(id),commercial_contract_id uuid REFERENCES contracts(id),purchase_contract_id uuid REFERENCES contracts(id),model_version_id uuid NOT NULL,
 starts_at date NOT NULL,ends_at date,status text NOT NULL DEFAULT 'active' CHECK(status IN('active','ended')),revision integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),ended_by uuid,ended_at timestamptz,end_reason text,CHECK(ends_at IS NULL OR ends_at>=starts_at));
CREATE TABLE hiring_employment_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,engagement_id uuid NOT NULL REFERENCES hiring_engagements(id),actor_id uuid NOT NULL,kind text NOT NULL,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE people_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,assigned_to uuid,person_id uuid,project_id uuid,contract_id uuid,purchase_contract_id uuid,hiring_engagement_id uuid REFERENCES hiring_engagements(id),
 starts_at date,ends_at date,allocation_pct numeric,status text DEFAULT 'active',can_track_time boolean DEFAULT true,period_override_reason text,notes text,updated_at timestamptz DEFAULT now());
CREATE TABLE hiring_workspace_settings(workspace_id uuid PRIMARY KEY,employment_gate_enabled boolean DEFAULT true);
REVOKE ALL ON hiring_engagements,hiring_employment_events,ats_jobs,hiring_workspace_settings FROM anon,authenticated,techerp_request_writer;
GRANT SELECT ON hiring_engagements,hiring_employment_events TO authenticated;
REVOKE ALL ON people_allocations FROM anon,techerp_request_writer;
GRANT SELECT,INSERT,UPDATE ON people_allocations TO authenticated;
INSERT INTO permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.employment.view.workspace','techpeople','employment','view','workspace','Ver vínculos','fixture',true),
('techpeople.employment.manage.workspace','techpeople','employment','manage','workspace','Gerir vínculos','fixture',true),
('techprojects.projects.view.workspace','techprojects','projects','view','workspace','Ver projetos','fixture',true) ON CONFLICT DO NOTHING;
-- ATS recruitment gate stub (hr/work record access come from the formalization fixture).
CREATE FUNCTION hiring_recruitment_reason(w uuid,j uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT CASE WHEN EXISTS(SELECT 1 FROM ats_jobs WHERE id=j AND workspace_id=w AND recruitment_authorized) THEN NULL ELSE 'Autorização ATS da vaga necessária.' END $$;

-- Dependencies for the real canonical employment context (read-only).
ALTER TABLE user_permission_sets ADD COLUMN id uuid DEFAULT gen_random_uuid();
ALTER TABLE ats_jobs ADD COLUMN title text,ADD COLUMN hiring_purpose text,ADD COLUMN employment_type text,ADD COLUMN hiring_revision integer;
CREATE TABLE ats_applications(id uuid,workspace_id uuid,job_id uuid,candidate_id uuid,status text,hiring_details jsonb);
CREATE TABLE hiring_access_model_versions(id uuid,name text,allocation_only boolean);
CREATE TABLE hiring_access_models(id uuid,workspace_id uuid,name text,active boolean);
CREATE TABLE hiring_access_grants(engagement_id uuid,assignment_id uuid,set_id uuid,user_id uuid,revoked_at timestamptz);
CREATE TABLE workspace_invites(hiring_engagement_id uuid,accepted_at timestamptz,expires_at timestamptz);
