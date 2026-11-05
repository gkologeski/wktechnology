-- Contratação integrada 3A: evidência explícita, sem inferir assinatura de status/datas.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techcontracts.signature_evidence.view.workspace','techcontracts','signature_evidence','view','workspace','Ver evidências de assinatura','Exige leitura do contrato e membership ativo.',true),
('techcontracts.signature_evidence.manage.workspace','techcontracts','signature_evidence','manage','workspace','Gerenciar evidências de assinatura','Preparar assinatura, atestar documento externo e revogar evidência com motivo.',true)
ON CONFLICT(key) DO NOTHING;
ALTER TABLE public.hiring_workspace_settings ADD COLUMN signature_gate_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.hiring_contract_evidence(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),contract_id uuid NOT NULL REFERENCES public.contracts(id),
 kind text NOT NULL CHECK(kind IN('native','external')),contract_hash text NOT NULL,
 document_id uuid REFERENCES public.esign_documents(id),document_hash text,
 customer_signer_id uuid REFERENCES public.esign_signers(id),issuer_signer_id uuid REFERENCES public.esign_signers(id),
 file_path text,file_hash text,signed_on date,reference text,note text NOT NULL,
 recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,revoked_by uuid,revocation_reason text,
 CHECK((kind='native' AND document_id IS NOT NULL AND document_hash IS NOT NULL AND customer_signer_id IS NOT NULL AND issuer_signer_id IS NOT NULL AND customer_signer_id<>issuer_signer_id) OR (kind='external' AND file_path IS NOT NULL AND file_hash IS NOT NULL AND signed_on IS NOT NULL AND reference IS NOT NULL))
);
CREATE UNIQUE INDEX hiring_evidence_document_unique ON public.hiring_contract_evidence(document_id) WHERE document_id IS NOT NULL;
CREATE UNIQUE INDEX hiring_external_evidence_dedupe ON public.hiring_contract_evidence(contract_id,contract_hash,file_hash) WHERE kind='external' AND revoked_at IS NULL;
CREATE INDEX hiring_evidence_contract ON public.hiring_contract_evidence(workspace_id,contract_id,recorded_at DESC);
CREATE TABLE public.hiring_commercial_contracts(
 deal_id uuid PRIMARY KEY REFERENCES public.deals(id),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),contract_id uuid NOT NULL REFERENCES public.contracts(id),
 selected_by uuid NOT NULL,selected_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hiring_signature_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,contract_id uuid NOT NULL,actor_id uuid NOT NULL,kind text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.hiring_contract_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_commercial_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_signature_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hiring_contract_evidence,public.hiring_commercial_contracts,public.hiring_signature_events FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_signature_access(p_ws uuid,p_contract uuid,p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_action IS NULL OR p_action NOT IN('view','manage') OR auth.uid() IS NULL OR NOT public.is_workspace_member(p_ws,auth.uid())
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active_workspace_id=p_ws)
 OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=p_ws AND user_id=auth.uid() AND status='active')
 OR NOT EXISTS(SELECT 1 FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws)
 OR NOT public.user_has_permission(auth.uid(),p_ws,'techcontracts.signature_evidence.'||p_action||'.workspace') THEN RETURN false;END IF;
 IF p_action='manage' AND public.is_read_only_view() THEN RETURN false;END IF;
 RETURN public.work_record_access('techcontracts.contracts',p_contract,CASE WHEN p_action='manage' THEN 'update' ELSE 'view' END);
END $$;
REVOKE ALL ON FUNCTION public.hiring_signature_access(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_signature_access(uuid,uuid,text) TO authenticated;
GRANT SELECT ON public.hiring_contract_evidence,public.hiring_signature_events TO authenticated;
CREATE POLICY hiring_evidence_read ON public.hiring_contract_evidence FOR SELECT TO authenticated USING(public.hiring_signature_access(workspace_id,contract_id,'view'));
CREATE POLICY hiring_signature_event_read ON public.hiring_signature_events FOR SELECT TO authenticated USING(public.hiring_signature_access(workspace_id,contract_id,'view'));

CREATE OR REPLACE FUNCTION public.hiring_contract_fingerprint(p_contract uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT encode(extensions.digest(convert_to(jsonb_build_object(
 'contract',to_jsonb(c)-ARRAY['status','updated_at','created_at','owner_id','assigned_to','public_token','signed_at','signed_pdf_path','signature_provider','signature_document_id','signature_operation_id','import_confidence','imported_from'],
 'issuer',(SELECT jsonb_build_object('id',l.id,'name',l.name,'cnpj',l.cnpj) FROM public.legal_entities l WHERE l.id=c.contracting_legal_entity_id AND l.workspace_id=c.workspace_id),
 'counterparty',(SELECT jsonb_build_object('id',x.id,'name',x.name,'cnpj',to_jsonb(x)->>'cnpj') FROM public.companies x WHERE x.id=c.counterparty_company_id AND x.workspace_id=c.workspace_id),
 'services',coalesce((SELECT jsonb_agg(to_jsonb(s)-ARRAY['updated_at','created_at','owner_id','assigned_to','delivery_owner_id','next_billing_at','metadata'] ORDER BY s.id) FROM public.services s WHERE s.contract_id=c.id AND s.workspace_id=c.workspace_id),'[]'))::text,'UTF8'),'sha256'),'hex') FROM public.contracts c WHERE c.id=p_contract
$$;
REVOKE ALL ON FUNCTION public.hiring_contract_fingerprint(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_contract_signature_reason(p_contract uuid,p_ws uuid,p_deal uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;e public.hiring_contract_evidence;d public.esign_documents;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws;
 IF c.id IS NULL THEN RETURN 'Selecione um contrato comercial do mesmo workspace.';END IF;
 IF c.role::text<>'provider' OR c.document_kind='amendment' THEN RETURN 'Use o contrato principal de prestação ao cliente.';END IF;
 IF p_deal IS NOT NULL AND (c.deal_id IS DISTINCT FROM p_deal OR NOT EXISTS(SELECT 1 FROM public.deals x WHERE x.id=p_deal AND x.workspace_id=p_ws AND x.deleted_at IS NULL AND x.company_id IS NOT NULL AND x.company_id=c.counterparty_company_id)) THEN RETURN 'Contrato e negócio precisam ter o mesmo cliente e vínculo explícito.';END IF;
 IF c.counterparty_company_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.companies x WHERE x.id=c.counterparty_company_id AND x.workspace_id=p_ws AND x.deleted_at IS NULL) THEN RETURN 'Defina a contraparte do contrato.';END IF;
 IF c.contracting_legal_entity_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.legal_entities l WHERE l.id=c.contracting_legal_entity_id AND l.workspace_id=p_ws AND l.active AND nullif(trim(l.cnpj),'') IS NOT NULL) THEN RETURN 'Defina uma entidade WK ativa com CNPJ.';END IF;
 IF c.status::text NOT IN('active','renewing') THEN RETURN 'Ative o contrato pelo fluxo de aprovação contratual.';END IF;
 IF c.starts_at IS NULL OR (c.ends_at IS NOT NULL AND (c.ends_at<current_date OR c.ends_at<c.starts_at)) THEN RETURN 'Contrato sem início definido, com vigência inválida ou expirada.';END IF;
 FOR e IN SELECT * FROM public.hiring_contract_evidence WHERE contract_id=c.id AND workspace_id=p_ws AND revoked_at IS NULL AND contract_hash=public.hiring_contract_fingerprint(c.id) ORDER BY recorded_at DESC LOOP
  IF e.kind='external' AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-signature-evidence' AND o.name=e.file_path AND o.user_metadata->>'sha256'=e.file_hash) THEN RETURN NULL;END IF;
  IF e.kind='native' THEN
   SELECT * INTO d FROM public.esign_documents WHERE id=e.document_id AND workspace_id=p_ws;
   IF d.status::text='completed' AND d.sealed_at IS NOT NULL AND d.completed_at IS NOT NULL AND d.content_hash=e.document_hash
   AND encode(extensions.digest(convert_to(d.body,'UTF8'),'sha256'),'hex')=e.document_hash
   AND (d.expires_at IS NULL OR d.completed_at<=d.expires_at)
   AND NOT EXISTS(SELECT 1 FROM public.ats_offers WHERE esign_document_id=d.id)
   AND NOT EXISTS(SELECT 1 FROM public.esign_signers WHERE document_id=d.id AND (workspace_id<>p_ws OR status::text<>'signed' OR signed_at IS NULL))
   AND EXISTS(SELECT 1 FROM public.esign_signers WHERE id=e.customer_signer_id AND document_id=d.id AND workspace_id=p_ws AND status::text='signed')
   AND EXISTS(SELECT 1 FROM public.esign_signers WHERE id=e.issuer_signer_id AND document_id=d.id AND workspace_id=p_ws AND status::text='signed') THEN RETURN NULL;END IF;
  END IF;
 END LOOP;
 RETURN 'Assinatura verificável da versão atual ausente, incompleta, alterada ou revogada.';
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_signature_reason(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

-- Evidências externas são PDFs privados, imutáveis para o usuário, enviados pelo servidor autenticado.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('contract-signature-evidence','contract-signature-evidence',false,5242880,ARRAY['application/pdf']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY hiring_signed_pdf_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='contract-signature-evidence' AND EXISTS(SELECT 1 FROM public.hiring_contract_evidence e WHERE e.file_path=name AND public.hiring_signature_access(e.workspace_id,e.contract_id,'view')));

CREATE OR REPLACE FUNCTION public.hiring_contract_external_attest(p_ws uuid,p_contract uuid,p_hash text,p_path text,p_file_hash text,p_signed_on date,p_reference text,p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;r uuid;
BEGIN
 IF NOT public.hiring_signature_access(p_ws,p_contract,'manage') OR NOT public.hiring_signature_access(p_ws,p_contract,'view') THEN RAISE EXCEPTION 'Sem permissão para atestar assinatura.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws FOR UPDATE;
 IF p_hash IS DISTINCT FROM public.hiring_contract_fingerprint(c.id) THEN RAISE EXCEPTION 'Contrato alterado. Recarregue antes de atestar.';END IF;
 IF p_signed_on IS NULL OR p_signed_on>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR length(trim(coalesce(p_reference,''))) NOT BETWEEN 3 AND 500 OR length(trim(coalesce(p_note,''))) NOT BETWEEN 20 AND 2000 THEN RAISE EXCEPTION 'Informe data real da assinatura, referência e justificativa da verificação.';END IF;
 IF p_path NOT LIKE p_ws::text||'/'||p_contract::text||'/%' OR p_file_hash !~ '^[a-f0-9]{64}$'
 OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-signature-evidence' AND o.name=p_path AND o.user_metadata->>'sha256'=p_file_hash AND o.user_metadata->>'contract_hash'=p_hash AND o.user_metadata->>'actor_id'=auth.uid()::text) THEN RAISE EXCEPTION 'PDF verificado pelo servidor não encontrado.';END IF;
 SELECT id INTO r FROM public.hiring_contract_evidence WHERE contract_id=p_contract AND contract_hash=p_hash AND file_hash=p_file_hash AND kind='external' AND revoked_at IS NULL;IF r IS NOT NULL THEN RETURN r;END IF;
 INSERT INTO public.hiring_contract_evidence(workspace_id,contract_id,kind,contract_hash,file_path,file_hash,signed_on,reference,note,recorded_by) VALUES(p_ws,p_contract,'external',p_hash,p_path,p_file_hash,p_signed_on,p_reference,p_note,auth.uid()) RETURNING id INTO r;
 INSERT INTO public.hiring_signature_events(workspace_id,contract_id,actor_id,kind,details) VALUES(p_ws,p_contract,auth.uid(),'external_attested',jsonb_build_object('evidence_id',r,'file_hash',p_file_hash,'reference',p_reference,'note',p_note));RETURN r;
END $$;

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
 body:=concat_ws(E'\n\n',c.title,'Contrato: '||coalesce(c.number,c.id::text),
 'Entidade prestadora: '||(SELECT name||' — CNPJ '||cnpj FROM public.legal_entities WHERE id=c.contracting_legal_entity_id AND workspace_id=p_ws),
 'Cliente: '||(SELECT name FROM public.companies WHERE id=c.counterparty_company_id AND workspace_id=p_ws),
 'Vigência: '||coalesce(c.starts_at::text,'não definida')||' a '||coalesce(c.ends_at::text,'indeterminada'),
 'Valor total: '||coalesce(c.currency,'BRL')||' '||coalesce(c.total_value::text,'não informado'),
 regexp_replace(c.body_html,'<[^>]*>',' ','g'),
 'Serviços contratados:'||(SELECT coalesce(string_agg(E'\n'||name||' | Quantidade: '||coalesce(quantity::text,'não informada')||' | Valor unitário: '||coalesce(currency,'BRL')||' '||coalesce(unit_price::text,'não informado'),'' ORDER BY id),' nenhum cadastrado') FROM public.services WHERE contract_id=c.id AND workspace_id=p_ws));
 r:=public.contract_esign_manage('create',NULL,jsonb_build_object('title',left(c.title,255),'body',body,'dealId',c.deal_id,'ordered',false,'signers',jsonb_build_array(jsonb_build_object('name',p_customer_name,'email',p_customer_email,'sign_order',1),jsonb_build_object('name',p_issuer_name,'email',p_issuer_email,'sign_order',2))));d:=(r->>'id')::uuid;
 SELECT id INTO customer FROM public.esign_signers WHERE document_id=d AND workspace_id=p_ws AND sign_order=1;
 SELECT id INTO issuer FROM public.esign_signers WHERE document_id=d AND workspace_id=p_ws AND sign_order=2;
 INSERT INTO public.hiring_contract_evidence(workspace_id,contract_id,kind,contract_hash,document_id,document_hash,customer_signer_id,issuer_signer_id,note,recorded_by) VALUES(p_ws,c.id,'native',p_hash,d,encode(extensions.digest(convert_to(body,'UTF8'),'sha256'),'hex'),customer,issuer,'Documento preparado da versão atual. Aguarda envio e conclusão pelas partes.',auth.uid());
 INSERT INTO public.hiring_signature_events(workspace_id,contract_id,actor_id,kind,details) VALUES(p_ws,c.id,auth.uid(),'native_prepared',jsonb_build_object('document_id',d));RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.hiring_contract_evidence_revoke(p_ws uuid,p_evidence uuid,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_contract_evidence;
BEGIN
 SELECT * INTO e FROM public.hiring_contract_evidence WHERE id=p_evidence AND workspace_id=p_ws;
 IF e.id IS NULL OR NOT public.hiring_signature_access(p_ws,e.contract_id,'manage') THEN RAISE EXCEPTION 'Sem permissão para revogar evidência.' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.contracts WHERE id=e.contract_id FOR UPDATE;
 IF length(trim(coalesce(p_note,''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Informe o motivo da revogação (10–2000 caracteres).';END IF;
 UPDATE public.hiring_contract_evidence SET revoked_at=coalesce(revoked_at,now()),revoked_by=coalesce(revoked_by,auth.uid()),revocation_reason=coalesce(revocation_reason,p_note) WHERE id=e.id;
 INSERT INTO public.hiring_signature_events(workspace_id,contract_id,actor_id,kind,details) VALUES(p_ws,e.contract_id,auth.uid(),'evidence_revoked',jsonb_build_object('evidence_id',e.id,'note',p_note));
END $$;

CREATE OR REPLACE FUNCTION public.hiring_contract_signature_context(p_ws uuid,p_contract uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;
BEGIN
 IF NOT public.hiring_signature_access(p_ws,p_contract,'view') THEN RAISE EXCEPTION 'Sem acesso à evidência do contrato.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws;
 RETURN jsonb_build_object('hash',public.hiring_contract_fingerprint(c.id),'reason',public.hiring_contract_signature_reason(c.id,p_ws,c.deal_id),'deal_id',c.deal_id,
 'entity_id',c.contracting_legal_entity_id,'entities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'cnpj',cnpj) ORDER BY name) FROM public.legal_entities WHERE workspace_id=p_ws AND active),'[]'),'can_manage',public.hiring_signature_access(p_ws,c.id,'manage'),'commercial_source',EXISTS(SELECT 1 FROM public.hiring_commercial_contracts WHERE contract_id=c.id AND workspace_id=p_ws),
 'evidence',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'document_id',document_id,'current_version',contract_hash=public.hiring_contract_fingerprint(c.id),'recorded_at',recorded_at,'signed_on',signed_on,'reference',reference,'note',note,'revoked_at',revoked_at,'revocation_reason',revocation_reason) ORDER BY recorded_at DESC) FROM public.hiring_contract_evidence WHERE contract_id=c.id AND workspace_id=p_ws),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_external_attest(uuid,uuid,text,text,text,date,text,text),public.hiring_contract_native_prepare(uuid,uuid,text,text,text,text,text),public.hiring_contract_evidence_revoke(uuid,uuid,text),public.hiring_contract_signature_context(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_contract_external_attest(uuid,uuid,text,text,text,date,text,text),public.hiring_contract_native_prepare(uuid,uuid,text,text,text,text,text),public.hiring_contract_evidence_revoke(uuid,uuid,text),public.hiring_contract_signature_context(uuid,uuid) TO authenticated;

-- Nenhuma política genérica de Storage pode permitir substituir um comprovante.
CREATE POLICY hiring_signed_pdf_write_block ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'contract-signature-evidence');
CREATE POLICY hiring_signed_pdf_update_block ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'contract-signature-evidence') WITH CHECK(bucket_id<>'contract-signature-evidence');
CREATE POLICY hiring_signed_pdf_delete_block ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'contract-signature-evidence');
CREATE POLICY hiring_signed_pdf_scope ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'contract-signature-evidence' OR EXISTS(SELECT 1 FROM public.hiring_contract_evidence e WHERE e.file_path=name AND public.hiring_signature_access(e.workspace_id,e.contract_id,'view')));
CREATE OR REPLACE FUNCTION public.hiring_bound_document_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.body IS DISTINCT FROM OLD.body AND EXISTS(SELECT 1 FROM public.hiring_contract_evidence WHERE document_id=OLD.id AND revoked_at IS NULL) THEN RAISE EXCEPTION 'O conteúdo está vinculado à versão do contrato. Revogue a evidência e prepare outra assinatura.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzzzzz_hiring_bound_document BEFORE UPDATE ON public.esign_documents FOR EACH ROW EXECUTE FUNCTION public.hiring_bound_document_guard();
REVOKE ALL ON FUNCTION public.hiring_bound_document_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hiring_contract_origin_save(p_ws uuid,p_contract uuid,p_hash text,p_deal uuid,p_entity uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;customer uuid;
BEGIN
 IF NOT public.hiring_signature_access(p_ws,p_contract,'manage') THEN RAISE EXCEPTION 'Sem permissão para configurar origem do contrato.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws FOR UPDATE;
 IF p_hash IS DISTINCT FROM public.hiring_contract_fingerprint(c.id) THEN RAISE EXCEPTION 'Contrato alterado. Recarregue.';END IF;
 IF NOT public.work_commercial_reference_allowed('deals',p_deal) THEN RAISE EXCEPTION 'Negócio fora do seu acesso.' USING ERRCODE='42501';END IF;
 SELECT company_id INTO customer FROM public.deals WHERE id=p_deal AND workspace_id=p_ws AND deleted_at IS NULL;
 IF customer IS NULL OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=customer AND workspace_id=p_ws AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Negócio exige cliente válido do mesmo workspace.';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.legal_entities WHERE id=p_entity AND workspace_id=p_ws AND active) THEN RAISE EXCEPTION 'Entidade WK indisponível neste workspace.';END IF;
 UPDATE public.contracts SET deal_id=p_deal,counterparty_company_id=customer,contracting_legal_entity_id=p_entity WHERE id=c.id;
 INSERT INTO public.hiring_signature_events(workspace_id,contract_id,actor_id,kind,details) VALUES(p_ws,c.id,auth.uid(),'origin_updated',jsonb_build_object('deal_id',p_deal,'entity_id',p_entity,'previous_deal_id',c.deal_id,'previous_entity_id',c.contracting_legal_entity_id));
END $$;
REVOKE ALL ON FUNCTION public.hiring_contract_origin_save(uuid,uuid,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hiring_contract_origin_save(uuid,uuid,text,uuid,uuid) TO authenticated;
