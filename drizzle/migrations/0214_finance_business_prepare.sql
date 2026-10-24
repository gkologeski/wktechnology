-- Order 2, remaining Finance boundaries. Additive preparation, no role grants.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
SELECT 'techfinance.'||r||'.manage.workspace','techfinance',r,'manage','workspace',l,'Exige leitura da fatura no escopo autorizado; não concede outras ações.',true
FROM (VALUES ('invoice_issuance','Emitir cobrança de fatura'),('invoice_settlement','Registrar quitação manual de fatura'),('invoice_cancellation','Cancelar fatura'),('nfse_issuance','Solicitar emissão de NFS-e'))v(r,l)
ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.finance_business_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT COALESCE(_ctx->>'workspace'=_workspace::text AND _ctx->>'actor' IS NOT NULL
 AND _resource IN('categories','bank_accounts','cost_centers','legal_entities','legal_entity_groups','reports','audit','invoices','nfse','dunning','charging_templates')
 AND _action IN('view','create','update','delete','export','manage')
 AND (_action='view' OR NOT (_ctx->>'read_only')::boolean)
 AND (EXISTS(SELECT 1 FROM unnest(CASE WHEN _resource='invoices' THEN ARRAY['techfinance','techsales'] ELSE ARRAY['techfinance'] END)m
 WHERE (_ctx->'keys' ? (m||'.'||_resource||'.'||_action||'.workspace'))
 OR (_responsible::text=_ctx->>'actor' AND _ctx->'keys' ? (m||'.'||_resource||'.'||_action||'.own'))
 OR (_ctx->'team' ? _responsible::text AND _ctx->'keys' ? (m||'.'||_resource||'.'||_action||'.team')))),false)
$$;
CREATE OR REPLACE FUNCTION public.finance_business_authorize(_resource text,_action text,_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;r uuid;t text;BEGIN
 IF _id IS NOT NULL THEN
 t:=CASE _resource WHEN 'invoices' THEN 'customer_invoices' WHEN 'dunning' THEN 'dunning_policies' WHEN 'charging_templates' THEN 'charging_templates' WHEN 'legal_entities' THEN 'legal_entities' WHEN 'legal_entity_groups' THEN 'legal_entity_groups' END;
 IF t IS NULL THEN RAISE EXCEPTION 'Recurso inválido.' USING ERRCODE='22023';END IF;
 IF _resource IN('legal_entities','legal_entity_groups') THEN
 EXECUTE format('SELECT created_by FROM %I WHERE id=$1 AND workspace_id=$2',t) INTO r USING _id,w;
 ELSE EXECUTE format('SELECT %s FROM %I WHERE id=$1 AND workspace_id=$2',CASE WHEN _resource='invoices' THEN 'coalesce(assigned_to,owner_id)' ELSE 'owner_id' END,t) INTO r USING _id,w;END IF;
 IF r IS NULL AND NOT EXISTS(SELECT 1 FROM legal_entities WHERE _resource='legal_entities' AND id=_id AND workspace_id=w) THEN RAISE EXCEPTION 'Registro indisponível.' USING ERRCODE='42501';END IF;
 ELSE r:=CASE WHEN _resource IN('categories','bank_accounts','cost_centers','reports','audit','nfse') THEN NULL ELSE auth.uid() END;END IF;
 IF _id IS NULL AND _action='view' AND _resource IN('invoices','nfse','legal_entities','legal_entity_groups','dunning','charging_templates') THEN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(c->'keys')k WHERE k=ANY(ARRAY['techfinance.'||_resource||'.view.workspace','techfinance.'||_resource||'.view.team','techfinance.'||_resource||'.view.own']) OR (_resource='invoices' AND k=ANY(ARRAY['techsales.invoices.view.workspace','techsales.invoices.view.team','techsales.invoices.view.own']))) THEN RETURN w;END IF;
 END IF;
 IF NOT finance_business_access(c,w,_resource,_action,r) OR (_action<>'view' AND NOT finance_business_access(c,w,_resource,'view',r)) THEN RAISE EXCEPTION 'Ação financeira não autorizada.' USING ERRCODE='42501';END IF;
 RETURN w;
END $$;
-- Minimal shared catalog references. No balances, documents, settings or metadata.
CREATE OR REPLACE FUNCTION public.finance_reference_list(_resource text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN
 IF w IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_object_keys(c->'keys')k WHERE k ~ '^(techfinance|techsales|techcontracts|techpeople|techprojects)\..*\.(view|create|update)\.(own|team|workspace)$') THEN RAISE EXCEPTION 'Referência indisponível.' USING ERRCODE='42501';END IF;
 IF _resource='bank_accounts' AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(c->'keys')k WHERE k ~ '^techfinance\.(payments|bank_accounts)\.(view|create)\.(own|team|workspace)$') THEN RAISE EXCEPTION 'Referência bancária indisponível.' USING ERRCODE='42501';END IF;
 IF _resource='categories' AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(c->'keys')k WHERE k ~ '^techfinance\.(entries|recurrences|categories|reports)\.(view|create|update)\.(own|team|workspace)$') THEN RAISE EXCEPTION 'Referência contábil indisponível.' USING ERRCODE='42501';END IF;
 CASE _resource
 WHEN 'categories' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'parent_id',parent_id,'legal_entity_id',legal_entity_id)),'[]') INTO out_rows FROM financial_categories WHERE workspace_id=w;
 WHEN 'bank_accounts' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'currency',currency,'active',active,'legal_entity_id',legal_entity_id)),'[]') INTO out_rows FROM financial_bank_accounts WHERE workspace_id=w AND active;
 WHEN 'legal_entities' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'active',active,'is_default',is_default) ORDER BY name),'[]') INTO out_rows FROM legal_entities WHERE workspace_id=w;
 WHEN 'legal_entity_groups' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'code',g.code,'name',g.name,'active',g.active,'is_system',g.is_system,'member_ids',(SELECT coalesce(jsonb_agg(m.legal_entity_id),'[]') FROM legal_entity_group_members m WHERE m.group_id=g.id AND m.workspace_id=w))),'[]') INTO out_rows FROM legal_entity_groups g WHERE g.workspace_id=w;
 ELSE RAISE EXCEPTION 'Referência inválida.' USING ERRCODE='22023';END CASE;
 RETURN out_rows;
END $$;
CREATE OR REPLACE FUNCTION public.finance_set_default_entity(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE w uuid:=finance_business_authorize('legal_entities','update',_id);BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('finance-default:'||w,0));
 IF NOT EXISTS(SELECT 1 FROM legal_entities WHERE id=_id AND workspace_id=w AND active) THEN RAISE EXCEPTION 'Empresa indisponível.';END IF;
 UPDATE legal_entities SET is_default=false WHERE workspace_id=w AND is_default;
 UPDATE legal_entities SET is_default=true WHERE id=_id AND workspace_id=w;
 IF NOT FOUND THEN RAISE EXCEPTION 'Empresa indisponível.';END IF;
END $$;
CREATE OR REPLACE FUNCTION public.finance_set_group_members(_id uuid,_members uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE w uuid:=finance_business_authorize('legal_entity_groups','update',_id);BEGIN
 PERFORM 1 FROM legal_entity_groups WHERE id=_id AND workspace_id=w AND NOT is_system FOR UPDATE;
 IF NOT FOUND OR cardinality(_members)>500 OR EXISTS(SELECT 1 FROM unnest(_members)m WHERE NOT EXISTS(SELECT 1 FROM legal_entities WHERE id=m AND workspace_id=w)) THEN RAISE EXCEPTION 'Grupo ou empresas indisponíveis.' USING ERRCODE='42501';END IF;
 DELETE FROM legal_entity_group_members WHERE group_id=_id AND workspace_id=w;
 INSERT INTO legal_entity_group_members(group_id,legal_entity_id,workspace_id) SELECT _id,m,w FROM (SELECT DISTINCT unnest(_members)m)s;
END $$;
DO $$ DECLARE f regprocedure;BEGIN
 FOREACH f IN ARRAY ARRAY['public.finance_business_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_business_authorize(text,text,uuid)'::regprocedure,'public.finance_reference_list(text)'::regprocedure,'public.finance_set_default_entity(uuid)'::regprocedure,'public.finance_set_group_members(uuid,uuid[])'::regprocedure] LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);END LOOP;
END $$;

CREATE TABLE public.finance_invoice_sequences(workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,year integer NOT NULL,value bigint NOT NULL,PRIMARY KEY(workspace_id,year));
ALTER TABLE public.finance_invoice_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_invoice_sequences FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.finance_assign_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE y integer:=extract(year FROM now());n bigint;BEGIN
 UPDATE finance_invoice_sequences SET value=value+1 WHERE workspace_id=NEW.workspace_id AND year=y RETURNING value INTO n;
 IF n IS NULL THEN
 INSERT INTO finance_invoice_sequences(workspace_id,year,value)
 SELECT NEW.workspace_id,y,coalesce(max(substring(invoice_number from '^INV-[0-9]{4}-([0-9]+)$')::bigint),0)+1 FROM customer_invoices WHERE workspace_id=NEW.workspace_id AND invoice_number LIKE 'INV-'||y||'-%'
 ON CONFLICT(workspace_id,year) DO UPDATE SET value=finance_invoice_sequences.value+1 RETURNING value INTO n;
 END IF;
 NEW.invoice_number:='INV-'||y||'-'||CASE WHEN n<100000 THEN lpad(n::text,5,'0') ELSE n::text END;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.finance_assign_invoice_number() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.finance_business_capabilities(_resource text,_ids uuid[])
RETURNS TABLE(id uuid,can_update boolean,can_delete boolean,can_settle boolean,can_issue boolean,can_cancel boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE t text;own text;c jsonb:=finance_access_context();BEGIN
 IF cardinality(_ids)>500 THEN RAISE EXCEPTION 'Limite excedido.';END IF;
 t:=CASE _resource WHEN 'invoices' THEN 'customer_invoices' WHEN 'dunning' THEN 'dunning_policies' WHEN 'charging_templates' THEN 'charging_templates' WHEN 'legal_entities' THEN 'legal_entities' WHEN 'legal_entity_groups' THEN 'legal_entity_groups' WHEN 'categories' THEN 'financial_categories' WHEN 'bank_accounts' THEN 'financial_bank_accounts' END;
 IF t IS NULL THEN RAISE EXCEPTION 'Recurso inválido.';END IF;
 own:=CASE WHEN _resource='invoices' THEN 'coalesce(assigned_to,owner_id)' WHEN _resource IN('dunning','charging_templates') THEN 'owner_id' WHEN _resource IN('legal_entities','legal_entity_groups') THEN 'created_by' ELSE 'NULL::uuid' END;
 RETURN QUERY EXECUTE format('SELECT id,finance_business_access($1,workspace_id,$2,''update'',%s),finance_business_access($1,workspace_id,$2,''delete'',%s), finance_business_access($1,workspace_id,$2,''update'',%s) AND ($1->''keys'' ? ''techfinance.invoice_settlement.manage.workspace''), finance_business_access($1,workspace_id,$2,''update'',%s) AND ($1->''keys'' ? ''techfinance.invoice_issuance.manage.workspace''),finance_business_access($1,workspace_id,$2,''update'',%s) AND ($1->''keys'' ? ''techfinance.invoice_cancellation.manage.workspace'') FROM %I WHERE id=ANY($3) AND finance_business_access($1,workspace_id,$2,''view'',%s)',own,own,own,own,own,t,own) USING c,_resource,_ids;
END $$;
REVOKE ALL ON FUNCTION public.finance_business_capabilities(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_business_capabilities(text,uuid[]) TO authenticated;

-- Durable claim before any outbound effect. Never retry an uncertain effect automatically.
CREATE TABLE public.finance_dunning_attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES workspaces(id),run_id uuid NOT NULL REFERENCES dunning_runs(id) ON DELETE CASCADE,step integer NOT NULL,token uuid NOT NULL DEFAULT gen_random_uuid(),status text NOT NULL DEFAULT 'claimed',result jsonb,created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,UNIQUE(run_id,step));
ALTER TABLE public.finance_dunning_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON finance_dunning_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON finance_dunning_attempts TO service_role;
CREATE UNIQUE INDEX dunning_policy_invoice_unique ON dunning_runs(policy_id,invoice_id);
CREATE OR REPLACE FUNCTION public.finance_dunning_allowed(_policy uuid,_invoice uuid,_channel text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p dunning_policies;i customer_invoices;c jsonb;k jsonb;t jsonb;BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Serviço exclusivo.' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM dunning_policies WHERE id=_policy;
 SELECT * INTO i FROM customer_invoices WHERE id=_invoice AND workspace_id=p.workspace_id;
 IF p.id IS NULL OR i.id IS NULL OR NOT p.active OR p.segment_id IS NOT NULL OR NOT is_workspace_member(p.workspace_id,p.owner_id) THEN RETURN false;END IF;
 SELECT coalesce(jsonb_object_agg(x,true),'{}') INTO k FROM user_effective_permissions(p.owner_id,p.workspace_id)x;
 SELECT coalesce(jsonb_object_agg(b.user_id::text,true),'{}') INTO t FROM user_group_members a JOIN user_groups g ON g.id=a.group_id JOIN user_group_members b ON b.group_id=a.group_id WHERE a.user_id=p.owner_id AND g.workspace_id=p.workspace_id AND b.user_id IS NOT NULL;
 c:=jsonb_build_object('workspace',p.workspace_id,'actor',p.owner_id,'keys',k,'team',t,'read_only',false);
 RETURN k ? 'techfinance.dunning.manage.workspace'
 AND finance_business_access(c,p.workspace_id,'dunning','view',p.owner_id)
 AND finance_business_access(c,i.workspace_id,'invoices','view',coalesce(i.assigned_to,i.owner_id))
 AND CASE _channel WHEN 'email' THEN k ?| ARRAY['techsales.emails.create.own','techsales.inbox.email.create.own','techsales.inbox.email.create.workspace'] WHEN 'whatsapp' THEN k ?| ARRAY['techsales.whatsapp.create.own','techsales.inbox.whatsapp.create.own','techsales.inbox.whatsapp.create.workspace'] WHEN 'task' THEN k ? 'techsales.activities.create.own' WHEN 'escalation' THEN k ? 'techsales.activities.create.own' ELSE _channel IS NULL END;
END $$;
CREATE OR REPLACE FUNCTION public.finance_dunning_enroll()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Serviço exclusivo.' USING ERRCODE='42501';END IF;
 INSERT INTO dunning_runs(workspace_id,policy_id,invoice_id,current_step,next_run_at,status,history)
 SELECT p.workspace_id,p.id,i.id,0,(i.due_date+coalesce((p.steps->0->>'offset_days')::integer,0))::timestamptz,'active','[]'::jsonb FROM dunning_policies p JOIN customer_invoices i ON i.workspace_id=p.workspace_id WHERE p.active AND p.is_default AND p.segment_id IS NULL AND i.status IN('open','overdue') AND i.due_date<=current_date AND finance_dunning_allowed(p.id,i.id) ON CONFLICT(policy_id,invoice_id) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.finance_dunning_claim(_run uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r dunning_runs;p dunning_policies;i customer_invoices;a finance_dunning_attempts;s jsonb;BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Serviço exclusivo.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM dunning_runs WHERE id=_run FOR UPDATE;
 IF r.id IS NULL OR r.status<>'active' OR r.next_run_at IS NULL OR r.next_run_at>now() THEN RETURN NULL;END IF;
 SELECT * INTO p FROM dunning_policies WHERE id=r.policy_id AND workspace_id=r.workspace_id;
 SELECT * INTO i FROM customer_invoices WHERE id=r.invoice_id AND workspace_id=r.workspace_id;
 s:=p.steps->r.current_step;
 IF i.id IS NULL OR p.id IS NULL OR i.status NOT IN('open','overdue') OR NOT finance_dunning_allowed(p.id,i.id,s->>'channel') THEN
 UPDATE dunning_runs SET status='paused',next_run_at=NULL,history=history||jsonb_build_array(jsonb_build_object('at',now(),'status','blocked','reason','Origem, estado ou autorização indisponível')) WHERE id=r.id;RETURN NULL;END IF;
 IF s IS NULL THEN UPDATE dunning_runs SET status='completed',next_run_at=NULL WHERE id=r.id;RETURN NULL;END IF;
 INSERT INTO finance_dunning_attempts(workspace_id,run_id,step) VALUES(r.workspace_id,r.id,r.current_step) ON CONFLICT(run_id,step) DO NOTHING RETURNING * INTO a;
 IF a.id IS NULL THEN RETURN NULL;END IF;
 UPDATE dunning_runs SET next_run_at=NULL,history=history||jsonb_build_array(jsonb_build_object('at',now(),'status','claimed','step',r.current_step,'attempt_id',a.id)) WHERE id=r.id;
 RETURN jsonb_build_object('attempt_id',a.id,'token',a.token,'invoice',to_jsonb(i),'policy',to_jsonb(p),'step',s);
END $$;
CREATE OR REPLACE FUNCTION public.finance_dunning_finish(_attempt uuid,_token uuid,_result jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a finance_dunning_attempts;r dunning_runs;p dunning_policies;i customer_invoices;ok boolean;next_step jsonb;BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Serviço exclusivo.' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM finance_dunning_attempts WHERE id=_attempt AND token=_token FOR UPDATE;
 IF a.id IS NULL OR a.status<>'claimed' THEN RETURN false;END IF;
 SELECT * INTO r FROM dunning_runs WHERE id=a.run_id FOR UPDATE;
 SELECT * INTO p FROM dunning_policies WHERE id=r.policy_id AND workspace_id=r.workspace_id;
 SELECT * INTO i FROM customer_invoices WHERE id=r.invoice_id AND workspace_id=r.workspace_id;
 ok:=_result->>'status' IN('sent','suppressed','task_created','escalated');next_step:=p.steps->(a.step+1);
 UPDATE finance_dunning_attempts SET status=CASE WHEN ok THEN 'completed' ELSE 'unconfirmed' END,result=_result,finished_at=now() WHERE id=a.id;
 UPDATE dunning_runs SET current_step=CASE WHEN ok THEN a.step+1 ELSE a.step END,
 status=CASE WHEN NOT ok OR NOT finance_dunning_allowed(p.id,i.id) THEN 'paused' WHEN next_step IS NULL THEN 'completed' ELSE 'active' END,
 next_run_at=CASE WHEN ok AND next_step IS NOT NULL AND finance_dunning_allowed(p.id,i.id) THEN greatest(now()+interval '1 minute',(i.due_date+(next_step->>'offset_days')::integer)::timestamptz) END,
 history=history||jsonb_build_array(_result||jsonb_build_object('attempt_id',a.id,'step',a.step,'at',now())) WHERE id=r.id;
 RETURN true;
END $$;
DO $$ DECLARE f regprocedure;BEGIN
 FOREACH f IN ARRAY ARRAY['public.finance_dunning_allowed(uuid,uuid,text)'::regprocedure,'public.finance_dunning_enroll()'::regprocedure,'public.finance_dunning_claim(uuid)'::regprocedure,'public.finance_dunning_finish(uuid,uuid,jsonb)'::regprocedure] LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);END LOOP;END $$;

-- Legacy TechPeople billing still uses caller RLS and the project measurement guard.
-- The invoice and all source links commit together, or neither is created.
CREATE OR REPLACE FUNCTION public.finance_invoice_from_timesheet(_allocation uuid,_start date,_end date,_due date,_description text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE w uuid:=finance_business_authorize('invoices','create');a people_allocations;co contracts;ids uuid[];hours numeric;amount numeric;i customer_invoices;n integer;BEGIN
 IF _due IS NULL OR (_start IS NOT NULL AND _end IS NOT NULL AND _start>_end) THEN RAISE EXCEPTION 'Datas inválidas.' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('timesheet-invoice:'||_allocation,0));
 SELECT * INTO a FROM people_allocations WHERE id=_allocation AND workspace_id=w FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Alocação indisponível.' USING ERRCODE='42501';END IF;
 IF a.contract_id IS NOT NULL THEN SELECT * INTO co FROM contracts WHERE id=a.contract_id AND workspace_id=w;IF co.id IS NULL THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;END IF;
 -- Lock only visible approved, billable and unreserved records. Existing project
 -- triggers also reject records measured/closed between validation and write.
 SELECT array_agg(x.id),sum(x.hours),round(sum(x.hours*x.hourly_rate),2) INTO ids,hours,amount FROM
 (SELECT id,hours,hourly_rate FROM project_time_entries WHERE workspace_id=w AND allocation_id=a.id AND billable AND invoice_id IS NULL AND approved_at IS NOT NULL AND financial_entry_id IS NULL AND (_start IS NULL OR entry_date>=_start) AND (_end IS NULL OR entry_date<=_end) FOR UPDATE)x;
 IF ids IS NULL OR amount IS NULL OR amount<=0 THEN RAISE EXCEPTION 'Nenhuma hora aprovada e disponível para faturamento.' USING ERRCODE='23514';END IF;
 INSERT INTO customer_invoices(workspace_id,owner_id,invoice_number,description,amount,currency,due_date,status,gateway,payment_method,company_id)
 VALUES(w,auth.uid(),'assigned-by-trigger',left(coalesce(_description,'Faturamento de horas — '||coalesce(co.contract_number,co.title,'sem contrato')||' · '||hours||'h'),2000),amount,coalesce(a.currency,'BRL'),_due,'draft','manual','manual',co.company_id) RETURNING * INTO i;
 UPDATE project_time_entries SET invoice_id=i.id,invoiced_at=now() WHERE id=ANY(ids) AND workspace_id=w AND invoice_id IS NULL;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>cardinality(ids) THEN RAISE EXCEPTION 'Nem todos os apontamentos foram autorizados; nenhuma fatura criada.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('invoice',to_jsonb(i),'entries_linked',n,'total_hours',hours,'total_amount',amount);
END $$;
REVOKE ALL ON FUNCTION public.finance_invoice_from_timesheet(uuid,date,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_invoice_from_timesheet(uuid,date,date,date,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.finance_upsert_dunning(_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE i uuid:=(_data->>'id')::uuid;w uuid:=finance_business_authorize('dunning',CASE WHEN i IS NULL THEN 'create' ELSE 'update' END,i);p dunning_policies;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('dunning-default:'||w,0));
 IF coalesce((_data->>'is_default')::boolean,false) THEN UPDATE dunning_policies SET is_default=false WHERE workspace_id=w AND is_default AND (i IS NULL OR id<>i);END IF;
 IF i IS NULL THEN
 INSERT INTO dunning_policies(workspace_id,owner_id,name,active,is_default,segment_id,steps) VALUES(w,auth.uid(),_data->>'name',(_data->>'active')::boolean,(_data->>'is_default')::boolean,(_data->>'segment_id')::uuid,_data->'steps') RETURNING * INTO p;
 ELSE UPDATE dunning_policies SET name=_data->>'name',active=(_data->>'active')::boolean,is_default=(_data->>'is_default')::boolean,segment_id=(_data->>'segment_id')::uuid,steps=_data->'steps' WHERE id=i AND workspace_id=w RETURNING * INTO p;END IF;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Régua indisponível.' USING ERRCODE='42501';END IF;
 RETURN to_jsonb(p);
END $$;
REVOKE ALL ON FUNCTION public.finance_upsert_dunning(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_upsert_dunning(jsonb) TO authenticated;

CREATE UNIQUE INDEX dunning_active_default_unique ON public.dunning_policies(workspace_id) WHERE is_default AND active;

-- Private per-job scheduler credentials. No secret is returned by migrations or RPCs.
DO $$ DECLARE j text;BEGIN
 FOREACH j IN ARRAY ARRAY['dunning','recurrences','banking'] LOOP
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='techerp_finance_cron_'||j) THEN
 PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'techerp_finance_cron_'||j,'Private TechFinance scheduler credential, one job only');END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.finance_verify_cron_token(_job text,_token text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE expected text;BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Serviço exclusivo.' USING ERRCODE='42501';END IF;
 IF _job NOT IN('dunning','recurrences','banking') OR _token IS NULL OR _token !~ '^[0-9a-f]{64}$' THEN RETURN false;END IF;
 SELECT decrypted_secret INTO expected FROM vault.decrypted_secrets WHERE name='techerp_finance_cron_'||_job;
 RETURN coalesce(extensions.digest(_token,'sha256')=extensions.digest(expected,'sha256'),false);
END $$;
REVOKE ALL ON FUNCTION public.finance_verify_cron_token(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finance_verify_cron_token(text,text) TO service_role;
