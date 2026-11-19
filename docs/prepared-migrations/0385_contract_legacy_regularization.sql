-- LEGADO-REGULARIZA lote A: reconhecimento explícito e regularização humana de contratos legados importados.
-- Migração PREPARADA para revisão; fora do journal. Não aplicar antes de revisão independente e CI.
-- Não cria proposta, minuta, assinatura, serviço, título, pagamento nem grant. Não altera dados existentes.
-- O mesmo contrato é preservado (id, source_file_path, body_html, partes, vínculos e anexos); a classificação
-- de legado vive somente nestas tabelas e nunca é inferida de metadata, imported_from, GUC ou status manual.

INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techcontracts.legacy_contracts.view.workspace','techcontracts','legacy_contracts','view','workspace','Ver situação de contratos legados','Consulta o reconhecimento de legado, a trilha e as evidências privadas de contratos importados.',true),
('techcontracts.legacy_contracts.create.workspace','techcontracts','legacy_contracts','create','workspace','Reconhecer contrato legado','Registra, com motivo, que um contrato importado é legado pendente de regularização. Não comprova assinatura.',true),
('techcontracts.legacy_contracts.approve.workspace','techcontracts','legacy_contracts','approve','workspace','Regularizar contrato legado','Anexa o original assinado (PDF privado) e confirma situação, datas e assinatura humana do mesmo contrato. Não libera cobrança.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.contract_legacy_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','regularized')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 contract_fingerprint text NOT NULL CHECK(contract_fingerprint ~ '^[0-9a-f]{64}$'),
 recognized_by uuid NOT NULL,
 recognized_at timestamptz NOT NULL DEFAULT now(),
 recognition_reason text NOT NULL,
 regularized_by uuid,
 regularized_at timestamptz,
 situation text CHECK(situation IN('in_force','ended','terminated')),
 evidence_id uuid,
 UNIQUE(contract_id),
 UNIQUE(workspace_id,id)
);
CREATE TABLE public.contract_legacy_evidence(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 legacy_id uuid NOT NULL,
 contract_id uuid NOT NULL REFERENCES public.contracts(id),
 legacy_revision integer NOT NULL,
 storage_path text NOT NULL UNIQUE,
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),
 mime_type text NOT NULL CHECK(mime_type='application/pdf'),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 5 AND 5242880),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'pending_upload' CHECK(status IN('pending_upload','attested','used','superseded')),
 uploaded_by uuid NOT NULL,
 reserved_at timestamptz NOT NULL DEFAULT now(),
 server_attested_at timestamptz,
 FOREIGN KEY(workspace_id,legacy_id) REFERENCES public.contract_legacy_records(workspace_id,id),
 UNIQUE(workspace_id,id)
);
CREATE UNIQUE INDEX contract_legacy_evidence_bytes ON public.contract_legacy_evidence(contract_id,sha256) WHERE status<>'superseded';
CREATE TABLE public.contract_legacy_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 legacy_id uuid NOT NULL,
 contract_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('recognized','rebased','evidence_reserved','evidence_attested','regularized')),
 revision integer NOT NULL,
 operation_id uuid NOT NULL,
 request_hash text NOT NULL,
 actor_id uuid NOT NULL,
 details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,operation_id),
 FOREIGN KEY(workspace_id,legacy_id) REFERENCES public.contract_legacy_records(workspace_id,id)
);
CREATE INDEX contract_legacy_events_record ON public.contract_legacy_events(workspace_id,legacy_id,created_at);

-- Leitura e escrita somente por RPC definer; nenhum acesso direto do Data API.
REVOKE ALL ON public.contract_legacy_records,public.contract_legacy_evidence,public.contract_legacy_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.contract_legacy_records,public.contract_legacy_evidence,public.contract_legacy_events TO service_role;
ALTER TABLE public.contract_legacy_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_legacy_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_legacy_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY contract_legacy_records_service_read ON public.contract_legacy_records FOR SELECT TO service_role USING(true);
CREATE POLICY contract_legacy_evidence_service_read ON public.contract_legacy_evidence FOR SELECT TO service_role USING(true);
CREATE POLICY contract_legacy_events_service_read ON public.contract_legacy_events FOR SELECT TO service_role USING(true);

-- Trilha imutável: nenhuma alteração ou exclusão de eventos; registros só mudam pelas RPCs (owner).
CREATE FUNCTION public.contract_legacy_immutable_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Trilha de contrato legado é imutável.' USING ERRCODE='42501';END $$;
CREATE TRIGGER contract_legacy_events_immutable BEFORE UPDATE OR DELETE ON public.contract_legacy_events FOR EACH ROW EXECUTE FUNCTION public.contract_legacy_immutable_guard();
CREATE TRIGGER contract_legacy_records_no_delete BEFORE DELETE ON public.contract_legacy_records FOR EACH ROW EXECUTE FUNCTION public.contract_legacy_immutable_guard();
CREATE TRIGGER contract_legacy_evidence_no_delete BEFORE DELETE ON public.contract_legacy_evidence FOR EACH ROW EXECUTE FUNCTION public.contract_legacy_immutable_guard();

-- Impressão digital dos campos documentais preservados; qualquer mudança invalida ações futuras.
CREATE FUNCTION public.contract_legacy_fingerprint(c public.contracts) RETURNS text LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('id',c.id,'source',c.source_file_path,'body',md5(coalesce(c.body_html,'')),'role',c.role::text,
  'counterparty',c.counterparty_company_id,'wk',c.contracting_legal_entity_id,'entity',c.legal_entity_id,'deal',c.deal_id,'parent',c.parent_contract_id,
  'kind',c.document_kind,'number',c.number,'title',c.title,'starts',c.starts_at,'ends',c.ends_at,'auto_renew',c.auto_renew,'signed_at',c.signed_at,
  'signed_pdf',c.signed_pdf_path)::text,'UTF8')),'hex')
$$;

-- Origens governadas que nunca podem ser reclassificadas como legado.
CREATE FUNCTION public.contract_legacy_protected_problem(c public.contracts) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE
  WHEN c.hiring_request_origin IS NOT NULL THEN 'Contrato originado de solicitação de contratação segue o fluxo governado.'
  WHEN c.proposal_id IS NOT NULL OR c.quote_id IS NOT NULL OR coalesce(c.metadata ? 'accepted_contract_draft',false) OR coalesce(c.metadata ? 'accepted_proposal',false)
   THEN 'Contrato com proposta ou minuta aceita segue a jornada comercial.'
  WHEN c.signed_at IS NOT NULL OR c.signed_pdf_path IS NOT NULL OR c.signature_provider IS NOT NULL OR c.signature_document_id IS NOT NULL OR c.signature_operation_id IS NOT NULL
   OR EXISTS(SELECT 1 FROM contract_signature_packages x WHERE x.contract_id=c.id)
   OR EXISTS(SELECT 1 FROM contract_esign_deliveries x WHERE x.contract_id=c.id)
   OR EXISTS(SELECT 1 FROM contract_forsign_operations x WHERE x.contract_id=c.id)
   OR EXISTS(SELECT 1 FROM hiring_contract_evidence x WHERE x.contract_id=c.id)
   THEN 'Contrato com assinatura em curso ou concluída não pode ser regularizado como legado.'
  WHEN c.status::text<>'draft' THEN 'Somente contratos em rascunho podem ser reconhecidos como legado.'
  WHEN c.source_file_path IS NULL OR c.imported_from IS NULL THEN 'Somente contratos importados de arquivo podem ser reconhecidos como legado.'
 END
$$;

-- Autorização: membro ativo no workspace ativo, workspace ativo, acesso real ao contrato e chave própria (deny prevalece).
CREATE FUNCTION public.contract_legacy_subject(w uuid,u uuid,c public.contracts,p_action text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT u IS NOT NULL AND c.id IS NOT NULL AND c.workspace_id=w
  AND EXISTS(SELECT 1 FROM workspaces x WHERE x.id=w AND coalesce(x.status,'active')='active')
  AND EXISTS(SELECT 1 FROM profiles p WHERE p.id=u AND p.active_workspace_id=w)
  AND is_workspace_member(w,u)
  AND EXISTS(SELECT 1 FROM user_effective_permissions(u,w) k WHERE k='techcontracts.legacy_contracts.'||p_action||'.workspace')
  AND EXISTS(SELECT 1 FROM user_effective_permissions(u,w) k WHERE k='techcontracts.contracts.view.workspace'
   OR (k='techcontracts.contracts.view.own' AND u=coalesce(c.assigned_to,c.owner_id)))
$$;
CREATE FUNCTION public.contract_legacy_actor(w uuid,p_contract uuid,p_action text,p_write boolean) RETURNS public.contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;ctx jsonb:=work_access_context();
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE='42501';END IF;
 IF p_write AND is_read_only_view() THEN RAISE EXCEPTION 'Sessão "ver como" é somente leitura.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM contracts WHERE id=p_contract AND workspace_id=w;
 IF c.id IS NULL OR NOT contract_legacy_subject(w,auth.uid(),c,p_action)
  OR NOT work_context_access(ctx,w,'techcontracts.contracts','view',ARRAY[coalesce(c.assigned_to,c.owner_id)])
  OR (p_write AND NOT work_context_access(ctx,w,'techcontracts.contracts','update',ARRAY[coalesce(c.assigned_to,c.owner_id)])) THEN
  RAISE EXCEPTION 'Sem permissão para esta ação no contrato.' USING ERRCODE='42501';
 END IF;
 RETURN c;
END $$;
CREATE FUNCTION public.contract_legacy_replay(w uuid,p_operation uuid,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e contract_legacy_events;
BEGIN
 IF p_operation IS NULL THEN RAISE EXCEPTION 'Identificador da operação obrigatório.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('contract-legacy-op:'||w::text||':'||p_operation::text,0));
 SELECT * INTO e FROM contract_legacy_events WHERE workspace_id=w AND operation_id=p_operation;
 IF e.id IS NULL THEN RETURN NULL;END IF;
 IF e.request_hash<>p_hash OR e.actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'CONFLICT: operação reutilizada com dados diferentes.' USING ERRCODE='23505';END IF;
 RETURN e.legacy_id;
END $$;

-- Reconhecer (ou rebasear após alteração documental) um contrato importado como legado pendente.
CREATE FUNCTION public.contract_legacy_recognize(w uuid,p_contract uuid,p_expected_revision integer,p_reason text,p_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;r contract_legacy_records;h text;fp text;problem text;prev uuid;
BEGIN
 c:=contract_legacy_actor(w,p_contract,'create',true);
 h:=encode(sha256(convert_to(jsonb_build_object('a','recognize','c',p_contract,'rev',p_expected_revision,'reason',btrim(coalesce(p_reason,'')))::text,'UTF8')),'hex');
 prev:=contract_legacy_replay(w,p_operation,h);
 IF prev IS NOT NULL THEN SELECT * INTO r FROM contract_legacy_records WHERE id=prev;RETURN jsonb_build_object('id',r.id,'revision',r.revision,'status',r.status,'replayed',true);END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Motivo (5 a 2000 caracteres) obrigatório.';END IF;
 PERFORM 1 FROM contracts WHERE id=c.id FOR UPDATE;
 SELECT * INTO c FROM contracts WHERE id=c.id;
 problem:=contract_legacy_protected_problem(c);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem USING ERRCODE='23514';END IF;
 fp:=contract_legacy_fingerprint(c);
 SELECT * INTO r FROM contract_legacy_records WHERE contract_id=c.id FOR UPDATE;
 IF r.id IS NULL THEN
  IF p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'STALE: contrato ainda não reconhecido como legado.';END IF;
  INSERT INTO contract_legacy_records(workspace_id,contract_id,contract_fingerprint,recognized_by,recognition_reason) VALUES(w,c.id,fp,auth.uid(),btrim(p_reason)) RETURNING * INTO r;
  INSERT INTO contract_legacy_events(workspace_id,legacy_id,contract_id,kind,revision,operation_id,request_hash,actor_id,details) VALUES(w,r.id,c.id,'recognized',1,p_operation,h,auth.uid(),jsonb_build_object('fingerprint',fp,'reason',btrim(p_reason)));
 ELSE
  IF r.status<>'pending' THEN RAISE EXCEPTION 'Contrato legado já regularizado.' USING ERRCODE='23514';END IF;
  IF p_expected_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'STALE: revisão esperada difere da atual.';END IF;
  IF r.contract_fingerprint=fp THEN RAISE EXCEPTION 'Contrato já reconhecido como legado nesta revisão.' USING ERRCODE='23505';END IF;
  UPDATE contract_legacy_evidence SET status='superseded' WHERE legacy_id=r.id AND status IN('pending_upload','attested');
  UPDATE contract_legacy_records SET revision=revision+1,contract_fingerprint=fp WHERE id=r.id RETURNING * INTO r;
  INSERT INTO contract_legacy_events(workspace_id,legacy_id,contract_id,kind,revision,operation_id,request_hash,actor_id,details) VALUES(w,r.id,c.id,'rebased',r.revision,p_operation,h,auth.uid(),jsonb_build_object('fingerprint',fp,'reason',btrim(p_reason)));
 END IF;
 RETURN jsonb_build_object('id',r.id,'revision',r.revision,'status',r.status,'replayed',false);
END $$;

-- Reserva do PDF assinado privado (bucket existente contract-signature-evidence, só escrita do servidor).
CREATE FUNCTION public.contract_legacy_evidence_reserve(w uuid,p_contract uuid,p_expected_revision integer,p_file_name text,p_size bigint,p_sha256 text,p_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;r contract_legacy_records;h text;prev uuid;eid uuid:=gen_random_uuid();ev contract_legacy_evidence;
BEGIN
 c:=contract_legacy_actor(w,p_contract,'approve',true);
 h:=encode(sha256(convert_to(jsonb_build_object('a','reserve','c',p_contract,'rev',p_expected_revision,'f',p_file_name,'s',p_size,'h',lower(coalesce(p_sha256,'')))::text,'UTF8')),'hex');
 prev:=contract_legacy_replay(w,p_operation,h);
 IF prev IS NOT NULL THEN
  SELECT x.* INTO ev FROM contract_legacy_events e JOIN contract_legacy_evidence x ON x.id=(e.details->>'evidence_id')::uuid WHERE e.workspace_id=w AND e.operation_id=p_operation;
  RETURN jsonb_build_object('evidence_id',ev.id,'path',ev.storage_path,'replayed',true);
 END IF;
 IF lower(coalesce(p_sha256,'')) !~ '^[0-9a-f]{64}$' OR p_size NOT BETWEEN 5 AND 5242880 OR length(btrim(coalesce(p_file_name,''))) NOT BETWEEN 1 AND 255 OR lower(p_file_name) !~ '\.pdf$' THEN
  RAISE EXCEPTION 'Envie um PDF do original assinado (até 5 MB).';END IF;
 PERFORM 1 FROM contracts WHERE id=c.id FOR UPDATE;
 SELECT * INTO c FROM contracts WHERE id=c.id;
 SELECT * INTO r FROM contract_legacy_records WHERE contract_id=c.id AND workspace_id=w FOR UPDATE;
 IF r.id IS NULL OR r.status<>'pending' THEN RAISE EXCEPTION 'Contrato não está pendente de regularização.' USING ERRCODE='23514';END IF;
 IF p_expected_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'STALE: revisão esperada difere da atual.';END IF;
 IF r.contract_fingerprint<>contract_legacy_fingerprint(c) THEN RAISE EXCEPTION 'STALE: documento alterado após o reconhecimento; reconheça novamente.';END IF;
 INSERT INTO contract_legacy_evidence(id,workspace_id,legacy_id,contract_id,legacy_revision,storage_path,file_name,mime_type,size_bytes,sha256,uploaded_by)
 VALUES(eid,w,r.id,c.id,r.revision,'legacy-contracts/'||w::text||'/'||c.id::text||'/'||eid::text||'.pdf',btrim(p_file_name),'application/pdf',p_size,lower(p_sha256),auth.uid()) RETURNING * INTO ev;
 INSERT INTO contract_legacy_events(workspace_id,legacy_id,contract_id,kind,revision,operation_id,request_hash,actor_id,details) VALUES(w,r.id,c.id,'evidence_reserved',r.revision,p_operation,h,auth.uid(),jsonb_build_object('evidence_id',eid,'sha256',ev.sha256,'size',p_size));
 RETURN jsonb_build_object('evidence_id',eid,'path',ev.storage_path,'replayed',false);
END $$;

-- Somente servidor: confirma bytes efetivamente relidos do armazenamento privado. Revalida autor e autoridade atuais.
CREATE FUNCTION public.contract_legacy_evidence_attest(w uuid,p_evidence uuid,p_actor uuid,p_sha256 text,p_size bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ev contract_legacy_evidence;c contracts;r contract_legacy_records;
BEGIN
 IF coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Confirmação de arquivo restrita ao servidor.' USING ERRCODE='42501';END IF;
 SELECT * INTO ev FROM contract_legacy_evidence WHERE id=p_evidence AND workspace_id=w FOR UPDATE;
 SELECT * INTO c FROM contracts WHERE id=ev.contract_id AND workspace_id=w;
 SELECT * INTO r FROM contract_legacy_records WHERE id=ev.legacy_id;
 IF ev.id IS NULL OR ev.uploaded_by IS DISTINCT FROM p_actor OR NOT contract_legacy_subject(w,p_actor,c,'approve') THEN RAISE EXCEPTION 'Envio indisponível para confirmação.' USING ERRCODE='42501';END IF;
 IF ev.status<>'pending_upload' OR ev.reserved_at<now()-interval '1 hour' OR r.status<>'pending' OR r.revision<>ev.legacy_revision THEN RAISE EXCEPTION 'STALE: reserva não está pendente.';END IF;
 IF lower(p_sha256)<>ev.sha256 OR p_size<>ev.size_bytes THEN RAISE EXCEPTION 'Arquivo armazenado difere do reservado.';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-signature-evidence' AND o.name=ev.storage_path AND o.user_metadata->>'sha256'=ev.sha256 AND o.user_metadata->>'actor_id'=p_actor::text) THEN
  RAISE EXCEPTION 'Arquivo privado não encontrado no armazenamento.';END IF;
 UPDATE contract_legacy_evidence SET status='attested',server_attested_at=now() WHERE id=ev.id;
 INSERT INTO contract_legacy_events(workspace_id,legacy_id,contract_id,kind,revision,operation_id,request_hash,actor_id,details) VALUES(w,r.id,c.id,'evidence_attested',r.revision,gen_random_uuid(),ev.sha256,p_actor,jsonb_build_object('evidence_id',ev.id,'sha256',ev.sha256));
END $$;

-- Regularização humana do MESMO contrato. Nunca cria cobrança, serviço, título, pagamento ou assinatura nova.
CREATE FUNCTION public.contract_legacy_regularize(w uuid,p_contract uuid,p_expected_revision integer,p_situation text,p_signed_on date,p_signature_confirmed boolean,
 p_starts date,p_ends date,p_terminated_on date,p_auto_renew boolean,p_auto_renew_confirmed boolean,p_evidence uuid,p_evidence_sha256 text,p_external_reference text,p_reason text,p_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;r contract_legacy_records;ev contract_legacy_evidence;h text;prev uuid;problem text;st contract_status;fp text;old_terms jsonb;
BEGIN
 c:=contract_legacy_actor(w,p_contract,'approve',true);
 h:=encode(sha256(convert_to(jsonb_build_object('a','regularize','c',p_contract,'rev',p_expected_revision,'s',p_situation,'signed',p_signed_on,'conf',p_signature_confirmed,'st',p_starts,'en',p_ends,
  'term',p_terminated_on,'ar',p_auto_renew,'arc',p_auto_renew_confirmed,'ev',p_evidence,'evh',lower(coalesce(p_evidence_sha256,'')),'ref',btrim(coalesce(p_external_reference,'')),'reason',btrim(coalesce(p_reason,'')))::text,'UTF8')),'hex');
 prev:=contract_legacy_replay(w,p_operation,h);
 IF prev IS NOT NULL THEN SELECT * INTO r FROM contract_legacy_records WHERE id=prev;RETURN jsonb_build_object('id',r.id,'revision',r.revision,'status',r.status,'replayed',true);END IF;
 PERFORM 1 FROM contracts WHERE id=c.id FOR UPDATE;
 SELECT * INTO c FROM contracts WHERE id=c.id;
 SELECT * INTO r FROM contract_legacy_records WHERE contract_id=c.id AND workspace_id=w FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Reconheça o contrato como legado antes de regularizar.' USING ERRCODE='23514';END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'Contrato legado já regularizado.' USING ERRCODE='23514';END IF;
 IF p_expected_revision IS DISTINCT FROM r.revision THEN RAISE EXCEPTION 'STALE: revisão esperada difere da atual.';END IF;
 problem:=contract_legacy_protected_problem(c);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem USING ERRCODE='23514';END IF;
 IF r.contract_fingerprint<>contract_legacy_fingerprint(c) THEN RAISE EXCEPTION 'STALE: documento alterado após o reconhecimento; reconheça novamente.';END IF;
 IF c.counterparty_company_id IS NULL OR c.contracting_legal_entity_id IS NULL THEN RAISE EXCEPTION 'Defina contraparte e entidade legal WK no contrato antes de regularizar.' USING ERRCODE='23514';END IF;
 IF p_situation NOT IN('in_force','ended','terminated') THEN RAISE EXCEPTION 'Situação inválida.';END IF;
 IF p_signature_confirmed IS NOT TRUE OR p_signed_on IS NULL THEN RAISE EXCEPTION 'Confirme a data da assinatura humana conferida no original.';END IF;
 IF p_signed_on<date '1990-01-01' OR p_signed_on>current_date THEN RAISE EXCEPTION 'Data de assinatura implausível.';END IF;
 IF p_starts IS NULL OR p_starts<date '1990-01-01' OR p_starts>current_date+3650 THEN RAISE EXCEPTION 'Início de vigência implausível.';END IF;
 IF p_ends IS NOT NULL AND p_ends<p_starts THEN RAISE EXCEPTION 'Fim da vigência deve ser igual ou posterior ao início.';END IF;
 IF p_starts>current_date THEN RAISE EXCEPTION 'Vigência futura ainda não suportada: a regularização não pode ativar operação ou cobrança antecipada.' USING ERRCODE='23514';END IF;
 IF coalesce(p_auto_renew,false) AND p_auto_renew_confirmed IS NOT TRUE THEN RAISE EXCEPTION 'Renovação automática exige conferência humana da cláusula.';END IF;
 IF p_situation='in_force' THEN
  IF p_ends IS NOT NULL AND p_ends<current_date AND NOT coalesce(p_auto_renew,false) THEN RAISE EXCEPTION 'Vigência encerrada: escolha a situação encerrado.';END IF;
  IF p_terminated_on IS NOT NULL THEN RAISE EXCEPTION 'Data de rescisão só se aplica a contrato rescindido.';END IF;
  st:='active';
 ELSIF p_situation='ended' THEN
  IF p_ends IS NULL OR p_ends>=current_date THEN RAISE EXCEPTION 'Contrato encerrado exige fim de vigência passado.';END IF;
  IF p_terminated_on IS NOT NULL THEN RAISE EXCEPTION 'Data de rescisão só se aplica a contrato rescindido.';END IF;
  st:='ended';
 ELSE
  IF p_terminated_on IS NULL OR p_terminated_on<p_starts OR p_terminated_on>current_date OR (p_ends IS NOT NULL AND p_terminated_on>p_ends) THEN RAISE EXCEPTION 'Data de rescisão deve estar entre o início e hoje.';END IF;
  st:='terminated';
 END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 2000 OR length(btrim(coalesce(p_external_reference,''))) NOT BETWEEN 3 AND 500 THEN
  RAISE EXCEPTION 'Motivo (5 a 2000) e referência do documento/origem externa (3 a 500) obrigatórios.';END IF;
 SELECT * INTO ev FROM contract_legacy_evidence WHERE id=p_evidence AND workspace_id=w AND legacy_id=r.id FOR UPDATE;
 IF ev.id IS NULL OR ev.status<>'attested' OR ev.server_attested_at IS NULL OR ev.legacy_revision<>r.revision THEN RAISE EXCEPTION 'Envie o PDF assinado e aguarde a confirmação do servidor.' USING ERRCODE='23514';END IF;
 IF lower(coalesce(p_evidence_sha256,''))<>ev.sha256 THEN RAISE EXCEPTION 'STALE: hash conferido difere do PDF confirmado.';END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-signature-evidence' AND o.name=ev.storage_path AND o.user_metadata->>'sha256'=ev.sha256) THEN RAISE EXCEPTION 'PDF privado indisponível.';END IF;
 -- Liberação de cobrança histórica exige fluxo financeiro próprio (fora deste lote).
 IF EXISTS(SELECT 1 FROM services s WHERE s.contract_id=c.id AND s.workspace_id=w AND s.billing_hold IS NOT NULL) THEN
  RAISE EXCEPTION 'Contrato possui serviço aguardando liberação de cobrança; a regularização de legado não libera cobranças.' USING ERRCODE='23514';END IF;
 old_terms:=jsonb_build_object('status',c.status,'starts',c.starts_at,'ends',c.ends_at,'auto_renew',c.auto_renew);
 UPDATE contracts SET status=st,signed_at=(p_signed_on::timestamp AT TIME ZONE 'America/Sao_Paulo'),starts_at=p_starts,ends_at=p_ends,auto_renew=coalesce(p_auto_renew,false) WHERE id=c.id RETURNING * INTO c;
 fp:=contract_legacy_fingerprint(c);
 UPDATE contract_legacy_evidence SET status='used' WHERE id=ev.id;
 UPDATE contract_legacy_records SET status='regularized',revision=revision+1,contract_fingerprint=fp,regularized_by=auth.uid(),regularized_at=now(),situation=p_situation,evidence_id=ev.id WHERE id=r.id RETURNING * INTO r;
 INSERT INTO contract_legacy_events(workspace_id,legacy_id,contract_id,kind,revision,operation_id,request_hash,actor_id,details) VALUES(w,r.id,c.id,'regularized',r.revision,p_operation,h,auth.uid(),
  jsonb_build_object('situation',p_situation,'signed_on',p_signed_on,'signature_confirmed_by_human',true,'starts',p_starts,'ends',p_ends,'terminated_on',p_terminated_on,'auto_renew',coalesce(p_auto_renew,false),
   'evidence_id',ev.id,'evidence_sha256',ev.sha256,'external_reference',btrim(p_external_reference),'reason',btrim(p_reason),'previous',old_terms,'fingerprint',fp,'hash_is_integrity_not_legal_authentication',true));
 RETURN jsonb_build_object('id',r.id,'revision',r.revision,'status',r.status,'replayed',false);
END $$;

-- Leitura: situação e trilha sem caminhos privados.
CREATE FUNCTION public.contract_legacy_state(w uuid,p_contract uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;r contract_legacy_records;
BEGIN
 c:=contract_legacy_actor(w,p_contract,'view',false);
 SELECT * INTO r FROM contract_legacy_records WHERE contract_id=c.id AND workspace_id=w;
 RETURN jsonb_build_object('contract_id',c.id,'eligible_problem',CASE WHEN r.id IS NULL THEN contract_legacy_protected_problem(c) END,
  'record',CASE WHEN r.id IS NOT NULL THEN jsonb_build_object('id',r.id,'status',r.status,'revision',r.revision,'situation',r.situation,'stale',r.contract_fingerprint<>contract_legacy_fingerprint(c),
   'recognized_at',r.recognized_at,'regularized_at',r.regularized_at) END,
  'events',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',e.kind,'revision',e.revision,'actor_id',e.actor_id,'created_at',e.created_at,'details',e.details-'path') ORDER BY e.created_at) FROM contract_legacy_events e WHERE e.legacy_id=r.id),'[]'),
  'evidence',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'file_name',x.file_name,'sha256',x.sha256,'size',x.size_bytes,'status',x.status,'revision',x.legacy_revision) ORDER BY x.reserved_at) FROM contract_legacy_evidence x WHERE x.legacy_id=r.id),'[]'));
END $$;
-- Download autenticado: devolve o caminho privado somente a quem tem a chave de leitura; o servidor gera URL curta.
CREATE FUNCTION public.contract_legacy_evidence_open(w uuid,p_contract uuid,p_evidence uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;ev contract_legacy_evidence;
BEGIN
 c:=contract_legacy_actor(w,p_contract,'view',false);
 SELECT * INTO ev FROM contract_legacy_evidence WHERE id=p_evidence AND contract_id=c.id AND workspace_id=w AND status IN('attested','used','superseded');
 IF ev.id IS NULL THEN RAISE EXCEPTION 'Evidência indisponível.';END IF;
 RETURN jsonb_build_object('path',ev.storage_path,'sha256',ev.sha256,'file_name',ev.file_name);
END $$;

-- Somente legados regularizados e validados: usado por guardas comerciais.
CREATE FUNCTION public.contract_legacy_validated(p_contract uuid,w uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM contract_legacy_records r JOIN contract_legacy_evidence e ON e.id=r.evidence_id AND e.status='used'
  WHERE r.contract_id=p_contract AND r.workspace_id=w AND r.status='regularized')
$$;

-- Após a regularização o documento conferido é imutável (mudanças por aditivo); status manual já é bloqueado por contract_process_guard.
CREATE FUNCTION public.contract_legacy_contract_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE st text;
BEGIN
 SELECT r.status INTO st FROM public.contract_legacy_records r WHERE r.contract_id=OLD.id;
 IF st IS NULL THEN RETURN NEW;END IF;
 -- Pendente ou regularizado: nenhuma origem governada/assinatura nova pode ser enxertada no legado.
 IF (NEW.signature_provider,NEW.signature_document_id,NEW.signature_operation_id,NEW.signed_pdf_path,NEW.proposal_id,NEW.quote_id,NEW.hiring_request_origin)
   IS DISTINCT FROM (OLD.signature_provider,OLD.signature_document_id,OLD.signature_operation_id,OLD.signed_pdf_path,OLD.proposal_id,OLD.quote_id,OLD.hiring_request_origin)
  OR (st='pending' AND NEW.signed_at IS DISTINCT FROM OLD.signed_at AND current_user NOT IN('postgres','supabase_admin')) THEN
  RAISE EXCEPTION 'Contrato legado: assinatura, proposta ou origem nova não podem ser vinculadas; regularize com o original assinado.' USING ERRCODE='23514';
 END IF;
 -- Regularizado: todos os termos conferidos ficam imutáveis (documento, partes, vigência, valores, moeda, pagamento, identificadores e assinatura).
 IF st='regularized' AND (NEW.source_file_path,NEW.body_html,NEW.role,NEW.counterparty_company_id,NEW.contracting_legal_entity_id,NEW.legal_entity_id,NEW.signed_at,
   NEW.starts_at,NEW.ends_at,NEW.auto_renew,NEW.notice_days,NEW.document_kind,NEW.parent_contract_id,NEW.number,NEW.total_value,NEW.monthly_value,NEW.currency,
   NEW.payment_terms,NEW.payment_method,NEW.payment_day,NEW.hours_per_month,NEW.readjustment_index,NEW.readjustment_period,NEW.late_fee_percent,
   NEW.late_interest_monthly_percent,NEW.penalty_percent,NEW.amendment_of_id,NEW.imported_from,NEW.workspace_id)
  IS DISTINCT FROM (OLD.source_file_path,OLD.body_html,OLD.role,OLD.counterparty_company_id,OLD.contracting_legal_entity_id,OLD.legal_entity_id,OLD.signed_at,
   OLD.starts_at,OLD.ends_at,OLD.auto_renew,OLD.notice_days,OLD.document_kind,OLD.parent_contract_id,OLD.number,OLD.total_value,OLD.monthly_value,OLD.currency,
   OLD.payment_terms,OLD.payment_method,OLD.payment_day,OLD.hours_per_month,OLD.readjustment_index,OLD.readjustment_period,OLD.late_fee_percent,
   OLD.late_interest_monthly_percent,OLD.penalty_percent,OLD.amendment_of_id,OLD.imported_from,OLD.workspace_id) THEN
  RAISE EXCEPTION 'Contrato legado regularizado: termos conferidos são imutáveis. Formalize mudanças por aditivo.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_contract_legacy_guard BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.contract_legacy_contract_guard();
-- Assinatura nativa/ForSign/e-sign nunca recomeça em contrato legado (pendente ou regularizado), inclusive por serviço.
CREATE FUNCTION public.contract_legacy_signature_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.contract_legacy_records r WHERE r.contract_id=NEW.contract_id) THEN
  RAISE EXCEPTION 'Contrato legado não pode ser enviado para nova assinatura; use a regularização com o original assinado.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER contract_legacy_no_signature_package BEFORE INSERT ON public.contract_signature_packages FOR EACH ROW EXECUTE FUNCTION public.contract_legacy_signature_block();
CREATE TRIGGER contract_legacy_no_esign_delivery BEFORE INSERT ON public.contract_esign_deliveries FOR EACH ROW EXECUTE FUNCTION public.contract_legacy_signature_block();
CREATE TRIGGER contract_legacy_no_forsign BEFORE INSERT ON public.contract_forsign_operations FOR EACH ROW EXECUTE FUNCTION public.contract_legacy_signature_block();

-- Guarda comercial (0356): ignora a exigência de proposta/minuta SOMENTE para legado regularizado e validado,
-- e só quando o vínculo alterado é o negócio (proposta, papel e tipo de documento inalterados).
CREATE OR REPLACE FUNCTION public.contract_accepted_draft_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE d public.contract_drafts;s jsonb;
BEGIN
 IF current_user IN('postgres','supabase_admin','service_role') AND pg_trigger_depth()>1 THEN
  IF NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=NEW.workspace_id) THEN RETURN NEW;END IF;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF coalesce(OLD.metadata ? 'accepted_contract_draft',false) AND
    (NEW.body_html,NEW.contracting_legal_entity_id,NEW.total_value,NEW.currency,NEW.payment_method,NEW.payment_terms,NEW.metadata->'accepted_contract_draft') IS DISTINCT FROM
    (OLD.body_html,OLD.contracting_legal_entity_id,OLD.total_value,OLD.currency,OLD.payment_method,OLD.payment_terms,OLD.metadata->'accepted_contract_draft') THEN
   RAISE EXCEPTION 'Condições aprovadas são imutáveis. Formalize mudanças por aditivo.' USING ERRCODE='23514';
  END IF;
  IF NOT coalesce(OLD.metadata ? 'accepted_contract_draft',false) AND NEW.metadata ? 'accepted_contract_draft' THEN
   RAISE EXCEPTION 'Não é possível fabricar um aceite histórico da minuta.' USING ERRCODE='23514';
  END IF;
  IF nullif(OLD.metadata#>>'{accepted_contract_draft,prepared_terms,starts_at}','') IS NOT NULL AND (NEW.starts_at,NEW.ends_at) IS DISTINCT FROM (OLD.starts_at,OLD.ends_at) THEN
   RAISE EXCEPTION 'Vigência aprovada é imutável. Formalize mudanças por aditivo.' USING ERRCODE='23514';END IF;
  IF coalesce(OLD.metadata->>'commercial_journey_version','')='1' THEN
   IF NEW.metadata->>'commercial_journey_version' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'Origem da jornada protegida.' USING ERRCODE='23514';END IF;
   IF (NEW.proposal_id,NEW.deal_id,NEW.role,NEW.document_kind) IS NOT DISTINCT FROM (OLD.proposal_id,OLD.deal_id,OLD.role,OLD.document_kind) THEN RETURN NEW;END IF;
   IF NEW.proposal_id IS NULL AND OLD.proposal_id IS NULL AND (NEW.role,NEW.document_kind) IS NOT DISTINCT FROM (OLD.role,OLD.document_kind)
    AND public.contract_legacy_validated(OLD.id,OLD.workspace_id) THEN RETURN NEW;END IF;
  ELSE
   IF NEW.metadata ? 'commercial_journey_version' THEN RAISE EXCEPTION 'Não é possível fabricar origem histórica.' USING ERRCODE='23514';END IF;
   RETURN NEW;
  END IF;
 ELSE
  IF NEW.metadata IS NOT NULL AND jsonb_typeof(NEW.metadata)<>'object' THEN RAISE EXCEPTION 'Metadados inválidos.' USING ERRCODE='22023';END IF;
  NEW.metadata:=coalesce(NEW.metadata,'{}')||jsonb_build_object('commercial_journey_version',1);
 END IF;
 IF NEW.metadata ? 'accepted_contract_draft' THEN RAISE EXCEPTION 'Proveniência de minuta é gerada pelo banco.' USING ERRCODE='23514';END IF;
 IF NEW.document_kind='amendment' OR NEW.role::text<>'provider' OR NEW.deal_id IS NULL THEN RETURN NEW;END IF;
 IF NEW.proposal_id IS NULL THEN RAISE EXCEPTION 'Prepare o contrato pela jornada, com proposta e minuta aceitas.' USING ERRCODE='23514';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.proposal_id::text,0));
 SELECT * INTO d FROM public.contract_drafts WHERE proposal_id=NEW.proposal_id AND workspace_id=NEW.workspace_id
 AND status='accepted' ORDER BY updated_at DESC LIMIT 1;
 IF d.id IS NULL OR d.client_decided_at IS NULL OR d.decided_at IS NULL OR d.deal_id IS DISTINCT FROM NEW.deal_id THEN
  RAISE EXCEPTION 'O contrato só pode ser criado após a aprovação jurídica e o aceite da minuta pelo cliente.' USING ERRCODE='23514';
 END IF;
 IF length(btrim(regexp_replace(d.body_html,'<[^>]*>','','g')))<20 OR d.body_html ~ '\{\{[^}]+\}\}' THEN
  RAISE EXCEPTION 'A minuta aceita possui texto incompleto. Obtenha novo aceite de uma minuta preenchida.' USING ERRCODE='23514';
 END IF;
 s:=proposal_contract_source(NEW.proposal_id);
 IF s->'proposal'->>'total_amount' IS NULL THEN RAISE EXCEPTION 'A proposta aceita precisa ter valor estruturado. Obtenha novo aceite antes de preparar o contrato.' USING ERRCODE='23514';END IF;
 NEW.total_value:=(s->'proposal'->>'total_amount')::numeric;
 NEW.currency:=coalesce(s->'proposal'->>'currency',NEW.currency);
 NEW.body_html:=d.body_html;
 NEW.number:=coalesce(nullif(d.prepared_terms->>'number',''),NEW.number);
 IF nullif(d.prepared_terms->>'starts_at','') IS NOT NULL THEN
  NEW.starts_at:=(d.prepared_terms->>'starts_at')::date;NEW.ends_at:=nullif(d.prepared_terms->>'ends_at','')::date;
 END IF;
 NEW.metadata:=coalesce(NEW.metadata,'{}')||jsonb_build_object('accepted_contract_draft',jsonb_build_object('id',d.id,'revision',d.revision,'client_decided_at',d.client_decided_at,'decided_at',d.decided_at,'prepared_terms',d.prepared_terms));
 RETURN NEW;
END $function$;

-- ACL: revoga defaults e expõe somente as RPCs de usuário; atestado é service_role exclusivo.
REVOKE ALL ON FUNCTION public.contract_legacy_immutable_guard(),public.contract_legacy_fingerprint(public.contracts),public.contract_legacy_protected_problem(public.contracts),
 public.contract_legacy_subject(uuid,uuid,public.contracts,text),public.contract_legacy_actor(uuid,uuid,text,boolean),public.contract_legacy_replay(uuid,uuid,text),
 public.contract_legacy_recognize(uuid,uuid,integer,text,uuid),public.contract_legacy_evidence_reserve(uuid,uuid,integer,text,bigint,text,uuid),
 public.contract_legacy_evidence_attest(uuid,uuid,uuid,text,bigint),
 public.contract_legacy_regularize(uuid,uuid,integer,text,date,boolean,date,date,date,boolean,boolean,uuid,text,text,text,uuid),
 public.contract_legacy_state(uuid,uuid),public.contract_legacy_evidence_open(uuid,uuid,uuid),public.contract_legacy_validated(uuid,uuid),public.contract_legacy_contract_guard(),public.contract_legacy_signature_block() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.contract_legacy_recognize(uuid,uuid,integer,text,uuid),public.contract_legacy_evidence_reserve(uuid,uuid,integer,text,bigint,text,uuid),
 public.contract_legacy_regularize(uuid,uuid,integer,text,date,boolean,date,date,date,boolean,boolean,uuid,text,text,text,uuid),
 public.contract_legacy_state(uuid,uuid),public.contract_legacy_evidence_open(uuid,uuid,uuid) TO authenticated;
-- Booleano usado pela guarda comercial invocadora; não revela dados além da existência de regularização validada.
GRANT EXECUTE ON FUNCTION public.contract_legacy_validated(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.contract_legacy_evidence_attest(uuid,uuid,uuid,text,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
