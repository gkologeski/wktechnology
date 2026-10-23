\set ON_ERROR_STOP on
BEGIN;
RESET ROLE; SELECT set_config('request.jwt.claims','{}',false);
DELETE FROM permission_set_items WHERE set_id='90000000-0000-4000-8000-000000000050';
INSERT INTO permission_set_items SELECT '90000000-0000-4000-8000-000000000050',k FROM unnest(ARRAY['techpeople.people.view.own','techpeople.people.update.own','techpeople.people.create.own','techpeople.benefits.view.workspace','techpeople.one_on_ones.view.own','techpeople.one_on_ones.update.own','techpeople.one_on_ones.create.own','techpeople.allocations.view.own','techpeople.allocations.update.own','techpeople.allocations.create.own']) k;
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',false);
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['95600000-0000-4000-8000-000000000001'::uuid]);
 IF r.can_view OR r.can_update OR r.fields<>'{}' THEN RAISE EXCEPTION 'benefits leaked banking'; END IF;
 IF can_view_person_sensitive('95600000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'legacy wrapper leaked'; END IF;
 BEGIN UPDATE people SET bank=NULL WHERE id='95600000-0000-4000-8000-000000000001'; RAISE EXCEPTION 'private cleared'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE people SET full_name=full_name||' edited' WHERE id='95600000-0000-4000-8000-000000000001'; IF NOT FOUND THEN RAISE EXCEPTION 'general edit failed'; END IF;
 BEGIN UPDATE people_one_on_ones SET private_notes='forged' WHERE id='95700000-0000-4000-8000-000000050001'; RAISE EXCEPTION 'notes edited'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE people_allocations SET cost_rate=333 WHERE id='95700000-0000-4000-8000-000000030001'; RAISE EXCEPTION 'cost edited'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PRIVATE PASS: benefits never grants private read/write; ordinary writes preserve private values';
END $$;
RESET ROLE;
INSERT INTO permission_set_items SELECT '90000000-0000-4000-8000-000000000050','techpeople.'||r||'.view.own' FROM unnest(ARRAY['people_sensitive','one_on_ones_private','allocations_financial']) r;
SET ROLE authenticated;
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['95600000-0000-4000-8000-000000000001'::uuid]);
 IF NOT r.can_view OR r.can_update OR r.fields->>'bank'<>'SYNTHETIC BANK' THEN RAISE EXCEPTION 'view-only incorrect'; END IF;
 BEGIN UPDATE people SET bank='changed' WHERE id=r.id; RAISE EXCEPTION 'view grants write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['95600000-0000-4000-8000-000000000002'::uuid]);
 IF r.can_view OR r.fields<>'{}' THEN RAISE EXCEPTION 'own leaked other person'; END IF;
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['95600000-0000-4000-8000-000000000003'::uuid]);
 IF r.can_view OR r.fields<>'{}' THEN RAISE EXCEPTION 'tenant leaked'; END IF;
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['ffffffff-0000-4000-8000-000000000001'::uuid]);
 IF r.can_view OR r.fields<>'{}' THEN RAISE EXCEPTION 'missing leaked'; END IF;
 RAISE NOTICE 'PRIVATE PASS: view-only, own/other/foreign/missing boundaries';
END $$;
RESET ROLE;
INSERT INTO permission_set_items SELECT '90000000-0000-4000-8000-000000000050','techpeople.'||r||'.update.own' FROM unnest(ARRAY['people_sensitive','one_on_ones_private','allocations_financial']) r;
SET ROLE authenticated;
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['95600000-0000-4000-8000-000000000001'::uuid]);
 IF NOT r.can_update THEN RAISE EXCEPTION 'own private edit denied'; END IF;
 UPDATE people SET bank='authorized',monthly_cost=2345 WHERE id=r.id; IF NOT FOUND THEN RAISE EXCEPTION 'no update'; END IF;
 UPDATE people_one_on_ones SET private_notes='authorized' WHERE id='95700000-0000-4000-8000-000000050001'; IF NOT FOUND THEN RAISE EXCEPTION 'no notes update'; END IF;
 UPDATE people_allocations SET cost_rate=56 WHERE id='95700000-0000-4000-8000-000000030001'; IF NOT FOUND THEN RAISE EXCEPTION 'no rate update'; END IF;
 SELECT * INTO r FROM hr_private_fields('allocations_financial',ARRAY['95600000-0000-4000-8000-000000000001'::uuid],true);
 IF NOT r.can_update OR r.fields<>'{}' THEN RAISE EXCEPTION 'draft own private denied/leaked'; END IF;
 RAISE NOTICE 'PRIVATE PASS: independent private edit in three resources and draft parent';
END $$;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',false);
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['95600000-0000-4000-8000-000000000001'::uuid]);
 IF NOT r.can_view OR NOT r.can_update THEN RAISE EXCEPTION 'Head RH denied'; END IF;
 RAISE NOTICE 'PRIVATE PASS: WK Head HR authorized';
END $$;
RESET ROLE;
UPDATE workspace_members SET status='inactive' WHERE user_id='90000000-0000-4000-8000-000000000003' AND workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d';
SET ROLE authenticated;
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['95600000-0000-4000-8000-000000000001'::uuid]);
 IF r.can_view OR r.can_update OR r.fields<>'{}' THEN RAISE EXCEPTION 'inactive Head allowed'; END IF;
 BEGIN PERFORM * FROM hr_private_fields('arbitrary',ARRAY[]::uuid[]); RAISE EXCEPTION 'arbitrary resource allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM * FROM hr_private_fields('people_sensitive',array_fill(gen_random_uuid(),ARRAY[201])); RAISE EXCEPTION 'unbounded allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 RAISE NOTICE 'PRIVATE PASS: inactive, allowlist and batch limit';
END $$;
RESET ROLE;
UPDATE workspace_members SET status='active' WHERE user_id='90000000-0000-4000-8000-000000000003' AND workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d';
UPDATE job_role_permission_overrides SET effect='deny' WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND role_id='aaaaaaaa-0000-4000-8000-000000000004' AND permission_key='techpeople.people_sensitive.view.workspace';
SET ROLE authenticated;
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['95600000-0000-4000-8000-000000000001'::uuid]);
 IF r.can_view OR r.can_update OR r.fields<>'{}' THEN RAISE EXCEPTION 'explicit Head deny bypassed'; END IF;
 BEGIN PERFORM bank FROM people LIMIT 1; RAISE EXCEPTION 'direct bank SELECT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM people LIMIT 1; RAISE EXCEPTION 'SELECT star allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM private_notes FROM people_one_on_ones LIMIT 1; RAISE EXCEPTION 'direct note SELECT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM cost_rate FROM people_allocations LIMIT 1; RAISE EXCEPTION 'direct rate SELECT allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM id,full_name FROM people LIMIT 1;
 RAISE NOTICE 'PRIVATE PASS: explicit deny and direct column ACL (including Head)';
END $$;
RESET ROLE;
UPDATE job_role_permission_overrides SET effect='grant' WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND role_id='aaaaaaaa-0000-4000-8000-000000000004' AND permission_key='techpeople.people_sensitive.view.workspace';
INSERT INTO view_as_sessions VALUES('95900000-0000-4000-8000-000000000001','role',NULL);
SET ROLE authenticated; SELECT set_config('request.jwt.claims','{"session_id":"95900000-0000-4000-8000-000000000001"}',false);
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['95600000-0000-4000-8000-000000000001'::uuid]);
 IF NOT r.can_view OR r.can_update THEN RAISE EXCEPTION 'ViewAs readonly bypass'; END IF;
 RAISE NOTICE 'PRIVATE PASS: ViewAs preserves read-only';
END $$;
SELECT set_config('request.jwt.claims','{}',false);
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid],true);
 IF NOT r.can_update OR r.fields<>'{}' THEN RAISE EXCEPTION 'new person private capability'; END IF;
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['90000000-0000-4000-8000-000000000002'::uuid],true);
 IF r.can_update THEN RAISE EXCEPTION 'foreign draft allowed'; END IF;
 RAISE NOTICE 'PRIVATE PASS: draft person bound to active workspace';
END $$;
RESET ROLE;
-- Differential test bridge exists only in this disposable cluster. It returns
-- canonical booleans, never production values; it is not a browser session test.
CREATE FUNCTION test_private_expected(res text,act text,row_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE tab text; r jsonb;
BEGIN tab:=CASE res WHEN 'people_sensitive' THEN 'people' WHEN 'one_on_ones_private' THEN 'people_one_on_ones' ELSE 'people_allocations' END;
 EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id=$1',tab) INTO r USING row_id;
 RETURN COALESCE(hr_private_row_allowed(res,act,r,false),false);
END $$;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',false);
SET ROLE authenticated;
DO $$ DECLARE res text; ids uuid[]; c record; count_cases int:=0; BEGIN
 FOREACH res IN ARRAY ARRAY['people_sensitive','one_on_ones_private','allocations_financial'] LOOP
   ids:=CASE res WHEN 'people_sensitive' THEN ARRAY['95600000-0000-4000-8000-000000000001','95600000-0000-4000-8000-000000000002','95600000-0000-4000-8000-000000000003','ffffffff-0000-4000-8000-000000000001']::uuid[]
    WHEN 'one_on_ones_private' THEN ARRAY['95700000-0000-4000-8000-000000050001','95700000-0000-4000-8000-000000050002','95700000-0000-4000-8000-000000050003','ffffffff-0000-4000-8000-000000000001']::uuid[]
    ELSE ARRAY['95700000-0000-4000-8000-000000030001','95700000-0000-4000-8000-000000030002','95700000-0000-4000-8000-000000030003','ffffffff-0000-4000-8000-000000000001']::uuid[] END;
   FOR c IN SELECT * FROM hr_private_fields(res,ids) LOOP
     IF c.can_view IS DISTINCT FROM test_private_expected(res,'view',c.id)
       OR c.can_update IS DISTINCT FROM (test_private_expected(res,'view',c.id) AND test_private_expected(res,'update',c.id)) THEN RAISE EXCEPTION 'private batch drift % %',res,c.id; END IF;
     count_cases:=count_cases+1;
   END LOOP;
 END LOOP;
 IF count_cases<>12 THEN RAISE EXCEPTION 'private differential incomplete'; END IF;
 RAISE NOTICE 'PRIVATE PASS: optimized workspace path equals canonical predicates for 12 row/resource cases';
END $$;
RESET ROLE;
INSERT INTO user_groups VALUES('95900000-0000-4000-8000-000000000002','184b9435-0a9b-4334-9e89-8854dc883f5d');
INSERT INTO user_group_members VALUES('95900000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003'),('95900000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000004');
INSERT INTO permission_set_items VALUES('90000000-0000-4000-8000-000000000050','techpeople.people.view.team'),('90000000-0000-4000-8000-000000000050','techpeople.people_sensitive.view.team');
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',false);
DO $$ DECLARE r record; BEGIN
 SELECT * INTO r FROM hr_private_fields('people_sensitive',ARRAY['95600000-0000-4000-8000-000000000002'::uuid]);
 IF NOT r.can_view OR r.can_update THEN RAISE EXCEPTION 'team read/private update mismatch'; END IF;
 RAISE NOTICE 'PRIVATE PASS: team read requires real team and does not grant team writes';
END $$;
ROLLBACK;
