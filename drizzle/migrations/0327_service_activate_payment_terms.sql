-- CONDICOES-PAGAMENTO: na ativação do serviço, contrato com condições de pagamento
-- gera as contas a receber do cronograma (uma vez por contrato) e o serviço deixa de
-- faturar sozinho, para não cobrar em dobro. Mesmas autorizações de service_bill_checked.
CREATE OR REPLACE FUNCTION public.service_activate_with_terms(p_service uuid, p_starts date, p_schedule jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE s services;c contracts;actor uuid:=auth.uid();w uuid;start_date date;item jsonb;n int:=0;total numeric:=0;cnt int;inserted uuid;next_status service_status;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM services WHERE id=p_service FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Serviço indisponível.' USING ERRCODE='42501';END IF;
 w:=work_area_authorize('techservice.services','update',s.id);
 PERFORM work_area_authorize('techservice.billing','manage');
 IF NOT finance_scope_access(w,'entries','view',actor) THEN RAISE EXCEPTION 'Sem acesso aos lançamentos financeiros.' USING ERRCODE='42501';END IF;
 IF NOT(user_has_permission(actor,w,'techfinance.entries.create.own') OR user_has_permission(actor,w,'techfinance.entries.create.workspace')) THEN RAISE EXCEPTION 'Sem permissão para gerar lançamentos financeiros.' USING ERRCODE='42501';END IF;
 IF s.status IN('active','completed') THEN RETURN jsonb_build_object('generated',0,'duplicate',true,'service',to_jsonb(s));END IF;
 IF s.status<>'pending' THEN RAISE EXCEPTION 'Serviço indisponível para ativação.' USING ERRCODE='23514';END IF;
 IF s.contract_id IS NULL THEN RAISE EXCEPTION 'Serviço sem contrato.' USING ERRCODE='23514';END IF;
 SELECT * INTO c FROM contracts WHERE id=s.contract_id AND workspace_id=w;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 IF NOT (c.payment_terms ? 'plan') THEN RAISE EXCEPTION 'Contrato sem condições de pagamento.' USING ERRCODE='23514';END IF;
 IF jsonb_typeof(p_schedule)<>'array' OR jsonb_array_length(p_schedule)=0 OR jsonb_array_length(p_schedule)>240 THEN RAISE EXCEPTION 'Cronograma inválido.' USING ERRCODE='22023';END IF;
 SELECT coalesce(sum((x->>'amount')::numeric),0) INTO total FROM jsonb_array_elements(p_schedule) x;
 IF c.total_value IS NOT NULL AND abs(total-c.total_value)>0.01 THEN RAISE EXCEPTION 'As parcelas não fecham com o valor do contrato.' USING ERRCODE='23514';END IF;
 start_date:=coalesce(p_starts,s.starts_at,current_date);
 SELECT count(*) INTO cnt FROM financial_entries WHERE workspace_id=w AND external_ref LIKE 'payment-terms:'||c.id::text||':%';
 IF cnt=0 THEN
  FOR item IN SELECT * FROM jsonb_array_elements(p_schedule) LOOP
   n:=n+1;
   IF (item->>'amount')::numeric<=0 THEN CONTINUE;END IF;
   INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,contract_id,service_id,counterparty_company_id,description,amount,currency,competence_date,due_date,status,external_ref,installment_number,installment_total,notes,metadata)
   VALUES(w,actor,CASE WHEN c.role='client' THEN 'payable'::financial_direction ELSE 'receivable'::financial_direction END,'contract',c.id,c.id,s.id,c.counterparty_company_id,
     left(coalesce(c.title,'Contrato')||' — '||coalesce(item->>'label','Parcela'),300),(item->>'amount')::numeric,coalesce(c.currency,s.currency,'BRL'),
     coalesce((item->>'dueDate')::date,start_date),coalesce((item->>'dueDate')::date,start_date),'open',
     'payment-terms:'||c.id::text||':'||n::text,n,jsonb_array_length(p_schedule),
     CASE item->>'dueEvent' WHEN 'milestone' THEN 'Vence na entrega do marco: ajuste a data quando o marco for entregue.' WHEN 'signature' THEN 'Vence na assinatura do contrato.' END,
     jsonb_build_object('payment_terms',true,'due_event',item->>'dueEvent'))
   ON CONFLICT DO NOTHING RETURNING id INTO inserted;
  END LOOP;
 END IF;
 next_status:=CASE WHEN s.type='one_time' THEN 'completed'::service_status ELSE 'active'::service_status END;
 UPDATE services SET status=next_status,starts_at=start_date,next_billing_at=NULL WHERE id=s.id RETURNING * INTO s;
 RETURN jsonb_build_object('generated',CASE WHEN cnt=0 THEN n ELSE 0 END,'duplicate',cnt>0,'service',to_jsonb(s));
END $function$;
REVOKE ALL ON FUNCTION public.service_activate_with_terms(uuid,date,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_activate_with_terms(uuid,date,jsonb) TO authenticated;