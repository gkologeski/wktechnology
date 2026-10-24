\set ON_ERROR_STOP on
BEGIN;
RESET ROLE; SELECT set_config('request.jwt.claims','{}',false); SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM ats_pipelines) THEN RAISE EXCEPTION 'No-key catalog bypass'; END IF;
 UPDATE ats_pipelines SET name='Forbidden';IF FOUND THEN RAISE EXCEPTION 'No-key update';END IF;
 BEGIN INSERT INTO ats_pipelines(workspace_id,owner_id) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid());RAISE EXCEPTION 'No-key create';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'PIPELINE PASS 1: no-key CRUD denied';
END $$;
RESET ROLE; INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.jobs.view.own');SET ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM ats_pipelines)<>3 THEN RAISE EXCEPTION 'Job catalog metadata missing or foreign';END IF;
 IF hr_record_access('pipelines','view','97000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Job metadata grants editor';END IF;
 UPDATE ats_pipelines SET name='Forbidden';IF FOUND THEN RAISE EXCEPTION 'Job key edits pipelines';END IF;
 RAISE NOTICE 'PIPELINE PASS 2: job catalog is workspace-bounded read-only exception';
END $$;
RESET ROLE; DELETE FROM permission_set_items WHERE set_id='90000000-0000-4000-8000-000000000050';
INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.pipelines.view.own'),('90000000-0000-4000-8000-000000000050','techhire.pipelines.update.own');SET ROLE authenticated;
DO $$ BEGIN
 UPDATE ats_pipelines SET name='Edited own' WHERE id='97000000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Own edit denied';END IF;
 UPDATE ats_pipelines SET name='Forbidden' WHERE id='97000000-0000-4000-8000-000000000002';IF FOUND THEN RAISE EXCEPTION 'Own edit escaped';END IF;
 BEGIN UPDATE ats_pipelines SET is_default=true WHERE id='97000000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Own changed workspace default';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_pipelines SET owner_id='90000000-0000-4000-8000-000000000003' WHERE id='97000000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Author changed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE ats_pipelines SET workspace_id='90000000-0000-4000-8000-000000000002' WHERE id='97000000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Tenant changed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'PIPELINE PASS 3: own edit; default and immutable tenant/author protected';
END $$;
RESET ROLE;INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.pipelines.create.own'),('90000000-0000-4000-8000-000000000050','techhire.pipelines.delete.own');SET ROLE authenticated;
DO $$ BEGIN
 INSERT INTO ats_pipelines(id,workspace_id,owner_id) VALUES('97000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid());
 DELETE FROM ats_pipelines WHERE id='97000000-0000-4000-8000-000000000003';IF NOT FOUND THEN RAISE EXCEPTION 'Own delete denied';END IF;
 BEGIN INSERT INTO ats_pipelines(workspace_id,owner_id,is_default) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d',auth.uid(),true);RAISE EXCEPTION 'Create changed default';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'PIPELINE PASS 4: explicit create and delete; create cannot change default';
END $$;
RESET ROLE;INSERT INTO user_groups VALUES('97020000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d');
INSERT INTO user_group_members VALUES('97020000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003'),('97020000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004');
INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.pipelines.view.team'),('90000000-0000-4000-8000-000000000050','techhire.pipelines.update.team');SET ROLE authenticated;
DO $$ BEGIN
 UPDATE ats_pipelines SET name='Team edited' WHERE id='97000000-0000-4000-8000-000000000002';IF NOT FOUND THEN RAISE EXCEPTION 'Team edit denied';END IF;
 IF EXISTS(SELECT 1 FROM ats_pipelines WHERE workspace_id<>'184b9435-0a9b-4334-9e89-8854dc883f5d') THEN RAISE EXCEPTION 'Team escaped tenant';END IF;
 RAISE NOTICE 'PIPELINE PASS 5: actual team and foreign workspace';
END $$;
RESET ROLE;SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
DO $$ DECLARE c record; BEGIN
 UPDATE ats_pipelines SET is_default=true WHERE id='97000000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Head other owner denied';END IF;
 UPDATE ats_pipelines SET is_default=true WHERE id='97000000-0000-4000-8000-000000000002';
 IF (SELECT count(*) FROM ats_pipelines WHERE is_default)<>1 THEN RAISE EXCEPTION 'Default exclusivity';END IF;
 BEGIN DELETE FROM ats_pipelines WHERE id='97000000-0000-4000-8000-000000000002';RAISE EXCEPTION 'Default deleted';EXCEPTION WHEN check_violation THEN NULL;END;
 FOR c IN SELECT * FROM hr_record_capabilities('pipelines',ARRAY['97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000002','96010000-0000-4000-8000-000000000002','ffffffff-0000-4000-8000-000000000001']::uuid[]) LOOP
 IF c.can_view IS DISTINCT FROM hr_record_access('pipelines','view',c.id) OR c.can_update IS DISTINCT FROM hr_record_access('pipelines','update',c.id) OR c.can_delete IS DISTINCT FROM hr_record_access('pipelines','delete',c.id) THEN RAISE EXCEPTION 'Metadata drift';END IF;END LOOP;
 RAISE NOTICE 'PIPELINE PASS 6: Head workspace/default exclusivity and capability equivalence';
END $$;
RESET ROLE;UPDATE ats_jobs SET pipeline_id='97000000-0000-4000-8000-000000000001' WHERE id='96000000-0000-4000-8000-000000000001';SET ROLE authenticated;
DO $$ BEGIN BEGIN DELETE FROM ats_pipelines WHERE id='97000000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Linked pipeline deleted';EXCEPTION WHEN foreign_key_violation THEN NULL;END;RAISE NOTICE 'PIPELINE PASS 7: linked jobs protect deletion, including hidden jobs';END $$;
RESET ROLE;INSERT INTO view_as_sessions VALUES('97030000-0000-4000-8000-000000000001','role',NULL);SET ROLE authenticated;SELECT set_config('request.jwt.claims','{"session_id":"97030000-0000-4000-8000-000000000001"}',true);
DO $$ BEGIN IF hr_record_access('pipelines','update','97000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Readonly update';END IF;UPDATE ats_pipelines SET name='Forbidden';IF FOUND THEN RAISE EXCEPTION 'Readonly wrote';END IF;RAISE NOTICE 'PIPELINE PASS 8: read-only ViewAs';END $$;
RESET ROLE;SELECT set_config('request.jwt.claims','{}',true);
UPDATE job_role_permission_overrides SET effect='deny' WHERE role_id='aaaaaaaa-0000-4000-8000-000000000004' AND permission_key LIKE 'techhire.pipelines.view.%';SET ROLE authenticated;
DO $$ BEGIN IF hr_record_access('pipelines','update','97000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'View deny bypassed';END IF;RAISE NOTICE 'PIPELINE PASS 9: effective view deny prevents mutation';END $$;
RESET ROLE;UPDATE workspace_members SET status='inactive' WHERE user_id='90000000-0000-4000-8000-000000000003';SET ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_pipelines) THEN RAISE EXCEPTION 'Inactive catalog';END IF;RAISE NOTICE 'PIPELINE PASS 10: inactive membership denied';END $$;
ROLLBACK;
