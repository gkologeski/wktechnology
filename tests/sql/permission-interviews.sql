\set ON_ERROR_STOP on
BEGIN;RESET ROLE;SELECT set_config('request.jwt.claims','{}',false);SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_interviews) OR EXISTS(SELECT 1 FROM ats_scorecard_responses) THEN RAISE EXCEPTION 'No-key read bypass';END IF;RAISE NOTICE 'INTERVIEW PASS 1: no-key interview/evaluation read denied';END $$;
RESET ROLE;INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.candidates.view.own'),('90000000-0000-4000-8000-000000000050','techhire.jobs.view.own'),('90000000-0000-4000-8000-000000000050','techhire.interviews.view.workspace');SET ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM ats_interviews)<>1 OR (SELECT count(*) FROM ats_scorecard_responses)<>1 THEN RAISE EXCEPTION 'Actual parent visibility';END IF;UPDATE ats_interviews SET notes='Forbidden';IF FOUND THEN RAISE EXCEPTION 'View grants scheduling';END IF;UPDATE ats_scorecard_responses SET total_score=999;IF FOUND THEN RAISE EXCEPTION 'View grants score';END IF;RAISE NOTICE 'INTERVIEW PASS 2: own candidate/job view, no write';END $$;
RESET ROLE;INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.interviews.schedule.workspace');SET ROLE authenticated;
DO $$ BEGIN
 UPDATE ats_interviews SET notes='Allowed scheduling edit' WHERE id='99110000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Scheduling denied';END IF;
 BEGIN UPDATE ats_interviews SET ai_summary='Forged AI result' WHERE id='99110000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Scheduling writes AI';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO ats_interviews(workspace_id,owner_id,assigned_to,application_id,job_id,candidate_id,ai_summary) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid(),auth.uid(),'98000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000002','Forged');RAISE EXCEPTION 'Scheduling inserts AI';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 INSERT INTO ats_interviews(id,workspace_id,owner_id,assigned_to,application_id,job_id,candidate_id) VALUES('99110000-0000-4000-8000-000000000004','184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid(),auth.uid(),'98000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000002');
 RAISE NOTICE 'INTERVIEW PASS 3: scheduling create/update independent of evaluation and empty AI defaults';END $$;
RESET ROLE;DELETE FROM permission_set_items WHERE set_id='90000000-0000-4000-8000-000000000050' AND permission_key='techhire.interviews.schedule.workspace';INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.interviews.score.workspace');SET ROLE authenticated;
DO $$ BEGIN
 UPDATE ats_interviews SET transcript='Allowed transcript' WHERE id='99110000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Scoring AI edit denied';END IF;
 BEGIN UPDATE ats_interviews SET ai_summary='Unauthorized AI' WHERE id='99110000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Human score grants AI';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_interviews SET scheduled_at=now() WHERE id='99110000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Score reschedules';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 UPDATE ats_scorecard_responses SET total_score=999 WHERE id='99120000-0000-4000-8000-000000000001';IF NOT FOUND OR (SELECT total_score FROM ats_scorecard_responses WHERE id='99120000-0000-4000-8000-000000000001')<>3.67 THEN RAISE EXCEPTION 'Derived score forged';END IF;
 BEGIN UPDATE ats_scorecard_responses SET scores='{"other":5}' WHERE id='99120000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Unknown criterion';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 BEGIN UPDATE ats_scorecard_responses SET scores='{"tech":6}' WHERE id='99120000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Score out of range';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 RAISE NOTICE 'INTERVIEW PASS 4: scoring never schedules; weighted totals and criterion validation enforced';END $$;
RESET ROLE;INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.copilot.view.workspace'),('90000000-0000-4000-8000-000000000050','techhire.copilot.create.own');SET ROLE authenticated;
DO $$ BEGIN UPDATE ats_interviews SET ai_summary='Authorized AI',ai_score=80 WHERE id='99110000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Authorized AI update denied';END IF;END $$;
DO $$ BEGIN
 BEGIN UPDATE ats_scorecard_responses SET evaluator_id='90000000-0000-4000-8000-000000000003' WHERE id='99120000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Evaluator changed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_scorecard_responses SET application_id='98000000-0000-4000-8000-000000000002' WHERE id='99120000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Response parent changed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO ats_scorecard_responses(workspace_id,owner_id,evaluator_id,application_id,scorecard_id,scores) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid(),auth.uid(),'98000000-0000-4000-8000-000000000001','99100000-0000-4000-8000-000000000002','{"tech":4}');RAISE EXCEPTION 'Foreign template';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN DELETE FROM ats_scorecard_responses;RAISE EXCEPTION 'Direct evaluation delete';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO ats_scorecard_responses(workspace_id,owner_id,evaluator_id,application_id,scorecard_id,scores) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid(),auth.uid(),'98000000-0000-4000-8000-000000000001','99100000-0000-4000-8000-000000000003','{"tech":4}');RAISE EXCEPTION 'Other job template';EXCEPTION WHEN check_violation THEN NULL;END;
 RAISE NOTICE 'INTERVIEW PASS 5: immutable response authors/evaluators/parents and foreign template';END $$;
RESET ROLE;INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.interviews.schedule.workspace');SET ROLE authenticated;
DO $$ BEGIN
 BEGIN UPDATE ats_interviews SET application_id='98000000-0000-4000-8000-000000000002' WHERE id='99110000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Interview parent changed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_interviews SET interviewer_id='ffffffff-0000-4000-8000-000000000001' WHERE id='99110000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Foreign interviewer';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN UPDATE ats_interviews SET interview_kit_id='99140000-0000-4000-8000-000000000002' WHERE id='99110000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Foreign kit';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN UPDATE ats_interviews SET meeting_id='99160000-0000-4000-8000-000000000002' WHERE id='99110000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Foreign meeting';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN DELETE FROM ats_interviews;RAISE EXCEPTION 'Direct interview deletion';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'INTERVIEW PASS 6: scheduling links cannot cross candidature or tenant; cancel instead of delete';END $$;
RESET ROLE;SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE c record;r text;BEGIN
 UPDATE ats_interviews SET notes='Head edit other creator' WHERE id='99110000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Head other creator denied';END IF;
 UPDATE ats_scorecard_responses SET notes='Head edit response retaining original evaluator' WHERE id='99120000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Head score denied';END IF;
 IF (SELECT evaluator_id FROM ats_scorecard_responses WHERE id='99120000-0000-4000-8000-000000000001')<>'90000000-0000-4000-8000-000000000004' THEN RAISE EXCEPTION 'Evaluator overwritten';END IF;
 FOREACH r IN ARRAY ARRAY['interviews','interview_scoring','scorecard_responses'] LOOP
 FOR c IN SELECT * FROM hr_record_capabilities(r,CASE WHEN r<>'scorecard_responses' THEN ARRAY['99110000-0000-4000-8000-000000000001','99110000-0000-4000-8000-000000000002','ffffffff-0000-4000-8000-000000000001']::uuid[] ELSE ARRAY['99120000-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001']::uuid[] END) LOOP
 IF c.can_view IS DISTINCT FROM hr_record_access(r,'view',c.id) OR c.can_update IS DISTINCT FROM hr_record_access(r,'update',c.id) OR c.can_delete THEN RAISE EXCEPTION 'Capability drift';END IF;END LOOP;END LOOP;
 RAISE NOTICE 'INTERVIEW PASS 7: Head can edit other creators; immutable evaluator and metadata equivalence';END $$;
RESET ROLE;INSERT INTO view_as_sessions VALUES('99130000-0000-4000-8000-000000000001','role',NULL);SET ROLE authenticated;SELECT set_config('request.jwt.claims','{"session_id":"99130000-0000-4000-8000-000000000001"}',true);
DO $$ BEGIN IF hr_record_access('interviews','update','99110000-0000-4000-8000-000000000001') OR hr_record_access('scorecard_responses','update','99120000-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM hr_record_capabilities('application_interviews',ARRAY['98000000-0000-4000-8000-000000000001']::uuid[]) WHERE can_create_child) OR EXISTS(SELECT 1 FROM hr_record_capabilities('application_scores',ARRAY['98000000-0000-4000-8000-000000000001']::uuid[]) WHERE can_create_child) THEN RAISE EXCEPTION 'Readonly writes';END IF;RAISE NOTICE 'INTERVIEW PASS 8: readonly ViewAs denies both actions';END $$;
RESET ROLE;SELECT set_config('request.jwt.claims','{}',true);UPDATE job_role_permission_overrides SET effect='deny' WHERE role_id='aaaaaaaa-0000-4000-8000-000000000004' AND permission_key='techhire.interviews.score.workspace';SET ROLE authenticated;
DO $$ BEGIN UPDATE ats_scorecard_responses SET notes='Forbidden';IF FOUND THEN RAISE EXCEPTION 'Explicit score deny ignored';END IF;RAISE NOTICE 'INTERVIEW PASS 9: score deny independent of scheduling';END $$;
RESET ROLE;UPDATE workspace_members SET status='inactive' WHERE user_id='90000000-0000-4000-8000-000000000003';SET ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_interviews) OR EXISTS(SELECT 1 FROM ats_scorecard_responses) THEN RAISE EXCEPTION 'Inactive read';END IF;RAISE NOTICE 'INTERVIEW PASS 10: inactive member denied';END $$;
ROLLBACK;
BEGIN;RESET ROLE;SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);SELECT set_config('request.jwt.claims','{}',true);
DELETE FROM ats_jobs WHERE id='96000000-0000-4000-8000-000000000001';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_interviews WHERE application_id='98000000-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM ats_scorecard_responses WHERE application_id='98000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Authorized parent cascade failed';END IF;RAISE NOTICE 'INTERVIEW PASS 11: authorized parent deletion preserves full FK cascade';END $$;
ROLLBACK;
BEGIN;RESET ROLE;SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);SELECT set_config('request.jwt.claims','{}',true);
DO $$ DECLARE r text;c record;BEGIN
 FOREACH r IN ARRAY ARRAY['application_interviews','application_scores'] LOOP
 SELECT * INTO c FROM hr_record_capabilities(r,ARRAY['98000000-0000-4000-8000-000000000001']::uuid[]);
 IF NOT c.can_view OR c.can_create_child IS DISTINCT FROM hr_record_access(r,'create',c.id) OR NOT c.can_create_child THEN RAISE EXCEPTION 'Parent action metadata drift';END IF;END LOOP;
 RAISE NOTICE 'INTERVIEW PASS 12: parent scheduling/scoring dialog metadata';END $$;
ROLLBACK;
BEGIN;RESET ROLE;SELECT set_config('request.jwt.claim.sub','',true);SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO ats_interviews(id,workspace_id,owner_id,assigned_to,application_id,job_id,candidate_id) SELECT ('99210000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000004','98000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000002' FROM generate_series(1,200)i;
SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE ids uuid[];reference jsonb;batch jsonb;started timestamptz;reference_ms numeric;batch_ms numeric;BEGIN
 SELECT array_agg(id ORDER BY id) INTO ids FROM ats_interviews WHERE id::text LIKE '99210000-%';IF cardinality(ids)<>200 THEN RAISE EXCEPTION 'Missing bulk fixture';END IF;
 started:=clock_timestamp();SELECT jsonb_agg(jsonb_build_object('id',x,'view',hr_record_access('interviews','view',x),'update',hr_record_access('interviews','update',x),'delete',hr_record_access('interviews','delete',x)) ORDER BY x) INTO reference FROM unnest(ids)x;reference_ms:=extract(epoch FROM clock_timestamp()-started)*1000;
 started:=clock_timestamp();SELECT jsonb_agg(jsonb_build_object('id',id,'view',can_view,'update',can_update,'delete',can_delete) ORDER BY id) INTO batch FROM hr_record_capabilities('interviews',ids);batch_ms:=extract(epoch FROM clock_timestamp()-started)*1000;
 IF batch IS DISTINCT FROM reference THEN RAISE EXCEPTION 'Bulk capability drift';END IF;
 RAISE NOTICE 'INTERVIEW PASS 13: 200-record batch equals canonical checks; isolated reference % ms, batch % ms',reference_ms,batch_ms;
END $$;ROLLBACK;
