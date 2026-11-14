ALTER TABLE public.services ADD COLUMN IF NOT EXISTS billing_hold text, ADD COLUMN IF NOT EXISTS billing_hold_schedule jsonb;
COMMENT ON COLUMN public.services.billing_hold IS 'awaiting_signature: activated before contract signature; billing released by contract signature';

CREATE OR REPLACE FUNCTION public.contract_is_signed_for_billing(c public.contracts) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT c.signed_at IS NOT NULL OR c.status::text IN ('active','renewing','ended') $$;

CREATE OR REPLACE FUNCTION public.service_activate_with_terms(p_service uuid, p_starts date, p_schedule jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
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
 IF NOT contract_is_signed_for_billing(c) THEN
  UPDATE services SET status='active',starts_at=start_date,next_billing_at=NULL,billing_hold='awaiting_signature',billing_hold_schedule=p_schedule WHERE id=s.id RETURNING * INTO s;
  RETURN jsonb_build_object('generated',0,'duplicate',false,'awaitingSignature',true,'service',to_jsonb(s));
 END IF;
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
 UPDATE services SET status=next_status,starts_at=start_date,next_billing_at=NULL,billing_hold=NULL,billing_hold_schedule=NULL WHERE id=s.id RETURNING * INTO s;
 RETURN jsonb_build_object('generated',CASE WHEN cnt=0 THEN n ELSE 0 END,'duplicate',cnt>0,'service',to_jsonb(s));
END $function$;

CREATE OR REPLACE FUNCTION public.service_bill_checked(p_service uuid, p_mode text, p_starts date DEFAULT NULL::date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE s services;c contracts;actor uuid:=auth.uid();w uuid;billing_date date;upcoming date;next_status service_status;inserted uuid;generated boolean:=false;BEGIN
 IF p_mode NOT IN('activate','tick') THEN RAISE EXCEPTION 'Ação inválida.';END IF;
 SELECT * INTO s FROM services WHERE id=p_service FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Serviço indisponível.' USING ERRCODE='42501';END IF;
 IF actor IS NOT NULL THEN
 w:=work_area_authorize('techservice.services','update',s.id);PERFORM work_area_authorize('techservice.billing','manage');
 IF NOT finance_scope_access(w,'entries','view',actor) THEN RAISE EXCEPTION 'Sem acesso aos lançamentos financeiros.' USING ERRCODE='42501';END IF;
 IF NOT(user_has_permission(actor,w,'techfinance.entries.create.own') OR user_has_permission(actor,w,'techfinance.entries.create.workspace')) THEN RAISE EXCEPTION 'Sem permissão para gerar lançamentos financeiros.' USING ERRCODE='42501';END IF;
 ELSIF coalesce(auth.role(),'')='service_role' THEN
 actor:=s.owner_id;w:=s.workspace_id;
 IF NOT work_delegated_authorize(w,actor,'service_billing',s.id) THEN RETURN jsonb_build_object('authorized',false,'generated',false,'skippedOwned',false,'duplicate',false);END IF;
 ELSE RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 IF p_mode='activate' THEN
 IF s.status IN('active','completed') THEN RETURN jsonb_build_object('authorized',true,'generated',false,'duplicate',true,'skippedOwned',false,'service',to_jsonb(s));END IF;
 IF s.status<>'pending' THEN RAISE EXCEPTION 'Serviço indisponível para ativação.' USING ERRCODE='23514';END IF;
 billing_date:=coalesce(p_starts,s.starts_at,current_date);
 IF s.contract_id IS NOT NULL THEN
  SELECT * INTO c FROM contracts WHERE id=s.contract_id;
  IF c.id IS NOT NULL AND NOT contract_is_signed_for_billing(c) THEN
   UPDATE services SET status='active',starts_at=billing_date,next_billing_at=NULL,billing_hold='awaiting_signature',billing_hold_schedule=NULL WHERE id=s.id RETURNING * INTO s;
   RETURN jsonb_build_object('authorized',true,'generated',false,'duplicate',false,'skippedOwned',false,'awaitingSignature',true,'service',to_jsonb(s));
  END IF;
 END IF;
 ELSE
 IF s.billing_hold IS NOT NULL OR s.status<>'active' OR s.type<>'recurring' OR s.next_billing_at IS NULL OR s.next_billing_at>current_date THEN RETURN jsonb_build_object('authorized',true,'generated',false,'duplicate',false,'skippedOwned',false,'service',to_jsonb(s));END IF;
 billing_date:=s.next_billing_at;
 END IF;
 IF s.type='one_time' OR p_mode='tick' THEN
 IF project_billing_service_owned(s.id,billing_date) THEN
 IF p_mode='activate' THEN RAISE EXCEPTION 'Cobrança deste serviço pertence às medições.' USING ERRCODE='23514';END IF;
 RETURN jsonb_build_object('authorized',true,'generated',false,'skippedOwned',true,'duplicate',false);
 END IF;
 INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,service_id,contract_id,description,amount,currency,competence_date,due_date,status)
 VALUES(w,actor,CASE WHEN s.role='provider' THEN 'receivable'::financial_direction ELSE 'payable'::financial_direction END,'service',s.id,s.id,s.contract_id,s.name,s.quantity*s.unit_price,s.currency,billing_date,billing_date,'open')
 ON CONFLICT(service_id,competence_date) WHERE origin_type='service' AND service_id IS NOT NULL DO NOTHING RETURNING id INTO inserted;
 generated:=inserted IS NOT NULL;
 END IF;
 IF p_mode='activate' THEN
 next_status:=CASE WHEN s.type='one_time' THEN 'completed'::service_status ELSE 'active'::service_status END;
 upcoming:=CASE WHEN s.type='recurring' THEN billing_date END;
 ELSE
 upcoming:=services_next_billing(billing_date,s.cadence);
 next_status:=CASE WHEN s.ends_at IS NOT NULL AND upcoming>s.ends_at THEN 'completed'::service_status ELSE 'active'::service_status END;
 IF next_status='completed' THEN upcoming:=NULL;END IF;
 END IF;
 UPDATE services SET status=next_status,starts_at=CASE WHEN p_mode='activate' THEN billing_date ELSE starts_at END,next_billing_at=upcoming WHERE id=s.id RETURNING * INTO s;
 RETURN jsonb_build_object('authorized',true,'generated',generated,'skippedOwned',false,'duplicate',NOT generated AND (p_mode='tick' OR s.type='one_time'),'service',to_jsonb(s));
END $function$;

-- Releases held billing once the contract is signed. Internal: only the contract trigger calls it.
CREATE OR REPLACE FUNCTION public.service_release_signature_billing(p_contract uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE c contracts;s services;item jsonb;n int;total int:=0;cnt int;sig date;d date;bd date;
BEGIN
 SELECT * INTO c FROM contracts WHERE id=p_contract;
 IF c.id IS NULL OR NOT contract_is_signed_for_billing(c) THEN RETURN 0;END IF;
 sig:=coalesce(c.signed_at::date,current_date);
 FOR s IN SELECT * FROM services WHERE contract_id=c.id AND workspace_id=c.workspace_id AND billing_hold='awaiting_signature' FOR UPDATE LOOP
  IF s.billing_hold_schedule IS NOT NULL THEN
   SELECT count(*) INTO cnt FROM financial_entries WHERE workspace_id=c.workspace_id AND external_ref LIKE 'payment-terms:'||c.id::text||':%';
   IF cnt=0 THEN
    n:=0;
    FOR item IN SELECT * FROM jsonb_array_elements(s.billing_hold_schedule) LOOP
     n:=n+1;
     IF (item->>'amount')::numeric<=0 THEN CONTINUE;END IF;
     d:=CASE WHEN item->>'dueEvent'='signature' THEN sig ELSE coalesce((item->>'dueDate')::date,s.starts_at,sig) END;
     INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,contract_id,service_id,counterparty_company_id,description,amount,currency,competence_date,due_date,status,external_ref,installment_number,installment_total,notes,metadata)
     VALUES(c.workspace_id,s.owner_id,CASE WHEN c.role='client' THEN 'payable'::financial_direction ELSE 'receivable'::financial_direction END,'contract',c.id,c.id,s.id,c.counterparty_company_id,
       left(coalesce(c.title,'Contrato')||' — '||coalesce(item->>'label','Parcela'),300),(item->>'amount')::numeric,coalesce(c.currency,s.currency,'BRL'),d,d,'open',
       'payment-terms:'||c.id::text||':'||n::text,n,jsonb_array_length(s.billing_hold_schedule),
       CASE item->>'dueEvent' WHEN 'milestone' THEN 'Vence na entrega do marco: ajuste a data quando o marco for entregue.' WHEN 'signature' THEN 'Vence na assinatura do contrato.' END,
       jsonb_build_object('payment_terms',true,'due_event',item->>'dueEvent','released_on_signature',true))
     ON CONFLICT DO NOTHING;
     total:=total+1;
    END LOOP;
   END IF;
   UPDATE services SET status=CASE WHEN type='one_time' THEN 'completed'::service_status ELSE status END,billing_hold=NULL,billing_hold_schedule=NULL WHERE id=s.id;
  ELSE
   bd:=greatest(coalesce(s.starts_at,sig),sig);
   IF s.type='one_time' THEN
    IF NOT project_billing_service_owned(s.id,bd) THEN
     INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,service_id,contract_id,description,amount,currency,competence_date,due_date,status)
     VALUES(s.workspace_id,s.owner_id,CASE WHEN s.role='provider' THEN 'receivable'::financial_direction ELSE 'payable'::financial_direction END,'service',s.id,s.id,s.contract_id,s.name,s.quantity*s.unit_price,s.currency,bd,bd,'open')
     ON CONFLICT(service_id,competence_date) WHERE origin_type='service' AND service_id IS NOT NULL DO NOTHING;
     total:=total+1;
    END IF;
    UPDATE services SET status='completed',billing_hold=NULL WHERE id=s.id;
   ELSE
    UPDATE services SET billing_hold=NULL,next_billing_at=CASE WHEN type='recurring' THEN bd END WHERE id=s.id;
   END IF;
  END IF;
 END LOOP;
 RETURN total;
END $function$;
REVOKE ALL ON FUNCTION public.service_release_signature_billing(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_release_signature_billing(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.contracts_release_service_billing_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ BEGIN
 IF contract_is_signed_for_billing(NEW) AND NOT contract_is_signed_for_billing(OLD) THEN PERFORM service_release_signature_billing(NEW.id);END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.contracts_release_service_billing_trg() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS zz_contracts_release_service_billing ON public.contracts;
CREATE TRIGGER zz_contracts_release_service_billing AFTER UPDATE OF signed_at, status ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.contracts_release_service_billing_trg();