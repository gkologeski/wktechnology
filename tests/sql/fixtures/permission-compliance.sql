\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'isolated fixture required';END IF;END $$;
RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false);SELECT set_config('request.jwt.claims','{}',false);
ALTER TABLE ats_candidates ADD COLUMN retention_until timestamptz;
ALTER TABLE ats_candidate_consents ADD COLUMN workspace_id uuid,ADD COLUMN owner_id uuid,ADD COLUMN purpose text,ADD COLUMN source text,ADD COLUMN legal_basis text,ADD COLUMN expires_at timestamptz,ADD COLUMN granted_at timestamptz DEFAULT now(),ADD COLUMN evidence jsonb,ADD COLUMN created_at timestamptz DEFAULT now();
UPDATE ats_candidate_consents s SET workspace_id=c.workspace_id,owner_id=c.owner_id,purpose='Fixture',source='fixture' FROM ats_candidates c WHERE c.id=s.candidate_id;
CREATE TABLE ats_dsar_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,owner_id uuid NOT NULL,candidate_id uuid NOT NULL REFERENCES ats_candidates(id) ON DELETE CASCADE,request_type text NOT NULL CHECK(request_type IN('export','erasure','rectification','access')),status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','in_progress','completed','rejected')),subject_email text,notes text,requested_by uuid,processed_by uuid,processed_at timestamptz,result jsonb,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
ALTER TABLE ats_dsar_requests ENABLE ROW LEVEL SECURITY;ALTER TABLE ats_candidate_consents ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON ats_dsar_requests,ats_candidate_consents TO authenticated,service_role;
CREATE POLICY old_owner_all ON ats_dsar_requests USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY old_owner_all ON ats_candidate_consents USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
INSERT INTO permissions(key,module,resource,action,scope,label_pt) SELECT 'techhire.compliance.'||a||'.'||s,'techhire','compliance',a::perm_action,s::perm_scope,'Compliance fixture' FROM unnest(ARRAY['view','create','update','delete','export'])a CROSS JOIN unnest(ARRAY['own','team','workspace'])s ON CONFLICT DO NOTHING;
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by) SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000004',key,'grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688' FROM permissions WHERE key LIKE 'techhire.compliance.%' OR key LIKE 'techhire.candidates.%' ON CONFLICT DO NOTHING;
INSERT INTO ats_dsar_requests(id,workspace_id,owner_id,candidate_id,request_type) VALUES
 ('99600000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','95100000-0000-4000-8000-000000000002','export'),
 ('99600000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','95100000-0000-4000-8000-000000000003','erasure');
