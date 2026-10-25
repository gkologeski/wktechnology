\set ON_ERROR_STOP on
BEGIN;
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.__isolated_marker WHERE label='techerp-isolated-harness') THEN RAISE EXCEPTION 'Isolated only';END IF;END$$;
-- Fixture loading only; normal triggers and authenticated RLS are restored before the measurement.
SET LOCAL session_replication_role=replica;
INSERT INTO public.contacts(workspace_id,owner_id,assigned_to,first_name)
SELECT 'aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','[ISO PERF ORDER4]' FROM generate_series(1,20000);
SET LOCAL session_replication_role=origin;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001"}',true);
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout='8s';
EXPLAIN (ANALYZE,BUFFERS false,TIMING false) SELECT count(*) FROM public.contacts;
ROLLBACK;
