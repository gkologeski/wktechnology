-- Package 3: reviewed additive migration.
CREATE OR REPLACE FUNCTION public.hiring_contract_fingerprint_without_attachments(p_contract uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT encode(extensions.digest(convert_to(jsonb_build_object(
 'contract',to_jsonb(c)-ARRAY['hiring_request_origin','hiring_person_id','status','updated_at','created_at','owner_id','assigned_to','public_token','signed_at','signed_pdf_path','signature_provider','signature_document_id','signature_operation_id','import_confidence','imported_from'],
 'issuer',(SELECT jsonb_build_object('id',l.id,'name',l.name,'cnpj',l.cnpj) FROM public.legal_entities l WHERE l.id=c.contracting_legal_entity_id AND l.workspace_id=c.workspace_id),
 'counterparty',(SELECT jsonb_build_object('id',x.id,'name',x.name,'cnpj',to_jsonb(x)->>'cnpj') FROM public.companies x WHERE x.id=c.counterparty_company_id AND x.workspace_id=c.workspace_id),
 'services',coalesce((SELECT jsonb_agg(to_jsonb(s)-ARRAY['updated_at','created_at','owner_id','assigned_to','delivery_owner_id','next_billing_at','metadata'] ORDER BY s.id) FROM public.services s WHERE s.contract_id=c.id AND s.workspace_id=c.workspace_id),'[]'))::text,'UTF8'),'sha256'),'hex') FROM public.contracts c WHERE c.id=p_contract
$$;
REVOKE ALL ON FUNCTION public.hiring_contract_fingerprint_without_attachments(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.hiring_contract_esign_body_without_attachments_sales_v1(p_ws uuid, p_contract uuid)
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
REVOKE ALL ON FUNCTION public.hiring_contract_esign_body_without_attachments_sales_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.hiring_contract_esign_body_without_attachments(p_ws uuid,p_contract uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;ent text;counterparty text;
BEGIN
 SELECT * INTO c FROM contracts WHERE id=p_contract AND workspace_id=p_ws;
 IF c.hiring_request_origin IS NULL THEN RETURN public.hiring_contract_esign_body_without_attachments_sales_v1(p_ws,p_contract);END IF;
 SELECT name INTO ent FROM legal_entities WHERE id=c.contracting_legal_entity_id AND workspace_id=p_ws;
 IF c.hiring_person_id IS NOT NULL THEN SELECT full_name INTO counterparty FROM people WHERE id=c.hiring_person_id AND workspace_id=p_ws;
 ELSE SELECT name INTO counterparty FROM companies WHERE id=c.counterparty_company_id AND workspace_id=p_ws;END IF;
 RETURN '<!--techerp:html--><h1>'||replace(replace(replace(c.title,'&','&amp;'),'<','&lt;'),'>','&gt;')||'</h1><p><strong>WK contratante:</strong> '||replace(replace(replace(coalesce(ent,''),'&','&amp;'),'<','&lt;'),'>','&gt;')||'<br><strong>Pessoa/empresa contratada:</strong> '||replace(replace(replace(coalesce(counterparty,''),'&','&amp;'),'<','&lt;'),'>','&gt;')||'</p>'||c.body_html;
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_esign_body_without_attachments(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.hiring_contract_native_prepare_sales_v1(p_ws uuid,p_contract uuid,p_hash text,p_customer_name text,p_customer_email text,p_issuer_name text,p_issuer_email text)
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
REVOKE ALL ON FUNCTION public.hiring_contract_native_prepare_sales_v1(uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.hiring_contract_native_prepare(p_ws uuid,p_contract uuid,p_hash text,p_customer_name text,p_customer_email text,p_issuer_name text,p_issuer_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;d uuid;customer uuid;issuer uuid;body text;r jsonb;
BEGIN
 IF NOT public.hiring_signature_access(p_ws,p_contract,'manage') OR NOT public.hiring_signature_access(p_ws,p_contract,'view') THEN RAISE EXCEPTION 'Sem permissão para preparar assinatura.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws FOR UPDATE;
 IF p_hash IS DISTINCT FROM public.hiring_contract_fingerprint(c.id) THEN RAISE EXCEPTION 'Contrato alterado. Recarregue.';END IF;
 IF c.hiring_request_origin IS NULL THEN RETURN public.hiring_contract_native_prepare_sales_v1(p_ws,p_contract,p_hash,p_customer_name,p_customer_email,p_issuer_name,p_issuer_email);END IF;
 PERFORM public.hiring_formalization_signature_gate(p_ws,p_contract,p_hash);
 IF c.role::text<>'client' OR c.contracting_legal_entity_id IS NULL OR (c.hiring_person_id IS NULL AND c.counterparty_company_id IS NULL) OR nullif(trim(c.body_html),'') IS NULL THEN RAISE EXCEPTION 'Confira partes e conteúdo do instrumento de compra.';END IF;
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
REVOKE ALL ON FUNCTION public.hiring_contract_native_prepare(uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_esign_public_sales_v1(p_token text,p_action text,p_name text DEFAULT NULL,p_signature text DEFAULT NULL,p_reason text DEFAULT NULL,p_ip text DEFAULT NULL,p_ua text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s esign_signers;d esign_documents;can_sign boolean;others jsonb;BEGIN
 IF p_action NOT IN('view','sign','decline') OR length(p_token) NOT BETWEEN 10 AND 100 THEN RAISE EXCEPTION 'Link inválido.';END IF;
 SELECT * INTO s FROM esign_signers WHERE public_token=p_token;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Link inválido.';END IF;
 SELECT * INTO d FROM esign_documents WHERE id=s.document_id AND workspace_id=s.workspace_id FOR UPDATE;
 SELECT * INTO s FROM esign_signers WHERE id=s.id FOR UPDATE;
 IF position('<!--techerp:contract-package:' in d.body)>0 AND NOT EXISTS(
 SELECT 1 FROM public.hiring_contract_evidence e JOIN public.contract_signature_packages p ON p.contract_id=e.contract_id AND p.workspace_id=e.workspace_id AND p.contract_hash=e.contract_hash
 JOIN storage.objects o ON o.bucket_id='contract-signature-packages' AND o.name=p.storage_path AND o.user_metadata->>'sha256'=p.sha256
 WHERE e.document_id=d.id AND e.workspace_id=d.workspace_id AND e.kind='native' AND e.revoked_at IS NULL
 AND position('<!--techerp:contract-package:'||p.id::text||':'||p.sha256||'-->' in d.body)>0
 ) THEN RAISE EXCEPTION 'Pacote de assinatura revogado ou indisponível.' USING ERRCODE='42501';END IF;
 IF d.id IS NULL OR EXISTS(SELECT 1 FROM ats_offers WHERE esign_document_id=d.id) THEN RAISE EXCEPTION 'Use o fluxo específico de contratação.';END IF;
 IF d.status IN('draft','canceled') OR (d.expires_at IS NOT NULL AND d.expires_at<=now()) THEN RAISE EXCEPTION 'Link inválido ou expirado.' USING ERRCODE='23514';END IF;
 can_sign:=d.status IN('sent','partially_signed') AND s.status IN('pending','viewed') AND (NOT d.ordered OR NOT EXISTS(SELECT 1 FROM esign_signers WHERE document_id=d.id AND sign_order<s.sign_order AND status<>'signed'));
 IF p_action<>'view' AND NOT can_sign THEN RAISE EXCEPTION 'Assinatura indisponível.' USING ERRCODE='23514';END IF;
 IF p_action='sign' AND (length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 255 OR length(coalesce(p_signature,''))>500000) THEN RAISE EXCEPTION 'Assinatura inválida.';END IF;
 IF p_action='decline' AND length(coalesce(p_reason,''))>1000 THEN RAISE EXCEPTION 'Motivo excede o limite.';END IF;
 IF d.content_hash IS NULL AND d.status IN('sent','partially_signed') THEN
 UPDATE esign_documents SET content_hash=encode(extensions.digest(convert_to(body,'UTF8'),'sha256'),'hex'),sealed_at=now() WHERE id=d.id;
 INSERT INTO esign_audit(workspace_id,document_id,owner_id,event,metadata) VALUES(d.workspace_id,d.id,d.owner_id,'legacy_snapshot',jsonb_build_object('captured_at',now(),'historical_seal',false));
 END IF;
 IF p_action='sign' THEN UPDATE esign_signers SET status='signed',signed_name=p_name,signature_data=p_signature,signed_at=now(),ip_address=p_ip,user_agent=p_ua WHERE id=s.id;
 ELSIF p_action='decline' THEN UPDATE esign_signers SET status='declined',decline_reason=p_reason,declined_at=now(),ip_address=p_ip,user_agent=p_ua WHERE id=s.id;
 ELSIF s.viewed_at IS NULL THEN UPDATE esign_signers SET viewed_at=now(),status=CASE WHEN status='pending' THEN 'viewed'::esign_signer_status ELSE status END WHERE id=s.id;
 END IF;
 IF p_action<>'view' OR s.viewed_at IS NULL THEN INSERT INTO esign_audit(workspace_id,document_id,signer_id,owner_id,event,ip_address,user_agent) VALUES(d.workspace_id,d.id,s.id,s.owner_id,p_action,p_ip,p_ua);END IF;
 IF p_action<>'view' THEN RETURN jsonb_build_object('ok',true);END IF;
 SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'sign_order',sign_order,'status',status,'signed_at',signed_at) ORDER BY sign_order) INTO others FROM esign_signers WHERE document_id=d.id;
 RETURN jsonb_build_object('doc',jsonb_build_object('id',d.id,'title',d.title,'description',d.description,'body',d.body,'status',d.status,'ordered',d.ordered,'expires_at',d.expires_at),'signer',jsonb_build_object('id',s.id,'name',s.name,'email',s.email,'status',s.status,'signed_name',s.signed_name,'signed_at',s.signed_at,'decline_reason',s.decline_reason),'signers',coalesce(others,'[]'),'canSign',can_sign);
END $$;
REVOKE ALL ON FUNCTION public.contract_esign_public_sales_v1(text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.contract_esign_public(p_token text,p_action text,p_name text DEFAULT NULL,p_signature text DEFAULT NULL,p_reason text DEFAULT NULL,p_ip text DEFAULT NULL,p_ua text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k uuid;w uuid;h text;
BEGIN
 SELECT e.contract_id,e.workspace_id,e.contract_hash INTO k,w,h FROM esign_signers z JOIN hiring_contract_evidence e ON e.document_id=z.document_id WHERE z.public_token=p_token AND e.kind='native' AND e.revoked_at IS NULL LIMIT 1;
 IF k IS NOT NULL THEN PERFORM hiring_formalization_signature_gate(w,k,h);END IF;
 RETURN public.contract_esign_public_sales_v1(p_token,p_action,p_name,p_signature,p_reason,p_ip,p_ua);
END $$;
REVOKE ALL ON FUNCTION public.contract_esign_public(text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.contract_esign_public(text,text,text,text,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.hiring_contract_signers_prepare_sales_v1(p_ws uuid,p_contract uuid,p_hash text,p_signers jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts; x jsonb; item public.contacts; contacts jsonb:='[]'; d uuid; e uuid; s uuid; r text; n text; mail text; body text; old_manifest jsonb; wanted jsonb;
BEGIN
 IF auth.uid() IS NULL OR is_read_only_view() OR NOT public.hiring_signature_access(p_ws,p_contract,'manage') OR NOT public.hiring_signature_access(p_ws,p_contract,'view') THEN RAISE EXCEPTION 'Sem permissão para preparar assinatura.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws FOR UPDATE;
 IF c.id IS NULL OR p_hash IS DISTINCT FROM public.hiring_contract_fingerprint(c.id) THEN RAISE EXCEPTION 'Contrato alterado. Recarregue.';END IF;
 IF jsonb_typeof(p_signers) IS DISTINCT FROM 'array' OR jsonb_array_length(p_signers) NOT BETWEEN 2 AND 20 THEN RAISE EXCEPTION 'Informe as partes e os demais signatários incluídos.';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_signers) LOOP
  r:=upper(trim(x->>'role'));
  IF r IS NULL OR length(r) NOT BETWEEN 2 AND 80 OR r !~ '^[A-Z0-9_ -]+$' OR EXISTS(SELECT 1 FROM jsonb_array_elements(contacts) v WHERE v->>'role'=r OR v->>'contact_id'=x->>'contactId') THEN RAISE EXCEPTION 'Papéis e contatos devem ser distintos.';END IF;
  SELECT * INTO item FROM public.contacts WHERE id=(x->>'contactId')::uuid AND workspace_id=p_ws AND deleted_at IS NULL;
  IF item.id IS NULL OR NOT public.sales_record_access('contacts',item.id,'view') THEN RAISE EXCEPTION 'Contato indisponível para este usuário e workspace.' USING ERRCODE='42501';END IF;
  n:=trim(concat_ws(' ',item.first_name,item.last_name));mail:=trim(item.email);
  IF length(n) NOT BETWEEN 2 AND 255 OR coalesce(length(mail),0) NOT BETWEEN 3 AND 255 OR mail !~ '^[^[:space:]@]+@[^[:space:]@]+$' OR EXISTS(SELECT 1 FROM jsonb_array_elements(contacts) v WHERE lower(v->>'email')=lower(mail)) THEN RAISE EXCEPTION 'Cada signatário deve ter nome e e-mail válidos e distintos. Atualize o contato.';END IF;
  contacts:=contacts||jsonb_build_array(jsonb_build_object('role',r,'contact_id',item.id,'name',n,'email',mail));
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(contacts) v WHERE v->>'role' IN('CONTRATANTE','CONTRATADO'))<>2 THEN RAISE EXCEPTION 'Contratante e contratado são obrigatórios.';END IF;
 SELECT ev.document_id,ev.id INTO d,e FROM public.hiring_contract_evidence ev JOIN public.esign_documents doc ON doc.id=ev.document_id WHERE ev.workspace_id=p_ws AND ev.contract_id=p_contract AND ev.contract_hash=p_hash AND ev.kind='native' AND ev.revoked_at IS NULL AND doc.status::text NOT IN('canceled','declined') ORDER BY ev.recorded_at DESC LIMIT 1;
 IF d IS NOT NULL THEN
  SELECT jsonb_agg(jsonb_build_object('role',p.role,'contact_id',p.contact_id,'name',z.name,'email',z.email) ORDER BY p.role) INTO old_manifest FROM public.contract_signature_participants p JOIN public.esign_signers z ON z.id=p.signer_id WHERE p.document_id=d;
  SELECT jsonb_agg(v ORDER BY v->>'role') INTO wanted FROM jsonb_array_elements(contacts) v;
  IF old_manifest IS NOT DISTINCT FROM wanted THEN RETURN d;END IF;
  RAISE EXCEPTION 'Já existe uma preparação desta versão. Revogue a evidência anterior antes de alterar signatários.';
 END IF;
 d:=public.hiring_contract_native_prepare(p_ws,p_contract,p_hash,
  (SELECT v->>'name' FROM jsonb_array_elements(contacts) v WHERE v->>'role'='CONTRATANTE'),(SELECT v->>'email' FROM jsonb_array_elements(contacts) v WHERE v->>'role'='CONTRATANTE'),
  (SELECT v->>'name' FROM jsonb_array_elements(contacts) v WHERE v->>'role'='CONTRATADO'),(SELECT v->>'email' FROM jsonb_array_elements(contacts) v WHERE v->>'role'='CONTRATADO'));
 SELECT id INTO e FROM public.hiring_contract_evidence WHERE document_id=d AND workspace_id=p_ws AND contract_id=p_contract;
 FOR x IN SELECT value FROM jsonb_array_elements(contacts) LOOP
  r:=x->>'role';
  IF r NOT IN('CONTRATANTE','CONTRATADO') THEN
   PERFORM public.contract_esign_manage('add_signer',d,jsonb_build_object('name',x->>'name','email',x->>'email','sign_order',(SELECT count(*)+1 FROM public.esign_signers WHERE document_id=d)));
  END IF;
  SELECT id INTO s FROM public.esign_signers WHERE workspace_id=p_ws AND document_id=d AND email=x->>'email';
  INSERT INTO public.contract_signature_participants(workspace_id,evidence_id,document_id,signer_id,contact_id,role) VALUES(p_ws,e,d,s,(x->>'contact_id')::uuid,r);
 END LOOP;
 INSERT INTO public.hiring_signature_events(workspace_id,contract_id,actor_id,kind,details) VALUES(p_ws,p_contract,auth.uid(),'participants_prepared',jsonb_build_object('document_id',d,'roles',(SELECT jsonb_agg(v->>'role') FROM jsonb_array_elements(contacts) v)));
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_signers_prepare_sales_v1(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
CREATE OR REPLACE FUNCTION public.hiring_contract_signers_prepare(p_ws uuid,p_contract uuid,p_hash text,p_signers jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN PERFORM hiring_formalization_signature_gate(p_ws,p_contract,p_hash);RETURN hiring_contract_signers_prepare_sales_v1(p_ws,p_contract,p_hash,p_signers);END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_signers_prepare(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_contract_signers_prepare(uuid,uuid,text,jsonb) TO authenticated;
