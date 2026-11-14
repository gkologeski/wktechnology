CREATE OR REPLACE FUNCTION public.hiring_contract_esign_body(p_ws uuid, p_contract uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts; ent text; cli text; svc text;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws;
 IF c.id IS NULL THEN RETURN NULL; END IF;
 SELECT replace(replace(replace(name||' — CNPJ '||coalesce(cnpj,''),'&','&amp;'),'<','&lt;'),'>','&gt;') INTO ent FROM public.legal_entities WHERE id=c.contracting_legal_entity_id AND workspace_id=p_ws;
 SELECT replace(replace(replace(name,'&','&amp;'),'<','&lt;'),'>','&gt;') INTO cli FROM public.companies WHERE id=c.counterparty_company_id AND workspace_id=p_ws;
 SELECT string_agg('<li>'||replace(replace(replace(name,'&','&amp;'),'<','&lt;'),'>','&gt;')||' — Quantidade: '||coalesce(quantity::text,'não informada')||' — Valor unitário: '||CASE WHEN unit_price IS NULL THEN 'não informado' WHEN coalesce(currency,'BRL')='BRL' THEN 'R$ '||translate(to_char(unit_price,'FM999,999,999,990.00'),',.','.,') ELSE currency||' '||unit_price::text END||'</li>','' ORDER BY id) INTO svc FROM public.services WHERE contract_id=c.id AND workspace_id=p_ws;
 RETURN '<!--techerp:html-->'
  ||'<h1>'||replace(replace(replace(c.title,'&','&amp;'),'<','&lt;'),'>','&gt;')||'</h1>'
  ||'<p><strong>Contrato:</strong> '||coalesce(c.number,c.id::text)||'<br><strong>Entidade prestadora:</strong> '||coalesce(ent,'')
  ||'<br><strong>Cliente:</strong> '||coalesce(cli,'')
  ||'<br><strong>Vigência:</strong> '||coalesce(to_char(c.starts_at,'DD/MM/YYYY'),'não definida')||' a '||coalesce(to_char(c.ends_at,'DD/MM/YYYY'),'indeterminada')
  ||'<br><strong>Valor total:</strong> '||CASE WHEN c.total_value IS NULL THEN 'não informado' WHEN coalesce(c.currency,'BRL')='BRL' THEN 'R$ '||translate(to_char(c.total_value,'FM999,999,999,990.00'),',.','.,') ELSE c.currency||' '||c.total_value::text END||'</p><hr>'
  ||c.body_html
  ||'<hr><h3>Serviços contratados</h3>'||CASE WHEN svc IS NULL THEN '<p>Nenhum cadastrado.</p>' ELSE '<ul>'||svc||'</ul>' END;
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_esign_body(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_contract_esign_body(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.hiring_contract_native_prepare(p_ws uuid,p_contract uuid,p_hash text,p_customer_name text,p_customer_email text,p_issuer_name text,p_issuer_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;d uuid;customer uuid;issuer uuid;body text;r jsonb;
BEGIN
 IF NOT public.hiring_signature_access(p_ws,p_contract,'manage') OR NOT public.hiring_signature_access(p_ws,p_contract,'view') THEN RAISE EXCEPTION 'Sem permissão para preparar assinatura.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws FOR UPDATE;
 IF p_hash IS DISTINCT FROM public.hiring_contract_fingerprint(c.id) THEN RAISE EXCEPTION 'Contrato alterado. Recarregue.';END IF;
 IF c.role::text<>'provider' OR c.document_kind='amendment' OR c.contracting_legal_entity_id IS NULL OR c.counterparty_company_id IS NULL OR c.deal_id IS NULL OR nullif(trim(c.body_html),'') IS NULL THEN RAISE EXCEPTION 'Defina negócio, partes, entidade WK e conteúdo do contrato principal de prestação.';END IF;
 IF length(trim(coalesce(p_customer_name,''))) NOT BETWEEN 2 AND 255 OR length(trim(coalesce(p_issuer_name,''))) NOT BETWEEN 2 AND 255 OR nullif(trim(p_customer_email),'') IS NULL OR nullif(trim(p_issuer_email),'') IS NULL OR lower(trim(p_customer_email))=lower(trim(p_issuer_email)) THEN RAISE EXCEPTION 'Informe representantes distintos do cliente e da entidade WK.';END IF;
 SELECT e.document_id INTO d FROM public.hiring_contract_evidence e JOIN public.esign_documents x ON x.id=e.document_id WHERE e.contract_id=c.id AND e.contract_hash=p_hash AND e.revoked_at IS NULL AND e.kind='native' AND x.status::text NOT IN('canceled','declined') LIMIT 1;
 IF d IS NOT NULL THEN RETURN d;END IF;
 body:=public.hiring_contract_esign_body(p_ws,c.id);
 r:=public.contract_esign_manage('create',NULL,jsonb_build_object('title',left(c.title,255),'body',body,'dealId',c.deal_id,'ordered',false,'signers',jsonb_build_array(jsonb_build_object('name',p_customer_name,'email',p_customer_email,'sign_order',1),jsonb_build_object('name',p_issuer_name,'email',p_issuer_email,'sign_order',2))));d:=(r->>'id')::uuid;
 SELECT id INTO customer FROM public.esign_signers WHERE document_id=d AND workspace_id=p_ws AND sign_order=1;
 SELECT id INTO issuer FROM public.esign_signers WHERE document_id=d AND workspace_id=p_ws AND sign_order=2;
 INSERT INTO public.hiring_contract_evidence(workspace_id,contract_id,kind,contract_hash,document_id,document_hash,customer_signer_id,issuer_signer_id,note,recorded_by) VALUES(p_ws,c.id,'native',p_hash,d,encode(extensions.digest(convert_to(body,'UTF8'),'sha256'),'hex'),customer,issuer,'Documento preparado da versão atual. Aguarda envio e conclusão pelas partes.',auth.uid());
 INSERT INTO public.hiring_signature_events(workspace_id,contract_id,actor_id,kind,details) VALUES(p_ws,c.id,auth.uid(),'native_prepared',jsonb_build_object('document_id',d));RETURN d;
END $$;