-- FORMALIZA-SOLICITA. REVIEW ONLY, outside the automatic journal. Depends on 0373-0375 and 0367.
BEGIN;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('techpeople.hiring_requests.formalization.manage.workspace','techpeople','hiring_requests.formalization','manage','workspace','Preparar instrumento de profissional','RH prepara origem aprovada; não inicia atividade.',true),
('techcontracts.supplier_requests.formalization.manage.workspace','techcontracts','supplier_requests.formalization','manage','workspace','Preparar instrumento de fornecedor','Jurídico prepara compra WK com origem aprovada.',true),
('techpeople.hiring_requests.formalization.approve.workspace','techpeople','hiring_requests.formalization','approve','workspace','Revisar instrumento de profissional','Decisão jurídica ou Financeiro nomeado, na ordem.',true),
('techcontracts.supplier_requests.formalization.approve.workspace','techcontracts','supplier_requests.formalization','approve','workspace','Revisar instrumento de fornecedor','Decisão jurídica ou Financeiro nomeado, na ordem.',true)
ON CONFLICT(key) DO NOTHING;
CREATE TABLE public.hiring_formalizations(
 request_id uuid PRIMARY KEY,workspace_id uuid NOT NULL,contract_id uuid NOT NULL UNIQUE REFERENCES public.contracts(id),draft_id uuid NOT NULL UNIQUE REFERENCES public.contract_drafts(id),
 approval_id uuid NOT NULL,request_revision integer NOT NULL,cycle integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'editing' CHECK(status IN('editing','legal','accepted','sent','finance','signing','invalid')),
 prepared_by uuid NOT NULL,legal_user uuid NOT NULL,finance_user uuid NOT NULL,signature_user uuid NOT NULL,settings_snapshot jsonb NOT NULL,
 document_hash text,legal_by uuid,legal_at timestamptz,accepted_at timestamptz,finance_by uuid,finance_at timestamptz,due_at timestamptz,
 FOREIGN KEY(workspace_id,request_id) REFERENCES public.hiring_preparation_requests(workspace_id,id),
 FOREIGN KEY(workspace_id,approval_id) REFERENCES public.hiring_preparation_approvals(workspace_id,id)
);
REVOKE ALL ON public.hiring_formalizations FROM PUBLIC,anon,authenticated,techerp_request_writer;
GRANT SELECT ON public.hiring_formalizations TO authenticated; GRANT ALL ON public.hiring_formalizations TO service_role;
ALTER TABLE public.hiring_formalizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY hiring_formalization_read ON public.hiring_formalizations FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.workspace_id=hiring_formalizations.workspace_id AND r.id=request_id));
-- Private capability/challenge state, not an email queue. No token/digest exposed via table SELECT.
CREATE TABLE public.hiring_draft_capabilities(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL REFERENCES public.hiring_formalizations(request_id),cycle integer NOT NULL,
 token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,revoked_at timestamptz,
 sends integer NOT NULL DEFAULT 0,attempts integer NOT NULL DEFAULT 0,last_send_at timestamptz,
 challenge_attempts integer NOT NULL DEFAULT 0,challenge_id uuid,code_hash text,code_expires_at timestamptz,delivery_ok boolean NOT NULL DEFAULT false,consumed_at timestamptz
);
REVOKE ALL ON public.hiring_draft_capabilities FROM PUBLIC,anon,authenticated,techerp_request_writer;
GRANT ALL ON public.hiring_draft_capabilities TO service_role;
ALTER TABLE public.hiring_draft_capabilities ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.hiring_formalization_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,request_id uuid NOT NULL REFERENCES public.hiring_formalizations(request_id),cycle integer NOT NULL,actor_id uuid,kind text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.hiring_formalization_events FROM PUBLIC,anon,authenticated,techerp_request_writer;
GRANT SELECT ON public.hiring_formalization_events TO authenticated;GRANT ALL ON public.hiring_formalization_events TO service_role;
ALTER TABLE public.hiring_formalization_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY hiring_formalization_event_read ON public.hiring_formalization_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.hiring_preparation_requests r WHERE r.workspace_id=hiring_formalization_events.workspace_id AND r.id=request_id));
CREATE TRIGGER hiring_formalization_event_immutable BEFORE UPDATE OR DELETE ON public.hiring_formalization_events FOR EACH ROW EXECUTE FUNCTION public.hiring_preparation_immutable();
ALTER TABLE public.contracts ADD COLUMN hiring_request_origin uuid REFERENCES public.hiring_preparation_requests(id);
ALTER TABLE public.contract_drafts ADD COLUMN hiring_request_origin uuid REFERENCES public.hiring_preparation_requests(id);
CREATE UNIQUE INDEX hiring_contract_one_request ON public.contracts(hiring_request_origin) WHERE hiring_request_origin IS NOT NULL;
CREATE UNIQUE INDEX hiring_draft_one_request ON public.contract_drafts(hiring_request_origin) WHERE hiring_request_origin IS NOT NULL;
-- Separate equivalent boundary: never replaces the user's local batch-1 helper.
CREATE FUNCTION public.hiring_formalization_lock(i uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM hp.area_id FROM hiring_area_policies hp JOIN hiring_preparation_requests r ON r.workspace_id=hp.workspace_id AND r.area_id=hp.area_id WHERE r.id=i FOR SHARE OF hp;
 PERFORM id FROM hiring_preparation_requests WHERE id=i FOR UPDATE;
 PERFORM c.id FROM contracts c WHERE c.hiring_request_origin=i FOR UPDATE;
 PERFORM request_id FROM hiring_formalizations WHERE request_id=i FOR UPDATE;
END $$;
CREATE FUNCTION public.hiring_formalization_current(w uuid,i uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;a hiring_preparation_approvals;p hiring_area_policies;ref integer;u uuid;
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE workspace_id=w AND id=i;
 SELECT * INTO a FROM hiring_preparation_approvals WHERE workspace_id=w AND request_id=i AND revision=r.revision AND status='approved' ORDER BY created_at DESC LIMIT 1;
 SELECT * INTO p FROM hiring_area_policies WHERE workspace_id=w AND area_id=r.area_id;
 SELECT revision INTO ref FROM hiring_preparation_reference_values WHERE workspace_id=w AND request_id=i;
 IF r.id IS NULL OR r.status<>'ready' OR a.id IS NULL OR a.reference_revision<>coalesce(ref,0) OR a.policy_snapshot IS DISTINCT FROM to_jsonb(p) THEN RETURN false;END IF;
 FOREACH u IN ARRAY ARRAY[a.manager_id,a.ceo_id] LOOP
  IF u IN(r.created_by,a.requested_by) OR NOT hiring_preparation_approval_subject(w,u,r.kind,'view') OR NOT hiring_preparation_approval_subject(w,u,r.kind,'approve') OR NOT hiring_preparation_approval_subject(w,u,r.kind,'reference_view') THEN RETURN false;END IF;
 END LOOP;
 RETURN (SELECT count(*)=2 FROM hiring_preparation_approval_events WHERE approval_id=a.id AND stage IN('manager','ceo') AND kind='approved');
END $$;
CREATE FUNCTION public.hiring_formalization_subject(w uuid,u uuid,k text,action text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT hiring_preparation_approval_subject(w,u,k,'view') AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x=CASE k WHEN 'professional' THEN 'techpeople.hiring_requests' ELSE 'techcontracts.supplier_requests' END||'.formalization.'||action||'.workspace')
$$;
CREATE FUNCTION public.hiring_formalization_access(w uuid,i uuid,action text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM hiring_preparation_requests r WHERE r.workspace_id=w AND r.id=i AND hiring_preparation_access(w,r.kind,'view') AND (action='view' OR (NOT is_read_only_view() AND hiring_formalization_subject(w,auth.uid(),r.kind,action))))
$$;
CREATE FUNCTION public.hiring_formalization_recipient(i uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r hiring_preparation_requests;email text;
BEGIN
 SELECT * INTO r FROM hiring_preparation_requests WHERE id=i;
 IF r.kind='professional' THEN SELECT nullif(btrim(to_jsonb(p)->>'email'),'') INTO email FROM people p WHERE id=r.person_id AND workspace_id=r.workspace_id AND NOT archived;
 ELSE SELECT nullif(btrim(to_jsonb(c)->>'email'),'') INTO email FROM contacts c WHERE id=r.contact_id AND company_id=r.company_id AND workspace_id=r.workspace_id AND deleted_at IS NULL;END IF;
 RETURN email;
END $$;
CREATE FUNCTION public.hiring_formalization_fingerprint(i uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT encode(extensions.digest(convert_to(jsonb_build_object('contract',hiring_contract_fingerprint(f.contract_id),'body',d.body_html,'terms',d.prepared_terms,'template',d.template_id,'recipient',hiring_formalization_recipient(i),'conditions',(SELECT to_jsonb(v) FROM hiring_preparation_reference_values v WHERE request_id=i),'person',(SELECT to_jsonb(p)-ARRAY['monthly_cost','updated_at','created_at'] FROM people p WHERE p.id=r.person_id AND p.workspace_id=f.workspace_id))::text,'UTF8'),'sha256'),'hex') FROM hiring_formalizations f JOIN contract_drafts d ON d.id=f.draft_id JOIN hiring_preparation_requests r ON r.id=f.request_id WHERE f.request_id=i
$$;
CREATE FUNCTION public.hiring_formalization_ready_subject(w uuid,u uuid,k text,a text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT hiring_preparation_approval_subject(w,u,k,'view') AND hiring_preparation_approval_subject(w,u,k,'reference_view') AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x='techcontracts.contracts.view.workspace')
 AND CASE a WHEN 'legal' THEN hiring_formalization_subject(w,u,k,'approve') AND EXISTS(SELECT 1 FROM contract_draft_approvers WHERE workspace_id=w AND user_id=u) AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x='techcontracts.contract_drafts.approve.workspace')
 WHEN 'finance' THEN hiring_formalization_subject(w,u,k,'approve') AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x='techcontracts.approvals.approve.workspace')
 WHEN 'signature' THEN hiring_formalization_subject(w,u,k,'manage') AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(u,w) x WHERE x='techcontracts.signature_evidence.manage.workspace') ELSE false END
$$;
CREATE FUNCTION public.hiring_formalization_valid(i uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce((SELECT hiring_formalization_current(f.workspace_id,i) AND f.request_revision=r.revision AND f.approval_id=a.id AND f.settings_snapshot=to_jsonb(s) AND f.document_hash=hiring_formalization_fingerprint(i) AND f.status<>'invalid'
 AND hiring_formalization_subject(f.workspace_id,f.legal_user,r.kind,'approve') AND hiring_formalization_subject(f.workspace_id,f.finance_user,r.kind,'approve') AND hiring_formalization_ready_subject(f.workspace_id,f.legal_user,r.kind,'legal') AND hiring_formalization_ready_subject(f.workspace_id,f.finance_user,r.kind,'finance') AND hiring_formalization_ready_subject(f.workspace_id,f.signature_user,r.kind,'signature')
 AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(f.finance_user,f.workspace_id) x WHERE x='techcontracts.approvals.approve.workspace')
 AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(f.legal_user,f.workspace_id) x WHERE x='techcontracts.contracts.view.workspace') AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(f.finance_user,f.workspace_id) x WHERE x='techcontracts.contracts.view.workspace')
 AND EXISTS(SELECT 1 FROM techerp_api.effective_permissions_unchecked(f.signature_user,f.workspace_id) x WHERE x='techcontracts.signature_evidence.manage.workspace') AND is_workspace_member(f.workspace_id,f.signature_user)
 FROM hiring_formalizations f JOIN hiring_preparation_requests r ON r.id=f.request_id JOIN hiring_preparation_approvals a ON a.id=f.approval_id JOIN contract_handoff_settings s ON s.workspace_id=f.workspace_id WHERE f.request_id=i),false)
$$;
CREATE FUNCTION public.hiring_formalization_invalidate(i uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f hiring_formalizations;
BEGIN
 UPDATE hiring_formalizations SET status='invalid',legal_by=NULL,legal_at=NULL,accepted_at=NULL,finance_by=NULL,finance_at=NULL WHERE request_id=i AND status<>'invalid' RETURNING * INTO f;
 IF FOUND THEN
 UPDATE hiring_draft_capabilities SET revoked_at=now(),code_hash=NULL WHERE request_id=i AND revoked_at IS NULL;
 INSERT INTO hiring_formalization_events(workspace_id,request_id,cycle,actor_id,kind) VALUES(f.workspace_id,i,f.cycle,auth.uid(),'invalidated');
 END IF;
END $$;
CREATE FUNCTION public.hiring_formalization_notify(i uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f hiring_formalizations;r hiring_preparation_requests;u uuid;
BEGIN
 SELECT * INTO f FROM hiring_formalizations WHERE request_id=i;SELECT * INTO r FROM hiring_preparation_requests WHERE id=i;
 u:=CASE f.status WHEN 'legal' THEN f.legal_user WHEN 'finance' THEN f.finance_user WHEN 'signing' THEN f.signature_user END;
 IF u IS NULL OR NOT hiring_preparation_approval_subject(f.workspace_id,u,r.kind,'view') THEN RETURN;END IF;
 INSERT INTO notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key) VALUES(f.workspace_id,u,u,'hiring_formalization','Instrumento de contratação pendente','Abra a solicitação para conferir sua etapa.',CASE r.kind WHEN 'professional' THEN '/people/hiring-requests' ELSE '/contracts/supplier-requests' END||'?request='||i,'hiring_preparation_request',i,'formalization:'||i||':'||f.cycle||':'||f.status) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END $$;
-- New factory only; explicit canonical origin with no caller-supplied contract/draft identity.
CREATE FUNCTION public.hiring_formalization_prepare(w uuid,i uuid,rev integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
CREATE FUNCTION public.hiring_formalization_transition(w uuid,i uuid,rev integer,action text,note text DEFAULT '') RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f hiring_formalizations;c contracts;r hiring_preparation_requests;token text;dur integer;u uuid;
BEGIN
 IF action NOT IN('submit','legal','finance','link','revoke','reject') OR NOT hiring_formalization_access(w,i,CASE WHEN action IN('legal','finance','reject') THEN 'approve' ELSE 'manage' END) THEN RAISE EXCEPTION 'Sem permissão para esta etapa.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(i::text,376));
 PERFORM hiring_formalization_lock(i);
 SELECT * INTO f FROM hiring_formalizations WHERE workspace_id=w AND request_id=i FOR UPDATE;SELECT * INTO r FROM hiring_preparation_requests WHERE id=i;SELECT * INTO c FROM contracts WHERE id=f.contract_id FOR UPDATE;
 IF f.request_id IS NULL OR r.revision<>rev OR NOT hiring_formalization_current(w,i) OR NOT work_record_access('techcontracts.contracts',c.id,'view') THEN RAISE EXCEPTION 'Origem ou revisão inválida.' USING ERRCODE='40001';END IF;
 IF action='submit' THEN
 IF NOT work_record_access('techcontracts.contracts',c.id,'update') OR f.status NOT IN('editing','invalid') OR c.starts_at IS NULL OR (EXISTS(SELECT 1 FROM hiring_preparation_reference_values WHERE request_id=i AND reference_value IS NOT NULL) AND NOT hiring_preparation_access(w,r.kind,'reference_view')) OR EXISTS(SELECT 1 FROM contract_attachments WHERE contract_id=c.id AND (NOT ready OR kind<>'file' OR sha256 IS NULL)) OR length(btrim(regexp_replace(coalesce(c.body_html,''),'<[^>]*>','','g')))<20 OR c.body_html ~ '(\{\{[^}]+\}\}|\[\[[^]]+\]\])' OR length(btrim(note))<5 THEN RAISE EXCEPTION 'Confira cláusulas, partes, vigência, condições e anexos no contrato e registre a conferência.';END IF;
 UPDATE hiring_formalizations SET status='editing' WHERE request_id=i;
 UPDATE contract_drafts SET body_html=c.body_html,prepared_terms=jsonb_build_object('starts_at',c.starts_at,'ends_at',c.ends_at),revision=revision+1,status='pending_legal' WHERE id=f.draft_id;
 UPDATE hiring_formalizations SET status='legal',document_hash=hiring_formalization_fingerprint(i),due_at=contract_handoff_due(now(),(f.settings_snapshot->>'legal_days')::int,f.settings_snapshot->>'timezone') WHERE request_id=i;
 ELSIF action='revoke' THEN PERFORM hiring_formalization_invalidate(i);RETURN 'invalid';
 ELSE
 IF NOT hiring_formalization_valid(i) THEN RAISE EXCEPTION 'Documento, origem, condições, acessos ou responsáveis alterados.' USING ERRCODE='40001';END IF;
 IF action IN('legal','finance','reject') THEN
 u:=CASE WHEN action='legal' OR (action='reject' AND f.status='legal') THEN f.legal_user ELSE f.finance_user END;
 IF u IS DISTINCT FROM auth.uid() OR auth.uid() IN(f.prepared_by,r.created_by,(SELECT requested_by FROM hiring_preparation_approvals WHERE id=f.approval_id)) OR length(btrim(note))<5 THEN RAISE EXCEPTION 'Responsável nomeado e motivo obrigatórios; autoaprovação proibida.' USING ERRCODE='42501';END IF;
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
 INSERT INTO hiring_formalization_events(workspace_id,request_id,cycle,actor_id,kind) VALUES(w,i,f.cycle,auth.uid(),action);
 PERFORM hiring_formalization_notify(i);RETURN (SELECT status FROM hiring_formalizations WHERE request_id=i);
END $$;
CREATE FUNCTION public.hiring_formalization_signature_gate(w uuid,k uuid,h text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f hiring_formalizations;c contracts;
BEGIN
 SELECT * INTO c FROM contracts WHERE id=k AND workspace_id=w;
 IF c.hiring_request_origin IS NULL THEN RETURN true;END IF;
 SELECT * INTO f FROM hiring_formalizations WHERE contract_id=k AND workspace_id=w;
 IF f.status IS DISTINCT FROM 'signing' OR NOT hiring_formalization_valid(f.request_id) OR c.role::text<>'client' OR c.deal_id IS NOT NULL OR c.proposal_id IS NOT NULL OR (h IS NOT NULL AND h IS DISTINCT FROM hiring_contract_fingerprint(k)) THEN RAISE EXCEPTION 'Conclua a origem aprovada, revisão jurídica, aceite externo e conferência Financeiro da versão atual.' USING ERRCODE='42501';END IF;
 IF auth.uid() IS NOT NULL AND (auth.uid() IS DISTINCT FROM f.signature_user OR NOT hiring_formalization_access(w,f.request_id,'manage')) THEN RAISE EXCEPTION 'Envio reservado ao responsável nomeado com permissão de formalização.' USING ERRCODE='42501';END IF;
 RETURN true;
END $$;
CREATE FUNCTION public.hiring_formalization_context(w uuid,i uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE f hiring_formalizations;ok boolean;problem text;
BEGIN
 IF NOT hiring_formalization_access(w,i,'view') THEN RAISE EXCEPTION 'Solicitação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO f FROM hiring_formalizations WHERE request_id=i AND workspace_id=w;
 ok:=hiring_formalization_current(w,i);
 IF NOT ok THEN problem:='É necessária aprovação válida da revisão atual pelo gestor e CEO com acessos ativos.';
 ELSIF f.request_id IS NOT NULL AND f.status NOT IN('editing','invalid') AND NOT hiring_formalization_valid(i) THEN problem:='Documento, anexos, alçada, condições ou acesso alterados. Prepare nova revisão e obtenha novas decisões.';END IF;
 RETURN jsonb_build_object('contract_id',CASE WHEN work_record_access('techcontracts.contracts',f.contract_id,'view') THEN f.contract_id END,'draft_id',CASE WHEN user_has_permission(auth.uid(),w,'techcontracts.contract_drafts.view.workspace') THEN f.draft_id END,'cycle',coalesce(f.cycle,0),'status',CASE WHEN f.request_id IS NULL THEN 'none' WHEN problem IS NOT NULL THEN 'invalid' ELSE f.status END,'problem',problem,
 'can_prepare',ok AND hiring_formalization_access(w,i,'manage'),'can_submit',ok AND hiring_formalization_access(w,i,'manage') AND f.status IN('editing','invalid'),'can_legal',ok AND hiring_formalization_access(w,i,'approve') AND auth.uid()=f.legal_user AND f.status='legal','can_finance',ok AND hiring_formalization_access(w,i,'approve') AND auth.uid()=f.finance_user AND f.status='finance','can_link',ok AND hiring_formalization_access(w,i,'manage') AND f.status IN('accepted','sent'),'due_at',f.due_at,
 'legal_name',(SELECT full_name FROM profiles WHERE id=f.legal_user),'finance_name',(SELECT full_name FROM profiles WHERE id=f.finance_user),'signature_name',(SELECT full_name FROM profiles WHERE id=f.signature_user));
END $$;
-- Default ACL revocation for every new function, limited grants follow in 0377.
REVOKE ALL ON FUNCTION public.hiring_formalization_lock(uuid),public.hiring_formalization_ready_subject(uuid,uuid,text,text),public.hiring_formalization_current(uuid,uuid),public.hiring_formalization_subject(uuid,uuid,text,text),public.hiring_formalization_access(uuid,uuid,text),public.hiring_formalization_recipient(uuid),public.hiring_formalization_fingerprint(uuid),public.hiring_formalization_valid(uuid),public.hiring_formalization_invalidate(uuid),public.hiring_formalization_notify(uuid),public.hiring_formalization_prepare(uuid,uuid,integer),public.hiring_formalization_transition(uuid,uuid,integer,text,text),public.hiring_formalization_signature_gate(uuid,uuid,text),public.hiring_formalization_context(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,techerp_request_writer;
GRANT EXECUTE ON FUNCTION public.hiring_formalization_access(uuid,uuid,text),public.hiring_formalization_prepare(uuid,uuid,integer),public.hiring_formalization_transition(uuid,uuid,integer,text,text),public.hiring_formalization_signature_gate(uuid,uuid,text),public.hiring_formalization_context(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_formalization_signature_gate(uuid,uuid,text) TO service_role;
COMMIT;
