CREATE OR REPLACE FUNCTION public.contract_purchase_payables_generate(p_contract uuid, p_installments jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE actor uuid:=auth.uid();f jsonb;c contracts;item jsonb;n int:=0;len int;total numeric:=0;cnt int;amt numeric;due date;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM contracts WHERE id=p_contract FOR UPDATE;
 IF c.id IS NULL OR NOT work_context_access(work_access_context(),c.workspace_id,'techcontracts.contracts','view',ARRAY[c.owner_id,c.assigned_to]) THEN
  RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 f:=finance_access_context();
 IF f->>'workspace' IS DISTINCT FROM c.workspace_id::text OR coalesce((f->>'read_only')::boolean,false)
  OR NOT ((f->'keys') ? 'techfinance.entries.create.workspace' OR (f->'keys') ? 'techfinance.entries.create.own') THEN
  RAISE EXCEPTION 'Sem permissão para gerar contas a pagar.' USING ERRCODE='42501';END IF;
 IF c.role::text<>'client' THEN RAISE EXCEPTION 'Use apenas em contratos de compra.' USING ERRCODE='23514';END IF;
 IF NOT (c.signed_at IS NOT NULL OR c.status::text IN('active','renewing','ended')) THEN
  RAISE EXCEPTION 'O contrato de compra ainda não foi assinado.' USING ERRCODE='23514';END IF;
 IF c.total_value IS NULL OR c.total_value<=0 THEN RAISE EXCEPTION 'Informe o valor total do contrato antes.' USING ERRCODE='23514';END IF;
 IF jsonb_typeof(p_installments)<>'array' THEN RAISE EXCEPTION 'Parcelas inválidas.' USING ERRCODE='22023';END IF;
 len:=jsonb_array_length(p_installments);
 IF len<1 OR len>60 THEN RAISE EXCEPTION 'Informe de 1 a 60 parcelas.' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO cnt FROM financial_entries WHERE workspace_id=c.workspace_id
  AND (external_ref LIKE 'purchase-payables:'||c.id::text||':%' OR external_ref LIKE 'payment-terms:'||c.id::text||':%');
 IF cnt>0 THEN RETURN jsonb_build_object('generated',0,'duplicate',true);END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_installments) LOOP
  amt:=(item->>'amount')::numeric;due:=(item->>'due_on')::date;
  IF amt IS NULL OR amt<=0 OR round(amt,2)<>amt OR due IS NULL THEN RAISE EXCEPTION 'Toda parcela precisa de valor e vencimento.' USING ERRCODE='22023';END IF;
  total:=total+amt;
 END LOOP;
 IF abs(total-c.total_value)>0.004 THEN RAISE EXCEPTION 'A soma das parcelas deve fechar o valor do contrato.' USING ERRCODE='23514';END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_installments) LOOP
  n:=n+1;
  INSERT INTO financial_entries(workspace_id,owner_id,direction,origin_type,origin_id,contract_id,counterparty_company_id,description,amount,currency,competence_date,due_date,status,external_ref,installment_number,installment_total,metadata)
  VALUES(c.workspace_id,actor,'payable','contract',c.id,c.id,c.counterparty_company_id,
   left(coalesce(c.title,'Contrato de compra')||' — '||coalesce(nullif(item->>'label',''),'Parcela '||n||'/'||len),300),
   (item->>'amount')::numeric,coalesce(c.currency,'BRL'),(item->>'due_on')::date,(item->>'due_on')::date,'open',
   'purchase-payables:'||c.id::text||':'||n::text,n,len,
   jsonb_build_object('purchase_payables',true,'confirmed_by',actor,'counterparty_contact_id',c.counterparty_contact_id));
 END LOOP;
 RETURN jsonb_build_object('generated',n,'duplicate',false);
END $function$;
REVOKE ALL ON FUNCTION public.contract_purchase_payables_generate(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_purchase_payables_generate(uuid,jsonb) TO authenticated;