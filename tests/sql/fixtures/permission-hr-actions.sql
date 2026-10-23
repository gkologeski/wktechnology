-- Extend the isolated baseline with actual columns used by 0193; synthetic rows.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'isolated fixture required'; END IF; END $$;
RESET ROLE;
ALTER TABLE people ADD candidate_id uuid;
ALTER TABLE ats_candidates ADD assigned_to uuid,ADD relationship_owner_id uuid,ADD created_by uuid;
ALTER TABLE people_onboarding_plans ADD template_id uuid,ADD status text DEFAULT 'in_progress',ADD started_at date,ADD target_completion_date date,ADD completed_at timestamptz,ADD notes text,ADD created_at timestamptz DEFAULT now();
ALTER TABLE people_onboarding_tasks ADD title text,ADD description text,ADD category text,ADD due_date date,ADD order_index integer DEFAULT 0,ADD status text DEFAULT 'pending',ADD is_critical boolean DEFAULT false,ADD revocation_system text,ADD completed_at timestamptz,ADD completed_by uuid,ADD updated_at timestamptz DEFAULT now();
ALTER TABLE people_onboarding_templates ADD name text,ADD items jsonb DEFAULT '[]';
CREATE TABLE user_groups(id uuid PRIMARY KEY,workspace_id uuid);
CREATE TABLE user_group_members(group_id uuid,user_id uuid);
CREATE OR REPLACE FUNCTION my_team_member_pairs() RETURNS TABLE(workspace_id uuid,user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT DISTINCT g.workspace_id,b.user_id FROM user_group_members a JOIN user_groups g ON g.id=a.group_id JOIN user_group_members b ON b.group_id=a.group_id WHERE a.user_id=auth.uid() AND b.user_id IS NOT NULL AND g.workspace_id IS NOT NULL AND is_workspace_member(g.workspace_id,auth.uid()) $$;
ALTER TABLE ats_candidates ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON ats_candidates TO authenticated;
-- Audited production bypass: this permissive ALL policy alone allows every CRUD.
CREATE POLICY ats_candidates_workspace_scope ON ats_candidates FOR ALL TO authenticated USING(workspace_id IN(SELECT current_user_workspaces())) WITH CHECK(workspace_id IN(SELECT current_user_workspaces()));
CREATE POLICY ats_candidates_owner_select ON ats_candidates FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY ats_candidates_owner_update ON ats_candidates FOR UPDATE TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY view_as_ro_upd ON ats_candidates AS RESTRICTIVE FOR UPDATE TO authenticated USING(NOT is_read_only_view());
CREATE POLICY view_as_ro_ins ON ats_candidates AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT is_read_only_view());
CREATE POLICY view_as_ro_del ON ats_candidates AS RESTRICTIVE FOR DELETE TO authenticated USING(NOT is_read_only_view());
INSERT INTO people(id,workspace_id,owner_id,created_by,profile_id,full_name,assigned_to) VALUES
('95000000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','Head own','90000000-0000-4000-8000-000000000003'),
('95000000-0000-4000-8000-000000000002','184b9435-0a9b-4334-9e89-8854dc883f5d','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000004','Other person','90000000-0000-4000-8000-000000000004'),
('95000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','Foreign person','90000000-0000-4000-8000-000000000003');
INSERT INTO ats_candidates(id,owner_id,assigned_to,workspace_id,full_name) VALUES
('95100000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d','Own candidate'),
('95100000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000004','184b9435-0a9b-4334-9e89-8854dc883f5d','Other candidate'),
('95100000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','Foreign candidate');
INSERT INTO people_onboarding_templates(id,workspace_id,owner_id,name,kind,items) VALUES
('95200000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','Synthetic valid','onboarding','[{"title":"Welcome","due_offset_days":2},{"title":"Accounts","is_critical":true}]'),
('95200000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','Other tenant','onboarding','[]'),
('95200000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','Invalid second task','onboarding','[{"title":"First valid"},{"title":""}]');

INSERT INTO people_onboarding_templates(id,workspace_id,owner_id,name,kind,items) VALUES('95200000-0000-4000-8000-000000000004','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000004','Own template','onboarding','[]');
INSERT INTO people_onboarding_plans(id,workspace_id,owner_id,assigned_to,person_id,kind) VALUES('95400000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000004','95000000-0000-4000-8000-000000000002','onboarding');
INSERT INTO people_onboarding_tasks(id,workspace_id,plan_id,assignee_id,title) VALUES('95500000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','95400000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004','Task 1');
INSERT INTO people_onboarding_plans(id,workspace_id,owner_id,assigned_to,person_id,kind) VALUES('95400000-0000-4000-8000-000000000002','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000001','onboarding');
INSERT INTO people_onboarding_tasks(id,workspace_id,plan_id,assignee_id,title) VALUES('95500000-0000-4000-8000-000000000002','184b9435-0a9b-4334-9e89-8854dc883f5d','95400000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','Task 2');
INSERT INTO people_onboarding_plans(id,workspace_id,owner_id,assigned_to,person_id,kind) VALUES('95400000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000003','onboarding');
INSERT INTO people_onboarding_tasks(id,workspace_id,plan_id,assignee_id,title) VALUES('95500000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','95400000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','Task 3');
DELETE FROM permission_set_items WHERE set_id='90000000-0000-4000-8000-000000000050';
GRANT SELECT ON people TO service_role;
