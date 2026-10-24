\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'isolated fixture required';END IF;END $$;
RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false);SELECT set_config('request.jwt.claims','{}',false);
CREATE TABLE ats_scorecards(id uuid PRIMARY KEY,workspace_id uuid NOT NULL,owner_id uuid,criteria jsonb NOT NULL,job_id uuid);
CREATE TABLE ats_interview_kits(id uuid PRIMARY KEY,workspace_id uuid);
CREATE TABLE ats_interviewer_pools(id uuid PRIMARY KEY,workspace_id uuid);
CREATE TABLE meetings(id uuid PRIMARY KEY,workspace_id uuid,owner_id uuid);
CREATE TABLE ats_interviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,assigned_to uuid,application_id uuid REFERENCES ats_applications(id) ON DELETE CASCADE,job_id uuid,candidate_id uuid,interviewer_id uuid,panel_interviewer_ids uuid[],interview_kit_id uuid,pool_id uuid,meeting_id uuid,auto_rescheduled_from uuid,kind text DEFAULT 'video' CHECK(kind IN('phone','video','onsite','async')),status text DEFAULT 'scheduled' CHECK(status IN('scheduled','done','no_show','canceled','rescheduled','pending_candidate')),duration_min int DEFAULT 45,scheduled_at timestamptz,notes text,transcript text,ai_summary text,ai_strengths jsonb DEFAULT '[]',ai_concerns jsonb DEFAULT '[]',ai_followups jsonb DEFAULT '[]',ai_recommendation text,ai_score numeric,ai_generated_at timestamptz,ai_model text,updated_at timestamptz DEFAULT now());
CREATE TABLE ats_scorecard_responses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid,application_id uuid REFERENCES ats_applications(id) ON DELETE CASCADE,scorecard_id uuid REFERENCES ats_scorecards(id) ON DELETE CASCADE,evaluator_id uuid,scores jsonb,total_score numeric,recommendation text,notes text,updated_at timestamptz DEFAULT now());
ALTER TABLE ats_interviews ENABLE ROW LEVEL SECURITY;ALTER TABLE ats_scorecard_responses ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON ats_interviews,ats_scorecard_responses TO authenticated,service_role;
CREATE POLICY old_interviews_workspace_all ON ats_interviews TO authenticated USING(workspace_id IN(SELECT current_user_workspaces())) WITH CHECK(workspace_id IN(SELECT current_user_workspaces()));
-- Reproduce the live restrictive gate which incorrectly treats creator as tenant.
CREATE POLICY ats_interviews_rbac_update ON ats_interviews AS RESTRICTIVE FOR UPDATE TO authenticated USING(is_workspace_member(owner_id,auth.uid())) WITH CHECK(is_workspace_member(owner_id,auth.uid()));
CREATE POLICY old_responses_workspace_all ON ats_scorecard_responses TO authenticated USING(workspace_id IN(SELECT current_user_workspaces())) WITH CHECK(workspace_id IN(SELECT current_user_workspaces()));
CREATE POLICY view_as_ro_upd ON ats_interviews AS RESTRICTIVE FOR UPDATE TO authenticated USING(NOT is_read_only_view());
CREATE POLICY view_as_ro_ins ON ats_interviews AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT is_read_only_view());
CREATE POLICY view_as_ro_del ON ats_interviews AS RESTRICTIVE FOR DELETE TO authenticated USING(NOT is_read_only_view());
CREATE POLICY view_as_ro_upd ON ats_scorecard_responses AS RESTRICTIVE FOR UPDATE TO authenticated USING(NOT is_read_only_view());
CREATE POLICY view_as_ro_ins ON ats_scorecard_responses AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT is_read_only_view());
CREATE POLICY view_as_ro_del ON ats_scorecard_responses AS RESTRICTIVE FOR DELETE TO authenticated USING(NOT is_read_only_view());
INSERT INTO permissions(key,module,resource,action,scope,label_pt) VALUES
 ('techhire.interviews.view.workspace','techhire','interviews','view','workspace','Ver entrevistas'),('techhire.interviews.schedule.workspace','techhire','interviews','manage','workspace','Agendar entrevistas'),('techhire.interviews.score.workspace','techhire','interviews','update','workspace','Pontuar entrevistas') ON CONFLICT(key) DO NOTHING;
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000004',key,'grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688' FROM permissions WHERE key LIKE 'techhire.interviews.%' ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
INSERT INTO ats_scorecards(id,workspace_id,owner_id,criteria) VALUES('99100000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','[{"key":"tech","weight":1},{"key":"comm","weight":2}]'),('99100000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','[{"key":"tech","weight":1}]');
INSERT INTO ats_interview_kits VALUES('99140000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002');
INSERT INTO ats_interviewer_pools VALUES('99150000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002');
INSERT INTO meetings VALUES('99160000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002',NULL);
INSERT INTO ats_interviews(id,workspace_id,owner_id,assigned_to,application_id,job_id,candidate_id,interviewer_id,scheduled_at) SELECT '99110000-0000-4000-8000-000000000001',workspace_id,owner_id,assigned_to,id,job_id,candidate_id,assigned_to,now()+interval '1 day' FROM ats_applications WHERE id='98000000-0000-4000-8000-000000000001';
INSERT INTO ats_interviews(id,workspace_id,owner_id,assigned_to,application_id,job_id,candidate_id,interviewer_id,scheduled_at) SELECT '99110000-0000-4000-8000-000000000002',workspace_id,owner_id,assigned_to,id,job_id,candidate_id,assigned_to,now()+interval '1 day' FROM ats_applications WHERE id='98000000-0000-4000-8000-000000000002';
INSERT INTO ats_scorecard_responses(id,workspace_id,owner_id,evaluator_id,application_id,scorecard_id,scores,total_score) SELECT '99120000-0000-4000-8000-000000000001',workspace_id,owner_id,owner_id,id,'99100000-0000-4000-8000-000000000001','{"tech":5,"comm":3}',0 FROM ats_applications WHERE id='98000000-0000-4000-8000-000000000001';

INSERT INTO ats_scorecards(id,workspace_id,owner_id,criteria,job_id) VALUES('99100000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','[{"key":"tech","weight":1}]','96000000-0000-4000-8000-000000000002');

INSERT INTO permissions(key,module,resource,action,scope,label_pt) VALUES
 ('techhire.copilot.view.workspace','techhire','copilot','view','workspace','Ver copiloto'),('techhire.copilot.create.own','techhire','copilot','create','own','Usar copiloto') ON CONFLICT(key) DO NOTHING;
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by) SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000004',key,'grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688' FROM permissions WHERE key LIKE 'techhire.copilot.%' ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
