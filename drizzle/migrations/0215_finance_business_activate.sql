-- Activate only after publication of compatible handlers and shared selectors.
DO $$ DECLARE t text;p record;BEGIN
 FOREACH t IN ARRAY ARRAY['financial_categories','financial_bank_accounts','financial_cost_centers','legal_entities','legal_entity_groups','legal_entity_group_members','customer_invoices','customer_payments','nfse_invoices','dunning_policies','dunning_runs','charging_templates'] LOOP
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);END LOOP;
 END LOOP;
END $$;
DO $$ DECLARE t text;r text;own text;BEGIN
 FOR t,r,own IN SELECT * FROM (VALUES ('financial_categories','categories','NULL::uuid'),('financial_bank_accounts','bank_accounts','NULL::uuid'),('financial_cost_centers','cost_centers','NULL::uuid'),('legal_entities','legal_entities','created_by'),('legal_entity_groups','legal_entity_groups','created_by'),('customer_invoices','invoices','COALESCE(assigned_to,owner_id)'),('dunning_policies','dunning','owner_id'),('charging_templates','charging_templates','owner_id'))v(t,r,o) LOOP
 EXECUTE format('CREATE POLICY finance_business_view ON %I FOR SELECT TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',%s))',t,r,own);
 EXECUTE format('CREATE POLICY finance_business_create ON %I FOR INSERT TO authenticated WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''create'',%s) AND finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',%s))',t,r,own,r,own);
 EXECUTE format('CREATE POLICY finance_business_update ON %I FOR UPDATE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''update'',%s) AND finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',%s)) WITH CHECK(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',%s))',t,r,own,r,own,r,own);
 EXECUTE format('CREATE POLICY finance_business_delete ON %I FOR DELETE TO authenticated USING(finance_business_access((SELECT finance_access_context()),workspace_id,%L,''delete'',%s) AND finance_business_access((SELECT finance_access_context()),workspace_id,%L,''view'',%s))',t,r,own,r,own);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.finance_invoice_visible(_id uuid,_workspace uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT finance_business_access(finance_access_context(),workspace_id,'invoices','view',coalesce(assigned_to,owner_id)) FROM customer_invoices WHERE id=_id AND workspace_id=_workspace),false)
$$;
REVOKE ALL ON FUNCTION public.finance_invoice_visible(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_invoice_visible(uuid,uuid) TO authenticated;
CREATE POLICY finance_business_view ON customer_payments FOR SELECT TO authenticated USING(finance_invoice_visible(invoice_id,workspace_id));
CREATE OR REPLACE FUNCTION public.finance_nfse_visible(_invoice uuid,_workspace uuid,_responsible uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT finance_business_access(finance_access_context(),i.workspace_id,'invoices','view',coalesce(i.assigned_to,i.owner_id)) AND finance_business_access(finance_access_context(),i.workspace_id,'nfse','view',coalesce(_responsible,i.assigned_to,i.owner_id)) FROM customer_invoices i WHERE i.id=_invoice AND i.workspace_id=_workspace),false)
$$;
REVOKE ALL ON FUNCTION public.finance_nfse_visible(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_nfse_visible(uuid,uuid,uuid) TO authenticated;
CREATE POLICY finance_business_view ON nfse_invoices FOR SELECT TO authenticated USING(finance_nfse_visible(invoice_id,workspace_id,assigned_to));
CREATE POLICY finance_business_view ON dunning_runs FOR SELECT TO authenticated USING(finance_invoice_visible(invoice_id,workspace_id) AND EXISTS(SELECT 1 FROM dunning_policies p WHERE p.id=policy_id AND p.workspace_id=dunning_runs.workspace_id));
CREATE POLICY finance_business_view ON legal_entity_group_members FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM legal_entity_groups g WHERE g.id=group_id AND g.workspace_id=legal_entity_group_members.workspace_id));
CREATE POLICY finance_business_members ON legal_entity_group_members FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM legal_entity_groups g WHERE g.id=group_id AND g.workspace_id=legal_entity_group_members.workspace_id AND NOT g.is_system AND finance_business_access((SELECT finance_access_context()),g.workspace_id,'legal_entity_groups','update',g.created_by))) WITH CHECK(EXISTS(SELECT 1 FROM legal_entity_groups g WHERE g.id=group_id AND g.workspace_id=legal_entity_group_members.workspace_id AND NOT g.is_system AND finance_business_access((SELECT finance_access_context()),g.workspace_id,'legal_entity_groups','update',g.created_by)) AND EXISTS(SELECT 1 FROM legal_entities e WHERE e.id=legal_entity_id AND e.workspace_id=legal_entity_group_members.workspace_id));
-- Provider history cannot be forged through generic CRUD or authenticated REST.
REVOKE INSERT,UPDATE,DELETE ON customer_payments,nfse_invoices,dunning_runs FROM authenticated,anon;
REVOKE ALL ON payment_webhook_events FROM authenticated,anon;
-- Legal entity settings have their own protected settings RPC; catalog reads exclude secrets.
REVOKE SELECT ON legal_entities FROM authenticated;
DO $$ DECLARE cols text;BEGIN
 SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute WHERE attrelid='public.legal_entities'::regclass AND attnum>0 AND NOT attisdropped AND attname NOT IN('nfse_settings','payments_settings');
 EXECUTE 'GRANT SELECT('||cols||') ON legal_entities TO authenticated';
END $$;
CREATE OR REPLACE FUNCTION public.finance_business_write_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;o jsonb;c jsonb;f record;refw uuid;key_name text;BEGIN
 IF auth.role()='service_role' OR (auth.uid() IS NULL AND session_user='postgres') THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;END IF;
 -- Only trusted nested system-group maintenance may bypass catalog user actions.
 IF pg_trigger_depth()>1 AND TG_TABLE_NAME IN('legal_entity_groups','legal_entity_group_members') THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;END IF;
 c:=finance_access_context();
 IF n->>'workspace_id' IS DISTINCT FROM c->>'workspace' OR coalesce((c->>'read_only')::boolean,true) THEN RAISE EXCEPTION 'Workspace ou sessão inválida.' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' THEN
 o:=to_jsonb(OLD);
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['id','workspace_id','owner_id','created_by','created_at'])k WHERE n->k IS DISTINCT FROM o->k) THEN RAISE EXCEPTION 'Identidade e autoria são imutáveis.' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='INSERT' AND ((n ? 'owner_id' AND n->>'owner_id' IS DISTINCT FROM auth.uid()::text) OR (n ? 'created_by' AND n->>'created_by' IS DISTINCT FROM auth.uid()::text)) THEN RAISE EXCEPTION 'Autoria inválida.' USING ERRCODE='42501';END IF;
 IF TG_OP<>'DELETE' THEN
 -- Validate every single-column FK whose target has a workspace, including fields not exposed by a form.
 FOR f IN SELECT a.attname col,cl.relname target,ta.attname target_col FROM pg_constraint co JOIN pg_class cl ON cl.oid=co.confrelid JOIN pg_attribute a ON a.attrelid=co.conrelid AND a.attnum=co.conkey[1] JOIN pg_attribute ta ON ta.attrelid=co.confrelid AND ta.attnum=co.confkey[1] WHERE co.conrelid=TG_RELID AND co.contype='f' AND cardinality(co.conkey)=1 AND EXISTS(SELECT 1 FROM pg_attribute wa WHERE wa.attrelid=co.confrelid AND wa.attname='workspace_id' AND NOT wa.attisdropped) LOOP
 IF n->>f.col IS NOT NULL THEN
 EXECUTE format('SELECT workspace_id FROM %I WHERE %I=$1',f.target,f.target_col) INTO refw USING (n->>f.col)::uuid;
 IF refw IS DISTINCT FROM (n->>'workspace_id')::uuid THEN RAISE EXCEPTION 'Vínculo indisponível no workspace.' USING ERRCODE='23514';END IF;
 END IF;END LOOP;
 IF n->>'assigned_to' IS NOT NULL AND NOT is_workspace_member((n->>'workspace_id')::uuid,(n->>'assigned_to')::uuid) THEN RAISE EXCEPTION 'Responsável inativo ou externo.' USING ERRCODE='23514';END IF;
 END IF;
 IF TG_OP='DELETE' AND TG_TABLE_NAME IN('financial_categories','financial_bank_accounts','financial_cost_centers','legal_entities','legal_entity_groups','charging_templates') THEN
 FOR f IN SELECT a.attname col,cl.relname target FROM pg_constraint co JOIN pg_class cl ON cl.oid=co.conrelid JOIN pg_attribute a ON a.attrelid=co.conrelid AND a.attnum=co.conkey[1] WHERE co.confrelid=TG_RELID AND co.contype='f' AND cardinality(co.conkey)=1 AND cl.relname<>'legal_entity_group_members' LOOP
 EXECUTE format('SELECT CASE WHEN EXISTS(SELECT 1 FROM %I WHERE %I=$1) THEN $2 END',f.target,f.col) INTO refw USING (n->>'id')::uuid,(n->>'workspace_id')::uuid;
 IF refw IS NOT NULL THEN RAISE EXCEPTION 'Cadastro em uso; desative em vez de excluir.' USING ERRCODE='23514';END IF;END LOOP;
 IF TG_TABLE_NAME='charging_templates' AND EXISTS(SELECT 1 FROM dunning_policies p CROSS JOIN LATERAL jsonb_array_elements(p.steps)x WHERE x->>'template_id'=n->>'id') THEN RAISE EXCEPTION 'Modelo vinculado a régua; exclusão indisponível.' USING ERRCODE='23514';END IF;
 END IF;
 IF TG_OP<>'DELETE' AND TG_TABLE_NAME IN('financial_categories','financial_cost_centers') AND n->>'parent_id' IS NOT NULL THEN
 IF n->>'parent_id'=n->>'id' THEN RAISE EXCEPTION 'Hierarquia circular não permitida.' USING ERRCODE='23514';END IF;
 EXECUTE format('WITH RECURSIVE ancestors AS (SELECT id,parent_id,ARRAY[id] path FROM %I WHERE id=$1 UNION ALL SELECT p.id,p.parent_id,a.path||p.id FROM %I p JOIN ancestors a ON p.id=a.parent_id WHERE NOT p.id=ANY(a.path)) SELECT workspace_id FROM %I WHERE id=$2 AND (id=$1 OR EXISTS(SELECT 1 FROM ancestors WHERE id=$2))',TG_TABLE_NAME,TG_TABLE_NAME,TG_TABLE_NAME) INTO refw USING (n->>'parent_id')::uuid,(n->>'id')::uuid;
 IF refw IS NOT NULL THEN RAISE EXCEPTION 'Hierarquia circular não permitida.' USING ERRCODE='23514';END IF;
 END IF;
 IF TG_TABLE_NAME='customer_invoices' THEN
 IF TG_OP='INSERT' THEN NEW.issued_at:=now();END IF;
 IF TG_OP<>'DELETE' AND (NEW.amount<0 OR NEW.amount::text IN('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Valor inválido.' USING ERRCODE='23514';END IF;
 IF TG_OP='INSERT' AND (NEW.status<>'draft' OR NEW.paid_at IS NOT NULL OR NEW.cancelled_at IS NOT NULL OR NEW.external_id IS NOT NULL OR NEW.payment_url IS NOT NULL OR NEW.barcode IS NOT NULL OR NEW.pix_qr_code IS NOT NULL OR NEW.pix_copy_paste IS NOT NULL OR NEW.gateway_mode<>'sandbox') THEN RAISE EXCEPTION 'Faturas iniciam como rascunho.' USING ERRCODE='23514';END IF;
 IF TG_OP='DELETE' AND (OLD.status<>'draft' OR EXISTS(SELECT 1 FROM customer_payments WHERE invoice_id=OLD.id) OR EXISTS(SELECT 1 FROM nfse_invoices WHERE invoice_id=OLD.id) OR EXISTS(SELECT 1 FROM dunning_runs WHERE invoice_id=OLD.id) OR EXISTS(SELECT 1 FROM project_time_entries WHERE invoice_id=OLD.id)) THEN RAISE EXCEPTION 'Fatura possui histórico; exclusão não permitida.' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' THEN
 IF (o - ARRAY['status','paid_at','cancelled_at','updated_at']) IS DISTINCT FROM (n - ARRAY['status','paid_at','cancelled_at','updated_at']) AND OLD.status<>'draft' THEN RAISE EXCEPTION 'Condições de fatura emitida são imutáveis.' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['external_id','payment_url','barcode','pix_qr_code','pix_copy_paste','gateway_mode','issued_at'])k WHERE n->k IS DISTINCT FROM o->k) THEN RAISE EXCEPTION 'Dados do provedor são protegidos.' USING ERRCODE='42501';END IF;
 IF NEW.status IS DISTINCT FROM OLD.status THEN
 key_name:=CASE WHEN NEW.status='paid' AND NEW.gateway='manual' AND OLD.status IN('draft','open','overdue') THEN 'invoice_settlement' WHEN NEW.status='cancelled' AND OLD.status IN('draft','open','overdue') THEN 'invoice_cancellation' WHEN NEW.status='open' AND OLD.status='draft' AND NEW.gateway='manual' THEN 'invoice_issuance' END;
 IF key_name IS NULL OR NOT (c->'keys' ? ('techfinance.'||key_name||'.manage.workspace')) THEN RAISE EXCEPTION 'Transição de fatura não autorizada.' USING ERRCODE='42501';END IF;
 IF NEW.status='open' THEN NEW.issued_at:=now();END IF;
 NEW.paid_at:=CASE WHEN NEW.status='paid' THEN now() ELSE OLD.paid_at END;NEW.cancelled_at:=CASE WHEN NEW.status='cancelled' THEN now() ELSE OLD.cancelled_at END;
 ELSIF NEW.paid_at IS DISTINCT FROM OLD.paid_at OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN RAISE EXCEPTION 'Datas de liquidação são protegidas.' USING ERRCODE='42501';END IF;
 END IF;
 END IF;
 IF TG_TABLE_NAME='financial_bank_accounts' AND TG_OP<>'DELETE' AND ((TG_OP='INSERT' AND (n->>'bank_connection_id' IS NOT NULL OR n->>'external_account_id' IS NOT NULL)) OR (TG_OP='UPDATE' AND (n->'bank_connection_id' IS DISTINCT FROM o->'bank_connection_id' OR n->'external_account_id' IS DISTINCT FROM o->'external_account_id'))) AND NOT banking_access((n->>'workspace_id')::uuid,'connect') THEN RAISE EXCEPTION 'Vínculo ao provedor exige configuração bancária.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='legal_entities' AND TG_OP='INSERT' AND (coalesce(n->'payments_settings','{}') NOT IN('{}'::jsonb,'null'::jsonb) OR coalesce(n->'nfse_settings','{}') NOT IN('{}'::jsonb,'null'::jsonb)) THEN RAISE EXCEPTION 'Configurações sensíveis não pertencem ao cadastro básico.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='legal_entities' AND TG_OP='UPDATE' AND (n->'payments_settings' IS DISTINCT FROM o->'payments_settings' OR n->'nfse_settings' IS DISTINCT FROM o->'nfse_settings') THEN RAISE EXCEPTION 'Use a configuração de pagamentos/fiscal autorizada.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='legal_entity_groups' AND (coalesce((n->>'is_system')::boolean,false) OR (TG_OP='UPDATE' AND n->'is_system' IS DISTINCT FROM o->'is_system')) AND pg_trigger_depth()=1 THEN RAISE EXCEPTION 'Grupo de sistema protegido.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='dunning_policies' AND TG_OP<>'DELETE' THEN
 IF n->>'segment_id' IS NOT NULL THEN RAISE EXCEPTION 'Segmentação de cobrança ainda indisponível; não será ignorada.' USING ERRCODE='23514';END IF;
 IF ((n->>'active')::boolean OR (n->>'is_default')::boolean) AND NOT (c->'keys' ? 'techfinance.dunning.manage.workspace') THEN RAISE EXCEPTION 'Ativação exige gerenciar cobrança.' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(n->'steps')s WHERE s->>'template_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM charging_templates t WHERE t.id=(s->>'template_id')::uuid AND t.workspace_id=(n->>'workspace_id')::uuid AND t.channel=s->>'channel' AND t.active)) THEN RAISE EXCEPTION 'Modelo de cobrança indisponível.' USING ERRCODE='23514';END IF;
 END IF;
 IF TG_OP='DELETE' AND TG_TABLE_NAME='dunning_policies' AND EXISTS(SELECT 1 FROM dunning_runs WHERE policy_id=(n->>'id')::uuid) THEN RAISE EXCEPTION 'Régua possui histórico; desative em vez de excluir.' USING ERRCODE='23514';END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION public.finance_business_write_guard() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['financial_categories','financial_bank_accounts','financial_cost_centers','legal_entities','legal_entity_groups','legal_entity_group_members','customer_invoices','dunning_policies','charging_templates'] LOOP
 EXECUTE format('CREATE TRIGGER finance_business_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION finance_business_write_guard()',t);END LOOP;
END $$;

CREATE TRIGGER finance_invoice_number BEFORE INSERT ON customer_invoices FOR EACH ROW EXECUTE FUNCTION finance_assign_invoice_number();

DO $$ DECLARE t text;cols text;BEGIN
 FOREACH t IN ARRAY ARRAY['customer_payments','nfse_invoices'] LOOP
 EXECUTE format('REVOKE SELECT ON %I FROM authenticated',t);
 SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute WHERE attrelid=('public.'||t)::regclass AND attnum>0 AND NOT attisdropped AND attname<>'raw';
 EXECUTE format('GRANT SELECT(%s) ON %I TO authenticated',cols,t);END LOOP;
END $$;

-- Keep the original schedules and active state; replace only authenticated endpoint calls.
DO $$ DECLARE j record;base text;cmd text;BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
 SELECT substring(command from $q$url[[:space:]]*:?=[[:space:]]*'([^']+)'$q$) INTO base FROM cron.job WHERE jobname='banking-tick';
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname IN('dunning-tick','recurrences-tick','banking-tick')) AND (base IS NULL OR base !~ '^https://[^/]+/api/public/hooks/banking-tick$') THEN RAISE EXCEPTION 'Origem segura do agendador financeiro não encontrada.';END IF;
 FOR j IN SELECT jobid,replace(jobname,'-tick','') AS kind FROM cron.job WHERE jobname IN('dunning-tick','recurrences-tick','banking-tick') LOOP
 cmd:=format('SELECT net.http_post(url:=%L,headers:=jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer ''||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=%L)),body:=''{}''::jsonb);',replace(base,'banking-tick',j.kind||'-tick'),'techerp_finance_cron_'||j.kind);
 PERFORM cron.alter_job(j.jobid,command:=cmd);
 END LOOP;END IF;
END $$;
REVOKE SELECT(payments_settings,nfse_settings) ON legal_entities FROM PUBLIC,anon,authenticated;
REVOKE SELECT(raw) ON customer_payments,nfse_invoices FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='techerp_api_subject') THEN
 REVOKE SELECT ON legal_entities,customer_payments,nfse_invoices FROM techerp_api_subject;
 REVOKE SELECT(payments_settings,nfse_settings) ON legal_entities FROM techerp_api_subject;
 REVOKE SELECT(raw) ON customer_payments,nfse_invoices FROM techerp_api_subject;
 END IF;
END $$;
