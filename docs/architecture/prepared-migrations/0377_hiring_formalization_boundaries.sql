-- FORMALIZA-SOLICITA: capability OTP and protected native/ForSign dispatch. REVIEW ONLY.
BEGIN;
CREATE FUNCTION public.hiring_draft_capability(token text) RETURNS public.hiring_draft_capabilities LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap hiring_draft_capabilities;
BEGIN
 SELECT * INTO cap FROM hiring_draft_capabilities WHERE token_hash=encode(extensions.digest(token,'sha256'),'hex');
 PERFORM hiring_formalization_lock(cap.request_id);
 SELECT * INTO cap FROM hiring_draft_capabilities WHERE token_hash=encode(extensions.digest(token,'sha256'),'hex') FOR UPDATE;
 IF cap.id IS NULL OR cap.revoked_at IS NOT NULL OR cap.expires_at<=now() OR NOT hiring_formalization_valid(cap.request_id) OR NOT EXISTS(SELECT 1 FROM hiring_formalizations WHERE request_id=cap.request_id AND cycle=cap.cycle AND status IN('sent','finance','signing')) THEN RAISE EXCEPTION 'Link expirado, revogado ou versão indisponível.' USING ERRCODE='42501';END IF;
 RETURN cap;
END $$;
CREATE FUNCTION public.hiring_draft_public(token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap hiring_draft_capabilities;f hiring_formalizations;d contract_drafts;
BEGIN
 cap:=hiring_draft_capability(token);SELECT * INTO f FROM hiring_formalizations WHERE request_id=cap.request_id;SELECT * INTO d FROM contract_drafts WHERE id=f.draft_id;
 RETURN jsonb_build_object('title',d.title,'body_html',hiring_contract_esign_body_without_attachments(f.workspace_id,f.contract_id),'status',CASE WHEN f.accepted_at IS NULL THEN 'sent' ELSE 'accepted' END,'workspace_name',(SELECT to_jsonb(w)->>'name' FROM workspaces w WHERE id=f.workspace_id),'client_decided_at',f.accepted_at,'client_name',NULL,'requires_code',true,'expires_at',cap.expires_at,
 'attachments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'name',a.file_name,'sha256',a.sha256) ORDER BY a.id) FROM contract_attachments a WHERE a.contract_id=f.contract_id AND a.ready),'[]'));
END $$;
CREATE FUNCTION public.hiring_draft_code_reserve(token text,challenge uuid,digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap hiring_draft_capabilities;recipient text;
BEGIN
 cap:=hiring_draft_capability(token);
 IF cap.consumed_at IS NOT NULL OR cap.sends>=5 OR cap.attempts>=15 OR (cap.last_send_at IS NOT NULL AND cap.last_send_at>now()-interval '60 seconds') OR digest !~ '^[a-f0-9]{64}$' OR challenge IS NULL THEN RAISE EXCEPTION 'Aguarde antes de reenviar ou solicite um novo link após esgotar as tentativas.';END IF;
 recipient:=hiring_formalization_recipient(cap.request_id);
 IF recipient IS NULL THEN RAISE EXCEPTION 'E-mail da contraparte indisponível.';END IF;
 UPDATE hiring_draft_capabilities SET sends=sends+1,challenge_attempts=0,last_send_at=now(),challenge_id=challenge,code_hash=digest,code_expires_at=now()+interval '10 minutes',delivery_ok=false WHERE id=cap.id;
 RETURN jsonb_build_object('challenge',challenge,'recipient',recipient);
END $$;
CREATE FUNCTION public.hiring_draft_code_delivery(token text,challenge uuid,ok boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap hiring_draft_capabilities;
BEGIN
 cap:=hiring_draft_capability(token);
 UPDATE hiring_draft_capabilities SET delivery_ok=ok,code_hash=CASE WHEN ok THEN code_hash ELSE NULL END WHERE id=cap.id AND challenge_id=challenge AND consumed_at IS NULL;
END $$;
CREATE FUNCTION public.hiring_draft_code_context(token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap hiring_draft_capabilities;BEGIN cap:=hiring_draft_capability(token);RETURN cap.challenge_id;END $$;
CREATE FUNCTION public.hiring_draft_decide(token text,challenge uuid,digest text,decision text,note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
 UPDATE hiring_draft_capabilities SET consumed_at=now(),code_hash=NULL WHERE id=cap.id;
 IF decision='accept' THEN UPDATE hiring_formalizations SET status='finance',accepted_at=now(),due_at=contract_handoff_due(now(),(settings_snapshot->>'finance_days')::int,settings_snapshot->>'timezone') WHERE request_id=cap.request_id;
 ELSE PERFORM hiring_formalization_invalidate(cap.request_id);END IF;
 INSERT INTO hiring_formalization_events(workspace_id,request_id,cycle,kind) VALUES(f.workspace_id,f.request_id,f.cycle,CASE decision WHEN 'accept' THEN 'counterparty_accepted' ELSE 'counterparty_changes' END);
 PERFORM hiring_formalization_notify(cap.request_id);
 RETURN jsonb_build_object('ok',true,'status',CASE decision WHEN 'accept' THEN 'accepted' ELSE 'changes_requested' END,'deal_moved',false);
END $$;
CREATE FUNCTION public.hiring_draft_attachment(token text,annex uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cap hiring_draft_capabilities;f hiring_formalizations;a contract_attachments;
BEGIN
 cap:=hiring_draft_capability(token);SELECT * INTO f FROM hiring_formalizations WHERE request_id=cap.request_id;
 SELECT * INTO a FROM contract_attachments WHERE id=annex AND contract_id=f.contract_id AND workspace_id=f.workspace_id AND ready AND kind='file';
 IF a.id IS NULL THEN RAISE EXCEPTION 'Anexo indisponível.';END IF;
 RETURN jsonb_build_object('path',a.storage_path,'sha256',a.sha256,'name',a.file_name);
END $$;
CREATE FUNCTION public.hiring_formalization_change_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i uuid;x record;
BEGIN
 IF TG_TABLE_NAME='hiring_preparation_approvals' THEN
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status='superseded' THEN PERFORM hiring_formalization_invalidate(NEW.request_id);END IF;RETURN NEW;
 ELSIF TG_TABLE_NAME='contract_handoff_settings' THEN
 IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN FOR x IN SELECT request_id FROM hiring_formalizations WHERE workspace_id=OLD.workspace_id LOOP PERFORM hiring_formalization_invalidate(x.request_id);END LOOP;END IF;RETURN NEW;
 ELSIF TG_TABLE_NAME='contract_attachments' THEN
 i:=coalesce(to_jsonb(NEW)->>'contract_id',to_jsonb(OLD)->>'contract_id')::uuid;
 SELECT hiring_request_origin INTO i FROM contracts WHERE id=i;
 IF i IS NOT NULL THEN
 IF TG_OP<>'UPDATE' OR (to_jsonb(NEW)-ARRAY['source_stamp','source_name','source_snapshot_path','source_snapshot_sha256']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['source_stamp','source_name','source_snapshot_path','source_snapshot_sha256']) THEN PERFORM hiring_formalization_invalidate(i);END IF;
 END IF;
 ELSE
 i:=(to_jsonb(NEW)->>'hiring_request_origin')::uuid;
 IF i IS NOT NULL AND TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM hiring_formalizations WHERE request_id=i AND status NOT IN('editing','invalid')) THEN
 IF TG_TABLE_NAME='contracts' AND (to_jsonb(NEW)-ARRAY['status','updated_at','signed_at','signed_pdf_path','signature_provider','signature_document_id','signature_operation_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','updated_at','signed_at','signed_pdf_path','signature_provider','signature_document_id','signature_operation_id']) THEN PERFORM hiring_formalization_invalidate(i);
 ELSIF TG_TABLE_NAME='contract_drafts' AND ROW(to_jsonb(NEW)->>'body_html',to_jsonb(NEW)->>'template_id',to_jsonb(NEW)->'prepared_terms') IS DISTINCT FROM ROW(to_jsonb(OLD)->>'body_html',to_jsonb(OLD)->>'template_id',to_jsonb(OLD)->'prepared_terms') THEN PERFORM hiring_formalization_invalidate(i);END IF;
 END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER hiring_origin_approval_change AFTER UPDATE ON public.hiring_preparation_approvals FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_change_guard();
CREATE TRIGGER hiring_origin_config_change AFTER UPDATE ON public.contract_handoff_settings FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_change_guard();
CREATE TRIGGER hiring_origin_contract_change AFTER UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_change_guard();
CREATE TRIGGER hiring_origin_draft_change AFTER UPDATE ON public.contract_drafts FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_change_guard();
CREATE TRIGGER hiring_origin_annex_change AFTER INSERT OR UPDATE OR DELETE ON public.contract_attachments FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_change_guard();
CREATE FUNCTION public.hiring_formalization_origin_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;i uuid;
BEGIN
 i:=NEW.hiring_request_origin;
 IF TG_OP='UPDATE' AND NEW.hiring_request_origin IS DISTINCT FROM OLD.hiring_request_origin THEN RAISE EXCEPTION 'Origem de contratação imutável.';END IF;
 IF i IS NULL THEN RETURN NEW;END IF;
 SELECT * INTO r FROM hiring_preparation_requests WHERE id=i AND workspace_id=NEW.workspace_id;
 IF r.id IS NULL OR (TG_OP='INSERT' AND (coalesce(current_setting('app.hiring_formalization_factory',true),'')<>i::text OR NOT hiring_formalization_access(NEW.workspace_id,i,'manage') OR NOT hiring_formalization_current(NEW.workspace_id,i))) THEN RAISE EXCEPTION 'Origem de contratação não autorizada.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='contracts' THEN
 IF NEW.role::text<>'client' OR NEW.deal_id IS NOT NULL OR NEW.proposal_id IS NOT NULL OR NEW.document_kind<>'main' OR NEW.hiring_person_id IS DISTINCT FROM r.person_id OR NEW.counterparty_company_id IS DISTINCT FROM r.company_id OR NEW.contracting_legal_entity_id IS DISTINCT FROM r.legal_entity_id THEN RAISE EXCEPTION 'Partes ou origem do instrumento incompatíveis.';END IF;
 IF NEW.status::text IN('active','renewing') THEN RAISE EXCEPTION 'Execução pertence ao pacote 4; assinatura não autoriza ativação.';END IF;
 ELSE
 IF NEW.deal_id IS NOT NULL OR NEW.proposal_id IS NOT NULL OR NEW.public_token IS NOT NULL OR NEW.status IN('approved','accepted','sent') THEN RAISE EXCEPTION 'Use o fluxo de formalização com aceite externo verificado; sem bypass interno.';END IF;
 END IF;RETURN NEW;
END $$;
-- INVOKER wrapper prevents user-controlled session flags from manufacturing provenance.
CREATE FUNCTION public.hiring_formalization_origin_invoker() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.hiring_request_origin IS NOT NULL AND current_user NOT IN('postgres','supabase_admin') AND current_user<>pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='public.hiring_formalization_prepare(uuid,uuid,integer)'::regprocedure)) THEN RAISE EXCEPTION 'Origem protegida; use a fábrica de formalização.' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
CREATE TRIGGER hiring_origin_provenance BEFORE INSERT OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_origin_guard();
CREATE TRIGGER hiring_origin_provenance BEFORE INSERT OR UPDATE ON public.contract_drafts FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_origin_guard();
CREATE TRIGGER hiring_origin_caller BEFORE INSERT ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_origin_invoker();
CREATE TRIGGER hiring_origin_caller BEFORE INSERT ON public.contract_drafts FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_origin_invoker();
-- Guard low-level signing paths (including direct REST callers) without changing historical documents.
CREATE FUNCTION public.hiring_formalization_esign_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k uuid;w uuid;
BEGIN
 IF TG_TABLE_NAME='hiring_contract_evidence' OR TG_TABLE_NAME='contract_forsign_operations' OR TG_TABLE_NAME='contract_esign_deliveries' THEN k:=NEW.contract_id;w:=NEW.workspace_id;
 ELSE SELECT e.contract_id,e.workspace_id INTO k,w FROM hiring_contract_evidence e WHERE e.document_id=NEW.id AND e.kind='native' LIMIT 1;END IF;
 IF k IS NOT NULL THEN PERFORM hiring_formalization_signature_gate(w,k,NULL);END IF;RETURN NEW;
END $$;
CREATE TRIGGER hiring_formalization_evidence_gate BEFORE INSERT ON public.hiring_contract_evidence FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_esign_guard();
CREATE TRIGGER hiring_formalization_forsign_gate BEFORE INSERT ON public.contract_forsign_operations FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_esign_guard();
CREATE TRIGGER hiring_formalization_invite_gate BEFORE INSERT ON public.contract_esign_deliveries FOR EACH ROW EXECUTE FUNCTION public.hiring_formalization_esign_guard();
CREATE TRIGGER hiring_formalization_native_send BEFORE UPDATE OF status ON public.esign_documents FOR EACH ROW WHEN(NEW.status::text IN('sent','partially_signed')) EXECUTE FUNCTION public.hiring_formalization_esign_guard();
REVOKE ALL ON FUNCTION public.hiring_draft_capability(text),public.hiring_draft_public(text),public.hiring_draft_code_reserve(text,uuid,text),public.hiring_draft_code_delivery(text,uuid,boolean),public.hiring_draft_code_context(text),public.hiring_draft_decide(text,uuid,text,text,text),public.hiring_draft_attachment(text,uuid),public.hiring_formalization_change_guard(),public.hiring_formalization_origin_guard(),public.hiring_formalization_origin_invoker(),public.hiring_formalization_esign_guard() FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_draft_public(text),public.hiring_draft_code_reserve(text,uuid,text),public.hiring_draft_code_delivery(text,uuid,boolean),public.hiring_draft_code_context(text),public.hiring_draft_decide(text,uuid,text,text,text),public.hiring_draft_attachment(text,uuid) TO service_role;
CREATE POLICY hiring_contract_sensitive_origin ON public.contracts AS RESTRICTIVE FOR SELECT TO authenticated USING(hiring_request_origin IS NULL OR EXISTS(SELECT 1 FROM hiring_preparation_requests r WHERE r.id=hiring_request_origin AND r.workspace_id=contracts.workspace_id AND hiring_preparation_access(r.workspace_id,r.kind,'reference_view')));
CREATE POLICY hiring_draft_sensitive_origin ON public.contract_drafts AS RESTRICTIVE FOR SELECT TO authenticated USING(hiring_request_origin IS NULL OR EXISTS(SELECT 1 FROM hiring_preparation_requests r WHERE r.id=hiring_request_origin AND r.workspace_id=contract_drafts.workspace_id AND hiring_preparation_access(r.workspace_id,r.kind,'reference_view')));
COMMIT;
