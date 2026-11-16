CREATE OR REPLACE FUNCTION public.hiring_contract_fingerprint_without_attachments(p_contract uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT encode(extensions.digest(convert_to(jsonb_build_object(
 'contract',to_jsonb(c)-ARRAY['hiring_person_id','status','updated_at','created_at','owner_id','assigned_to','public_token','signed_at','signed_pdf_path','signature_provider','signature_document_id','signature_operation_id','import_confidence','imported_from'],
 'issuer',(SELECT jsonb_build_object('id',l.id,'name',l.name,'cnpj',l.cnpj) FROM public.legal_entities l WHERE l.id=c.contracting_legal_entity_id AND l.workspace_id=c.workspace_id),
 'counterparty',(SELECT jsonb_build_object('id',x.id,'name',x.name,'cnpj',to_jsonb(x)->>'cnpj') FROM public.companies x WHERE x.id=c.counterparty_company_id AND x.workspace_id=c.workspace_id),
 'services',coalesce((SELECT jsonb_agg(to_jsonb(s)-ARRAY['updated_at','created_at','owner_id','assigned_to','delivery_owner_id','next_billing_at','metadata'] ORDER BY s.id) FROM public.services s WHERE s.contract_id=c.id AND s.workspace_id=c.workspace_id),'[]'))::text,'UTF8'),'sha256'),'hex') FROM public.contracts c WHERE c.id=p_contract
$$;
REVOKE ALL ON FUNCTION public.hiring_contract_fingerprint_without_attachments(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.hiring_contract_esign_body_without_attachments(p_ws uuid, p_contract uuid)
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
REVOKE ALL ON FUNCTION public.hiring_contract_esign_body_without_attachments(uuid,uuid) FROM PUBLIC,anon,authenticated;
ALTER TABLE public.contract_attachments ADD COLUMN sha256 text CHECK(sha256 ~ '^[a-f0-9]{64}$');
ALTER TABLE public.contract_attachments ADD COLUMN source_stamp text CHECK(source_stamp ~ '^[a-f0-9]{64}$'),ADD COLUMN source_name text,ADD COLUMN source_snapshot_path text,ADD COLUMN source_snapshot_sha256 text CHECK(source_snapshot_sha256 ~ '^[a-f0-9]{64}$');
CREATE TABLE public.contract_signature_packages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,contract_hash text NOT NULL CHECK(contract_hash ~ '^[a-f0-9]{64}$'),
 storage_path text NOT NULL UNIQUE,sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='array' AND jsonb_array_length(manifest) BETWEEN 1 AND 30),
 page_count integer NOT NULL CHECK(page_count BETWEEN 1 AND 2000),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(contract_id,contract_hash)
);
ALTER TABLE public.contract_signature_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_signature_packages FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.contract_signature_packages TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('contract-signature-packages','contract-signature-packages',false,52428800,ARRAY['application/pdf']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY contract_signature_package_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING(bucket_id<>'contract-signature-packages') WITH CHECK(bucket_id<>'contract-signature-packages');

CREATE OR REPLACE FUNCTION public.contract_attachment_source_stamp(p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.contract_attachments; source jsonb; items jsonb; w uuid; company uuid; contact uuid; agent uuid; template uuid; deal uuid; quote uuid;
BEGIN
 SELECT * INTO a FROM public.contract_attachments WHERE id=p_id AND ready;
 IF a.id IS NULL THEN RETURN NULL;END IF;
 IF a.kind='file' THEN RETURN a.sha256;END IF;
 w:=a.workspace_id;
 IF a.kind='quote' THEN SELECT to_jsonb(q),q.company_id,q.contact_id,q.owner_id,q.template_id,q.deal_id,q.id INTO source,company,contact,agent,template,deal,quote FROM public.quotes q WHERE q.id=a.source_id AND q.workspace_id=w;
 ELSE SELECT to_jsonb(p),p.company_id,p.contact_id,p.owner_id,p.deal_id,p.quote_id INTO source,company,contact,agent,deal,quote FROM public.proposals p WHERE p.id=a.source_id AND p.workspace_id=w;END IF;
 IF source IS NULL THEN RETURN NULL;END IF;
 source:=source-ARRAY['public_token','updated_at'];
 SELECT jsonb_build_object('quote_items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.quote_line_items i WHERE i.workspace_id=w AND i.quote_id=quote),'[]'),
 'deal_items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM public.deal_line_items i WHERE i.workspace_id=w AND i.deal_id=deal),'[]'),
 'services',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) ORDER BY s.id) FROM public.service_catalog s WHERE s.workspace_id=w AND s.id IN(SELECT i.service_catalog_id FROM public.deal_line_items i WHERE i.workspace_id=w AND i.deal_id=deal UNION SELECT i.service_catalog_id FROM public.quote_line_items i WHERE i.workspace_id=w AND i.quote_id=quote)),'[]'),
 'presets',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) ORDER BY s.id) FROM public.contracting_presets s WHERE s.workspace_id=w AND s.id IN(SELECT i.contracting_preset_id FROM public.deal_line_items i WHERE i.workspace_id=w AND i.deal_id=deal UNION SELECT i.contracting_preset_id FROM public.quote_line_items i WHERE i.workspace_id=w AND i.quote_id=quote)),'[]')) INTO items;
 RETURN encode(extensions.digest(convert_to(jsonb_build_object('source',source,'items',items,
 'company',(SELECT jsonb_build_object('name',c.name,'website',c.website) FROM public.companies c WHERE c.id=company AND c.workspace_id=w),
 'contact',(SELECT jsonb_build_object('first_name',c.first_name,'last_name',c.last_name,'email',c.email) FROM public.contacts c WHERE c.id=contact AND c.workspace_id=w),
 'agent',(SELECT p.full_name FROM public.profiles p WHERE p.id=agent),
 'template',(SELECT t.html FROM public.quote_templates t WHERE t.id=template AND t.workspace_id=w))::text,'UTF8'),'sha256'),'hex');
END $$;
REVOKE ALL ON FUNCTION public.contract_attachment_source_stamp(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.hiring_contract_fingerprint(p_contract uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE base text; annexes jsonb;
BEGIN
 base:=public.hiring_contract_fingerprint_without_attachments(p_contract);
 SELECT jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'name',a.file_name,'source_id',a.source_id,'stamp',coalesce(a.source_stamp,public.contract_attachment_source_stamp(a.id))) ORDER BY a.created_at,a.id) INTO annexes FROM public.contract_attachments a WHERE a.contract_id=p_contract AND a.ready;
 IF annexes IS NULL THEN RETURN base;END IF;
 RETURN encode(extensions.digest(convert_to(base||annexes::text,'UTF8'),'sha256'),'hex');
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_fingerprint(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.contract_attachment_signing_context(p_contract uuid,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(public.work_access_context()->>'workspace')::uuid; a public.contract_attachments; rows jsonb:='[]'; n text;
BEGIN
 IF auth.uid() IS NULL OR w IS NULL OR public.is_read_only_view() OR NOT public.hiring_signature_access(w,p_contract,'view') OR NOT public.hiring_signature_access(w,p_contract,'manage') OR NOT public.work_record_access('techcontracts.contracts',p_contract,'view') THEN RAISE EXCEPTION 'Sem permissão para preparar contrato e anexos.' USING ERRCODE='42501';END IF;
 IF p_hash IS DISTINCT FROM public.hiring_contract_fingerprint(p_contract) THEN RAISE EXCEPTION 'Contrato ou anexos alterados. Recarregue.';END IF;
 FOR a IN SELECT * FROM public.contract_attachments WHERE workspace_id=w AND contract_id=p_contract AND ready ORDER BY created_at,id LOOP
 IF a.kind<>'file' AND NOT public.sales_record_access(CASE a.kind WHEN 'quote' THEN 'quotes' ELSE 'proposals' END,a.source_id,'view') THEN RAISE EXCEPTION 'Um anexo comercial não está disponível no seu acesso.' USING ERRCODE='42501';END IF;
 IF a.source_name IS NOT NULL THEN n:=a.source_name;
 ELSIF a.kind='file' THEN n:=a.file_name;
 ELSIF a.kind='quote' THEN SELECT title INTO n FROM public.quotes WHERE id=a.source_id AND workspace_id=w;
 ELSE SELECT title||' · versão '||version INTO n FROM public.proposals WHERE id=a.source_id AND workspace_id=w;END IF;
 IF coalesce(a.source_stamp,public.contract_attachment_source_stamp(a.id)) IS NULL OR n IS NULL THEN RAISE EXCEPTION 'Um anexo está incompleto ou foi excluído. Revise antes de enviar.';END IF;
 rows:=rows||jsonb_build_array(jsonb_build_object('id',a.id,'kind',a.kind,'name',n,'source_id',a.source_id,'storage_path',a.storage_path,'source_snapshot_path',a.source_snapshot_path,'source_snapshot_sha256',a.source_snapshot_sha256,'stamp',coalesce(a.source_stamp,public.contract_attachment_source_stamp(a.id))));
 END LOOP;
 IF jsonb_array_length(rows)>30 THEN RAISE EXCEPTION 'Máximo de 30 anexos no pacote de assinatura.';END IF;
 IF jsonb_array_length(rows)>0 AND NOT EXISTS(SELECT 1 FROM public.contracts WHERE id=p_contract AND workspace_id=w AND nullif(btrim(body_html),'') IS NOT NULL) THEN RAISE EXCEPTION 'Preencha o corpo do contrato antes de preparar o pacote com anexos.';END IF;
 RETURN jsonb_build_object('workspace_id',w,'attachments',rows,'body',public.hiring_contract_esign_body_without_attachments(w,p_contract));
END $$;
REVOKE ALL ON FUNCTION public.contract_attachment_signing_context(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_attachment_signing_context(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.contract_signature_package_store(p_ws uuid,p_contract uuid,p_actor uuid,p_hash text,p_path text,p_sha text,p_manifest jsonb,p_pages integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.contract_signature_packages; c public.contracts; a public.contract_attachments; line jsonb;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws FOR UPDATE;
 IF c.id IS NULL OR NOT public.is_workspace_member(p_ws,p_actor) OR p_hash IS DISTINCT FROM public.hiring_contract_fingerprint(c.id) OR p_path NOT LIKE p_ws::text||'/'||p_contract::text||'/'||p_hash||'/%' OR p_sha !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='contract-signature-packages' AND name=p_path AND user_metadata->>'sha256'=p_sha) THEN RAISE EXCEPTION 'Pacote indisponível ou versão alterada.' USING ERRCODE='42501';END IF;
 FOR a IN SELECT * FROM public.contract_attachments WHERE contract_id=c.id AND workspace_id=p_ws AND ready AND kind IN('quote','proposal') AND source_stamp IS NULL FOR UPDATE LOOP
  SELECT value INTO line FROM jsonb_array_elements(p_manifest) WHERE value->>'id'=a.id::text;
  IF line IS NULL OR line->>'stamp' IS DISTINCT FROM public.contract_attachment_source_stamp(a.id) OR line->>'source_pdf_path' NOT LIKE p_ws::text||'/'||p_contract::text||'/'||p_hash||'/%' OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-signature-packages' AND o.name=line->>'source_pdf_path' AND o.user_metadata->>'sha256'=line->>'sha256') THEN RAISE EXCEPTION 'Cópia do anexo indisponível ou alterada.';END IF;
  UPDATE public.contract_attachments SET source_stamp=line->>'stamp',source_name=line->>'name',source_snapshot_path=line->>'source_pdf_path',source_snapshot_sha256=line->>'sha256' WHERE id=a.id;
 END LOOP;
 INSERT INTO public.contract_signature_packages(workspace_id,contract_id,contract_hash,storage_path,sha256,manifest,page_count,created_by) VALUES(p_ws,c.id,p_hash,p_path,p_sha,p_manifest,p_pages,p_actor) ON CONFLICT(contract_id,contract_hash) DO NOTHING;
 SELECT * INTO r FROM public.contract_signature_packages WHERE contract_id=c.id AND contract_hash=p_hash;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.contract_signature_package_store(uuid,uuid,uuid,text,text,text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contract_signature_package_store(uuid,uuid,uuid,text,text,text,jsonb,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.hiring_contract_esign_body(p_ws uuid,p_contract uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE base text; p public.contract_signature_packages; line jsonb; annex text:='';
BEGIN
 base:=public.hiring_contract_esign_body_without_attachments(p_ws,p_contract);
 IF NOT EXISTS(SELECT 1 FROM public.contract_attachments WHERE contract_id=p_contract AND workspace_id=p_ws AND ready) THEN RETURN base;END IF;
 SELECT * INTO p FROM public.contract_signature_packages WHERE workspace_id=p_ws AND contract_id=p_contract AND contract_hash=public.hiring_contract_fingerprint(p_contract);
 IF p.id IS NULL THEN RAISE EXCEPTION 'Prepare o pacote com anexos antes de enviar para assinatura.';END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p.manifest) LOOP
 annex:=annex||'<li>'||replace(replace(replace(line->>'name','&','&amp;'),'<','&lt;'),'>','&gt;')||' — SHA-256: '||(line->>'sha256')||'</li>';
 END LOOP;
 RETURN base||'<!--techerp:contract-package:'||p.id::text||':'||p.sha256||'-->'||'<hr><h2>Anexos integrantes do contrato</h2><p>Esta assinatura abrange o contrato e todos os anexos do pacote PDF de SHA-256 '||p.sha256||'.</p><ul>'||annex||'</ul>';
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_esign_body(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_contract_esign_body(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.contract_attachment_manage(p_contract uuid,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid; c public.contracts; a public.contract_attachments; s uuid; label text; k text; ref uuid; result jsonb; n text;
BEGIN
 w:=public.work_area_authorize('techcontracts.contracts',CASE WHEN p_action IN('list','sources') THEN 'view' ELSE 'update' END,p_contract);
 IF auth.uid() IS NULL OR NOT public.work_record_access('techcontracts.contracts',p_contract,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=w FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 IF p_action='sources' THEN
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'title'),'[]') INTO result FROM (
   SELECT jsonb_build_object('kind','quote','id',q.id,'title',q.title) x FROM public.quotes q
    WHERE q.workspace_id=w AND (q.id=c.quote_id OR (c.deal_id IS NOT NULL AND q.deal_id=c.deal_id)) AND public.sales_record_access('quotes',q.id,'view')
   UNION ALL SELECT jsonb_build_object('kind','proposal','id',p.id,'title',p.title||' · versão '||p.version) FROM public.proposals p
    WHERE p.workspace_id=w AND (p.id=c.proposal_id OR (c.deal_id IS NOT NULL AND p.deal_id=c.deal_id)) AND public.sales_record_access('proposals',p.id,'view')
  ) t; RETURN result;
 ELSIF p_action='list' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'kind',t.kind,'source_id',t.source_id,'name',CASE t.kind WHEN 'file' THEN t.file_name WHEN 'quote' THEN coalesce(t.source_name,q.title) ELSE coalesce(t.source_name,p.title||' · versão '||p.version) END,'created_at',t.created_at,'frozen',t.source_stamp IS NOT NULL) ORDER BY t.created_at DESC),'[]') INTO result
  FROM public.contract_attachments t LEFT JOIN public.quotes q ON t.kind='quote' AND q.id=t.source_id LEFT JOIN public.proposals p ON t.kind='proposal' AND p.id=t.source_id
  WHERE t.contract_id=c.id AND t.workspace_id=w AND t.ready AND (t.kind='file' OR public.sales_record_access(CASE t.kind WHEN 'quote' THEN 'quotes' ELSE 'proposals' END,t.source_id,'view'));
  RETURN result;
 ELSIF p_action='link' THEN
  k:=p_data->>'kind'; s:=(p_data->>'source_id')::uuid;
  IF k='quote' THEN
   SELECT q.id INTO ref FROM public.quotes q WHERE q.id=s AND q.workspace_id=w AND (q.id=c.quote_id OR (c.deal_id IS NOT NULL AND q.deal_id=c.deal_id)) AND public.sales_record_access('quotes',q.id,'view');
  ELSIF k='proposal' THEN
   SELECT p.id INTO ref FROM public.proposals p WHERE p.id=s AND p.workspace_id=w AND (p.id=c.proposal_id OR (c.deal_id IS NOT NULL AND p.deal_id=c.deal_id)) AND public.sales_record_access('proposals',p.id,'view');
  END IF;
  IF ref IS NULL THEN RAISE EXCEPTION 'Documento comercial indisponível para este contrato.' USING ERRCODE='42501';END IF;
  INSERT INTO public.contract_attachments(workspace_id,contract_id,kind,source_id,ready,created_by) VALUES(w,c.id,k,s,true,auth.uid()) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok',true);
 ELSIF p_action='reserve' THEN
  n:=btrim(p_data->>'name');
  IF n IS NULL OR length(n) NOT BETWEEN 1 AND 255 OR n ~ '[[:cntrl:]/\\]' THEN RAISE EXCEPTION 'Nome de arquivo inválido.';END IF;
  a.id:=gen_random_uuid();
  INSERT INTO public.contract_attachments(id,workspace_id,contract_id,kind,file_name,storage_path,created_by)
  VALUES(a.id,w,c.id,'file',n,w::text||'/'||c.id::text||'/'||a.id::text,auth.uid()) RETURNING * INTO a;
  RETURN jsonb_build_object('id',a.id,'path',a.storage_path);
 END IF;
 SELECT * INTO a FROM public.contract_attachments WHERE id=(p_data->>'id')::uuid AND contract_id=c.id AND workspace_id=w FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Anexo indisponível.' USING ERRCODE='42501';END IF;
 IF p_action='finish' THEN
  IF a.ready THEN RETURN jsonb_build_object('ok',true);END IF;
  IF a.kind<>'file' OR a.created_by<>auth.uid() OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-attachments' AND o.name=a.storage_path AND (o.metadata->>'size')::bigint BETWEEN 1 AND 20971520) THEN RAISE EXCEPTION 'Upload não concluído.';END IF;
  IF coalesce(p_data->>'sha256','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Hash do arquivo inválido.';END IF;
  UPDATE public.contract_attachments SET ready=true,sha256=p_data->>'sha256' WHERE id=a.id;
 ELSIF p_action='remove' THEN
  DELETE FROM public.contract_attachments WHERE id=a.id;
 ELSE RAISE EXCEPTION 'Ação inválida.';END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE OR REPLACE FUNCTION public.contract_attachment_storage_allowed(p_path text,p_write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.contract_attachments a WHERE a.storage_path=p_path AND a.workspace_id=(public.work_access_context()->>'workspace')::uuid
 AND public.work_record_access('techcontracts.contracts',a.contract_id,'view')
 AND CASE WHEN p_write THEN NOT a.ready AND a.created_by=auth.uid() AND NOT public.is_read_only_view() AND public.work_record_access('techcontracts.contracts',a.contract_id,'update') ELSE a.ready OR (a.created_by=auth.uid() AND NOT public.is_read_only_view() AND public.work_record_access('techcontracts.contracts',a.contract_id,'update')) END)
$$;
CREATE POLICY contract_attachment_anon_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id NOT IN('contract-attachments','contract-signature-packages')) WITH CHECK(bucket_id NOT IN('contract-attachments','contract-signature-packages'));
CREATE INDEX IF NOT EXISTS hiring_evidence_native_document_lookup ON public.hiring_contract_evidence(document_id,workspace_id) WHERE kind='native' AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.contract_esign_public(p_token text,p_action text,p_name text DEFAULT NULL,p_signature text DEFAULT NULL,p_reason text DEFAULT NULL,p_ip text DEFAULT NULL,p_ua text DEFAULT NULL)
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

REVOKE ALL ON FUNCTION public.contract_esign_public(text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contract_esign_public(text,text,text,text,text,text,text) TO service_role;
-- Integrate the explicit bucket with the existing deny-by-default global
-- Storage boundary. All other buckets still use the unchanged resolver.
ALTER POLICY shared_storage_read ON storage.objects USING(
 CASE WHEN bucket_id='contract-attachments' THEN public.shared_storage_session_access('view') AND public.contract_attachment_storage_allowed(name,false)
 ELSE public.shared_storage_object_access(bucket_id,name,'view') END);
ALTER POLICY shared_storage_create ON storage.objects WITH CHECK(
 CASE WHEN bucket_id='contract-attachments' THEN public.shared_storage_session_access('create') AND public.contract_attachment_storage_allowed(name,true)
 ELSE public.shared_storage_object_access(bucket_id,name,'create') END);
