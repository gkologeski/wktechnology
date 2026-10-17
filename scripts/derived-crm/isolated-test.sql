\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ASSERT FAILED: %',label; END IF; RAISE NOTICE 'PASS %',label; END $$;
-- All fixtures are synthetic. Existing real policies/triggers remain enabled.
INSERT INTO auth.users(id,email,aud,role,email_confirmed_at,raw_user_meta_data) VALUES('10000000-0000-4000-8000-000000000091','derived@techerp-test.invalid','authenticated','authenticated',now(),'{}');
INSERT INTO public.workspaces(id,name,slug,created_by) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d','[ISO] WK','iso-derived-wk','10000000-0000-4000-8000-000000000091'),('aaaaaaaa-0000-4000-8000-00000000009b','[ISO] Other','iso-derived-other','10000000-0000-4000-8000-000000000091');
INSERT INTO public.workspace_members(workspace_id,user_id,role,status) VALUES('184b9435-0a9b-4334-9e89-8854dc883f5d','10000000-0000-4000-8000-000000000091','admin','active');
UPDATE public.profiles SET active_workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' WHERE id='10000000-0000-4000-8000-000000000091';
\i /tmp/derived-catalog-seed.sql
\i scripts/derived-crm/catalog-v2.sql
DO $$ DECLARE x record; d jsonb; rules jsonb; BEGIN
 SELECT c.rules INTO rules FROM public.crm_derivation_catalog c WHERE active;
 FOR x IN SELECT * FROM (VALUES
 ('HR Business Partner','HR Business Partner','Recursos humanos','Especialista'),('HRBP','HR Business Partner','Recursos humanos','Especialista'),('Business Partner de RH','HR Business Partner','Recursos humanos','Especialista'),('Parceiro de negócios de recursos humanos','HR Business Partner','Recursos humanos','Especialista'),('People Partner','People Partner','Recursos humanos','Especialista'),('Talent Acquisition Partner','Talent Acquisition Partner','Recursos humanos','Especialista'),('Product Owner','Product Owner','Produto','Especialista'),('Partner Manager','Gerente de Parcerias','Comercial','Gerência'),('Gerente de desenvolvimento de negócios','Gerente de Desenvolvimento de Negócios','Comercial','Gerência'),('Business Development Manager','Gerente de Desenvolvimento de Negócios','Comercial','Gerência'),('Co-Founder & CTO','CTO','Tecnologia','C-Level'),('CEO & CTO','Classificação ambígua','Classificação ambígua','Classificação ambígua'),('Diretor Técnico','Diretor Técnico','Não classificado','Diretoria'),('Analista suporte técnico','Analista','Não classificado','Operacional'),('Sócio','Sócio','Não classificado','Societário'),('Partner','Sócio','Não classificado','Societário'),('Business Partner','Business Partner','Não classificado','Especialista'),
 ('CTO','CTO','Tecnologia','C-Level'),(' cTo ','CTO','Tecnologia','C-Level'),('ＣＴＯ','CTO','Tecnologia','C-Level'),('CIO','CIO','Tecnologia','C-Level'),('CEO','CEO','Direção geral','C-Level'),('CFO','CFO','Finanças','C-Level'),('COO','COO','Operações','C-Level'),('CHRO','CHRO','Recursos humanos','C-Level'),('CISO','CISO','Segurança da informação','C-Level'),('CDO','CDO','Dados','C-Level'),
 ('IT Manager','Gerente de TI','Tecnologia','Gerência'),('Gerente TI','Gerente de TI','Tecnologia','Gerência'),('Gerente Tecnologia','Gerente de TI','Tecnologia','Gerência'),('Gerente de Projetos','Gerente de Projetos','Projetos','Gerência'),('Técnico','Técnico','Não classificado','Operacional'),('Analista Sênior','Analista','Não classificado','Operacional'),('PM','Não classificado','Não classificado','Não classificado'),('PO','Não classificado','Não classificado','Não classificado'),('astronauta','Não classificado','Não classificado','Não classificado'),('Sócio / C-Level / Presidente / Diretor','Classificação ambígua','Classificação ambígua','Classificação ambígua'),('CTO / CFO','Classificação ambígua','Classificação ambígua','Classificação ambígua'),('','', '', '')) q(src,title,area,level) LOOP
  d:=public.crm_classify_title(x.src,rules);
  PERFORM pg_temp.assert_ok(coalesce(d->>'title','')=x.title AND coalesce(d->>'area','')=x.area AND coalesce(d->>'level','')=x.level,'cargo '||x.src);
 END LOOP;
 FOR x IN SELECT * FROM (VALUES ('0','0 a 50'),('48','0 a 50'),('50','0 a 50'),('51','51 a 100'),('59','51 a 100'),('100','51 a 100'),('101','101 a 200'),('200','101 a 200'),('201','201 a 500'),('317','201 a 500'),('500','201 a 500'),('501','501 a 1.000'),('780','501 a 1.000'),('1000','501 a 1.000'),('1001','1.001 a 5.000'),('1500','1.001 a 5.000'),('1.500','1.001 a 5.000'),('1,500','1.001 a 5.000'),('5000','1.001 a 5.000'),('5001','5.001 a 10.000'),('10000','5.001 a 10.000'),('10001','Acima de 10.000'),('51-200','Faixa abrangente'),('51–100','51 a 100'),('-1',NULL),('1.5',NULL),('1,5',NULL),('abc',NULL),('200-51',NULL),(NULL,NULL),('',NULL)) q(src,expected) LOOP
 PERFORM pg_temp.assert_ok(public.crm_size_description(x.src) IS NOT DISTINCT FROM x.expected,'size '||coalesce(x.src,'NULL'));
 END LOOP;
END $$;
INSERT INTO public.contacts(id,workspace_id,owner_id,first_name,job_title,cargo_resumido) VALUES('90000000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','10000000-0000-4000-8000-000000000091','ISO','CTO','FORGED');
SELECT pg_temp.assert_ok(cargo_resumido='CTO','INSERT contacts overrides forged') FROM contacts WHERE id='90000000-0000-4000-8000-000000000001';
UPDATE contacts SET area_atuacao='FORGED' WHERE id='90000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_ok(area_atuacao='Tecnologia','UPDATE derived overwrite') FROM contacts WHERE id='90000000-0000-4000-8000-000000000001';
INSERT INTO contacts(id,workspace_id,owner_id,first_name,job_title) VALUES('90000000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','10000000-0000-4000-8000-000000000091','ISO','CFO') ON CONFLICT(id) DO UPDATE SET job_title=EXCLUDED.job_title;
SELECT pg_temp.assert_ok(cargo_resumido='CFO' AND area_atuacao='Finanças','UPSERT recomputes') FROM contacts WHERE id='90000000-0000-4000-8000-000000000001';
UPDATE contacts SET job_title=NULL WHERE id='90000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_ok(cargo_resumido IS NULL AND area_atuacao IS NULL AND nivel_hierarquico IS NULL,'clear contact') FROM contacts WHERE id='90000000-0000-4000-8000-000000000001';
INSERT INTO leads(id,workspace_id,owner_id,first_name,hs_raw) VALUES('90000000-0000-4000-8000-000000000002','184b9435-0a9b-4334-9e89-8854dc883f5d','10000000-0000-4000-8000-000000000091','ISO','{"properties":{"hs_contact_job_title":"CTO","cargo_formatado":"CFO"}}');
SELECT pg_temp.assert_ok(job_title='CTO' AND job_title_source='legacy','legacy primary precedence') FROM leads WHERE id='90000000-0000-4000-8000-000000000002';
UPDATE leads SET hs_raw=jsonb_set(hs_raw,'{properties,hs_contact_job_title}','"CIO"') WHERE id='90000000-0000-4000-8000-000000000002';
SELECT pg_temp.assert_ok(job_title='CIO','raw import synchronizes') FROM leads WHERE id='90000000-0000-4000-8000-000000000002';
UPDATE leads SET job_title='IT Manager' WHERE id='90000000-0000-4000-8000-000000000002';
UPDATE leads SET hs_raw=jsonb_set(hs_raw,'{properties,hs_contact_job_title}','"CFO"') WHERE id='90000000-0000-4000-8000-000000000002';
SELECT pg_temp.assert_ok(job_title='IT Manager' AND job_title_source='explicit','explicit edit survives raw import') FROM leads WHERE id='90000000-0000-4000-8000-000000000002';
UPDATE leads SET job_title=NULL WHERE id='90000000-0000-4000-8000-000000000002';
UPDATE leads SET hs_raw=jsonb_set(hs_raw,'{properties,hs_contact_job_title}','"CEO"'),cargo_resumido='FORGED' WHERE id='90000000-0000-4000-8000-000000000002';
SELECT pg_temp.assert_ok(job_title IS NULL AND cargo_resumido IS NULL AND job_title_source='explicit','clear never resurrects raw') FROM leads WHERE id='90000000-0000-4000-8000-000000000002';
INSERT INTO leads(id,workspace_id,owner_id,first_name,hs_raw) VALUES('90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d','10000000-0000-4000-8000-000000000091','ISO','{"properties":{"cargo_formatado":"Gerente de Projetos"}}');
SELECT pg_temp.assert_ok(job_title='Gerente de Projetos','legacy fallback') FROM leads WHERE id='90000000-0000-4000-8000-000000000003';
INSERT INTO companies(id,workspace_id,owner_id,name,size,size_description) VALUES('90000000-0000-4000-8000-000000000004','184b9435-0a9b-4334-9e89-8854dc883f5d','10000000-0000-4000-8000-000000000091','ISO','1.500','FORGED');
SELECT pg_temp.assert_ok(size='1.500' AND size_description='1.001 a 5.000','company insert retains source') FROM companies WHERE id='90000000-0000-4000-8000-000000000004';
UPDATE companies SET size=NULL WHERE id='90000000-0000-4000-8000-000000000004';
SELECT pg_temp.assert_ok(size_description IS NULL,'clear company') FROM companies WHERE id='90000000-0000-4000-8000-000000000004';
INSERT INTO contacts(id,workspace_id,owner_id,first_name,job_title) VALUES('90000000-0000-4000-8000-000000000005','aaaaaaaa-0000-4000-8000-00000000009b','10000000-0000-4000-8000-000000000091','ISO other','CTO');
SELECT pg_temp.assert_ok(cargo_resumido IS NULL AND job_title='CTO','other WS no policy no derivation') FROM contacts WHERE id='90000000-0000-4000-8000-000000000005';
CREATE TEMP TABLE side_counts AS SELECT (SELECT count(*) FROM property_history) h,(SELECT count(*) FROM workflow_events) w,(SELECT count(*) FROM audit_logs) a;
CREATE TEMP TABLE timestamps AS SELECT id,updated_at FROM contacts;
SET LOCAL app.crm_derivation_backfill='wk-2026-10-16';
UPDATE contacts SET cargo_resumido='FORGED' WHERE id='90000000-0000-4000-8000-000000000001';
SELECT pg_temp.assert_ok((SELECT count(*) FROM property_history)=h AND (SELECT count(*) FROM workflow_events)=w AND (SELECT count(*) FROM audit_logs)=a,'maintenance no side effects') FROM side_counts;
SELECT pg_temp.assert_ok(c.updated_at=t.updated_at,'maintenance preserves updated_at') FROM contacts c JOIN timestamps t USING(id) WHERE c.id='90000000-0000-4000-8000-000000000001';
-- RLS assertions run as authenticated, never service_role.
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_ok(NOT EXISTS(SELECT 1 FROM contacts WHERE id='90000000-0000-4000-8000-000000000005'),'RLS hides other workspace');
SELECT pg_temp.assert_ok(NOT public.crm_is_derivation_backfill('{"workspace_id":"184b9435-0a9b-4334-9e89-8854dc883f5d"}','{"workspace_id":"184b9435-0a9b-4334-9e89-8854dc883f5d"}'),'authenticated cannot suppress audit');
RESET ROLE;
-- Explicit clear to an already NULL canonical field still records intent.
INSERT INTO leads(id,workspace_id,owner_id,first_name,hs_raw) VALUES('90000000-0000-4000-8000-000000000006','184b9435-0a9b-4334-9e89-8854dc883f5d','10000000-0000-4000-8000-000000000091','ISO empty','{}');
UPDATE leads SET job_title=NULL WHERE id='90000000-0000-4000-8000-000000000006';
UPDATE leads SET hs_raw='{"properties":{"hs_contact_job_title":"CTO"}}' WHERE id='90000000-0000-4000-8000-000000000006';
SELECT pg_temp.assert_ok(job_title IS NULL AND job_title_source='explicit','NULL-to-NULL clear survives later import') FROM leads WHERE id='90000000-0000-4000-8000-000000000006';
INSERT INTO view_as_sessions(id,workspace_id,admin_id,target_user_id,mode,read_only,nonce,session_id,expires_at) VALUES('91000000-0000-4000-8000-000000000001','184b9435-0a9b-4334-9e89-8854dc883f5d','10000000-0000-4000-8000-000000000091','10000000-0000-4000-8000-000000000091','role',true,'iso-derived','92000000-0000-4000-8000-000000000001',now()+interval '1 hour');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000091","role":"authenticated","session_id":"92000000-0000-4000-8000-000000000001"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_ok(public.is_read_only_view(),'readonly session recognized');
DO $$ DECLARE n integer; BEGIN
 UPDATE contacts SET job_title='FORGED' WHERE id='90000000-0000-4000-8000-000000000001';
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM pg_temp.assert_ok(n=0,'readonly cannot update real CRM row');
 UPDATE crm_derivation_catalog SET active=false WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d';
 GET DIAGNOSTICS n=ROW_COUNT;
 PERFORM pg_temp.assert_ok(n=0,'readonly cannot activate catalog');
END $$;
RESET ROLE;
ROLLBACK;
