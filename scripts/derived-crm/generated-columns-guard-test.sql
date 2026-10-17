\set ON_ERROR_STOP on
-- Run only in a disposable PostgreSQL cluster. No shared data or service role.
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %',label; END IF; RAISE NOTICE 'PASS %',label; END $$;
CREATE TEMP TABLE guard_fixture (
 id integer PRIMARY KEY, workspace_id uuid, phone text, mobile_phone text,
 whatsapp_e164 text, cargo_catalog_version integer, updated_at timestamptz,
 phone_digits text GENERATED ALWAYS AS (replace(phone,'+','')) STORED,
 mobile_phone_digits text GENERATED ALWAYS AS (replace(mobile_phone,'+','')) STORED,
 whatsapp_digits text GENERATED ALWAYS AS (replace(whatsapp_e164,'+','')) STORED
);
CREATE FUNCTION pg_temp.fixture_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF public.crm_is_derivation_backfill(to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN NEW; END IF; NEW.updated_at:=now(); RETURN NEW; END $$;
CREATE TRIGGER fixture_updated BEFORE UPDATE ON guard_fixture FOR EACH ROW EXECUTE FUNCTION pg_temp.fixture_updated();
INSERT INTO guard_fixture VALUES(1,'184b9435-0a9b-4334-9e89-8854dc883f5d','+5548999999999','+5548988888888','+5548977777777',1,'2020-01-01');
SET LOCAL app.crm_derivation_backfill='wk-2026-10-16';
UPDATE guard_fixture SET cargo_catalog_version=2 WHERE id=1;
SELECT pg_temp.assert_ok(updated_at='2020-01-01' AND phone_digits='5548999999999','generated NEW indexes do not change commercial date') FROM guard_fixture;
UPDATE guard_fixture SET phone='+5548966666666' WHERE id=1;
SELECT pg_temp.assert_ok(updated_at<>'2020-01-01','phone source edit is not suppressed') FROM guard_fixture;
SELECT pg_temp.assert_ok(NOT public.crm_is_derivation_backfill('{"workspace_id":"aaaaaaaa-0000-4000-8000-00000000009b"}','{"workspace_id":"aaaaaaaa-0000-4000-8000-00000000009b"}'),'other workspace cannot suppress effects');
SET LOCAL app.crm_derivation_backfill='wrong';
SELECT pg_temp.assert_ok(NOT public.crm_is_derivation_backfill('{"workspace_id":"184b9435-0a9b-4334-9e89-8854dc883f5d"}','{"workspace_id":"184b9435-0a9b-4334-9e89-8854dc883f5d"}'),'wrong marker cannot suppress effects');
SET LOCAL app.crm_derivation_backfill='wk-2026-10-16';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_ok(NOT public.crm_is_derivation_backfill('{"workspace_id":"184b9435-0a9b-4334-9e89-8854dc883f5d"}','{"workspace_id":"184b9435-0a9b-4334-9e89-8854dc883f5d"}'),'authenticated cannot suppress effects');
RESET ROLE;
ROLLBACK;