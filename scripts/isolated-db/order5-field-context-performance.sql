-- Isolated-only regression. Every fixture is reverted, including on failure.
BEGIN;
SET LOCAL statement_timeout='5s';
DO $$BEGIN IF current_database()<>'postgres' OR NOT EXISTS(SELECT 1 FROM public.__isolated_marker WHERE label='techerp-isolated-harness') THEN RAISE EXCEPTION 'Isolated harness required';END IF;END$$;
INSERT INTO public.deals(owner_id,workspace_id,name,value,stage)
 SELECT '10000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-00000000000a','[ISO] Field-context regression',10,'new' FROM generate_series(1,1000);
DO $test$
DECLARE p jsonb; total numeric;definitions integer;
BEGIN
 SELECT count(*) INTO definitions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
 WHERE n.nspname='public' AND c.relname IN('shared_fields_contacts','shared_fields_leads','shared_fields_deals','shared_fields_ats_candidates','shared_fields_ats_offers','shared_fields_ats_interviews','shared_fields_deal_line_items')
 AND r.rolname='techerp_shared_fields' AND c.reloptions @> ARRAY['security_barrier=true'] AND pg_get_viewdef(c.oid,true) LIKE '%field_policy AS MATERIALIZED%';
 IF definitions<>7 THEN RAISE EXCEPTION 'All seven field views must retain protected ownership/barrier and materialized policy';END IF;
 PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 EXECUTE $q$SELECT sum(value) FROM (SELECT value FROM public.shared_fields_deals WHERE workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' AND name='[ISO] Field-context regression' AND stage NOT IN ('won','lost') LIMIT 1000)x$q$ INTO total;
 EXECUTE $q$EXPLAIN (ANALYZE,FORMAT JSON) SELECT sum(value) FROM (SELECT value FROM public.shared_fields_deals WHERE workspace_id='aaaaaaaa-0000-4000-8000-00000000000a' AND stage NOT IN ('won','lost') LIMIT 1000)x$q$ INTO p;
 EXECUTE 'RESET ROLE';
 IF total<>10000 OR total IS NULL THEN RAISE EXCEPTION 'Authorized aggregate changed: %',total;END IF;
 IF NOT jsonb_path_exists(p,'$.** ? (@."Subplan Name" == "CTE field_policy" && @."Actual Loops" == 1)') THEN RAISE EXCEPTION 'Field context must execute once per statement';END IF;
 IF (p->0->>'Execution Time')::numeric>2000 THEN RAISE EXCEPTION 'Unexpected isolated regression: %',p->0->>'Execution Time';END IF;
 RAISE NOTICE 'PASS: seven protected views; 1000 authorized values; policy once; execution_ms=%',p->0->>'Execution Time';
END $test$;
ROLLBACK;
