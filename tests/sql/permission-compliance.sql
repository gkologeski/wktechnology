\set ON_ERROR_STOP on
BEGIN;
RESET ROLE;SELECT set_config('request.jwt.claims','{}',true);SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
DELETE FROM permission_set_items WHERE set_id='90000000-0000-4000-8000-000000000050';SET ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM ats_dsar_requests) OR ats_compliance_access('95100000-0000-4000-8000-000000000002','view') THEN RAISE EXCEPTION 'No key bypass';END IF;
 BEGIN PERFORM ats_compliance_export('95100000-0000-4000-8000-000000000002');RAISE EXCEPTION 'No key export';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'COMPLIANCE PASS 1: owner alone cannot read or export';END $$;
RESET ROLE;INSERT INTO permission_set_items SELECT '90000000-0000-4000-8000-000000000050',k FROM unnest(ARRAY['techhire.candidates.view.own','techhire.candidates.update.own','techhire.compliance.view.own','techhire.compliance.create.own','techhire.compliance.update.own'])k;SET ROLE authenticated;
DO $$ DECLARE r jsonb;BEGIN
 IF (SELECT count(*) FROM ats_dsar_requests)<>1 THEN RAISE EXCEPTION 'Candidate scope not used';END IF;
 r:=ats_compliance_write('create_request','95100000-0000-4000-8000-000000000002',NULL,'{"request_type":"rectification"}');
 IF r->>'id' IS NULL THEN RAISE EXCEPTION 'Request not created';END IF;
 PERFORM ats_compliance_write('status',NULL,(r->>'id')::uuid,'{"status":"in_progress"}');
 BEGIN UPDATE ats_dsar_requests SET candidate_id='95100000-0000-4000-8000-000000000001' WHERE id=(r->>'id')::uuid;RAISE EXCEPTION 'Candidate reassigned';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_dsar_requests SET processed_by='90000000-0000-4000-8000-000000000003',status='completed',result='{"kind":"export"}' WHERE id='99600000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Unauthorized export completion';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN DELETE FROM ats_dsar_requests WHERE id=(r->>'id')::uuid;IF FOUND THEN RAISE EXCEPTION 'Audit deleted';END IF;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'COMPLIANCE PASS 2: request by another creator visible through candidate ownership; links and audit protected';END $$;
DO $$ BEGIN
 BEGIN PERFORM ats_compliance_write('retention','95100000-0000-4000-8000-000000000001',NULL,'{"retention_until":"2027-01-01T10:00:00Z"}');RAISE EXCEPTION 'Own scope crossed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM ats_compliance_write('create_request','95100000-0000-4000-8000-000000000003',NULL,'{"request_type":"export"}');RAISE EXCEPTION 'Cross tenant write';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM ats_compliance_write('retention','95100000-0000-4000-8000-000000000002',NULL,'{"retention_until":"2027-01-01T10:00:00Z"}');
 IF NOT EXISTS(SELECT 1 FROM ats_candidates WHERE id='95100000-0000-4000-8000-000000000002' AND retention_until='2027-01-01T10:00:00Z') THEN RAISE EXCEPTION 'Retention not saved';END IF;
 RAISE NOTICE 'COMPLIANCE PASS 3: own scope and tenant enforced for retention and writes';END $$;
DO $$ DECLARE r jsonb;BEGIN
 r:=ats_compliance_write('record_consent','95100000-0000-4000-8000-000000000002',NULL,'{"purpose":"Recruitment","granted":true}');
 PERFORM ats_compliance_write('revoke_consent',NULL,NULL,jsonb_build_object('id',r->>'id'));
 BEGIN UPDATE ats_candidate_consents SET granted=true WHERE id=(r->>'id')::uuid;RAISE EXCEPTION 'Revocation reversed';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN UPDATE ats_candidate_consents SET purpose='Forged evidence' WHERE id=(r->>'id')::uuid;RAISE EXCEPTION 'Evidence changed';EXCEPTION WHEN check_violation THEN NULL;END;
 RAISE NOTICE 'COMPLIANCE PASS 4: consent creation and revocation preserve original evidence';END $$;
RESET ROLE;INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.compliance.export.workspace');SET ROLE authenticated;
DO $$ DECLARE snap jsonb;BEGIN
 BEGIN PERFORM ats_compliance_export('95100000-0000-4000-8000-000000000002','99600000-0000-4000-8000-000000000002');RAISE EXCEPTION 'Mismatched request';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 snap:=ats_compliance_export('95100000-0000-4000-8000-000000000002','99600000-0000-4000-8000-000000000001');
 IF snap->'candidate'->>'id'<>'95100000-0000-4000-8000-000000000002' OR snap->'applications' @> '[{"hiring_details":{}}]' OR snap->'scope' IS NULL THEN RAISE EXCEPTION 'Export contract wrong';END IF;
 IF NOT EXISTS(SELECT 1 FROM ats_dsar_requests WHERE id='99600000-0000-4000-8000-000000000001' AND status='completed' AND processed_by=auth.uid()) THEN RAISE EXCEPTION 'Missing completion actor';END IF;
 BEGIN PERFORM ats_compliance_export('95100000-0000-4000-8000-000000000002','99600000-0000-4000-8000-000000000001');RAISE EXCEPTION 'Completed request replay';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'COMPLIANCE PASS 5: scoped export atomically completes only its actual pending request';END $$;
RESET ROLE;INSERT INTO job_roles(id,workspace_id) VALUES('aaaaaaaa-0000-4000-8000-000000000006','184b9435-0a9b-4334-9e89-8854dc883f5d');INSERT INTO user_job_roles VALUES('90000000-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000006','184b9435-0a9b-4334-9e89-8854dc883f5d','184b9435-0a9b-4334-9e89-8854dc883f5d');INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000006','techhire.compliance.export.workspace','deny','1c237fbe-079e-4eb9-a3e6-c08d85e79688');
SET ROLE authenticated;
DO $$ BEGIN IF ats_compliance_access('95100000-0000-4000-8000-000000000002','export') THEN RAISE EXCEPTION 'Deny ignored';END IF;RAISE NOTICE 'COMPLIANCE PASS 6: explicit deny wins';END $$;
RESET ROLE;UPDATE workspace_members SET status='inactive' WHERE user_id='90000000-0000-4000-8000-000000000004';SET ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_dsar_requests) OR ats_compliance_access('95100000-0000-4000-8000-000000000002','view') THEN RAISE EXCEPTION 'Inactive bypass';END IF;RAISE NOTICE 'COMPLIANCE PASS 7: inactive actor denied';END $$;
RESET ROLE;UPDATE workspace_members SET status='active' WHERE user_id='90000000-0000-4000-8000-000000000004';
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);SET ROLE authenticated;
DO $$ BEGIN IF ats_compliance_access('95100000-0000-4000-8000-000000000002','delete') THEN RAISE EXCEPTION 'Candidate update deny bypassed by compliance delete';END IF;END $$;
RESET ROLE;DELETE FROM job_role_permission_overrides WHERE role_id='aaaaaaaa-0000-4000-8000-000000000004' AND permission_key='techhire.candidates.update.workspace' AND effect='deny';
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000004','techhire.candidates.update.workspace','grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688');SET ROLE authenticated;
DO $$ DECLARE r jsonb;BEGIN
 IF NOT ats_compliance_access('95100000-0000-4000-8000-000000000002','view') THEN RAISE EXCEPTION 'Head workspace denied';END IF;
 r:=ats_compliance_write('create_request','95100000-0000-4000-8000-000000000002',NULL,'{"request_type":"erasure"}');
 BEGIN PERFORM ats_compliance_write('erase','95100000-0000-4000-8000-000000000001',(r->>'id')::uuid,'{"confirm":"ANONIMIZAR"}');RAISE EXCEPTION 'Erase mismatched candidate';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM ats_compliance_write('erase','95100000-0000-4000-8000-000000000002',(r->>'id')::uuid,'{"confirm":"ANONIMIZAR"}');
 IF NOT EXISTS(SELECT 1 FROM ats_dsar_requests WHERE id=(r->>'id')::uuid AND status='completed') OR NOT EXISTS(SELECT 1 FROM ats_candidates WHERE id='95100000-0000-4000-8000-000000000002' AND lgpd_redacted_at IS NOT NULL) THEN RAISE EXCEPTION 'Atomic erase incomplete';END IF;
 RAISE NOTICE 'COMPLIANCE PASS 8: Head workspace permission can erase and complete another creator request';END $$;
RESET ROLE;SELECT set_config('request.jwt.claim.sub','',true);SET ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM ats_compliance_capabilities(ARRAY['95100000-0000-4000-8000-000000000002'::uuid]);RAISE EXCEPTION 'Anon RPC executed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'COMPLIANCE PASS 9: anonymous RPC denied';END $$;
ROLLBACK;
