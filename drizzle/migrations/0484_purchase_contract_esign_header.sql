CREATE OR REPLACE FUNCTION public.hiring_contract_esign_body_without_attachments_purchase_v2(p_ws uuid, p_contract uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
 c public.contracts;
 ent text;
 supplier text;
 svc text;
 pm text;
 dp jsonb;
 dp_due jsonb;
 pl jsonb;
 dp_kind text;
 dp_val numeric;
 pl_kind text;
 entry_txt text;
 balance_txt text;
 terms_summary text;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id = p_contract AND workspace_id = p_ws;
 IF c.id IS NULL THEN RETURN NULL; END IF;

 SELECT replace(replace(replace(
   name || CASE WHEN nullif(btrim(cnpj), '') IS NOT NULL THEN ' — CNPJ ' || btrim(cnpj) ELSE '' END,
   '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
 INTO ent
 FROM public.legal_entities
 WHERE id = c.contracting_legal_entity_id AND workspace_id = p_ws;

 IF coalesce(c.counterparty_kind, 'company') = 'person'
    OR (c.counterparty_company_id IS NULL AND c.counterparty_contact_id IS NOT NULL) THEN
  SELECT replace(replace(replace(
    nullif(btrim(concat_ws(' ', first_name, last_name)), ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
  INTO supplier
  FROM public.contacts
  WHERE id = c.counterparty_contact_id AND workspace_id = p_ws;
  IF supplier IS NULL AND c.hiring_person_id IS NOT NULL THEN
   SELECT replace(replace(replace(full_name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
   INTO supplier
   FROM public.people
   WHERE id = c.hiring_person_id AND workspace_id = p_ws;
  END IF;
 ELSE
  SELECT replace(replace(replace(
    coalesce(nullif(btrim(legal_name), ''), name)
    || CASE WHEN nullif(btrim(cnpj), '') IS NOT NULL THEN ' — CNPJ ' || btrim(cnpj) ELSE '' END,
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
  INTO supplier
  FROM public.companies
  WHERE id = c.counterparty_company_id AND workspace_id = p_ws;
 END IF;

 SELECT string_agg(
   '<li>' || replace(replace(replace(name, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
   || ' — Quantidade: ' || coalesce(quantity::text, 'não informada')
   || ' — Valor unitário: ' || CASE
        WHEN unit_price IS NULL THEN 'não informado'
        WHEN coalesce(currency, 'BRL') = 'BRL' THEN 'R$ ' || translate(to_char(unit_price, 'FM999,999,999,990.00'), ',.', '.,')
        ELSE currency || ' ' || unit_price::text
      END
   || '</li>',
   '' ORDER BY id
 )
 INTO svc
 FROM public.services
 WHERE contract_id = c.id AND workspace_id = p_ws;

 pm := CASE lower(btrim(coalesce(c.payment_method, '')))
  WHEN '' THEN NULL
  WHEN 'pix' THEN 'PIX'
  WHEN 'boleto' THEN 'Boleto'
  WHEN 'transferencia' THEN 'Transferência bancária'
  WHEN 'bank_transfer' THEN 'Transferência bancária'
  WHEN 'cartao' THEN 'Cartão'
  WHEN 'credit_card' THEN 'Cartão de crédito'
  ELSE btrim(c.payment_method)
 END;

 IF c.payment_terms IS NOT NULL
    AND jsonb_typeof(c.payment_terms) = 'object'
    AND c.payment_terms ? 'plan' THEN
  dp := c.payment_terms->'downPayment';
  dp_kind := coalesce(dp->>'kind', 'none');
  dp_val := CASE WHEN coalesce(dp->>'value', '') ~ '^\d+(\.\d+)?$' THEN (dp->>'value')::numeric ELSE NULL END;
  IF dp_kind = 'percent' AND dp_val IS NOT NULL THEN
   entry_txt := 'entrada de ' || dp_val::text || '% do total';
  ELSIF dp_kind = 'amount' AND dp_val IS NOT NULL THEN
   entry_txt := 'entrada de ' || CASE
    WHEN coalesce(c.currency, 'BRL') = 'BRL' THEN 'R$ ' || translate(to_char(dp_val, 'FM999,999,999,990.00'), ',.', '.,')
    ELSE c.currency || ' ' || dp_val::text
   END;
  ELSE
   entry_txt := 'sem entrada';
  END IF;

  IF dp_kind <> 'none' AND dp_val IS NOT NULL THEN
   dp_due := c.payment_terms->'downPaymentDue';
   IF coalesce(dp_due->>'kind', 'signature') = 'date'
      AND coalesce(dp_due->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
    entry_txt := entry_txt || ' (vence em ' || to_char((dp_due->>'date')::date, 'DD/MM/YYYY') || ')';
   ELSE
    entry_txt := entry_txt || ' (vence na assinatura do contrato)';
   END IF;
  END IF;

  pl := c.payment_terms->'plan';
  pl_kind := coalesce(pl->>'kind', 'none');
  IF pl_kind = 'monthly'
     AND coalesce(pl->>'months', '') ~ '^\d+$'
     AND coalesce(pl->>'dueDay', '') ~ '^\d+$' THEN
   balance_txt := (pl->>'months') || ' mensalidades no dia ' || (pl->>'dueDay');
  ELSIF pl_kind = 'periodic'
     AND coalesce(pl->>'count', '') ~ '^\d+$'
     AND coalesce(pl->>'intervalMonths', '') ~ '^\d+$'
     AND coalesce(pl->>'dueDay', '') ~ '^\d+$' THEN
   balance_txt := (pl->>'count') || ' parcelas a cada ' || (pl->>'intervalMonths')
    || CASE WHEN (pl->>'intervalMonths')::int = 1 THEN ' mês' ELSE ' meses' END
    || ', dia ' || (pl->>'dueDay');
  ELSIF pl_kind = 'fixed_date'
     AND coalesce(pl->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN
   balance_txt := 'saldo em parcela única em ' || to_char((pl->>'date')::date, 'DD/MM/YYYY');
  ELSIF pl_kind = 'milestones'
     AND jsonb_typeof(pl->'milestones') = 'array' THEN
   balance_txt := jsonb_array_length(pl->'milestones')::text
    || CASE WHEN jsonb_array_length(pl->'milestones') = 1 THEN ' marco de entrega' ELSE ' marcos de entrega' END;
  ELSIF pl_kind = 'none' THEN
   balance_txt := 'sem saldo';
  END IF;

  IF balance_txt IS NOT NULL AND (dp_kind <> 'none' OR pl_kind <> 'none') THEN
   terms_summary := entry_txt || ' · ' || balance_txt;
  END IF;
 END IF;

 RETURN '<!--techerp:html-->'
  || '<h1>' || replace(replace(replace(c.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</h1>'
  || '<p><strong>Contrato:</strong> ' || replace(replace(replace(coalesce(c.number, c.id::text), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
  || '<br><strong>Contratante:</strong> ' || coalesce(ent, '')
  || '<br><strong>Contratada / Fornecedor:</strong> ' || coalesce(supplier, '')
  || '<br><strong>Vigência:</strong> ' || coalesce(to_char(c.starts_at, 'DD/MM/YYYY'), 'não definida')
     || ' a ' || coalesce(to_char(c.ends_at, 'DD/MM/YYYY'), 'indeterminada')
  || '<br><strong>Valor total:</strong> ' || CASE
       WHEN c.total_value IS NULL THEN 'não informado'
       WHEN coalesce(c.currency, 'BRL') = 'BRL' THEN 'R$ ' || translate(to_char(c.total_value, 'FM999,999,999,990.00'), ',.', '.,')
       ELSE c.currency || ' ' || c.total_value::text
     END
  || CASE
       WHEN c.monthly_value IS NOT NULL THEN '<br><strong>Valor mensal:</strong> ' || CASE
         WHEN coalesce(c.currency, 'BRL') = 'BRL' THEN 'R$ ' || translate(to_char(c.monthly_value, 'FM999,999,999,990.00'), ',.', '.,')
         ELSE c.currency || ' ' || c.monthly_value::text
       END
       ELSE ''
     END
  || CASE WHEN c.hours_per_month IS NOT NULL THEN '<br><strong>Horas/mês:</strong> ' || c.hours_per_month::text || ' h' ELSE '' END
  || CASE WHEN pm IS NOT NULL THEN '<br><strong>Forma de pagamento:</strong> ' || replace(replace(replace(pm, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ELSE '' END
  || CASE WHEN c.payment_day IS NOT NULL THEN '<br><strong>Dia de pagamento:</strong> dia ' || c.payment_day::text ELSE '' END
  || CASE WHEN terms_summary IS NOT NULL THEN '<br><strong>Condições de pagamento:</strong> ' || replace(replace(replace(terms_summary, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ELSE '' END
  || '</p><hr>'
  || coalesce(c.body_html, '')
  || CASE WHEN svc IS NOT NULL THEN '<hr><h3>Serviços contratados</h3><ul>' || svc || '</ul>' ELSE '' END;
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_esign_body_without_attachments_purchase_v2(uuid, uuid)
 FROM PUBLIC, anon, authenticated, service_role, techerp_request_writer;

CREATE OR REPLACE FUNCTION public.hiring_contract_esign_body_without_attachments(p_ws uuid, p_contract uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE c public.contracts; ent text; counterparty text;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id = p_contract AND workspace_id = p_ws;
 IF c.id IS NULL THEN RETURN NULL; END IF;
 IF c.hiring_request_origin IS NULL THEN
  IF c.role::text = 'client' THEN
   RETURN public.hiring_contract_esign_body_without_attachments_purchase_v2(p_ws, p_contract);
  END IF;
  RETURN public.hiring_contract_esign_body_without_attachments_sales_v1(p_ws, p_contract);
 END IF;
 SELECT name INTO ent FROM public.legal_entities WHERE id = c.contracting_legal_entity_id AND workspace_id = p_ws;
 IF c.hiring_person_id IS NOT NULL THEN
  SELECT full_name INTO counterparty FROM public.people WHERE id = c.hiring_person_id AND workspace_id = p_ws;
 ELSE
  SELECT name INTO counterparty FROM public.companies WHERE id = c.counterparty_company_id AND workspace_id = p_ws;
 END IF;
 RETURN '<!--techerp:html--><h1>' || replace(replace(replace(c.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
  || '</h1><p><strong>WK contratante:</strong> ' || replace(replace(replace(coalesce(ent, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
  || '<br><strong>Pessoa/empresa contratada:</strong> ' || replace(replace(replace(coalesce(counterparty, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
  || '</p>' || c.body_html;
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_esign_body_without_attachments(uuid, uuid)
 FROM PUBLIC, anon, authenticated, service_role, techerp_request_writer;

CREATE OR REPLACE FUNCTION public.hiring_contract_fingerprint_without_attachments(p_contract uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE c public.contracts; a public.contract_service_signature_anchors;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id = p_contract;
 IF c.id IS NULL THEN RETURN NULL; END IF;
 IF c.role::text = 'provider' THEN
  SELECT * INTO a FROM public.contract_service_signature_anchors
   WHERE contract_id = c.id AND workspace_id = c.workspace_id;
  IF a.contract_id IS NOT NULL AND a.commercial_hash = public.contract_service_commercial_signature_hash(c.id)
   THEN RETURN a.signature_base_hash; END IF;
 END IF;
 IF c.role::text = 'client' AND c.hiring_request_origin IS NULL THEN
  RETURN encode(extensions.digest(convert_to(jsonb_build_object(
   'base', public.hiring_contract_fingerprint_with_service_state_v1(c.id),
   'esign_body_format', 'purchase_v2',
   'counterparty_legal', (
    SELECT jsonb_build_object('legal_name', to_jsonb(x)->>'legal_name', 'cnpj', to_jsonb(x)->>'cnpj')
    FROM public.companies x WHERE x.id = c.counterparty_company_id AND x.workspace_id = c.workspace_id
   ),
   'counterparty_contact', CASE WHEN c.counterparty_contact_id IS NOT NULL THEN (
    SELECT jsonb_build_object('id', ct.id, 'first_name', ct.first_name, 'last_name', ct.last_name)
    FROM public.contacts ct WHERE ct.id = c.counterparty_contact_id AND ct.workspace_id = c.workspace_id
   ) ELSE NULL END
  )::text, 'UTF8'), 'sha256'), 'hex');
 END IF;
 RETURN public.hiring_contract_fingerprint_with_service_state_v1(c.id);
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_fingerprint_without_attachments(uuid)
 FROM PUBLIC, anon, authenticated, service_role, techerp_request_writer;
