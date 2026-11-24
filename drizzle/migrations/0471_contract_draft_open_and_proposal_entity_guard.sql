-- 1. Copy proposal (or fallback quote) legal_entity_id when opening a new contract draft.
CREATE OR REPLACE FUNCTION public.contract_draft_open(p_ws uuid, p_proposal uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE p record;d uuid;t record;existing uuid;n integer:=0;ap record;v_le uuid;BEGIN
 SELECT id,workspace_id,deal_id,title,status,legal_entity_id,quote_id INTO p FROM proposals WHERE id=p_proposal;
 IF p.id IS NULL OR p.workspace_id<>p_ws THEN RAISE EXCEPTION 'Proposta fora do workspace.' USING ERRCODE='42501';END IF;
 IF p.status<>'accepted' THEN RAISE EXCEPTION 'A minuta só é aberta para proposta aceita.' USING ERRCODE='22023';END IF;
 SELECT id INTO existing FROM contract_drafts WHERE proposal_id=p.id AND status NOT IN('rejected','canceled');
 IF existing IS NOT NULL THEN RETURN jsonb_build_object('draft_id',existing,'created',false);END IF;
 v_le := p.legal_entity_id;
 IF v_le IS NULL AND p.quote_id IS NOT NULL THEN
  SELECT q.legal_entity_id INTO v_le FROM quotes q WHERE q.id=p.quote_id AND q.workspace_id=p_ws;
 END IF;
 -- Modelo padrão do serviço: primeiro serviço do negócio com modelo vinculado ativo.
 SELECT ct.id,ct.name,ct.body_html INTO t
  FROM deal_line_items li
  JOIN contract_template_services s ON s.service_catalog_id=li.service_catalog_id AND s.workspace_id=p_ws
  JOIN contract_templates ct ON ct.id=s.template_id AND ct.workspace_id=p_ws AND coalesce(ct.status,'active')<>'archived'
  WHERE li.deal_id=p.deal_id
  ORDER BY ct.is_default DESC, li.created_at, ct.name LIMIT 1;
 INSERT INTO contract_drafts(workspace_id,deal_id,proposal_id,template_id,legal_entity_id,title,body_html,missing_template,created_by)
  VALUES(p_ws,p.deal_id,p.id,t.id,v_le,'Minuta — '||coalesce(p.title,'Proposta'),coalesce(t.body_html,''),t.id IS NULL,p_actor)
  RETURNING id INTO d;
 INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
  VALUES(p_ws,d,p_actor,'opened',jsonb_build_object('template_id',t.id,'missing_template',t.id IS NULL,'legal_entity_id',v_le));
 FOR ap IN SELECT a.user_id FROM contract_draft_approvers a WHERE a.workspace_id=p_ws LOOP
  IF contract_draft_is_approver(p_ws,ap.user_id) THEN
   INSERT INTO notifications(owner_id,user_id,workspace_id,type,title,body,link,entity,entity_id,dedupe_key)
   VALUES(ap.user_id,ap.user_id,p_ws,'approval','Revisar minuta de contrato',
    CASE WHEN t.id IS NULL THEN 'Proposta aceita sem modelo padrão vinculado ao serviço: escolha o modelo e aprove o envio.'
         ELSE 'Proposta aceita: confira o modelo "'||t.name||'" e aprove o envio ao cliente.' END,
    '/contracts/drafts/'||d,'contract_drafts',d,'contract_draft:'||d||':'||ap.user_id);
   n:=n+1;
  END IF;
 END LOOP;
 IF n=0 THEN
  INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
   VALUES(p_ws,d,p_actor,'no_approvers','{}'::jsonb);
  INSERT INTO notifications(owner_id,user_id,workspace_id,type,title,body,link,entity,entity_id,dedupe_key)
   VALUES(p_actor,p_actor,p_ws,'approval','Minuta sem aprovador jurídico',
    'Configure os aprovadores em Configurações → Fluxos de aprovação → Minuta de contrato.',
    '/contracts/drafts/'||d,'contract_drafts',d,'contract_draft:'||d||':noapprover');
 END IF;
 RETURN jsonb_build_object('draft_id',d,'created',true,'notified',n,'template_id',t.id);
END $function$;

-- 2. Treat legal_entity_id changes on unlocked proposals as commercial edits (bumps version and resets approval to draft).
CREATE OR REPLACE FUNCTION public.sales_proposal_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c jsonb:=sales_access_context();changed boolean;can_edit boolean;BEGIN
 IF auth.uid() IS NULL OR auth.role()='service_role' THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status::text<>'draft' OR NEW.locked OR NEW.sent_at IS NOT NULL OR NEW.decided_at IS NOT NULL THEN RAISE EXCEPTION 'Crie a proposta em rascunho.' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 can_edit:=sales_record_context_access(c,'proposals',OLD.id,'update');
 -- Approval/sending authority cannot edit commercial fields or the source links.
 IF NOT can_edit AND (to_jsonb(NEW)-ARRAY['status','locked','sent_at','decided_at','updated_at','variables','public_token']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','locked','sent_at','decided_at','updated_at','variables','public_token']) THEN RAISE EXCEPTION 'Sem permissão de edição.' USING ERRCODE='42501';END IF;
 changed:=(NEW.title,NEW.body,NEW.total_amount,NEW.currency,NEW.expires_at,NEW.deal_id,NEW.contact_id,NEW.company_id,NEW.legal_entity_id,(NEW.variables-'document_hash'-'content_hash')) IS DISTINCT FROM (OLD.title,OLD.body,OLD.total_amount,OLD.currency,OLD.expires_at,OLD.deal_id,OLD.contact_id,OLD.company_id,OLD.legal_entity_id,(OLD.variables-'document_hash'-'content_hash'));
 IF NOT can_edit AND (NEW.variables-'document_hash'-'content_hash') IS DISTINCT FROM (OLD.variables-'document_hash'-'content_hash') THEN RAISE EXCEPTION 'Sem permissão de edição.' USING ERRCODE='42501';END IF;
 IF NEW.decided_at IS DISTINCT FROM OLD.decided_at THEN RAISE EXCEPTION 'Resposta do cliente imutável.' USING ERRCODE='42501';END IF;
 IF NEW.sent_at IS DISTINCT FROM OLD.sent_at AND NOT(NEW.status::text='sent' AND OLD.status::text IN('draft','approved')) THEN RAISE EXCEPTION 'Data de envio imutável.' USING ERRCODE='42501';END IF;
 IF NEW.version IS DISTINCT FROM OLD.version THEN RAISE EXCEPTION 'Versão calculada pelo servidor.' USING ERRCODE='42501';END IF;
 IF OLD.locked AND (to_jsonb(NEW)-ARRAY['status','decided_at','updated_at','public_token']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','decided_at','updated_at','public_token']) THEN RAISE EXCEPTION 'Proposta publicada está selada.' USING ERRCODE='42501';END IF;
 IF changed THEN
  IF NOT sales_record_context_access(c,'proposals',OLD.id,'update') THEN RAISE EXCEPTION 'Sem permissão de edição.' USING ERRCODE='42501';END IF;
  NEW.version:=OLD.version+1;NEW.status:='draft';
 END IF;
 IF NEW.status::text IS DISTINCT FROM OLD.status::text THEN
  IF NEW.status::text='approved' THEN
   IF OLD.status::text<>'in_review' OR NOT sales_record_context_access(c,'proposals',OLD.id,'approve') OR NOT EXISTS(SELECT 1 FROM proposal_approvals a WHERE a.proposal_id=OLD.id AND a.status::text='approved' AND a.reviewer_id=auth.uid() AND a.requested_by<>auth.uid() AND a.review_version=OLD.version) THEN RAISE EXCEPTION 'Aprovação interna obrigatória.' USING ERRCODE='42501';END IF;
  ELSIF NEW.status::text='sent' THEN
   IF NOT sales_context_access(c,OLD.workspace_id,'techsales.proposal_send','manage',ARRAY[coalesce(OLD.assigned_to,OLD.owner_id)]) OR NOT NEW.locked OR NEW.sent_at IS NULL THEN RAISE EXCEPTION 'Envio não autorizado.' USING ERRCODE='42501';END IF;
   IF EXISTS(SELECT 1 FROM proposal_approvals WHERE proposal_id=OLD.id AND status::text='pending') OR (EXISTS(SELECT 1 FROM proposal_approvals WHERE proposal_id=OLD.id) AND NOT EXISTS(SELECT 1 FROM proposal_approvals WHERE proposal_id=OLD.id AND status::text='approved' AND review_version=NEW.version)) THEN RAISE EXCEPTION 'Aprovação vigente obrigatória.' USING ERRCODE='42501';END IF;
   IF OLD.status::text NOT IN('draft','approved') OR (NEW.expires_at IS NOT NULL AND NEW.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'Proposta indisponível para envio.' USING ERRCODE='42501';END IF;
   NEW.sent_at:=clock_timestamp();
   NEW.variables:=coalesce(NEW.variables,'{}')||jsonb_build_object('document_hash',encode(extensions.digest(jsonb_build_object('id',NEW.id,'title',NEW.title,'body',NEW.body,'total',NEW.total_amount,'currency',NEW.currency,'legal_entity_id',NEW.legal_entity_id,'version',NEW.version,'sent_at',NEW.sent_at)::text,'sha256'),'hex'));
  ELSIF NEW.status::text='in_review' THEN
   IF NOT can_edit OR OLD.status::text<>'draft' OR OLD.locked THEN RAISE EXCEPTION 'Revisão não autorizada.' USING ERRCODE='42501';END IF;
  ELSIF NEW.status::text='draft' THEN
   IF OLD.locked OR (NOT can_edit AND NOT EXISTS(SELECT 1 FROM proposal_approvals WHERE proposal_id=OLD.id AND reviewer_id=auth.uid() AND status::text='rejected' AND review_version=OLD.version)) THEN RAISE EXCEPTION 'Retorno a rascunho não autorizado.' USING ERRCODE='42501';END IF;
   -- A canceled review always becomes stale, even if only the status changed.
   IF OLD.status::text='in_review' AND NOT changed THEN NEW.version:=OLD.version+1;END IF;
  ELSIF NEW.status::text IN('accepted','rejected') THEN RAISE EXCEPTION 'A resposta do cliente exige o link público válido.' USING ERRCODE='42501';
  END IF;
 END IF;
 IF NEW.locked IS DISTINCT FROM OLD.locked AND NOT(NEW.locked AND NEW.status::text='sent') THEN RAISE EXCEPTION 'Selo imutável.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $function$;