-- Core Finance action/scope contract. Additive preparation, no role grants.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
VALUES('techfinance.entry_cancellation.manage.workspace','techfinance','entry_cancellation','manage','workspace','Cancelar lançamento financeiro','Exige leitura do lançamento; não permite editar valores nem apagar baixas.',true),
('techfinance.entries.assign.workspace','techfinance','entries','assign','workspace','Reatribuir lançamento financeiro','Requer edição e responsável ativo no mesmo workspace.',true)
ON CONFLICT(key) DO NOTHING;

-- Resolve identity, membership, effective keys and team once per statement.
-- RLS supplies this protected context; user-supplied JSON is never authoritative.
CREATE OR REPLACE FUNCTION public.finance_access_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE w uuid;keys jsonb;team jsonb;BEGIN
 IF auth.uid() IS NULL THEN RETURN '{}'::jsonb;END IF;
 SELECT active_workspace_id INTO w FROM profiles WHERE id=auth.uid();
 IF w IS NULL OR NOT is_workspace_member(w,auth.uid()) THEN RETURN '{}'::jsonb;END IF;
 SELECT COALESCE(jsonb_object_agg(k,true),'{}') INTO keys FROM user_effective_permissions(auth.uid(),w) k;
 SELECT COALESCE(jsonb_object_agg(t.user_id::text,true),'{}') INTO team FROM my_team_member_pairs()t WHERE t.workspace_id=w;
 RETURN jsonb_build_object('workspace',w,'actor',auth.uid(),'keys',keys,'team',team,'read_only',is_read_only_view());
END $$;
CREATE OR REPLACE FUNCTION public.finance_context_access(_ctx jsonb,_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT COALESCE(_workspace::text=_ctx->>'workspace' AND _ctx->>'actor' IS NOT NULL
 AND _resource IN('entries','payments','recurrences','categories','bank_accounts','cost_centers','reports','audit')
 AND _action IN('view','create','update','delete','export')
 AND (_action='view' OR NOT (_ctx->>'read_only')::boolean)
 AND ((_ctx->'keys' ? ('techfinance.'||_resource||'.'||_action||'.workspace'))
 OR (_responsible::text=_ctx->>'actor' AND _ctx->'keys' ? ('techfinance.'||_resource||'.'||_action||'.own'))
 OR (_ctx->'team' ? _responsible::text AND _ctx->'keys' ? ('techfinance.'||_resource||'.'||_action||'.team'))),false)
$$;
CREATE OR REPLACE FUNCTION public.finance_scope_access(_workspace uuid,_resource text,_action text,_responsible uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT finance_context_access(finance_access_context(),_workspace,_resource,_action,_responsible)
$$;
CREATE OR REPLACE FUNCTION public.finance_context_entry_access(_ctx jsonb,_workspace uuid,_action text,_responsible uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT finance_context_access(_ctx,_workspace,'entries','view',_responsible)
 AND CASE WHEN _action='cancel' THEN NOT (_ctx->>'read_only')::boolean AND _ctx->'keys' ? 'techfinance.entry_cancellation.manage.workspace'
 ELSE finance_context_access(_ctx,_workspace,'entries',_action,_responsible) END
$$;
CREATE OR REPLACE FUNCTION public.finance_entry_access(_entry uuid,_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT finance_context_entry_access(finance_access_context(),e.workspace_id,_action,COALESCE(e.assigned_to,e.owner_id)) FROM financial_entries e WHERE e.id=_entry),false)
$$;
CREATE OR REPLACE FUNCTION public.finance_context_payment_access(_ctx jsonb,_entry uuid,_workspace uuid,_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT e.workspace_id=_workspace AND finance_context_entry_access(_ctx,e.workspace_id,'view',COALESCE(e.assigned_to,e.owner_id))
 AND finance_context_access(_ctx,e.workspace_id,'payments',_action,COALESCE(e.assigned_to,e.owner_id))
 AND (_action='view' OR finance_context_access(_ctx,e.workspace_id,'payments','view',COALESCE(e.assigned_to,e.owner_id)))
 FROM financial_entries e WHERE e.id=_entry),false)
$$;
CREATE OR REPLACE FUNCTION public.finance_payment_access(_entry uuid,_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT finance_context_payment_access(finance_access_context(),e.id,e.workspace_id,_action) FROM financial_entries e WHERE e.id=_entry),false)
$$;
CREATE OR REPLACE FUNCTION public.finance_entry_capabilities(_ids uuid[])
RETURNS TABLE(id uuid,can_update boolean,can_delete boolean,can_cancel boolean,can_pay boolean,can_reverse boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH ctx AS MATERIALIZED(SELECT finance_access_context() c)
 SELECT e.id,finance_context_entry_access(c,e.workspace_id,'update',COALESCE(e.assigned_to,e.owner_id)),
 finance_context_entry_access(c,e.workspace_id,'delete',COALESCE(e.assigned_to,e.owner_id)) AND e.paid_amount=0,
 finance_context_entry_access(c,e.workspace_id,'cancel',COALESCE(e.assigned_to,e.owner_id)) AND e.paid_amount=0 AND e.status NOT IN('paid','cancelled'),
 finance_context_payment_access(c,e.id,e.workspace_id,'create') AND e.status NOT IN('paid','cancelled'),finance_context_payment_access(c,e.id,e.workspace_id,'delete')
 FROM financial_entries e CROSS JOIN ctx WHERE e.id=ANY(_ids) AND cardinality(_ids)<=200 AND finance_context_entry_access(c,e.workspace_id,'view',COALESCE(e.assigned_to,e.owner_id))
$$;
DO $$ DECLARE f regprocedure;BEGIN
 FOREACH f IN ARRAY ARRAY['public.finance_access_context()'::regprocedure,'public.finance_context_access(jsonb,uuid,text,text,uuid)'::regprocedure,'public.finance_context_entry_access(jsonb,uuid,text,uuid)'::regprocedure,'public.finance_context_payment_access(jsonb,uuid,uuid,text)'::regprocedure] LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);END LOOP;
END $$;
-- The narrow lock is authorized before locking and returns only an already
-- visible entry. A cashier does not need entries.update to post a payment.
CREATE OR REPLACE FUNCTION public.finance_lock_payment_entry(_entry uuid,_action text)
RETURNS public.financial_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.financial_entries;BEGIN
 IF _action NOT IN('create','delete') OR NOT finance_payment_access(_entry,_action) THEN RAISE EXCEPTION 'Baixa não autorizada.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM financial_entries WHERE id=_entry FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento indisponível.' USING ERRCODE='42501';END IF;
 RETURN e;
END $$;
REVOKE ALL ON FUNCTION public.finance_lock_payment_entry(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_lock_payment_entry(uuid,text) TO authenticated;
-- A single SQL statement prevents partial installment groups.
CREATE OR REPLACE FUNCTION public.finance_create_installments(_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_parent uuid:=gen_random_uuid();v_workspace uuid; n integer;v_total numeric;BEGIN
 IF auth.uid() IS NULL OR jsonb_typeof(_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(_rows) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Parcelamento inválido.' USING ERRCODE='22023';END IF;
 SELECT active_workspace_id INTO v_workspace FROM profiles WHERE id=auth.uid();
 IF NOT finance_scope_access(v_workspace,'entries','create',auth.uid()) OR NOT finance_scope_access(v_workspace,'entries','view',auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para criar parcelas.' USING ERRCODE='42501';END IF;
 n:=jsonb_array_length(_rows);
 INSERT INTO financial_entries(id,workspace_id,owner_id,direction,origin_type,description,amount,currency,competence_date,due_date,counterparty_company_id,category_id,contract_id,service_id,project_id,notes,payment_method,external_ref,status,installment_number,installment_total,parent_entry_id)
 SELECT CASE WHEN ord=1 THEN v_parent ELSE gen_random_uuid() END,v_workspace,auth.uid(),(v->>'direction')::financial_direction,(v->>'origin_type')::financial_origin_type,v->>'description',(v->>'amount')::numeric,COALESCE(v->>'currency','BRL'),(v->>'competence_date')::date,(v->>'due_date')::date,
 (v->>'counterparty_company_id')::uuid,(v->>'category_id')::uuid,(v->>'contract_id')::uuid,(v->>'service_id')::uuid,(v->>'project_id')::uuid,v->>'notes',v->>'payment_method',v->>'external_ref','open',ord,n,CASE WHEN ord>1 THEN v_parent END
 FROM jsonb_array_elements(_rows) WITH ORDINALITY x(v,ord);
 SELECT sum((v->>'amount')::numeric) INTO v_total FROM jsonb_array_elements(_rows)v;
 RETURN jsonb_build_object('parent_id',v_parent,'count',n,'total_amount',v_total);
END $$;
CREATE OR REPLACE FUNCTION public.finance_delete_installments(_parent uuid,_only_open boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.financial_entries;ids uuid[]:='{}';kept integer:=0;removed integer;BEGIN
 -- Permission on every real sibling, not just a client-selected subset.
 IF NOT finance_entry_access(_parent,'delete') THEN RAISE EXCEPTION 'Grupo indisponível ou sem permissão.' USING ERRCODE='42501';END IF;
 FOR e IN SELECT * FROM financial_entries WHERE id=_parent OR parent_entry_id=_parent ORDER BY id FOR UPDATE LOOP
  IF NOT finance_entry_access(e.id,'delete') THEN RAISE EXCEPTION 'Sem permissão em todas as parcelas.' USING ERRCODE='42501';END IF;
  IF _only_open AND e.status NOT IN('open','overdue') THEN kept:=kept+1;ELSE
   IF e.paid_amount<>0 OR EXISTS(SELECT 1 FROM financial_payments WHERE entry_id=e.id) THEN RAISE EXCEPTION 'Reverta as baixas antes de excluir parcelas.' USING ERRCODE='23514';END IF;
   ids:=array_append(ids,e.id);END IF;
 END LOOP;
 -- Keep the group anchor while paid/closed siblings remain.
 IF kept>0 AND _parent=ANY(ids) THEN ids:=array_remove(ids,_parent);kept:=kept+1;END IF;
 DELETE FROM financial_entries WHERE id=ANY(ids);GET DIAGNOSTICS removed=ROW_COUNT;
 IF removed<>cardinality(ids) THEN RAISE EXCEPTION 'Exclusão incompleta; nenhuma parcela foi removida.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('deleted',removed,'kept',kept);
END $$;
DO $$ DECLARE f regprocedure;BEGIN
 FOREACH f IN ARRAY ARRAY['public.finance_scope_access(uuid,text,text,uuid)'::regprocedure,'public.finance_entry_access(uuid,text)'::regprocedure,'public.finance_payment_access(uuid,text)'::regprocedure,'public.finance_entry_capabilities(uuid[])'::regprocedure,'public.finance_create_installments(jsonb)'::regprocedure,'public.finance_delete_installments(uuid,boolean)'::regprocedure] LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);END LOOP;
END $$;
NOTIFY pgrst,'reload schema';

-- A recurrence is a workspace-owned schedule, not an owner-only RLS exception.
CREATE OR REPLACE FUNCTION public.finance_recurrence_access(_id uuid,_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT finance_scope_access(r.workspace_id,'recurrences',_action,COALESCE(r.assigned_to,r.owner_id))
 AND (_action='view' OR finance_scope_access(r.workspace_id,'recurrences','view',COALESCE(r.assigned_to,r.owner_id)))
 FROM financial_recurrences r WHERE r.id=_id),false)
$$;
CREATE OR REPLACE FUNCTION public.finance_advance_recurrence(_id uuid,_today date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.financial_recurrences;t jsonb;e uuid;next_date date;n integer;still_active boolean;
 worker boolean:=current_setting('role',true)='service_role';v_ref record;v_id uuid;w uuid;
BEGIN
 IF _today IS NULL OR _today>CURRENT_DATE THEN RAISE EXCEPTION 'Não é permitido antecipar a geração.' USING ERRCODE='22023';END IF;
 SELECT * INTO r FROM financial_recurrences WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recorrência indisponível.' USING ERRCODE='42501';END IF;
 IF worker THEN
  -- Cron delegation is explicit to the source workspace and active schedule
  -- owner, independent of which workspace that user selected in the browser.
  IF NOT is_workspace_member(r.workspace_id,r.owner_id)
   OR NOT (user_has_permission(r.owner_id,r.workspace_id,'techfinance.recurrences.update.workspace') OR user_has_permission(r.owner_id,r.workspace_id,'techfinance.recurrences.update.own'))
   OR NOT (user_has_permission(r.owner_id,r.workspace_id,'techfinance.entries.create.workspace') OR (COALESCE(r.assigned_to,r.owner_id)=r.owner_id AND user_has_permission(r.owner_id,r.workspace_id,'techfinance.entries.create.own'))) THEN RAISE EXCEPTION 'Delegação financeira da recorrência revogada.' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT finance_recurrence_access(r.id,'update') OR NOT finance_scope_access(r.workspace_id,'entries','create',COALESCE(r.assigned_to,r.owner_id)) THEN RAISE EXCEPTION 'Sem permissão para gerar lançamentos desta recorrência.' USING ERRCODE='42501';END IF;
 END IF;
 IF NOT r.active OR r.next_run_date>_today THEN RETURN NULL;END IF;
 IF (r.max_occurrences IS NOT NULL AND r.occurrences_generated>=r.max_occurrences) OR (r.end_date IS NOT NULL AND r.next_run_date>r.end_date) THEN UPDATE financial_recurrences SET active=false WHERE id=r.id;RETURN NULL;END IF;
 t:=r.template;
 IF jsonb_typeof(t) IS DISTINCT FROM 'object' OR length(trim(COALESCE(t->>'description','')))=0 OR (COALESCE((t->>'amount')::numeric,0)<=0 OR (t->>'amount') IN('NaN','Infinity','-Infinity')) OR r.next_run_date IS NULL THEN RAISE EXCEPTION 'Modelo de recorrência inválido.' USING ERRCODE='23514';END IF;
 FOR v_ref IN SELECT * FROM (VALUES('category_id','financial_categories'),('counterparty_company_id','companies'),('contract_id','contracts'),('service_id','services'),('project_id','projects'),('legal_entity_id','legal_entities'))x(col,tbl) LOOP
  v_id:=(t->>v_ref.col)::uuid;
  IF v_id IS NOT NULL THEN
   EXECUTE format('SELECT workspace_id FROM public.%I WHERE id=$1',v_ref.tbl) INTO w USING v_id;
   IF w IS DISTINCT FROM r.workspace_id THEN RAISE EXCEPTION 'Vínculo de recorrência incompatível com o workspace.' USING ERRCODE='23514';END IF;
  END IF;
 END LOOP;
 next_date:=CASE r.cadence WHEN 'weekly' THEN r.next_run_date+7 WHEN 'custom_days' THEN r.next_run_date+greatest(1,COALESCE(r.interval_days,30)) WHEN 'yearly' THEN (r.next_run_date+interval '1 year')::date WHEN 'monthly' THEN (r.next_run_date+interval '1 month')::date ELSE NULL END;
 IF next_date IS NULL THEN RAISE EXCEPTION 'Cadência inválida.' USING ERRCODE='23514';END IF;
 IF r.cadence IN('monthly','yearly') THEN
  next_date:=make_date(extract(year from next_date)::integer,extract(month from next_date)::integer,least(COALESCE(r.day_of_month,extract(day from r.next_run_date)::integer),extract(day from (date_trunc('month',next_date)+interval '1 month - 1 day'))::integer));
 END IF;
 INSERT INTO financial_entries(workspace_id,owner_id,assigned_to,direction,origin_type,status,description,amount,currency,category_id,counterparty_company_id,contract_id,service_id,project_id,legal_entity_id,payment_method,notes,competence_date,due_date,external_ref)
 VALUES(r.workspace_id,r.owner_id,COALESCE(r.assigned_to,r.owner_id),r.direction::financial_direction,'manual','open',t->>'description',(t->>'amount')::numeric,COALESCE(t->>'currency','BRL'),(t->>'category_id')::uuid,(t->>'counterparty_company_id')::uuid,(t->>'contract_id')::uuid,(t->>'service_id')::uuid,(t->>'project_id')::uuid,(t->>'legal_entity_id')::uuid,t->>'payment_method',t->>'notes',r.next_run_date,r.next_run_date,'recurrence:'||r.id) RETURNING id INTO e;
 n:=r.occurrences_generated+1;
 still_active:=NOT ((r.max_occurrences IS NOT NULL AND n>=r.max_occurrences) OR (r.end_date IS NOT NULL AND next_date>r.end_date));
 UPDATE financial_recurrences SET next_run_date=next_date,occurrences_generated=n,last_generated_entry_id=e,active=still_active WHERE id=r.id;
 RETURN jsonb_build_object('next_run_date',next_date,'occurrences_generated',n,'active',still_active);
END $$;
REVOKE ALL ON FUNCTION public.finance_recurrence_access(uuid,text),public.finance_advance_recurrence(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_recurrence_access(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_advance_recurrence(uuid,date) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';

CREATE OR REPLACE FUNCTION public.finance_recurrence_capabilities(_ids uuid[])
RETURNS TABLE(id uuid,can_update boolean,can_delete boolean,can_generate boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.id,finance_recurrence_access(r.id,'update'),finance_recurrence_access(r.id,'delete') AND r.occurrences_generated=0,
 finance_recurrence_access(r.id,'update') AND finance_scope_access(r.workspace_id,'entries','create',COALESCE(r.assigned_to,r.owner_id))
 FROM financial_recurrences r WHERE r.id=ANY(_ids) AND cardinality(_ids)<=200 AND finance_recurrence_access(r.id,'view')
$$;
REVOKE ALL ON FUNCTION public.finance_recurrence_capabilities(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_recurrence_capabilities(uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema';

-- Keep the banking consumer compatible with derived balances: create entry,
-- post its payment and link the statement in one caller-authorized transaction.
CREATE OR REPLACE FUNCTION public.finance_reconcile_transaction(_transaction uuid,_category uuid DEFAULT NULL,_bank uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t public.bank_statement_transactions;w uuid;e uuid;p uuid;d date;v numeric;BEGIN
 SELECT active_workspace_id INTO w FROM profiles WHERE id=auth.uid();
 IF NOT finance_scope_access(w,'entries','create',auth.uid()) OR NOT finance_scope_access(w,'payments','create',auth.uid())
 OR NOT user_has_permission(auth.uid(),w,'techfinance.banking.update.workspace') THEN RAISE EXCEPTION 'Sem permissão para criar e conciliar lançamento/baixa.' USING ERRCODE='42501';END IF;
 SELECT * INTO t FROM bank_statement_transactions WHERE id=_transaction AND workspace_id=w FOR UPDATE;
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
NOTIFY pgrst,'reload schema';
