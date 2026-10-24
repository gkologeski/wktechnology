\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'isolated fixture required';END IF;END $$;
RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false);SELECT set_config('request.jwt.claims','{}',false);
DELETE FROM ats_applications;
INSERT INTO ats_candidates(id,owner_id,assigned_to,workspace_id,full_name) VALUES
 ('95100000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d','Other fixture candidate'),
 ('95100000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000004','184b9435-0a9b-4334-9e89-8854dc883f5d','Own fixture candidate'),
 ('95100000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','Foreign fixture candidate') ON CONFLICT(id) DO NOTHING;
ALTER TABLE ats_applications ADD COLUMN assigned_to uuid,ADD COLUMN job_id uuid REFERENCES ats_jobs(id) ON DELETE CASCADE;
ALTER TABLE ats_applications ADD CONSTRAINT fixture_application_candidate_fk FOREIGN KEY(candidate_id) REFERENCES ats_candidates(id) ON DELETE CASCADE;
ALTER TABLE ats_applications ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON ats_applications TO authenticated;
CREATE POLICY old_application_workspace_all ON ats_applications TO authenticated USING(workspace_id IN(SELECT current_user_workspaces())) WITH CHECK(workspace_id IN(SELECT current_user_workspaces()));
CREATE POLICY view_as_ro_upd ON ats_applications AS RESTRICTIVE FOR UPDATE TO authenticated USING(NOT is_read_only_view());
CREATE POLICY view_as_ro_ins ON ats_applications AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT is_read_only_view());
CREATE POLICY view_as_ro_del ON ats_applications AS RESTRICTIVE FOR DELETE TO authenticated USING(NOT is_read_only_view());
INSERT INTO ats_applications(id,workspace_id,owner_id,assigned_to,job_id,candidate_id,status,stage_value) VALUES
 ('98000000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000004','96000000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000002','active','applied'),
 ('98000000-0000-4000-8000-000000000002','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000002','95100000-0000-4000-8000-000000000001','active','applied'),
 ('98000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000003','95100000-0000-4000-8000-000000000003','active','applied');

-- Model the live WK Head grants audited before this migration; production SQL changes none.
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000004',key,'grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688' FROM permissions WHERE key LIKE 'techhire.candidates.%' ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;

CREATE TABLE ats_application_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid NOT NULL,application_id uuid NOT NULL REFERENCES ats_applications(id) ON DELETE CASCADE,job_id uuid NOT NULL,candidate_id uuid NOT NULL,event_type text NOT NULL,actor_id uuid,metadata jsonb NOT NULL DEFAULT '{}');
ALTER TABLE ats_application_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON ats_application_events TO authenticated,service_role;
CREATE POLICY old_events_membership_all ON ats_application_events TO authenticated USING(workspace_id IN(SELECT current_user_workspaces())) WITH CHECK(workspace_id IN(SELECT current_user_workspaces()));
INSERT INTO ats_application_events(workspace_id,owner_id,application_id,job_id,candidate_id,event_type,actor_id) SELECT workspace_id,owner_id,id,job_id,candidate_id,'application_created',owner_id FROM ats_applications;

INSERT INTO ats_application_events(owner_id,application_id,job_id,candidate_id,event_type,actor_id) SELECT owner_id,id,job_id,candidate_id,'legacy_event',owner_id FROM ats_applications WHERE id='98000000-0000-4000-8000-000000000001';
