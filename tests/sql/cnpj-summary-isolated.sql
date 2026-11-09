-- Run only in an empty disposable PostgreSQL database.
\set ON_ERROR_STOP on
CREATE TABLE public.legal_entities(id uuid PRIMARY KEY,workspace_id uuid,name text,code text,cnpj text,is_default boolean,active boolean,created_by uuid);
CREATE TABLE public.financial_entries(id uuid PRIMARY KEY,workspace_id uuid,legal_entity_id uuid,assigned_to uuid,owner_id uuid,amount numeric,direction text);
CREATE FUNCTION public.finance_access_context() RETURNS jsonb LANGUAGE sql AS $$ SELECT current_setting('test.context')::jsonb $$;
CREATE FUNCTION public.finance_business_authorize(text,text,uuid) RETURNS uuid LANGUAGE plpgsql AS $$ BEGIN
 IF current_setting('test.allowed') <> 'yes' THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501'; END IF;
 RETURN (public.finance_access_context()->>'workspace')::uuid;
END $$;
CREATE FUNCTION public.finance_context_access(c jsonb,w uuid,r text,a text,u uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT coalesce(c->>'workspace'=w::text AND c->'keys' ? ('techfinance.'||r||'.'||a||'.workspace'),false)
$$;
CREATE FUNCTION public.finance_business_access(c jsonb,w uuid,r text,a text,u uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT c->>'workspace'=w::text
$$;
\ir ../../drizzle/migrations/0317_cnpj_summary_scoped_performance.sql
INSERT INTO legal_entities VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010','WK','WK',NULL,true,true,NULL),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000020','Other','Other',NULL,true,true,NULL);
INSERT INTO financial_entries VALUES
 ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001',NULL,'00000000-0000-0000-0000-000000000030',100,'receivable'),
 ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000040',NULL,200,'payable'),
 ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000002',NULL,'00000000-0000-0000-0000-000000000030',999,'receivable');
SELECT set_config('test.allowed','yes',false);
DO $$ DECLARE c jsonb:=jsonb_build_object('workspace','00000000-0000-0000-0000-000000000010','actor','00000000-0000-0000-0000-000000000030','team',jsonb_build_object('00000000-0000-0000-0000-000000000040',true)); s jsonb; BEGIN
 PERFORM set_config('test.context',(c||jsonb_build_object('keys',jsonb_build_object('techfinance.entries.view.workspace',true)))::text,false);
 s:=public.legal_entities_summary();
 IF jsonb_array_length(s)<>1 OR (s#>>'{0,totals,count}')::int<>2 OR (s#>>'{0,totals,receivable}')::numeric<>100 OR (s#>>'{0,totals,payable}')::numeric<>200 THEN RAISE EXCEPTION 'workspace totals or isolation failed'; END IF;
 PERFORM set_config('test.context',(c||jsonb_build_object('keys',jsonb_build_object('techfinance.entries.view.own',true)))::text,false);
 s:=public.legal_entities_summary();
 IF (s#>>'{0,totals,count}')::int<>1 OR (s#>>'{0,totals,payable}')::numeric<>0 THEN RAISE EXCEPTION 'own scope failed'; END IF;
 PERFORM set_config('test.context',(c||jsonb_build_object('keys',jsonb_build_object('techfinance.entries.view.team',true)))::text,false);
 s:=public.legal_entities_summary();
 IF (s#>>'{0,totals,count}')::int<>1 OR (s#>>'{0,totals,payable}')::numeric<>200 THEN RAISE EXCEPTION 'team scope failed'; END IF;
 PERFORM set_config('test.context',(c||jsonb_build_object('keys','{}'::jsonb))::text,false);
 s:=public.legal_entities_summary();
 IF (s#>>'{0,totals,count}')::int<>0 THEN RAISE EXCEPTION 'missing entry permission leaked totals'; END IF;
 PERFORM set_config('test.allowed','no',false);
 BEGIN PERFORM public.legal_entities_summary(); RAISE EXCEPTION 'unauthorized call succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;