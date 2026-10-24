-- Run only against a catalog-derived synthetic local database. No production writes.
\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE r text;t text;f regprocedure;BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.__isolated_marker WHERE label='techerp-isolated-harness') THEN RAISE EXCEPTION 'Isolated catalog required';END IF;
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF has_table_privilege(r,'public.bank_connection_tokens','SELECT') OR has_any_column_privilege(r,'public.bank_connection_tokens','SELECT') THEN RAISE EXCEPTION 'Token exposure: %',r;END IF;
 IF has_column_privilege(r,'public.bank_connections','metadata','SELECT') THEN RAISE EXCEPTION 'OAuth state exposure: %',r;END IF;
 FOREACH t IN ARRAY ARRAY['bank_connections','bank_connection_tokens','bank_connection_events','bank_payments','bank_charges'] LOOP
 IF has_table_privilege(r,'public.'||t,'INSERT') OR has_table_privilege(r,'public.'||t,'UPDATE') OR has_table_privilege(r,'public.'||t,'DELETE') THEN RAISE EXCEPTION 'Unrestricted banking DML: % %',r,t;END IF;
 END LOOP;
 FOREACH f IN ARRAY ARRAY['public.banking_apply_event(text,uuid,text,text,timestamp with time zone,text,uuid)'::regprocedure,'public.banking_store_tokens(uuid,uuid,jsonb,uuid,text,uuid)'::regprocedure,'public.banking_disconnect(uuid,uuid,uuid)'::regprocedure,'public.banking_claim_refresh(uuid,uuid)'::regprocedure] LOOP
 IF has_function_privilege(r,f,'EXECUTE') THEN RAISE EXCEPTION 'Service RPC exposure: % %',r,f;END IF;
 END LOOP;
 END LOOP;
 IF has_table_privilege('authenticated','public.bank_statement_transactions','UPDATE') OR has_column_privilege('authenticated','public.bank_statement_transactions','amount','UPDATE') OR has_column_privilege('authenticated','public.bank_statement_transactions','raw','SELECT') THEN RAISE EXCEPTION 'Provider statement writable or raw exposed';END IF;
 IF NOT has_column_privilege('authenticated','public.bank_statement_transactions','matched_payment_id','UPDATE') THEN RAISE EXCEPTION 'Reviewed reconciliation unavailable';END IF;
 RAISE NOTICE 'BANKING SQL PASS 1: token/metadata ACL, service-only RPCs and field-scoped reconciliation';
END $$;
CREATE ROLE banking_test_api_subject INHERIT;
GRANT authenticated TO banking_test_api_subject;
GRANT banking_test_api_subject TO postgres;
SET LOCAL ROLE banking_test_api_subject;
DO $$ BEGIN
 BEGIN PERFORM access_token FROM bank_connection_tokens;RAISE EXCEPTION 'Inherited API role can read tokens';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM banking_authorize('execute');RAISE EXCEPTION 'Anonymous identity authorized';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 RAISE NOTICE 'BANKING SQL PASS 2: technical API identity inherits the same denials';
END $$;
ROLLBACK;
