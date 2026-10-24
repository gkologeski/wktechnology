\set ON_ERROR_STOP on
BEGIN;RESET ROLE;SELECT set_config('request.jwt.claims','{}',false);SELECT set_config('request.jwt.claim.sub','',false);
-- One synthetic model and pool by another member, with a used scorecard.
INSERT INTO ats_scorecards(id,workspace_id,owner_id,name,criteria) VALUES('99400000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000003','Configuration fixture','[{"key":"tech","label":"Tech","weight":1}]');
SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_scorecards) THEN RAISE EXCEPTION 'No-key model access';END IF;RAISE NOTICE 'CONFIG PASS 1: no-key model denied';END $$;
RESET ROLE;INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.interviews.view.workspace'),('90000000-0000-4000-8000-000000000050','techhire.interviews.schedule.workspace') ON CONFLICT DO NOTHING;SET ROLE authenticated;
DO $$ BEGIN
 IF NOT public.ats_config_catalog_access('184b9435-0a9b-4334-9e89-8854dc883f5d','interview_kits',auth.uid()) OR public.ats_config_action_access('184b9435-0a9b-4334-9e89-8854dc883f5d','interview_kits','update',auth.uid()) THEN RAISE EXCEPTION 'Metadata/editor separation';END IF;
 IF public.ats_config_catalog_access('90000000-0000-4000-8000-000000000002','interview_kits',auth.uid()) THEN RAISE EXCEPTION 'Cross-workspace catalog';END IF;
 RAISE NOTICE 'CONFIG PASS 2: read-only scheduler catalog pinned to tenant';END $$;
RESET ROLE;INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.scorecards.view.own'),('90000000-0000-4000-8000-000000000050','techhire.scorecards.update.own') ON CONFLICT DO NOTHING;SET ROLE authenticated;
DO $$ BEGIN UPDATE ats_scorecards SET name='Forbidden' WHERE id='99400000-0000-4000-8000-000000000001';IF FOUND THEN RAISE EXCEPTION 'Own scope edited another author';END IF;RAISE NOTICE 'CONFIG PASS 3: own binds actual author';END $$;
RESET ROLE;INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.scorecards.view.workspace'),('90000000-0000-4000-8000-000000000050','techhire.scorecards.update.workspace') ON CONFLICT DO NOTHING;SET ROLE authenticated;
DO $$ BEGIN
 UPDATE ats_scorecards SET name='Allowed' WHERE id='99400000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Workspace edit denied';END IF;
 BEGIN UPDATE ats_scorecards SET owner_id=auth.uid() WHERE id='99400000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Author mutable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF NOT EXISTS(SELECT 1 FROM hr_record_capabilities('scorecards',ARRAY['99400000-0000-4000-8000-000000000001'::uuid]) WHERE can_view AND can_update AND NOT can_delete) THEN RAISE EXCEPTION 'Capability action mismatch';END IF;
 RAISE NOTICE 'CONFIG PASS 4: workspace actions and immutable author';END $$;
RESET ROLE;INSERT INTO job_roles(id,workspace_id) VALUES('90000000-0000-4000-8000-000000000051','184b9435-0a9b-4334-9e89-8854dc883f5d');INSERT INTO user_job_roles(user_id,role_id,workspace_id,owner_id) VALUES('90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000051','184b9435-0a9b-4334-9e89-8854dc883f5d','184b9435-0a9b-4334-9e89-8854dc883f5d');INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d','90000000-0000-4000-8000-000000000051','techhire.scorecards.update.workspace','deny','1c237fbe-079e-4eb9-a3e6-c08d85e79688');SET ROLE authenticated;
DO $$ BEGIN UPDATE ats_scorecards SET name='Denied' WHERE id='99400000-0000-4000-8000-000000000001';IF FOUND THEN RAISE EXCEPTION 'Deny bypass';END IF;RAISE NOTICE 'CONFIG PASS 5: explicit deny';END $$;
RESET ROLE;UPDATE workspace_members SET status='inactive' WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND user_id='90000000-0000-4000-8000-000000000004';SET ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ats_scorecards) OR public.ats_schedule_metadata_access('184b9435-0a9b-4334-9e89-8854dc883f5d') THEN RAISE EXCEPTION 'Inactive access';END IF;RAISE NOTICE 'CONFIG PASS 6: inactive denied';END $$;
RESET ROLE;UPDATE workspace_members SET status='active' WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND user_id='90000000-0000-4000-8000-000000000004';
DELETE FROM permission_set_items WHERE set_id='90000000-0000-4000-8000-000000000050' AND permission_key LIKE 'techhire.scorecards.%';
DELETE FROM job_role_permission_overrides WHERE role_id='90000000-0000-4000-8000-000000000051';
INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techhire.scorecards.view.team'),('90000000-0000-4000-8000-000000000050','techhire.scorecards.update.team');
SET ROLE authenticated;
DO $$ BEGIN IF public.hr_record_access('scorecards','update','99400000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Team key without real team';END IF;END $$;
RESET ROLE;INSERT INTO user_groups VALUES('99410000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d');INSERT INTO user_group_members VALUES('99410000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004'),('99410000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003');SET ROLE authenticated;
DO $$ BEGIN UPDATE ats_scorecards SET name='Team allowed' WHERE id='99400000-0000-4000-8000-000000000001';IF NOT FOUND THEN RAISE EXCEPTION 'Real team denied';END IF;RAISE NOTICE 'CONFIG PASS 7: team requires actual same-workspace group';END $$;
RESET ROLE;
INSERT INTO view_as_sessions(session_id,mode,ended_at) VALUES('99420000-0000-4000-8000-000000000001','role',NULL);
SET ROLE authenticated;SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000004","session_id":"99420000-0000-4000-8000-000000000001"}',true);
DO $$ BEGIN IF public.hr_record_access('scorecards','update','99400000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Readonly update';END IF;RAISE NOTICE 'CONFIG PASS 8: readonly view denies mutations';END $$;
ROLLBACK;
