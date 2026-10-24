\set ON_ERROR_STOP on
BEGIN;
RESET ROLE; SELECT set_config('request.jwt.claims','{}',false);
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM ats_jobs) THEN RAISE EXCEPTION 'No-key read bypass'; END IF;
 UPDATE ats_jobs SET title='Forbidden' WHERE id='96000000-0000-4000-8000-000000000001'; IF FOUND THEN RAISE EXCEPTION 'Owner edits without key'; END IF;
 BEGIN INSERT INTO ats_jobs(workspace_id,owner_id,title) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid(),'Forbidden'); RAISE EXCEPTION 'Owner creates without key'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'JOB PASS 1: no-key own read/write/create denied';
END $$;
RESET ROLE; INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.jobs.view.own');
SET ROLE authenticated;
DO $$ BEGIN
 IF NOT can_access_ats_job('96000000-0000-4000-8000-000000000001') OR NOT can_access_ats_job('96000000-0000-4000-8000-000000000004') THEN RAISE EXCEPTION 'Own/recruiter view denied'; END IF;
 IF can_access_ats_job('96000000-0000-4000-8000-000000000002') OR can_access_ats_job('96000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'Own view escaped'; END IF;
 UPDATE ats_jobs SET title='Forbidden' WHERE id='96000000-0000-4000-8000-000000000001'; IF FOUND THEN RAISE EXCEPTION 'View grants write'; END IF;
 DELETE FROM ats_jobs WHERE id='96000000-0000-4000-8000-000000000001'; IF FOUND THEN RAISE EXCEPTION 'View grants delete'; END IF;
 IF NOT EXISTS(SELECT 1 FROM ats_job_postings WHERE id='96040000-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM ats_job_postings WHERE id IN('96040000-0000-4000-8000-000000000002','96040000-0000-4000-8000-000000000003')) THEN RAISE EXCEPTION 'Posting parent scope escaped'; END IF;
 BEGIN UPDATE ats_job_postings SET status='forged' WHERE id='96040000-0000-4000-8000-000000000001'; RAISE EXCEPTION 'User forged provider status'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'JOB PASS 2: real own/recruiter view; provider state is parent-scoped and read-only';
END $$;
RESET ROLE; INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.jobs.update.own');
SET ROLE authenticated;
DO $$ BEGIN
 UPDATE ats_jobs SET title='Own edited' WHERE id='96000000-0000-4000-8000-000000000001'; IF NOT FOUND THEN RAISE EXCEPTION 'Own edit denied'; END IF;
 UPDATE ats_jobs SET title='Other edit' WHERE id='96000000-0000-4000-8000-000000000002'; IF FOUND THEN RAISE EXCEPTION 'Own update escaped'; END IF;
 BEGIN PERFORM test_elevated_job_reassign('96000000-0000-4000-8000-000000000002'); RAISE EXCEPTION 'Elevated NEW assignment forged own'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'JOB PASS 3: own edit; elevated reassignment checked against old row';
END $$;
RESET ROLE; INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.jobs.view.workspace'),('90000000-0000-4000-8000-000000000050','techhire.jobs.update.workspace');
SET ROLE authenticated;
DO $$ BEGIN
 UPDATE ats_jobs SET title='Workspace edited' WHERE id='96000000-0000-4000-8000-000000000002'; IF NOT FOUND THEN RAISE EXCEPTION 'Workspace edit denied'; END IF;
 BEGIN INSERT INTO ats_jobs(workspace_id,owner_id,title) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid(),'Forbidden'); RAISE EXCEPTION 'Update grants create'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE ats_jobs SET status='published' WHERE id='96000000-0000-4000-8000-000000000001'; RAISE EXCEPTION 'Update grants publish'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'JOB PASS 4: workspace update never grants create/publish';
END $$;
RESET ROLE; INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.jobs.create.own'),('90000000-0000-4000-8000-000000000050','techhire.jobs.publish.workspace'),('90000000-0000-4000-8000-000000000050','techhire.jobs.delete.own');
SET ROLE authenticated;
DO $$ BEGIN
 INSERT INTO ats_jobs(id,workspace_id,owner_id,assigned_to,title,pipeline_id) VALUES('96000000-0000-4000-8000-000000000005','184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid(),auth.uid(),'Created','96010000-0000-4000-8000-000000000001');
 UPDATE ats_jobs SET status='published' WHERE id='96000000-0000-4000-8000-000000000005'; IF NOT FOUND THEN RAISE EXCEPTION 'Publish denied'; END IF;
 BEGIN UPDATE ats_jobs SET pipeline_id='96010000-0000-4000-8000-000000000002' WHERE id='96000000-0000-4000-8000-000000000005'; RAISE EXCEPTION 'Foreign pipeline allowed'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE ats_jobs SET workspace_id='90000000-0000-4000-8000-000000000002' WHERE id='96000000-0000-4000-8000-000000000005'; RAISE EXCEPTION 'Moved tenant'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE ats_jobs SET owner_id='90000000-0000-4000-8000-000000000003' WHERE id='96000000-0000-4000-8000-000000000005'; RAISE EXCEPTION 'Moved creator'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE ats_jobs SET recruiter_id='ffffffff-0000-4000-8000-000000000001' WHERE id='96000000-0000-4000-8000-000000000005'; RAISE EXCEPTION 'Foreign assignee'; EXCEPTION WHEN check_violation THEN NULL; END;
 DELETE FROM ats_jobs WHERE id='96000000-0000-4000-8000-000000000005'; IF NOT FOUND THEN RAISE EXCEPTION 'Own delete denied'; END IF;
 DELETE FROM ats_jobs WHERE id='96000000-0000-4000-8000-000000000002'; IF FOUND THEN RAISE EXCEPTION 'Own delete escaped'; END IF;
 RAISE NOTICE 'JOB PASS 5: create/publish/delete and immutable same-workspace links';
END $$;
RESET ROLE;
DELETE FROM permission_set_items WHERE set_id='90000000-0000-4000-8000-000000000050' AND permission_key IN('techhire.jobs.view.workspace','techhire.jobs.update.workspace');
INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.jobs.view.team');
INSERT INTO user_groups VALUES('96020000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d');
INSERT INTO user_group_members VALUES('96020000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003'),('96020000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004');
SET ROLE authenticated;
DO $$ BEGIN
 IF NOT can_access_ats_job('96000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Real team read denied'; END IF;
 UPDATE ats_jobs SET title='Team forbidden' WHERE id='96000000-0000-4000-8000-000000000002'; IF FOUND THEN RAISE EXCEPTION 'Team view grants edit'; END IF;
 RAISE NOTICE 'JOB PASS 6: actual team read independent of edit';
END $$;
RESET ROLE; INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.jobs.update.team');
SET ROLE authenticated;
DO $$ BEGIN
 UPDATE ats_jobs SET title='Team edited' WHERE id='96000000-0000-4000-8000-000000000002'; IF NOT FOUND THEN RAISE EXCEPTION 'Real team edit denied'; END IF;
 IF can_access_ats_job('96000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'Foreign team access'; END IF;
 RAISE NOTICE 'JOB PASS 7: team edit stays within selected workspace';
END $$;
RESET ROLE; INSERT INTO view_as_sessions VALUES('96030000-0000-4000-8000-000000000001','role',NULL);
SET ROLE authenticated; SELECT set_config('request.jwt.claims','{"session_id":"96030000-0000-4000-8000-000000000001"}',true);
DO $$ BEGIN
 IF NOT can_access_ats_job('96000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Readonly lost view'; END IF;
 IF hr_record_access('jobs','update','96000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Readonly can edit'; END IF;
 UPDATE ats_jobs SET title='Readonly forbidden' WHERE id='96000000-0000-4000-8000-000000000001'; IF FOUND THEN RAISE EXCEPTION 'Readonly wrote'; END IF;
 RAISE NOTICE 'JOB PASS 8: readonly ViewAs enforced';
END $$;
RESET ROLE; SELECT set_config('request.jwt.claims','{}',false); DELETE FROM user_group_members WHERE group_id='96020000-0000-4000-8000-000000000001';
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE c record; BEGIN
 IF NOT can_access_ats_job('96000000-0000-4000-8000-000000000001') OR NOT hr_record_access('jobs','update','96000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Head workspace scope denied'; END IF;
 FOR c IN SELECT * FROM hr_record_capabilities('jobs',ARRAY['96000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000003','ffffffff-0000-4000-8000-000000000001']::uuid[]) LOOP
  IF c.can_view IS DISTINCT FROM hr_record_access('jobs','view',c.id) OR c.can_update IS DISTINCT FROM (hr_record_access('jobs','view',c.id) AND hr_record_access('jobs','update',c.id)) OR c.can_delete IS DISTINCT FROM (hr_record_access('jobs','view',c.id) AND hr_record_access('jobs','delete',c.id)) THEN RAISE EXCEPTION 'Job capability drift'; END IF;
 END LOOP;
 RAISE NOTICE 'JOB PASS 9: Head workspace access and capability equivalence';
END $$;
RESET ROLE; UPDATE job_role_permission_overrides SET effect='deny' WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND role_id='aaaaaaaa-0000-4000-8000-000000000004' AND permission_key='techhire.jobs.view.workspace';
SET ROLE authenticated;
DO $$ BEGIN
 IF can_access_ats_job('96000000-0000-4000-8000-000000000001') OR hr_record_access('jobs','update','96000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Head deny bypassed'; END IF;
 RAISE NOTICE 'JOB PASS 10: explicit view deny prevents scoped write bypass';
END $$;
RESET ROLE; UPDATE workspace_members SET status='inactive' WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND user_id='90000000-0000-4000-8000-000000000003';
SET ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM ats_jobs) OR can_access_ats_job('96000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Inactive access'; END IF;
 RAISE NOTICE 'JOB PASS 11: inactive actor denied regardless of old ownership';
END $$;
ROLLBACK;
