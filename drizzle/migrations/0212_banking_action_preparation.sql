-- Additive preparation. No business-role grants. Activate 0213 only after compatible application publication.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techfinance.banking.view.workspace','techfinance','banking','view','workspace','Consultar operações bancárias','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true),
('techfinance.banking.manage.workspace','techfinance','banking','manage','workspace','Configurar conexão bancária','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true),
('techfinance.banking_sync.manage.workspace','techfinance','banking_sync','manage','workspace','Sincronizar saldo e extrato bancário','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true),
('techfinance.banking.update.workspace','techfinance','banking','update','workspace','Conciliar extrato bancário','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true),
('techfinance.bank_payment_drafts.create.workspace','techfinance','bank_payment_drafts','create','workspace','Criar rascunho de pagamento bancário','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true),
('techfinance.bank_payment_approval.manage.workspace','techfinance','bank_payment_approval','manage','workspace','Aprovar pagamento bancário','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true),
('techfinance.bank_payment_execution.manage.workspace','techfinance','bank_payment_execution','manage','workspace','Executar pagamento bancário aprovado','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true),
('techfinance.bank_payment_cancellation.manage.workspace','techfinance','bank_payment_cancellation','manage','workspace','Cancelar pagamento bancário não enviado','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true),
('techfinance.bank_charge_issuance.manage.workspace','techfinance','bank_charge_issuance','manage','workspace','Emitir cobrança bancária','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true),
('techfinance.bank_charge_cancellation.manage.workspace','techfinance','bank_charge_cancellation','manage','workspace','Cancelar cobrança bancária','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true),
('techfinance.banking_simulation.manage.workspace','techfinance','banking_simulation','manage','workspace','Simular liquidação bancária','Ação bancária específica; exige workspace selecionado, membership ativo e leitura bancária.',true)
ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.banking_access(_workspace uuid,_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb:=finance_access_context();k text;BEGIN
 k:=CASE _action WHEN 'view' THEN 'banking.view' WHEN 'connect' THEN 'banking.manage' WHEN 'sync' THEN 'banking_sync.manage' WHEN 'reconcile' THEN 'banking.update' WHEN 'create_payment' THEN 'bank_payment_drafts.create' WHEN 'approve' THEN 'bank_payment_approval.manage' WHEN 'execute' THEN 'bank_payment_execution.manage' WHEN 'cancel_payment' THEN 'bank_payment_cancellation.manage' WHEN 'create_charge' THEN 'bank_charge_issuance.manage' WHEN 'cancel_charge' THEN 'bank_charge_cancellation.manage' WHEN 'simulate' THEN 'banking_simulation.manage' END;
 RETURN COALESCE(k IS NOT NULL AND c->>'workspace'=_workspace::text AND c->'keys' ? 'techfinance.banking.view.workspace' AND c->'keys' ? ('techfinance.'||k||'.workspace') AND (_action='view' OR NOT (c->>'read_only')::boolean),false);
END $$;
CREATE OR REPLACE FUNCTION public.banking_authorize(_action text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE w uuid;BEGIN
 SELECT active_workspace_id INTO w FROM profiles WHERE id=auth.uid();
 IF NOT banking_access(w,_action) THEN RAISE EXCEPTION 'Operação bancária não autorizada.' USING ERRCODE='42501';END IF;RETURN w;
END $$;
REVOKE ALL ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.banking_access(uuid,text),public.banking_authorize(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.banking_create_payment(_data jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w uuid:=banking_authorize('create_payment');c bank_connections;e financial_entries;v numeric:=(_data->>'amount')::numeric;out_id uuid;BEGIN
 SELECT * INTO c FROM bank_connections WHERE id=(_data->>'connection_id')::uuid AND workspace_id=w AND status='connected' FOR SHARE;
 IF c.id IS NULL OR v IS NULL OR v<=0 OR v::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Conexão ou valor inválido.' USING ERRCODE='23514';END IF;
 IF _data->>'financial_entry_id' IS NOT NULL THEN
 SELECT * INTO e FROM financial_entries WHERE id=(_data->>'financial_entry_id')::uuid AND workspace_id=w FOR UPDATE;
 IF e.id IS NULL OR NOT finance_entry_access(e.id,'view') OR e.direction<>'payable' OR e.status IN('paid','cancelled') OR e.amount-e.paid_amount<v THEN RAISE EXCEPTION 'Lançamento indisponível ou saldo insuficiente.' USING ERRCODE='42501';END IF;END IF;
 IF _data->>'type'='pix' AND (nullif(_data->>'pix_key','') IS NULL OR nullif(_data->>'pix_key_type','') IS NULL) OR _data->>'type'='boleto' AND nullif(COALESCE(_data->>'boleto_barcode',_data->>'boleto_digitable_line'),'') IS NULL OR COALESCE(_data->>'type','') NOT IN('pix','boleto') THEN RAISE EXCEPTION 'Dados de pagamento inválidos; TED indisponível.' USING ERRCODE='23514';END IF;
 INSERT INTO bank_payments(workspace_id,connection_id,financial_entry_id,type,amount,scheduled_for,status,favored_name,favored_document,pix_key,pix_key_type,boleto_barcode,boleto_digitable_line,description,created_by)
 VALUES(w,c.id,e.id,_data->>'type',v,(_data->>'scheduled_for')::date,'draft',left(_data->>'favored_name',200),left(_data->>'favored_document',32),left(_data->>'pix_key',200),_data->>'pix_key_type',left(_data->>'boleto_barcode',64),left(_data->>'boleto_digitable_line',64),left(_data->>'description',500),auth.uid()) RETURNING id INTO out_id;
 INSERT INTO bank_connection_events(workspace_id,connection_id,actor_id,event_type,payload) VALUES(w,c.id,auth.uid(),'payment_created',jsonb_build_object('payment_id',out_id,'amount',v));RETURN out_id;
END $$;
CREATE OR REPLACE FUNCTION public.banking_payment_transition(_id uuid,_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w uuid;p bank_payments;c bank_connections;e financial_entries;BEGIN
 IF _action NOT IN('approve','execute','cancel_payment') THEN RAISE EXCEPTION 'Transição inválida.' USING ERRCODE='22023';END IF;
 w:=banking_authorize(_action);
 SELECT * INTO p FROM bank_payments WHERE id=_id AND workspace_id=w FOR UPDATE;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Pagamento indisponível.' USING ERRCODE='42501';END IF;
 IF _action='cancel_payment' THEN
 IF p.status NOT IN('draft','approved') THEN RAISE EXCEPTION 'Pagamento já enviado não pode ser cancelado localmente.' USING ERRCODE='23514';END IF;
 UPDATE bank_payments SET status='canceled' WHERE id=p.id;
 ELSE
 SELECT * INTO c FROM bank_connections WHERE id=p.connection_id AND workspace_id=w AND status='connected' FOR SHARE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Conexão inativa.' USING ERRCODE='23514';END IF;
 IF (_action='approve' AND p.status<>'draft') OR (_action='execute' AND p.status<>'approved') THEN RAISE EXCEPTION 'Estado bancário alterado; atualize a tela.' USING ERRCODE='23514';END IF;
 IF _action='execute' AND p.scheduled_for>current_date THEN RAISE EXCEPTION 'Pagamento com data futura: execução indisponível antes do vencimento.' USING ERRCODE='23514';END IF;
 IF p.financial_entry_id IS NOT NULL THEN
 SELECT * INTO e FROM financial_entries WHERE id=p.financial_entry_id AND workspace_id=w FOR UPDATE;
 IF e.id IS NULL OR NOT finance_entry_access(e.id,'view') OR e.direction<>'payable' OR e.status IN('paid','cancelled') OR e.amount-e.paid_amount<p.amount THEN RAISE EXCEPTION 'Lançamento indisponível ou saldo insuficiente.' USING ERRCODE='42501';END IF;END IF;
 IF _action='approve' THEN UPDATE bank_payments SET status='approved',approved_by=auth.uid(),approved_at=now() WHERE id=p.id;
 ELSE UPDATE bank_payments SET status='processing',metadata=metadata||jsonb_build_object('execution_actor',auth.uid(),'execution_started_at',now()) WHERE id=p.id;END IF;
 END IF;
 INSERT INTO bank_connection_events(workspace_id,connection_id,actor_id,event_type,payload) VALUES(w,p.connection_id,auth.uid(),'payment_'||_action,jsonb_build_object('payment_id',p.id));
 SELECT * INTO p FROM bank_payments WHERE id=_id;RETURN to_jsonb(p);
END $$;
REVOKE ALL ON FUNCTION public.banking_create_payment(jsonb),public.banking_payment_transition(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.banking_create_payment(jsonb),public.banking_payment_transition(uuid,text) TO authenticated;

-- Server/service-only callback, one lock and transaction for source, ledger and statement.
CREATE OR REPLACE FUNCTION public.banking_apply_event(_kind text,_id uuid,_status text,_external text DEFAULT NULL,_paid_at timestamptz DEFAULT now(),_reason text DEFAULT NULL,_actor uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record;c bank_connections;e financial_entries;pay uuid;account uuid;expected_direction text;BEGIN
 IF _kind='payment' THEN SELECT id,workspace_id,connection_id,financial_entry_id,amount,type,status,external_id,metadata INTO p FROM bank_payments WHERE id=_id FOR UPDATE;expected_direction:='payable';
 ELSIF _kind='charge' THEN SELECT id,workspace_id,connection_id,financial_entry_id,amount,type,status,external_id,metadata INTO p FROM bank_charges WHERE id=_id FOR UPDATE;expected_direction:='receivable';
 ELSE RAISE EXCEPTION 'Evento inválido.' USING ERRCODE='22023';END IF;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Registro bancário indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM bank_connections WHERE id=p.connection_id AND workspace_id=p.workspace_id;
 IF c.id IS NULL OR c.provider<>'inter' OR c.mode<>'mock' OR (_external IS NULL AND c.mode<>'mock') OR (_external IS NOT NULL AND p.external_id IS DISTINCT FROM _external) THEN RAISE EXCEPTION 'Origem bancária incompatível.' USING ERRCODE='42501';END IF;
 IF p.status=_status THEN RETURN jsonb_build_object('ok',true,'already',true,'payment_id',p.metadata->>'finance_payment_id');END IF;
 IF (_kind='payment' AND p.status<>'processing') OR (_kind='charge' AND p.status<>'pending') OR _status NOT IN('paid','failed','processing','canceled','expired') OR (_kind='charge' AND _status NOT IN('paid','canceled','expired')) OR (_kind='payment' AND _status='expired') THEN RAISE EXCEPTION 'Transição bancária incompatível.' USING ERRCODE='23514';END IF;
 IF _status='paid' AND p.financial_entry_id IS NOT NULL THEN
 SELECT * INTO e FROM financial_entries WHERE id=p.financial_entry_id AND workspace_id=p.workspace_id FOR UPDATE;
 IF e.id IS NULL OR e.direction::text<>expected_direction OR e.status IN('paid','cancelled') OR p.amount<=0 OR p.amount::text IN('NaN','Infinity','-Infinity') OR e.paid_amount+p.amount>e.amount THEN RAISE EXCEPTION 'Liquidação incompatível com lançamento/saldo.' USING ERRCODE='23514';END IF;
 SELECT id INTO account FROM financial_bank_accounts WHERE workspace_id=p.workspace_id AND bank_connection_id=p.connection_id AND active ORDER BY id LIMIT 1;
 INSERT INTO financial_payments(workspace_id,entry_id,bank_account_id,created_by,amount,paid_at,method,reference,notes) VALUES(p.workspace_id,e.id,account,_actor,p.amount,_paid_at::date,p.type,p.external_id,'Liquidação bancária confirmada') RETURNING id INTO pay;
 END IF;
 IF _kind='payment' THEN UPDATE bank_payments SET status=_status,paid_at=CASE WHEN _status='paid' THEN _paid_at ELSE paid_at END,failure_reason=CASE WHEN _status='failed' THEN left(_reason,500) ELSE NULL END,metadata=metadata||jsonb_build_object('finance_payment_id',pay) WHERE id=p.id;
 ELSE UPDATE bank_charges SET status=_status,paid_at=CASE WHEN _status='paid' THEN _paid_at ELSE paid_at END,canceled_at=CASE WHEN _status='canceled' THEN now() ELSE canceled_at END,metadata=metadata||jsonb_build_object('finance_payment_id',pay) WHERE id=p.id;END IF;
 IF pay IS NOT NULL AND p.external_id IS NOT NULL THEN UPDATE bank_statement_transactions SET reconciliation_status='matched',matched_payment_id=pay WHERE workspace_id=p.workspace_id AND connection_id=p.connection_id AND external_id=p.external_id AND reconciliation_status='pending';END IF;
 INSERT INTO bank_connection_events(workspace_id,connection_id,actor_id,event_type,payload) VALUES(p.workspace_id,p.connection_id,_actor,_kind||'_'||_status,jsonb_build_object('record_id',p.id,'payment_id',pay));
 RETURN jsonb_build_object('ok',true,'payment_id',pay);
END $$;
REVOKE ALL ON FUNCTION public.banking_apply_event(text,uuid,text,text,timestamptz,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.banking_apply_event(text,uuid,text,text,timestamptz,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.banking_store_tokens(_connection uuid,_workspace uuid,_tokens jsonb,_expected uuid DEFAULT NULL,_state text DEFAULT NULL,_actor uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c bank_connections;BEGIN
 SELECT * INTO c FROM bank_connections WHERE id=_connection AND workspace_id=_workspace FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Conexão indisponível.' USING ERRCODE='42501';END IF;
 IF _state IS NOT NULL THEN
 IF c.status<>'connecting' OR c.metadata->>'pending_state' IS DISTINCT FROM _state OR c.metadata->>'pending_actor' IS DISTINCT FROM _actor::text OR _actor IS NULL OR NOT is_workspace_member(_workspace,_actor) OR NOT user_has_permission(_actor,_workspace,'techfinance.banking.manage.workspace') OR c.metadata->>'pending_at' IS NULL OR (c.metadata->>'pending_at')::timestamptz<now()-interval '10 minutes' THEN RAISE EXCEPTION 'Autorização expirada ou já utilizada.' USING ERRCODE='42501';END IF;
 ELSIF _expected IS NULL OR NOT EXISTS(SELECT 1 FROM bank_connection_tokens WHERE id=_expected AND connection_id=c.id AND rotated_at IS NULL) OR c.status<>'connected' THEN RETURN false;END IF;
 IF COALESCE(_tokens->>'access_token','') NOT LIKE 'enc:v1:%' OR COALESCE(_tokens->>'refresh_token','enc:v1:') NOT LIKE 'enc:v1:%' THEN RAISE EXCEPTION 'Credencial deve estar cifrada.' USING ERRCODE='23514';END IF;
 UPDATE bank_connection_tokens SET rotated_at=now() WHERE connection_id=c.id AND rotated_at IS NULL;
 INSERT INTO bank_connection_tokens(connection_id,workspace_id,access_token,refresh_token,token_type,scope,expires_at) VALUES(c.id,c.workspace_id,_tokens->>'access_token',_tokens->>'refresh_token',_tokens->>'token_type',_tokens->>'scope',(_tokens->>'expires_at')::timestamptz);
 UPDATE bank_connections SET status='connected',metadata=jsonb_build_object('connected_at',now()),last_error=NULL,last_sync_at=now(),display_name=COALESCE(_tokens->>'display_name',display_name,'Banco Inter'),external_account_id=COALESCE(_tokens->>'external_account_id',external_account_id) WHERE id=c.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.banking_store_tokens(uuid,uuid,jsonb,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.banking_store_tokens(uuid,uuid,jsonb,uuid,text,uuid) TO service_role;
NOTIFY pgrst,'reload schema';

CREATE OR REPLACE FUNCTION public.finance_reconcile_transaction(_transaction uuid,_category uuid DEFAULT NULL,_bank uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t record;w uuid;e uuid;p uuid;d date;v numeric;BEGIN
 SELECT active_workspace_id INTO w FROM profiles WHERE id=auth.uid();
 IF NOT finance_scope_access(w,'entries','create',auth.uid()) OR NOT finance_scope_access(w,'payments','create',auth.uid())
 OR NOT user_has_permission(auth.uid(),w,'techfinance.banking.update.workspace') THEN RAISE EXCEPTION 'Sem permissão para criar e conciliar lançamento/baixa.' USING ERRCODE='42501';END IF;
 SELECT id,posted_at,amount,direction,description,counterparty,reconciliation_status INTO t FROM bank_statement_transactions WHERE id=_transaction AND workspace_id=w FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Transação indisponível.' USING ERRCODE='42501';END IF;
 IF t.reconciliation_status<>'pending' THEN RETURN jsonb_build_object('created',false);END IF;
 v:=abs(t.amount);d:=t.posted_at::date;
 INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,description,amount,currency,competence_date,due_date,category_id,external_ref,status)
 VALUES(w,auth.uid(),CASE WHEN t.direction='credit' THEN 'receivable'::financial_direction ELSE 'payable'::financial_direction END,'manual',COALESCE(NULLIF(trim(t.description),''),NULLIF(trim(t.counterparty),''),'Movimentação bancária'),v,'BRL',d,d,_category,'bank_tx:'||t.id,'open') RETURNING id INTO e;
 INSERT INTO financial_payments(workspace_id,entry_id,bank_account_id,paid_at,amount,method,reference,created_by)
 VALUES(w,e,_bank,d,v,'bank',left(COALESCE(t.description,'Movimentação bancária'),120),auth.uid()) RETURNING id INTO p;
 UPDATE bank_statement_transactions SET reconciliation_status='matched',matched_payment_id=p WHERE id=t.id AND workspace_id=w;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conciliação não concluída.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('created',true,'entry_id',e,'payment_id',p);
END $$;
REVOKE ALL ON FUNCTION public.finance_reconcile_transaction(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_reconcile_transaction(uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.banking_disconnect(_id uuid,_workspace uuid,_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c bank_connections;BEGIN
 IF _actor IS NULL OR NOT is_workspace_member(_workspace,_actor) OR NOT user_has_permission(_actor,_workspace,'techfinance.banking.manage.workspace') THEN RAISE EXCEPTION 'Desconexão não autorizada.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM bank_connections WHERE id=_id AND workspace_id=_workspace FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Conexão indisponível.' USING ERRCODE='42501';END IF;
 UPDATE bank_connection_tokens SET rotated_at=now() WHERE connection_id=c.id AND rotated_at IS NULL;
 UPDATE bank_connections SET status='disconnected',display_name=NULL,external_account_id=NULL,last_sync_at=NULL,last_error=NULL,metadata='{}' WHERE id=c.id;
 INSERT INTO bank_connection_events(workspace_id,connection_id,actor_id,event_type,payload) VALUES(_workspace,c.id,_actor,'disconnect','{}');
END $$;
REVOKE ALL ON FUNCTION public.banking_disconnect(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.banking_disconnect(uuid,uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';

-- Lease before calling the external refresh endpoint. CAS alone only protects storage.
CREATE OR REPLACE FUNCTION public.banking_claim_refresh(_connection uuid,_expected uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c bank_connections;BEGIN
 SELECT * INTO c FROM bank_connections WHERE id=_connection AND status='connected' FOR UPDATE;
 IF c.id IS NULL OR NOT EXISTS(SELECT 1 FROM bank_connection_tokens WHERE id=_expected AND connection_id=c.id AND rotated_at IS NULL) OR COALESCE((c.metadata->>'refresh_lease_until')::timestamptz,'-infinity')>now() THEN RETURN false;END IF;
 UPDATE bank_connections SET metadata=metadata||jsonb_build_object('refresh_lease_until',now()+interval '2 minutes','refresh_token_id',_expected) WHERE id=c.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.banking_claim_refresh(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.banking_claim_refresh(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
