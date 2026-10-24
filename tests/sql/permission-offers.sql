\set ON_ERROR_STOP on
BEGIN;RESET ROLE;SELECT set_config('request.jwt.claims','{}',false);SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);SET ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_offers) OR EXISTS(SELECT 1 FROM public.ats_offer_projection()) THEN RAISE EXCEPTION 'No-key read bypass';END IF;RAISE NOTICE 'OFFER PASS 1: no-key raw and projected read denied';END $$;
RESET ROLE;INSERT INTO permission_set_items SELECT '90000000-0000-4000-8000-000000000050',k FROM unnest(ARRAY['techhire.candidates.view.own','techhire.candidates.update.own','techhire.jobs.view.own','techhire.offers.view.own','techhire.offers.update.own','techhire.offers.delete.own'])k;SET ROLE authenticated;
DO $$ DECLARE r jsonb;BEGIN SELECT * INTO r FROM ats_offer_projection();IF r->>'salary_amount' IS NOT NULL OR r->>'body' IS NOT NULL OR (r->>'can_view_terms')::boolean THEN RAISE EXCEPTION 'Private terms leaked';END IF;IF (SELECT count(*) FROM ats_offers)<>1 THEN RAISE EXCEPTION 'Metadata hidden';END IF;
 BEGIN PERFORM salary_amount FROM ats_offers;RAISE EXCEPTION 'Raw salary leak';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public_token FROM ats_offers;RAISE EXCEPTION 'Token leak';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_offers SET body='Changed';RAISE EXCEPTION 'Private write bypass';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_offers SET status='sent';RAISE EXCEPTION 'State forged';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_offers SET approval_status='approved';RAISE EXCEPTION 'Approval forged';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.ats_offer_transition('99500000-0000-4000-8000-000000000001','approve',1);RAISE EXCEPTION 'Approval without key';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM 1 FROM techerp_offers.sessions;RAISE EXCEPTION 'Attestation leak';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'OFFER PASS 2: metadata does not grant private reads, writes, approval or token access';END $$;
RESET ROLE;INSERT INTO permission_set_items SELECT '90000000-0000-4000-8000-000000000050',k FROM unnest(ARRAY['techhire.offer_terms.view.own','techhire.offer_terms.update.own'])k;SET ROLE authenticated;
DO $$ DECLARE r jsonb;BEGIN SELECT * INTO r FROM ats_offer_projection();IF r->>'salary_amount'<>'9000' OR r->>'body'<>'Private letter' THEN RAISE EXCEPTION 'Allowed terms denied';END IF;
 UPDATE ats_offers SET salary_amount=9500 WHERE id='99500000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Term update denied';END IF;
 PERFORM ats_offer_transition('99500000-0000-4000-8000-000000000001','request',2);
 BEGIN UPDATE ats_offers SET body='Concurrent edit';RAISE EXCEPTION 'Pending edit allowed';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM ats_offer_transition('99500000-0000-4000-8000-000000000001','send',2);RAISE EXCEPTION 'Send permission bypass';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'OFFER PASS 3: revision, private edit and immutable pending review';END $$;
RESET ROLE;INSERT INTO permission_set_items SELECT '90000000-0000-4000-8000-000000000050',k FROM unnest(ARRAY['techhire.offers.approve.workspace','techhire.offer_delivery.manage.workspace','techhire.offer_cancellation.manage.workspace'])k;SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM ats_offer_transition('99500000-0000-4000-8000-000000000001','send',2);RAISE EXCEPTION 'Unapproved send';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN PERFORM ats_offer_transition('99500000-0000-4000-8000-000000000001','approve',1);RAISE EXCEPTION 'Stale approval accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
 PERFORM ats_offer_transition('99500000-0000-4000-8000-000000000001','approve',2);
 UPDATE ats_offers SET body='Revised letter';
 IF (SELECT approval_status FROM ats_offers)<>'not_requested' OR (SELECT revision FROM ats_offers)<>3 THEN RAISE EXCEPTION 'Approval not invalidated';END IF;
 PERFORM ats_offer_transition('99500000-0000-4000-8000-000000000001','request',3);
 PERFORM ats_offer_transition('99500000-0000-4000-8000-000000000001','approve',3);
 PERFORM ats_offer_transition('99500000-0000-4000-8000-000000000001','send',3);
 IF (SELECT status FROM ats_offers)<>'sent' OR NOT EXISTS(SELECT 1 FROM esign_documents WHERE body LIKE '%9500%' AND body LIKE '%versão 3%') OR (SELECT count(*) FROM esign_signers)<>0 THEN RAISE EXCEPTION 'Send or bearer protection failed';END IF;
 BEGIN UPDATE esign_documents SET body='Forged generic eSign edit';RAISE EXCEPTION 'Generic eSign edit bypass';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN DELETE FROM ats_offers;RAISE EXCEPTION 'Historical deletion allowed';EXCEPTION WHEN check_violation THEN NULL;END;
 RAISE NOTICE 'OFFER PASS 4: stale approvals, approved-version invalidation, atomic send, eSign protection';END $$;
RESET ROLE;SELECT set_config('request.jwt.claim.sub','',true);
DO $$ DECLARE token text;link text;r jsonb;BEGIN
 SELECT public_token INTO token FROM esign_signers LIMIT 1;SELECT public_token INTO link FROM ats_offers LIMIT 1;
 r:=ats_offer_public(link);IF r->>'signing_token' IS DISTINCT FROM token OR r ? 'candidate_id' OR r ? 'public_token' THEN RAISE EXCEPTION 'Public projection leak or missing signing route';END IF;
 r:=ats_offer_sign(token,'sign','Fixture candidate');IF NOT (r->>'completed')::boolean OR (SELECT status FROM ats_offers)<>'signed' OR (SELECT status FROM ats_applications WHERE id='98000000-0000-4000-8000-000000000001')<>'active' THEN RAISE EXCEPTION 'Signature changed hiring or completion wrong';END IF;
 BEGIN PERFORM ats_offer_sign(token,'sign','Again');RAISE EXCEPTION 'Repeated signature accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 RAISE NOTICE 'OFFER PASS 5: public signature completes only offer; no automatic hiring or replay';END $$;
SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN
 BEGIN UPDATE ats_applications SET status='hired',stage_value='hired' WHERE id='98000000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Generic update hired';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_applications SET hiring_details='{"model":"internal","monthly_amount":10000}' WHERE id='98000000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Terms edit bypass';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM hiring_details FROM ats_applications;RAISE EXCEPTION 'Raw hiring details leaked';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF EXISTS(SELECT 1 FROM ats_hiring_terms(ARRAY['98000000-0000-4000-8000-000000000001'::uuid]) WHERE can_view OR fields<>'{}') THEN RAISE EXCEPTION 'Hiring RPC leaked';END IF;
 RAISE NOTICE 'OFFER PASS 6: generic movement cannot hire or read/write financial hiring conditions';END $$;
RESET ROLE;INSERT INTO permission_set_items SELECT '90000000-0000-4000-8000-000000000050',k FROM unnest(ARRAY['techhire.candidates.delete.own','techhire.hiring.approve.workspace','techhire.hiring_terms.view.own','techhire.hiring_terms.update.own'])k;SET ROLE authenticated;
DO $$ BEGIN
 UPDATE ats_applications SET status='hired',stage_value='hired',hiring_details='{"model":"internal","monthly_amount":12000}' WHERE id='98000000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Authorized hire denied';END IF;
 IF (SELECT count(*) FROM ats_hiring_decisions)<>1 THEN RAISE EXCEPTION 'Missing hiring audit';END IF;
 IF NOT EXISTS(SELECT 1 FROM ats_hiring_terms(ARRAY['98000000-0000-4000-8000-000000000001'::uuid]) WHERE can_view AND fields->>'recorded_by'=auth.uid()::text) THEN RAISE EXCEPTION 'Hiring read/actor failed';END IF;
 BEGIN UPDATE ats_applications SET status='active',stage_value='applied' WHERE id='98000000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Reversal without permission';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_applications SET id=gen_random_uuid() WHERE id='98000000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Hiring identity rebound';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN DELETE FROM ats_applications WHERE id='98000000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Hired deletion bypass';EXCEPTION WHEN check_violation THEN NULL;END;
 RAISE NOTICE 'OFFER PASS 7: hiring approval, terms permission and reversal are independent';END $$;
RESET ROLE;SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 BEGIN UPDATE ats_applications SET status='hired',stage_value='hired' WHERE id='98000000-0000-4000-8000-000000000002';RAISE EXCEPTION 'Service hiring bypass';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'OFFER PASS 8: unbound service workflow cannot confirm hiring';END $$;

SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
RESET ROLE;INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.offers.create.own');SET ROLE authenticated;
DO $$ DECLARE offer_id uuid;before_docs int;BEGIN
 INSERT INTO ats_offers(workspace_id,owner_id,assigned_to,candidate_id,job_id,application_id,title) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid(),auth.uid(),'95100000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','Atomic test') RETURNING ats_offers.id INTO offer_id;
 PERFORM set_config('test.offer',offer_id::text,true);
 PERFORM ats_offer_transition(offer_id,'request',1);PERFORM ats_offer_transition(offer_id,'approve',1);
 UPDATE ats_candidates SET email=NULL WHERE ats_candidates.id='95100000-0000-4000-8000-000000000002';SELECT count(*) INTO before_docs FROM esign_documents;
 BEGIN PERFORM ats_offer_transition(offer_id,'send',1);RAISE EXCEPTION 'Missing email accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 IF (SELECT count(*) FROM esign_documents)<>before_docs OR (SELECT status FROM ats_offers WHERE ats_offers.id=offer_id)<>'draft' THEN RAISE EXCEPTION 'Partial send persisted';END IF;
 UPDATE ats_candidates SET email='fixture@example.test' WHERE ats_candidates.id='95100000-0000-4000-8000-000000000002';
 PERFORM ats_offer_transition(offer_id,'send',1);
 RAISE NOTICE 'OFFER PASS 9: failed preparation rolls back all signing side effects';END $$;
RESET ROLE;SELECT set_config('request.jwt.claim.sub','',true);
DO $$ DECLARE oid uuid:=current_setting('test.offer')::uuid;doc uuid;token text;link text;BEGIN
 SELECT esign_document_id,public_token INTO doc,link FROM ats_offers WHERE id=oid;SELECT public_token INTO token FROM esign_signers WHERE document_id=doc;
 INSERT INTO techerp_offers.sessions VALUES(txid_current(),NULL,oid,'send');UPDATE esign_documents SET expires_at=now()-interval '1 minute' WHERE id=doc;DELETE FROM techerp_offers.sessions WHERE offer_id=oid;
 BEGIN PERFORM ats_offer_public(link);RAISE EXCEPTION 'Expired public view';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM ats_offer_sign(token,'sign','Expired Candidate');RAISE EXCEPTION 'Expired public sign';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 INSERT INTO techerp_offers.sessions VALUES(txid_current(),NULL,oid,'send');UPDATE esign_documents SET expires_at=NULL WHERE id=doc;DELETE FROM techerp_offers.sessions WHERE offer_id=oid;
 PERFORM set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);PERFORM ats_offer_transition(oid,'cancel',1);PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM ats_offer_sign(token,'sign','Cancelled Candidate');RAISE EXCEPTION 'Cancelled signature revived';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF (SELECT status FROM ats_offers WHERE id=oid)<>'cancelled' THEN RAISE EXCEPTION 'Cancelled state revived';END IF;
 RAISE NOTICE 'OFFER PASS 10: expired/cancelled links cannot disclose or revive signing';END $$;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
UPDATE workspace_members SET status='inactive' WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND user_id=auth.uid();SET ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_offer_projection()) OR EXISTS(SELECT 1 FROM ats_hiring_terms(ARRAY['98000000-0000-4000-8000-000000000001'::uuid]) WHERE can_view) THEN RAISE EXCEPTION 'Inactive grants used';END IF;RAISE NOTICE 'OFFER PASS 11: active membership mandatory for terms and offers';END $$;
RESET ROLE;UPDATE workspace_members SET status='active' WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND user_id=auth.uid();
INSERT INTO view_as_sessions(session_id,mode,ended_at) VALUES('99520000-0000-4000-8000-000000000001','role',NULL);
SET ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000004","session_id":"99520000-0000-4000-8000-000000000001"}',true);
DO $$ BEGIN IF public.hr_record_access('application_hiring','update','98000000-0000-4000-8000-000000000001') OR public.ats_offer_action_access(jsonb_build_object('workspace_id','184b9435-0a9b-4334-9e89-8854dc883f5d','owner_id',auth.uid(),'candidate_id','95100000-0000-4000-8000-000000000002'),'approve') THEN RAISE EXCEPTION 'Readonly write allowed';END IF;RAISE NOTICE 'OFFER PASS 12: readonly view cannot approve or confirm hiring';END $$;
RESET ROLE;SELECT set_config('request.jwt.claims','{}',true);SELECT set_config('request.jwt.claim.sub','',true);
INSERT INTO api_keys(id,owner_id,workspace_id,scopes) VALUES('99530000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004','184b9435-0a9b-4334-9e89-8854dc883f5d',ARRAY['write']);
DO $$ DECLARE r jsonb;BEGIN
 r:=ats_api_confirm_hire('98000000-0000-4000-8000-000000000001','99530000-0000-4000-8000-000000000001','hired');IF NOT (r->>'already_hired')::boolean OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Delegation failed/restoration leaked';END IF;
 INSERT INTO api_keys(id,owner_id,workspace_id,scopes) VALUES('99530000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d',ARRAY['write']);
 r:=ats_api_confirm_hire('98000000-0000-4000-8000-000000000002','99530000-0000-4000-8000-000000000002','hired');IF (r->>'already_hired')::boolean OR (SELECT status FROM ats_applications WHERE id='98000000-0000-4000-8000-000000000002')<>'hired' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'API confirm failed or actor leaked';END IF;
 UPDATE api_keys SET revoked_at=now();
 BEGIN PERFORM ats_api_confirm_hire('98000000-0000-4000-8000-000000000001','99530000-0000-4000-8000-000000000001','hired');RAISE EXCEPTION 'Revoked key allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'OFFER PASS 13: API delegation checks owner RBAC, key validity and restores caller';END $$;

SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
INSERT INTO job_roles(id,workspace_id) VALUES('90000000-0000-4000-8000-000000000051','184b9435-0a9b-4334-9e89-8854dc883f5d');
INSERT INTO user_job_roles(user_id,role_id,workspace_id,owner_id) VALUES(auth.uid(),'90000000-0000-4000-8000-000000000051','184b9435-0a9b-4334-9e89-8854dc883f5d','184b9435-0a9b-4334-9e89-8854dc883f5d');
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000051','techhire.offer_terms.view.own','deny','1c237fbe-079e-4eb9-a3e6-c08d85e79688');
SET ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_offer_projection() r WHERE r->>'salary_amount' IS NOT NULL OR r->>'body' IS NOT NULL OR (r->>'can_view_terms')::boolean) THEN RAISE EXCEPTION 'Explicit deny bypass';END IF;RAISE NOTICE 'OFFER PASS 14: explicit deny removes private fields despite existing grant';END $$;
RESET ROLE;DELETE FROM job_role_permission_overrides WHERE role_id='90000000-0000-4000-8000-000000000051';
SELECT set_config('request.jwt.claim.sub','',true);
INSERT INTO ats_offers(id,owner_id,assigned_to,workspace_id,candidate_id,job_id,application_id,title,body,salary_amount) VALUES('99500000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d','95100000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','98000000-0000-4000-8000-000000000002','Team offer','Team terms',8000);
INSERT INTO permission_set_items SELECT '90000000-0000-4000-8000-000000000050',k FROM unnest(ARRAY['techhire.offers.view.team','techhire.offer_terms.view.team','techhire.candidates.view.workspace','techhire.jobs.view.workspace'])k;
SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_offer_projection('99500000-0000-4000-8000-000000000003')) THEN RAISE EXCEPTION 'Team key without team allowed';END IF;END $$;
RESET ROLE;INSERT INTO user_groups VALUES('99510000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d');INSERT INTO user_group_members VALUES('99510000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004'),('99510000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003');SET ROLE authenticated;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM ats_offer_projection('99500000-0000-4000-8000-000000000003') r WHERE (r->>'can_view_terms')::boolean) THEN RAISE EXCEPTION 'Actual team denied';END IF;RAISE NOTICE 'OFFER PASS 15: team permission requires actual same-workspace membership';END $$;
DO $$ BEGIN
 BEGIN UPDATE ats_offers SET workspace_id='90000000-0000-4000-8000-000000000002' WHERE id='99500000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Workspace rebound';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_offers SET candidate_id='95100000-0000-4000-8000-000000000001' WHERE id='99500000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Parent rebound';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO ats_offers(workspace_id,owner_id,assigned_to,candidate_id,title) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid(),auth.uid(),'95100000-0000-4000-8000-000000000003','Foreign');RAISE EXCEPTION 'Foreign parent accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 RAISE NOTICE 'OFFER PASS 16: immutable scope and same-workspace parents';END $$;
ROLLBACK;
