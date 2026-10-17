\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %',label; END IF; RAISE NOTICE 'PASS %',label; END $$;
CREATE TEMP TABLE responsible_fixture(id integer,workspace_id uuid,owner_id uuid,assigned_to uuid,assigned_user_id uuid,cargo_catalog_version integer);
INSERT INTO responsible_fixture VALUES(1,'184b9435-0a9b-4334-9e89-8854dc883f5d','10000000-0000-4000-8000-000000000091','10000000-0000-4000-8000-000000000091',NULL,1);
CREATE TRIGGER sync BEFORE INSERT OR UPDATE ON responsible_fixture FOR EACH ROW EXECUTE FUNCTION public.sync_responsible_columns();
SET LOCAL app.crm_derivation_backfill='wk-2026-10-16';
UPDATE responsible_fixture SET cargo_catalog_version=2 WHERE id=1;
SELECT pg_temp.assert_ok(assigned_user_id IS NULL,'backfill preserves stale mirror without changing responsibility') FROM responsible_fixture;
UPDATE responsible_fixture SET assigned_to='10000000-0000-4000-8000-000000000092' WHERE id=1;
SELECT pg_temp.assert_ok(assigned_user_id=assigned_to,'real responsibility edit still synchronizes') FROM responsible_fixture;
INSERT INTO responsible_fixture(id,workspace_id,owner_id) VALUES(2,'184b9435-0a9b-4334-9e89-8854dc883f5d','10000000-0000-4000-8000-000000000091');
SELECT pg_temp.assert_ok(assigned_to=owner_id AND assigned_user_id=owner_id,'insert keeps original owner default') FROM responsible_fixture WHERE id=2;
ROLLBACK;