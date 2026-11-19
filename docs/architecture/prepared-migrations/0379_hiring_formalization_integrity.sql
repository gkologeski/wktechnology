-- INTEGRIDADE-FORMALIZA: REVIEW ONLY; depends on prepared 0376-0378. Not in journal.
BEGIN;
CREATE FUNCTION public.hiring_formalization_private_access(w uuid,i uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM hiring_preparation_requests r JOIN hiring_formalizations f ON f.request_id=r.id AND f.workspace_id=r.workspace_id WHERE r.id=i AND r.workspace_id=w AND hiring_formalization_access(w,i,'view') AND (hiring_formalization_subject(w,auth.uid(),r.kind,'manage') OR hiring_formalization_subject(w,auth.uid(),r.kind,'approve')) AND hiring_preparation_access(w,r.kind,'reference_view') AND work_record_access('techcontracts.contracts',f.contract_id,'view'))
$$;
CREATE TABLE public.hiring_formalization_notes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,request_id uuid NOT NULL REFERENCES public.hiring_formalizations(request_id),cycle integer NOT NULL,stage text NOT NULL,actor_id uuid,actor_label text NOT NULL,actor_kind text NOT NULL CHECK(actor_kind IN('internal','counterparty')),note text NOT NULL CHECK(length(btrim(note)) BETWEEN 5 AND 4000),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.hiring_formalization_notes TO authenticated;GRANT ALL ON public.hiring_formalization_notes TO service_role;
REVOKE ALL ON public.hiring_formalization_notes FROM PUBLIC,anon,techerp_request_writer;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.hiring_formalization_notes FROM authenticated;
ALTER TABLE public.hiring_formalization_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY hiring_formalization_notes_read ON public.hiring_formalization_notes FOR SELECT TO authenticated USING(hiring_formalization_private_access(workspace_id,request_id));
CREATE TRIGGER hiring_formalization_notes_immutable BEFORE UPDATE OR DELETE ON public.hiring_formalization_notes FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
CREATE FUNCTION public.hiring_formalization_forsign_roster(expected jsonb,remote jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
BEGIN
 IF jsonb_typeof(expected) IS DISTINCT FROM 'array' OR jsonb_typeof(remote) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 IF jsonb_array_length(expected)<2 OR jsonb_array_length(expected)<>jsonb_array_length(remote) THEN RETURN false;END IF;
 RETURN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(expected) x WHERE nullif(btrim(x->>'email'),'') IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(remote) y WHERE lower(btrim(y->>'email'))=lower(btrim(x->>'email')) AND y->>'status'='Completed'))
 AND (SELECT count(DISTINCT lower(btrim(x->>'email'))) FROM jsonb_array_elements(expected) x)=jsonb_array_length(expected)
 AND (SELECT count(DISTINCT lower(btrim(x->>'email'))) FROM jsonb_array_elements(remote) x)=jsonb_array_length(remote);
END $$;
CREATE FUNCTION public.hiring_formalization_signed(w uuid,k uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM hiring_contract_evidence e WHERE e.workspace_id=w AND e.contract_id=k AND e.revoked_at IS NULL AND e.contract_hash=hiring_contract_fingerprint(k) AND (
 (e.kind='native' AND EXISTS(SELECT 1 FROM esign_documents d WHERE d.id=e.document_id AND d.workspace_id=w AND d.status::text='completed' AND d.completed_at IS NOT NULL AND d.sealed_at IS NOT NULL AND d.content_hash=e.document_hash AND encode(extensions.digest(convert_to(d.body,'UTF8'),'sha256'),'hex')=e.document_hash AND (d.expires_at IS NULL OR d.completed_at<=d.expires_at) AND NOT EXISTS(SELECT 1 FROM ats_offers WHERE esign_document_id=d.id)
 AND EXISTS(SELECT 1 FROM esign_signers z WHERE z.id=e.customer_signer_id AND z.document_id=d.id AND z.workspace_id=w) AND EXISTS(SELECT 1 FROM esign_signers z WHERE z.id=e.issuer_signer_id AND z.document_id=d.id AND z.workspace_id=w) AND e.customer_signer_id<>e.issuer_signer_id
 AND NOT EXISTS(SELECT 1 FROM esign_signers z WHERE z.document_id=d.id AND (z.workspace_id<>w OR z.status::text<>'signed' OR z.signed_at IS NULL))
 AND (SELECT count(*) FROM contract_signature_participants p WHERE p.document_id=d.id AND p.workspace_id=w AND p.role IN('CONTRATANTE','CONTRATADO'))=2
 AND NOT EXISTS(SELECT 1 FROM contract_signature_participants p LEFT JOIN esign_signers z ON z.id=p.signer_id AND z.document_id=p.document_id AND z.workspace_id=w WHERE p.document_id=d.id AND (p.workspace_id<>w OR p.evidence_id<>e.id OR z.id IS NULL OR z.status::text<>'signed' OR z.signed_at IS NULL))
 AND NOT EXISTS(SELECT 1 FROM esign_signers z WHERE z.document_id=d.id AND NOT EXISTS(SELECT 1 FROM contract_signature_participants p WHERE p.signer_id=z.id AND p.document_id=d.id AND p.evidence_id=e.id AND p.workspace_id=w))))
 OR (e.kind='external' AND EXISTS(SELECT 1 FROM contract_forsign_operations o JOIN storage.objects x ON x.bucket_id='contract-signature-evidence' AND x.name=e.file_path AND x.user_metadata->>'sha256'=e.file_hash AND x.user_metadata->>'contract_hash'=e.contract_hash WHERE o.contract_id=k AND o.workspace_id=w AND o.contract_hash=e.contract_hash AND o.evidence_id=e.id AND o.status='evidence_recorded' AND o.operation_id IS NOT NULL AND hiring_formalization_forsign_roster(o.requested_members,o.members))) ))
$$;
CREATE FUNCTION public.hiring_formalization_document_locked(w uuid,k uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM hiring_contract_evidence e LEFT JOIN esign_documents d ON d.id=e.document_id WHERE e.workspace_id=w AND e.contract_id=k AND ((e.kind='native' AND (d.status::text='completed' OR (e.revoked_at IS NULL AND d.status::text IN('sent','partially_signed')))) OR e.kind='external')) OR EXISTS(SELECT 1 FROM contract_forsign_operations o WHERE o.contract_id=k AND o.workspace_id=w AND o.status IN('creating','sent','partially_signed','completed','evidence_recorded'))
$$;
CREATE FUNCTION public.hiring_formalization_preview_access(w uuid,k uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM contracts c WHERE c.id=k AND c.workspace_id=w AND c.hiring_request_origin IS NOT NULL AND hiring_formalization_private_access(w,c.hiring_request_origin) AND hiring_signature_access(w,k,'view') AND NOT is_read_only_view())
$$;
CREATE OR REPLACE FUNCTION public.hiring_formalization_prepare(w uuid,i uuid,rev integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;f hiring_formalizations;s contract_handoff_settings;a hiring_preparation_approvals;k uuid;d uuid;
BEGIN
 IF NOT hiring_formalization_access(w,i,'manage') OR NOT user_has_permission(auth.uid(),w,'techcontracts.contracts.create.workspace') OR NOT user_has_permission(auth.uid(),w,'techcontracts.contracts.view.workspace') OR NOT user_has_permission(auth.uid(),w,'techcontracts.contract_drafts.view.workspace') THEN RAISE EXCEPTION 'Sem permissão de formalização e contrato.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(i::text,376));
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO r FROM hiring_preparation_requests WHERE id=i AND workspace_id=w FOR UPDATE;
 IF r.revision IS DISTINCT FROM rev OR NOT hiring_formalization_current(w,i) THEN RAISE EXCEPTION 'Aprovação atual do gestor e CEO obrigatória.' USING ERRCODE='40001';END IF;
 IF r.kind='professional' AND (r.selection_mode<>'defined' OR r.person_id IS NULL OR NOT hr_record_access('people','view',r.person_id)) THEN RAISE EXCEPTION 'Defina uma pessoa real autorizada antes de preparar.' USING ERRCODE='42501';END IF;
 IF r.company_id IS NOT NULL AND NOT sales_record_access('companies',r.company_id,'view') THEN RAISE EXCEPTION 'Empresa indisponível.' USING ERRCODE='42501';END IF;
 IF r.kind='supplier' AND (r.company_id IS NULL OR r.contact_id IS NULL OR NOT sales_record_access('contacts',r.contact_id,'view')) THEN RAISE EXCEPTION 'Defina fornecedor e contato canônico autorizado.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM legal_entities WHERE id=r.legal_entity_id AND workspace_id=w AND active) THEN RAISE EXCEPTION 'Entidade WK indisponível.';END IF;
 IF hiring_formalization_recipient(i) IS NULL THEN RAISE EXCEPTION 'Cadastre o e-mail canônico da contraparte.';END IF;
 SELECT * INTO s FROM contract_handoff_settings WHERE workspace_id=w FOR SHARE;
 IF s.workspace_id IS NULL OR NOT s.enabled OR s.legal_user_id IS NULL OR s.finance_user_id IS NULL OR s.signature_user_id IS NULL THEN RAISE EXCEPTION 'Configure os responsáveis e prazos contratuais existentes.';END IF;
 IF NOT hiring_formalization_ready_subject(w,s.legal_user_id,r.kind,'legal') OR NOT hiring_formalization_ready_subject(w,s.finance_user_id,r.kind,'finance') OR NOT hiring_formalization_ready_subject(w,s.signature_user_id,r.kind,'signature') OR NOT hiring_formalization_subject(w,s.legal_user_id,r.kind,'approve') OR NOT hiring_formalization_subject(w,s.finance_user_id,r.kind,'approve') OR NOT EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(s.finance_user_id,w) x WHERE x='techcontracts.approvals.approve.workspace') THEN RAISE EXCEPTION 'Responsáveis sem acesso, alçada ou chave própria. Regularize a configuração.' USING ERRCODE='42501';END IF;
 IF r.kind='supplier' AND NOT EXISTS(SELECT 1 FROM contract_draft_approvers WHERE workspace_id=w AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Jurídico autorizado deve preparar compra de fornecedor.' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM hiring_preparation_approvals WHERE request_id=i AND revision=rev AND status='approved' ORDER BY created_at DESC LIMIT 1;
 SELECT * INTO f FROM hiring_formalizations WHERE request_id=i FOR UPDATE;
 IF f.request_id IS NOT NULL AND f.status<>'invalid' THEN RETURN f.contract_id;END IF;
 IF f.request_id IS NOT NULL THEN
 IF hiring_formalization_document_locked(w,f.contract_id) THEN RAISE EXCEPTION 'Documento em assinatura ou assinado: cancele/revogue o envio pendente ou prepare aditivo apropriado; corpo e assinaturas históricos preservados.' USING ERRCODE='23514';END IF;
 IF NOT work_record_access('techcontracts.contracts',f.contract_id,'update') THEN RAISE EXCEPTION 'Sem acesso de edição ao instrumento.' USING ERRCODE='42501';END IF;
 UPDATE hiring_formalizations SET approval_id=a.id,request_revision=rev,cycle=cycle+1,status='editing',prepared_by=auth.uid(),legal_user=s.legal_user_id,finance_user=s.finance_user_id,signature_user=s.signature_user_id,settings_snapshot=to_jsonb(s),document_hash=NULL,due_at=NULL WHERE request_id=i;
 UPDATE contracts SET body_html='',hiring_person_id=r.person_id,counterparty_company_id=r.company_id,contracting_legal_entity_id=r.legal_entity_id WHERE id=f.contract_id;
 UPDATE contract_drafts SET status='pending_legal',body_html='',revision=revision+1,public_token=NULL,decided_by=NULL,decided_at=NULL,client_decided_at=NULL WHERE id=f.draft_id;
 RETURN f.contract_id;
 END IF;
 k:=gen_random_uuid();d:=gen_random_uuid();
 PERFORM set_config('app.hiring_formalization_factory',i::text,true);
 INSERT INTO contracts(id,workspace_id,owner_id,assigned_to,title,role,document_kind,status,contracting_legal_entity_id,hiring_person_id,counterparty_company_id,body_html,hiring_request_origin)
 VALUES(k,w,auth.uid(),auth.uid(),r.title,'client','main','draft',r.legal_entity_id,r.person_id,r.company_id,'',i);
 INSERT INTO contract_drafts(id,workspace_id,title,body_html,created_by,status,hiring_request_origin) VALUES(d,w,r.title,'',auth.uid(),'pending_legal',i);
 INSERT INTO hiring_formalizations(request_id,workspace_id,contract_id,draft_id,approval_id,request_revision,prepared_by,legal_user,finance_user,signature_user,settings_snapshot)
 VALUES(i,w,k,d,a.id,rev,auth.uid(),s.legal_user_id,s.finance_user_id,s.signature_user_id,to_jsonb(s));
 INSERT INTO hiring_formalization_events(workspace_id,request_id,cycle,actor_id,kind) VALUES(w,i,1,auth.uid(),'prepared');RETURN k;
END $$;
CREATE OR REPLACE FUNCTION public.hiring_formalization_transition(w uuid,i uuid,rev integer,action text,note text DEFAULT '') RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f hiring_formalizations;c contracts;r hiring_preparation_requests;token text;dur integer;u uuid;
BEGIN
 IF action NOT IN('submit','legal','finance','link','revoke','reject') OR NOT hiring_formalization_access(w,i,CASE WHEN action IN('legal','finance','reject') THEN 'approve' ELSE 'manage' END) THEN RAISE EXCEPTION 'Sem permissão para esta etapa.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(i::text,376));
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO f FROM hiring_formalizations WHERE workspace_id=w AND request_id=i FOR UPDATE;SELECT * INTO r FROM hiring_preparation_requests WHERE id=i;SELECT * INTO c FROM contracts WHERE id=f.contract_id FOR UPDATE;
 IF f.request_id IS NULL OR r.revision<>rev OR NOT hiring_formalization_current(w,i) OR NOT work_record_access('techcontracts.contracts',c.id,'view') THEN RAISE EXCEPTION 'Origem ou revisão inválida.' USING ERRCODE='40001';END IF;
 IF action IN('submit','legal','finance','reject') AND NOT hiring_formalization_private_access(w,i) THEN RAISE EXCEPTION 'Conferência exige leitura da solicitação, formalização, referência e contrato.' USING ERRCODE='42501';END IF;
 IF action='submit' THEN
 IF hiring_formalization_document_locked(w,c.id) THEN RAISE EXCEPTION 'Documento em assinatura ou assinado; preserve a versão e use cancelamento/revogação ou aditivo.' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM contract_attachments WHERE contract_id=c.id AND kind<>'file') THEN RAISE EXCEPTION 'Compra WK: envie proposta do fornecedor e condições WK como arquivo PDF; vínculos de cotação/proposta de venda não são aceitos nesta origem.';END IF;
 IF NOT work_record_access('techcontracts.contracts',c.id,'update') OR f.status NOT IN('editing','invalid') OR c.starts_at IS NULL OR (EXISTS(SELECT 1 FROM hiring_preparation_reference_values WHERE request_id=i AND reference_value IS NOT NULL) AND NOT hiring_preparation_access(w,r.kind,'reference_view')) OR EXISTS(SELECT 1 FROM contract_attachments WHERE contract_id=c.id AND (NOT ready OR kind<>'file' OR sha256 IS NULL)) OR length(btrim(regexp_replace(coalesce(c.body_html,''),'<[^>]*>','','g')))<20 OR c.body_html ~ '(\{\{[^}]+\}\}|\[\[[^]]+\]\])' OR length(btrim(note))<5 THEN RAISE EXCEPTION 'Confira cláusulas, partes, vigência, condições e anexos no contrato e registre a conferência.';END IF;
 UPDATE hiring_formalizations SET status='editing' WHERE request_id=i;
 UPDATE contract_drafts SET body_html=c.body_html,prepared_terms=jsonb_build_object('starts_at',c.starts_at,'ends_at',c.ends_at),revision=revision+1,status='pending_legal' WHERE id=f.draft_id;
 UPDATE hiring_formalizations SET status='legal',document_hash=hiring_formalization_fingerprint(i),due_at=contract_handoff_due(now(),(f.settings_snapshot->>'legal_days')::int,f.settings_snapshot->>'timezone') WHERE request_id=i;
 ELSIF action='revoke' THEN PERFORM hiring_formalization_invalidate(i);RETURN 'invalid';
 ELSE
 IF NOT hiring_formalization_valid(i) THEN RAISE EXCEPTION 'Documento, origem, condições, acessos ou responsáveis alterados.' USING ERRCODE='40001';END IF;
 IF action IN('legal','finance','reject') THEN
 u:=CASE WHEN action='legal' OR (action='reject' AND f.status='legal') THEN f.legal_user ELSE f.finance_user END;
 IF u IS DISTINCT FROM auth.uid() OR auth.uid() IN(r.created_by,(SELECT requested_by FROM hiring_preparation_approvals WHERE id=f.approval_id)) OR length(btrim(note))<5 THEN RAISE EXCEPTION 'Responsável nomeado e motivo obrigatórios; autoaprovação proibida.' USING ERRCODE='42501';END IF;
 END IF;
 IF action='reject' THEN
 IF f.status NOT IN('legal','finance') THEN RAISE EXCEPTION 'Etapa de decisão indisponível.';END IF;PERFORM hiring_formalization_invalidate(i);
 ELSIF action='legal' THEN
 IF f.status<>'legal' OR NOT contract_draft_is_approver(w,auth.uid()) THEN RAISE EXCEPTION 'Revisão jurídica indisponível.';END IF;
 UPDATE hiring_formalizations SET status='accepted',legal_by=auth.uid(),legal_at=now(),due_at=NULL WHERE request_id=i;
 ELSIF action='finance' THEN
 IF f.status<>'finance' OR f.accepted_at IS NULL OR NOT user_has_permission(auth.uid(),w,'techcontracts.approvals.approve.workspace') THEN RAISE EXCEPTION 'Conclua revisão jurídica e aceite real antes do Financeiro.';END IF;
 UPDATE hiring_formalizations SET status='signing',finance_by=auth.uid(),finance_at=now(),due_at=contract_handoff_due(now(),(f.settings_snapshot->>'signature_days')::int,f.settings_snapshot->>'timezone') WHERE request_id=i;
 ELSIF action='link' THEN
 IF f.status NOT IN('accepted','sent') OR f.legal_by IS NULL THEN RAISE EXCEPTION 'Minuta não aprovada pelo Jurídico.';END IF;
 UPDATE hiring_draft_capabilities SET revoked_at=now(),code_hash=NULL WHERE request_id=i AND revoked_at IS NULL;
 token:=gen_random_uuid()::text;
 INSERT INTO hiring_draft_capabilities(request_id,cycle,token_hash,expires_at) VALUES(i,f.cycle,encode(extensions.digest(token,'sha256'),'hex'),now()+interval '7 days');
 UPDATE hiring_formalizations SET status='sent' WHERE request_id=i;RETURN token;
 END IF;
 END IF;
 IF action IN('submit','legal','finance','reject') THEN INSERT INTO hiring_formalization_notes(workspace_id,request_id,cycle,stage,actor_id,actor_label,actor_kind,note) VALUES(w,i,f.cycle,CASE WHEN action='reject' THEN f.status||'_reject' ELSE action END,auth.uid(),coalesce((SELECT full_name FROM profiles WHERE id=auth.uid()),'Responsável interno'),'internal',btrim(note));END IF;
 INSERT INTO hiring_formalization_events(workspace_id,request_id,cycle,actor_id,kind) VALUES(w,i,f.cycle,auth.uid(),action);
 PERFORM hiring_formalization_notify(i);RETURN (SELECT status FROM hiring_formalizations WHERE request_id=i);
END $$;
CREATE OR REPLACE FUNCTION public.hiring_draft_decide(token text,challenge uuid,digest text,decision text,note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap hiring_draft_capabilities;f hiring_formalizations;
BEGIN
 -- Serialize all capability/revision changes before consumption; failed attempts commit, never raise after increment.
 SELECT * INTO cap FROM hiring_draft_capabilities WHERE token_hash=encode(extensions.digest(token,'sha256'),'hex');
 IF cap.id IS NULL THEN RAISE EXCEPTION 'Link indisponível.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(cap.request_id::text,376));
 cap:=hiring_draft_capability(token);SELECT * INTO f FROM hiring_formalizations WHERE request_id=cap.request_id FOR UPDATE;
 IF cap.consumed_at IS NOT NULL OR f.status<>'sent' OR decision NOT IN('accept','changes') OR length(coalesce(note,''))>4000 THEN RETURN jsonb_build_object('ok',false,'error','Resposta indisponível.');END IF;
 IF cap.challenge_attempts>=5 OR cap.attempts>=15 THEN RETURN jsonb_build_object('ok',false,'error','Limite de tentativas atingido.');END IF;
 UPDATE hiring_draft_capabilities SET attempts=attempts+1,challenge_attempts=challenge_attempts+1 WHERE id=cap.id;
 IF NOT cap.delivery_ok OR cap.code_expires_at<=now() OR cap.challenge_id IS DISTINCT FROM challenge OR cap.code_hash IS DISTINCT FROM digest OR digest IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Código inválido ou expirado.');END IF;
 IF decision='changes' AND length(btrim(coalesce(note,'')))<5 THEN RETURN jsonb_build_object('ok',false,'error','Informe o motivo do pedido de ajustes (mínimo 5 caracteres).');END IF;
 IF decision='changes' THEN INSERT INTO hiring_formalization_notes(workspace_id,request_id,cycle,stage,actor_label,actor_kind,note) VALUES(f.workspace_id,f.request_id,f.cycle,'counterparty_changes','Contraparte — controle do e-mail canônico confirmado','counterparty',btrim(note));END IF;
 UPDATE hiring_draft_capabilities SET consumed_at=now(),code_hash=NULL WHERE id=cap.id;
 IF decision='accept' THEN UPDATE hiring_formalizations SET status='finance',accepted_at=now(),due_at=contract_handoff_due(now(),(settings_snapshot->>'finance_days')::int,settings_snapshot->>'timezone') WHERE request_id=cap.request_id;
 ELSE PERFORM hiring_formalization_invalidate(cap.request_id);END IF;
 INSERT INTO hiring_formalization_events(workspace_id,request_id,cycle,kind) VALUES(f.workspace_id,f.request_id,f.cycle,CASE decision WHEN 'accept' THEN 'counterparty_accepted' ELSE 'counterparty_changes' END);
 PERFORM hiring_formalization_notify(cap.request_id);
 RETURN jsonb_build_object('ok',true,'status',CASE decision WHEN 'accept' THEN 'accepted' ELSE 'changes_requested' END,'deal_moved',false);
END $$;
CREATE OR REPLACE FUNCTION public.hiring_formalization_context(w uuid,i uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f hiring_formalizations;ok boolean;problem text;signed boolean;pending boolean;
BEGIN
 IF NOT hiring_formalization_access(w,i,'view') THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO f FROM hiring_formalizations WHERE request_id=i AND workspace_id=w;
 ok:=hiring_formalization_current(w,i);signed:=hiring_formalization_signed(w,f.contract_id);pending:=hiring_formalization_document_locked(w,f.contract_id);
 IF pending AND f.status='invalid' THEN problem:='Documento em assinatura ou assinado: cancele/revogue o envio pendente ou use aditivo apropriado; corpo histórico preservado.';
 ELSIF NOT ok THEN problem:='É necessária aprovação válida da revisão atual pelo gestor e CEO com acessos ativos.';
 ELSIF f.request_id IS NOT NULL AND f.status NOT IN('editing','invalid') AND NOT hiring_formalization_valid(i) THEN problem:='Documento, anexos, alçada, condições ou acesso alterados. Prepare nova revisão e obtenha novas decisões.';END IF;
 RETURN jsonb_build_object('contract_id',CASE WHEN work_record_access('techcontracts.contracts',f.contract_id,'view') THEN f.contract_id END,'draft_id',CASE WHEN user_has_permission(auth.uid(),w,'techcontracts.contract_drafts.view.workspace') THEN f.draft_id END,'cycle',coalesce(f.cycle,0),'status',CASE WHEN f.request_id IS NULL THEN 'none' WHEN problem IS NOT NULL THEN 'invalid' WHEN f.status='signing' AND signed THEN 'signed' WHEN f.status='signing' AND pending THEN 'signature_pending' ELSE f.status END,'problem',problem,
 'can_prepare',ok AND NOT coalesce(pending,false) AND hiring_formalization_access(w,i,'manage'),'can_submit',ok AND hiring_formalization_private_access(w,i) AND NOT coalesce(pending,false) AND hiring_formalization_access(w,i,'manage') AND f.status IN('editing','invalid'),'can_legal',ok AND hiring_formalization_private_access(w,i) AND auth.uid() NOT IN((SELECT created_by FROM hiring_preparation_requests WHERE id=i),(SELECT requested_by FROM hiring_preparation_approvals WHERE id=f.approval_id)) AND hiring_formalization_access(w,i,'approve') AND auth.uid()=f.legal_user AND f.status='legal','can_finance',ok AND hiring_formalization_private_access(w,i) AND auth.uid() NOT IN((SELECT created_by FROM hiring_preparation_requests WHERE id=i),(SELECT requested_by FROM hiring_preparation_approvals WHERE id=f.approval_id)) AND hiring_formalization_access(w,i,'approve') AND auth.uid()=f.finance_user AND f.status='finance','can_link',ok AND hiring_formalization_access(w,i,'manage') AND f.status IN('accepted','sent'),'due_at',f.due_at,
 'notes',CASE WHEN hiring_formalization_private_access(w,i) THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'cycle',n.cycle,'stage',n.stage,'actor_id',n.actor_id,'actor_label',n.actor_label,'actor_kind',n.actor_kind,'note',n.note,'created_at',n.created_at) ORDER BY n.created_at,n.id) FROM hiring_formalization_notes n WHERE n.request_id=i AND n.workspace_id=w),'[]'::jsonb) ELSE '[]'::jsonb END,
 'legal_name',(SELECT full_name FROM profiles WHERE id=f.legal_user),'finance_name',(SELECT full_name FROM profiles WHERE id=f.finance_user),'signature_name',(SELECT full_name FROM profiles WHERE id=f.signature_user));
END $$;
CREATE OR REPLACE FUNCTION public.hiring_contract_signature_reason_sales_v1(p_contract uuid,p_ws uuid,p_deal uuid DEFAULT NULL)
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
CREATE OR REPLACE FUNCTION public.hiring_contract_signature_reason(p_contract uuid,p_ws uuid,p_deal uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;e public.hiring_contract_evidence;d public.esign_documents;
BEGIN
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws;
 IF c.hiring_request_origin IS NOT NULL THEN
 IF NOT hiring_formalization_valid(c.hiring_request_origin) THEN RETURN 'Cadeia de formalização da revisão atual pendente ou invalidada.';END IF;
 IF hiring_formalization_signed(p_ws,c.id) THEN RETURN NULL;END IF;RETURN 'Assinatura pendente: todos os signatários e testemunhas incluídos devem concluir; depois aguarda autorização de início.';END IF;
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
CREATE OR REPLACE FUNCTION public.hiring_contract_signature_context_sales_v1(p_ws uuid,p_contract uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;
BEGIN
 IF NOT public.hiring_signature_access(p_ws,p_contract,'view') THEN RAISE EXCEPTION 'Sem acesso à evidência do contrato.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws;
 RETURN jsonb_build_object('witnesses_detected',upper(regexp_replace(c.body_html,'<[^>]*>',' ','g')) ~ 'TESTEMUNHA', 'hash',public.hiring_contract_fingerprint(c.id),'reason',public.hiring_contract_signature_reason(c.id,p_ws,c.deal_id),'deal_id',c.deal_id,
 'entity_id',c.contracting_legal_entity_id,'entities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'cnpj',cnpj) ORDER BY name) FROM public.legal_entities WHERE workspace_id=p_ws AND active),'[]'),'can_manage',public.hiring_signature_access(p_ws,c.id,'manage'),'commercial_source',EXISTS(SELECT 1 FROM public.hiring_commercial_contracts WHERE contract_id=c.id AND workspace_id=p_ws),
 'evidence',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'document_id',document_id,'current_version',contract_hash=public.hiring_contract_fingerprint(c.id),'recorded_at',recorded_at,'signed_on',signed_on,'reference',reference,'note',note,'revoked_at',revoked_at,'revocation_reason',revocation_reason) ORDER BY recorded_at DESC) FROM public.hiring_contract_evidence WHERE contract_id=c.id AND workspace_id=p_ws),'[]'));
END $$;
CREATE OR REPLACE FUNCTION public.hiring_contract_signature_context(p_ws uuid,p_contract uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.contracts;
BEGIN
 IF NOT public.hiring_signature_access(p_ws,p_contract,'view') THEN RAISE EXCEPTION 'Sem acesso à evidência do contrato.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=p_ws;
 IF c.hiring_request_origin IS NOT NULL THEN RETURN jsonb_build_object('hiring_origin',true,'hash',hiring_contract_fingerprint(c.id),'reason',hiring_contract_signature_reason(c.id,p_ws,NULL),'deal_id',NULL,'entity_id',c.contracting_legal_entity_id,'entities','[]'::jsonb,'commercial_source',false,'witnesses_detected',upper(regexp_replace(c.body_html,'<[^>]*>',' ','g')) ~ 'TESTEMUNHA','can_preview',hiring_formalization_preview_access(p_ws,c.id),'can_manage',hiring_signature_access(p_ws,c.id,'manage') AND EXISTS(SELECT 1 FROM hiring_formalizations f WHERE f.contract_id=c.id AND f.status='signing' AND f.signature_user=auth.uid() AND hiring_formalization_access(p_ws,f.request_id,'manage') AND hiring_formalization_valid(f.request_id)) AND NOT hiring_formalization_signed(p_ws,c.id),'evidence',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'document_id',e.document_id,'current_version',e.contract_hash=hiring_contract_fingerprint(c.id),'recorded_at',e.recorded_at,'signed_on',e.signed_on,'reference',NULL,'note','Evidência de assinatura preservada','revoked_at',e.revoked_at,'revocation_reason',NULL) ORDER BY e.recorded_at DESC) FROM hiring_contract_evidence e WHERE e.contract_id=c.id AND e.workspace_id=p_ws),'[]'));END IF;
 RETURN jsonb_build_object('witnesses_detected',upper(regexp_replace(c.body_html,'<[^>]*>',' ','g')) ~ 'TESTEMUNHA', 'hash',public.hiring_contract_fingerprint(c.id),'reason',public.hiring_contract_signature_reason(c.id,p_ws,c.deal_id),'deal_id',c.deal_id,
 'entity_id',c.contracting_legal_entity_id,'entities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'cnpj',cnpj) ORDER BY name) FROM public.legal_entities WHERE workspace_id=p_ws AND active),'[]'),'can_manage',public.hiring_signature_access(p_ws,c.id,'manage'),'commercial_source',EXISTS(SELECT 1 FROM public.hiring_commercial_contracts WHERE contract_id=c.id AND workspace_id=p_ws),
 'evidence',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'document_id',document_id,'current_version',contract_hash=public.hiring_contract_fingerprint(c.id),'recorded_at',recorded_at,'signed_on',signed_on,'reference',reference,'note',note,'revoked_at',revoked_at,'revocation_reason',revocation_reason) ORDER BY recorded_at DESC) FROM public.hiring_contract_evidence WHERE contract_id=c.id AND workspace_id=p_ws),'[]'));
END $$;
CREATE OR REPLACE FUNCTION public.contract_attachment_manage_sales_v1(p_contract uuid,p_action text,p_data jsonb DEFAULT '{}')
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
CREATE OR REPLACE FUNCTION public.contract_attachment_manage(p_contract uuid,p_action text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid; c public.contracts; a public.contract_attachments; s uuid; label text; k text; ref uuid; result jsonb; n text;
BEGIN
 w:=public.work_area_authorize('techcontracts.contracts',CASE WHEN p_action IN('list','sources') THEN 'view' ELSE 'update' END,p_contract);
 IF auth.uid() IS NULL OR NOT public.work_record_access('techcontracts.contracts',p_contract,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM public.contracts WHERE id=p_contract AND workspace_id=w FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
 IF c.hiring_request_origin IS NOT NULL AND p_action='sources' THEN RETURN '[]'::jsonb;END IF;
 IF c.hiring_request_origin IS NOT NULL AND p_action='link' THEN RAISE EXCEPTION 'Compra WK: envie proposta do fornecedor ou condições WK como arquivo PDF, não cotação/proposta de venda.';END IF;
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
CREATE OR REPLACE FUNCTION public.contract_attachment_signing_context_sales_v1(p_contract uuid,p_hash text)
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
CREATE OR REPLACE FUNCTION public.contract_attachment_signing_context(p_contract uuid,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=(public.work_access_context()->>'workspace')::uuid; a public.contract_attachments; rows jsonb:='[]'; n text;
BEGIN
 IF auth.uid() IS NULL OR w IS NULL OR public.is_read_only_view() OR NOT public.hiring_signature_access(w,p_contract,'view') OR (NOT public.hiring_signature_access(w,p_contract,'manage') AND NOT public.hiring_formalization_preview_access(w,p_contract)) OR NOT public.work_record_access('techcontracts.contracts',p_contract,'view') THEN RAISE EXCEPTION 'Sem permissão para preparar contrato e anexos.' USING ERRCODE='42501';END IF;
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
CREATE FUNCTION public.hiring_formalization_signed_body_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k uuid;w uuid;
BEGIN
 IF OLD.hiring_request_origin IS NULL THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='contracts' THEN k:=OLD.id;w:=OLD.workspace_id;ELSE SELECT contract_id,workspace_id INTO k,w FROM hiring_formalizations WHERE request_id=OLD.hiring_request_origin;END IF;
 IF hiring_formalization_document_locked(w,k) AND ROW(NEW.body_html,NEW.hiring_request_origin) IS DISTINCT FROM ROW(OLD.body_html,OLD.hiring_request_origin) THEN RAISE EXCEPTION 'Documento em assinatura ou assinado: corpo histórico imutável; cancele/revogue o envio pendente ou use aditivo apropriado.' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER hiring_signed_body_guard BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_signed_body_guard();
CREATE TRIGGER hiring_signed_body_guard BEFORE UPDATE ON public.contract_drafts FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_signed_body_guard();
REVOKE ALL ON FUNCTION public.hiring_formalization_private_access(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_formalization_signed(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_formalization_document_locked(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_formalization_preview_access(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_formalization_signed_body_guard() FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_contract_signature_reason_sales_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.hiring_contract_signature_context_sales_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.contract_attachment_manage_sales_v1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
REVOKE ALL ON FUNCTION public.contract_attachment_signing_context_sales_v1(uuid,text) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_formalization_private_access(uuid,uuid) TO authenticated;
CREATE FUNCTION public.hiring_attachment_policy(k uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c contracts;BEGIN SELECT * INTO c FROM contracts WHERE id=k;IF c.id IS NULL OR NOT work_record_access('techcontracts.contracts',k,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;RETURN jsonb_build_object('hiring_origin',c.hiring_request_origin IS NOT NULL,'can_preview',hiring_formalization_preview_access(c.workspace_id,k));END $$;
REVOKE ALL ON FUNCTION public.hiring_attachment_policy(uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_attachment_policy(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.forsign_record_evidence(p_op uuid, p_path text, p_file_hash text, p_signed_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public.contract_forsign_operations; r uuid;
BEGIN
 SELECT * INTO o FROM public.contract_forsign_operations WHERE id=p_op FOR UPDATE;
 IF o.id IS NULL THEN RAISE EXCEPTION 'Envio ForSign não encontrado.'; END IF;
 IF EXISTS(SELECT 1 FROM contracts WHERE id=o.contract_id AND workspace_id=o.workspace_id AND hiring_request_origin IS NOT NULL) THEN
 IF o.status NOT IN('completed','evidence_recorded') OR NOT hiring_formalization_forsign_roster(o.requested_members,o.members) THEN RAISE EXCEPTION 'ForSign não comprovou todos os participantes da contratação.';END IF;
 PERFORM hiring_formalization_signature_gate(o.workspace_id,o.contract_id,o.contract_hash);END IF;
 IF o.evidence_id IS NOT NULL THEN RETURN o.evidence_id; END IF;
 PERFORM 1 FROM public.contracts WHERE id=o.contract_id AND workspace_id=o.workspace_id FOR UPDATE;
 IF o.contract_hash IS DISTINCT FROM public.hiring_contract_fingerprint(o.contract_id) THEN
  UPDATE public.contract_forsign_operations SET status='stale', last_error='O contrato mudou depois do envio; o PDF assinado não vale para a versão atual.', updated_at=now() WHERE id=o.id;
  RETURN NULL;
 END IF;
 IF p_path NOT LIKE o.workspace_id::text||'/'||o.contract_id::text||'/%' OR p_file_hash !~ '^[a-f0-9]{64}$'
  OR NOT EXISTS(SELECT 1 FROM storage.objects s WHERE s.bucket_id='contract-signature-evidence' AND s.name=p_path AND s.user_metadata->>'sha256'=p_file_hash AND s.user_metadata->>'contract_hash'=o.contract_hash) THEN
  RAISE EXCEPTION 'PDF assinado não encontrado no arquivo de evidências.';
 END IF;
 INSERT INTO public.hiring_contract_evidence(workspace_id,contract_id,kind,contract_hash,file_path,file_hash,signed_on,reference,note,recorded_by)
 VALUES(o.workspace_id,o.contract_id,'external',o.contract_hash,p_path,p_file_hash,coalesce(p_signed_on,(now() AT TIME ZONE 'America/Sao_Paulo')::date),
  'ForSign · operação '||o.operation_id,'Assinado no ForSign e recebido automaticamente pela integração (PDF final e trilha de auditoria do ForSign).',o.created_by)
 RETURNING id INTO r;
 INSERT INTO public.hiring_signature_events(workspace_id,contract_id,actor_id,kind,details)
 VALUES(o.workspace_id,o.contract_id,o.created_by,'external_attested',jsonb_build_object('evidence_id',r,'file_hash',p_file_hash,'provider','forsign','operation_id',o.operation_id));
 UPDATE public.contract_forsign_operations SET status='evidence_recorded', evidence_id=r, updated_at=now() WHERE id=o.id;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.hiring_formalization_forsign_roster(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
COMMIT;
