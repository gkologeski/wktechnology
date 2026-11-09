DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['deals','quotes','proposals','contracts','services','projects','people','ats_jobs','subscriptions','contract_drafts','financial_recurrences'] LOOP
EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS legal_entity_id uuid REFERENCES public.legal_entities(id)',t);
EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(workspace_id,legal_entity_id) WHERE legal_entity_id IS NOT NULL',t||'_legal_entity_idx',t); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.record_legal_entity_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb:=to_jsonb(NEW); oldr jsonb; w uuid:=(r->>'workspace_id')::uuid; e uuid; pt text; pc text; pid uuid; pe uuid; key text:=COALESCE(TG_ARGV[0],'legal_entity_id');
BEGIN e:=(r->>key)::uuid;
IF TG_OP='UPDATE' THEN oldr:=to_jsonb(OLD); IF (oldr->>key) IS NOT DISTINCT FROM (r->>key) AND (oldr->>'workspace_id') IS NOT DISTINCT FROM (r->>'workspace_id') THEN RETURN NEW; END IF; END IF;
IF w IS NULL THEN RAISE EXCEPTION 'Workspace obrigatório para vincular o CNPJ.' USING ERRCODE='23514'; END IF;
IF e IS NULL AND key<>'legal_entity_id' THEN RETURN NEW; END IF;
IF e IS NULL THEN
IF TG_TABLE_NAME='contracts' THEN e:=(r->>'contracting_legal_entity_id')::uuid; ELSIF TG_TABLE_NAME='people' THEN e:=(r->>'hiring_legal_entity_id')::uuid; END IF;
FOR pt,pc IN SELECT * FROM (VALUES ('contracts','contract_id'),('contracts','commercial_contract_id'),('projects','project_id'),('proposals','proposal_id'),('quotes','quote_id'),('deals','deal_id'),('customer_invoices','invoice_id'),('services','service_id')) v(a,b) LOOP
EXIT WHEN e IS NOT NULL; pid:=(r->>pc)::uuid;
IF pid IS NOT NULL AND pt<>TG_TABLE_NAME THEN EXECUTE format('SELECT legal_entity_id FROM public.%I WHERE id=$1 AND workspace_id=$2',pt) INTO pe USING pid,w; e:=pe; END IF; END LOOP;
IF e IS NULL THEN SELECT id INTO e FROM public.legal_entities WHERE workspace_id=w AND is_default AND active; END IF;
NEW:=jsonb_populate_record(NEW,jsonb_build_object(key,e)); END IF;
IF e IS NULL THEN RAISE EXCEPTION 'Defina uma empresa (CNPJ) padrão ativa antes de cadastrar o registro.' USING ERRCODE='23514'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.legal_entities WHERE id=e AND workspace_id=w AND active) THEN RAISE EXCEPTION 'Empresa (CNPJ) inativa, inexistente ou de outro workspace.' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.record_legal_entity_guard() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; pt text; pc text; BEGIN FOREACH t IN ARRAY ARRAY['deals','quotes','proposals','contracts','services','projects','people','ats_jobs','subscriptions','contract_drafts','financial_recurrences'] LOOP
IF t='contracts' THEN EXECUTE 'UPDATE public.contracts c SET legal_entity_id=le.id FROM public.legal_entities le WHERE c.legal_entity_id IS NULL AND c.contracting_legal_entity_id=le.id AND c.workspace_id=le.workspace_id'; ELSIF t='people' THEN EXECUTE 'UPDATE public.people p SET legal_entity_id=le.id FROM public.legal_entities le WHERE p.legal_entity_id IS NULL AND p.hiring_legal_entity_id=le.id AND p.workspace_id=le.workspace_id'; END IF;
FOR pt,pc IN SELECT * FROM (VALUES ('contracts','contract_id'),('projects','project_id'),('proposals','proposal_id'),('quotes','quote_id'),('deals','deal_id'),('services','service_id')) v(a,b) LOOP
IF pt<>t AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name=pc) THEN EXECUTE format('UPDATE public.%I c SET legal_entity_id=p.legal_entity_id FROM public.%I p WHERE c.legal_entity_id IS NULL AND c.%I=p.id AND c.workspace_id=p.workspace_id AND p.legal_entity_id IS NOT NULL',t,pt,pc); END IF; END LOOP;
EXECUTE format('UPDATE public.%I r SET legal_entity_id=le.id FROM public.legal_entities le WHERE r.legal_entity_id IS NULL AND r.workspace_id=le.workspace_id AND le.is_default AND le.active',t); END LOOP; END $$;
DO $$ DECLARE t text; col text; BEGIN FOR t,col IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('legal_entity_id','contracting_legal_entity_id','hiring_legal_entity_id') AND table_name<>'legal_entity_group_members' LOOP
EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I,workspace_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.record_legal_entity_guard(%L)','cnpj_active_'||col,col,t,col); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public._legal_entity_usage_counts(_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE usage jsonb:='{}'; t text; col text; n bigint; BEGIN
FOR t,col IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('legal_entity_id','contracting_legal_entity_id','hiring_legal_entity_id') LOOP EXECUTE format('SELECT count(*) FROM public.%I WHERE %I=$1',t,col) INTO n USING _id; IF n>0 THEN usage:=usage||jsonb_build_object(t||'.'||col,n); END IF; END LOOP; RETURN usage; END $$;
REVOKE ALL ON FUNCTION public._legal_entity_usage_counts(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public._legal_entity_usage_counts(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.legal_entity_usage(_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.finance_business_authorize('legal_entities','view',_id); RETURN public._legal_entity_usage_counts(_id); END $$;
REVOKE ALL ON FUNCTION public.legal_entity_usage(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.legal_entity_usage(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.legal_entities_summary() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$ DECLARE w uuid; result jsonb; BEGIN
w:=public.finance_business_authorize('legal_entities','view',NULL);
SELECT coalesce(jsonb_agg(to_jsonb(summary) ORDER BY summary.name),'[]') INTO result FROM (
SELECT le.id,le.name,le.code,le.cnpj,le.is_default,le.active,jsonb_build_object('count',count(fe.id),'receivable',coalesce(sum(fe.amount) FILTER(WHERE fe.direction='receivable'),0),'payable',coalesce(sum(fe.amount) FILTER(WHERE fe.direction='payable'),0)) AS totals FROM public.legal_entities le LEFT JOIN public.financial_entries fe ON fe.legal_entity_id=le.id AND fe.workspace_id=w WHERE le.workspace_id=w GROUP BY le.id) summary; RETURN result; END $$;
REVOKE ALL ON FUNCTION public.legal_entities_summary() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.legal_entities_summary() TO authenticated,service_role;