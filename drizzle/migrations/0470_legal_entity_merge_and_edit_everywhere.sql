-- 1. Include CNPJ in legal_entities reference list (already scoped to active workspace and authorized for sales/contracts/finance/people/projects).
CREATE OR REPLACE FUNCTION public.finance_reference_list(_resource text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c jsonb:=finance_access_context();w uuid:=(c->>'workspace')::uuid;out_rows jsonb;BEGIN
 IF w IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_object_keys(c->'keys')k WHERE k ~ '^(techfinance|techsales|techcontracts|techpeople|techprojects)\..*\.(view|create|update)\.(own|team|workspace)$') THEN RAISE EXCEPTION 'Referência indisponível.' USING ERRCODE='42501';END IF;
 IF _resource='bank_accounts' AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(c->'keys')k WHERE k ~ '^techfinance\.(payments|bank_accounts)\.(view|create)\.(own|team|workspace)$') THEN RAISE EXCEPTION 'Referência bancária indisponível.' USING ERRCODE='42501';END IF;
 IF _resource='categories' AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(c->'keys')k WHERE k ~ '^techfinance\.(entries|recurrences|categories|reports)\.(view|create|update)\.(own|team|workspace)$') THEN RAISE EXCEPTION 'Referência contábil indisponível.' USING ERRCODE='42501';END IF;
 CASE _resource
 WHEN 'categories' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'parent_id',parent_id,'legal_entity_id',legal_entity_id)),'[]') INTO out_rows FROM financial_categories WHERE workspace_id=w;
 WHEN 'bank_accounts' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'currency',currency,'active',active,'legal_entity_id',legal_entity_id)),'[]') INTO out_rows FROM financial_bank_accounts WHERE workspace_id=w AND active;
 WHEN 'legal_entities' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'cnpj',cnpj,'active',active,'is_default',is_default) ORDER BY is_default DESC, name),'[]') INTO out_rows FROM legal_entities WHERE workspace_id=w;
 WHEN 'legal_entity_groups' THEN SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'code',g.code,'name',g.name,'active',g.active,'is_system',g.is_system,'member_ids',(SELECT coalesce(jsonb_agg(m.legal_entity_id),'[]') FROM legal_entity_group_members m WHERE m.group_id=g.id AND m.workspace_id=w))),'[]') INTO out_rows FROM legal_entity_groups g WHERE g.workspace_id=w;
 ELSE RAISE EXCEPTION 'Referência inválida.' USING ERRCODE='22023';END CASE;
 RETURN out_rows;
END $function$;

-- 2. Return legal_entity_id and resolved legal_entity data in contract_draft_merge_source.
CREATE OR REPLACE FUNCTION public.contract_draft_merge_source(p_draft uuid, p_template uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 d public.contract_drafts;
 t public.contract_templates;
 r public.hiring_preparation_requests;
 v_entity_id uuid;
 v_entity jsonb;
 v_prop_le uuid;
 v_quote_id uuid;
 v_quote_le uuid;
BEGIN
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft;
 IF d.id IS NULL OR d.workspace_id IS DISTINCT FROM (work_access_context()->>'workspace')::uuid OR NOT contract_draft_is_approver(d.workspace_id,auth.uid()) OR is_read_only_view() THEN
  RAISE EXCEPTION 'Sem permissão para preparar o texto desta minuta.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO t FROM contract_templates WHERE id=p_template AND workspace_id=d.workspace_id AND coalesce(status,'active')<>'archived';
 IF t.id IS NULL THEN RAISE EXCEPTION 'Modelo indisponível neste workspace.' USING ERRCODE='42501'; END IF;
 SELECT q.* INTO r FROM hiring_formalizations f JOIN hiring_preparation_requests q ON q.id=f.request_id
  WHERE f.draft_id=d.id AND q.workspace_id=d.workspace_id LIMIT 1;

 -- Fallback chain: draft -> supplier request -> proposal -> quote -> workspace default.
 v_entity_id := coalesce(d.legal_entity_id, r.legal_entity_id);
 IF v_entity_id IS NULL AND d.proposal_id IS NOT NULL THEN
  SELECT p.legal_entity_id, p.quote_id INTO v_prop_le, v_quote_id
  FROM proposals p WHERE p.id=d.proposal_id AND p.workspace_id=d.workspace_id;
  v_entity_id := v_prop_le;
  IF v_entity_id IS NULL AND v_quote_id IS NOT NULL THEN
   SELECT q.legal_entity_id INTO v_quote_le
   FROM quotes q WHERE q.id=v_quote_id AND q.workspace_id=d.workspace_id;
   v_entity_id := v_quote_le;
  END IF;
 END IF;
 IF v_entity_id IS NULL THEN
  SELECT id INTO v_entity_id
  FROM legal_entities
  WHERE workspace_id=d.workspace_id AND active=true AND is_default=true
  LIMIT 1;
 END IF;
 IF v_entity_id IS NOT NULL THEN
  SELECT jsonb_build_object('id', id, 'name', name, 'cnpj', cnpj, 'address_json', address_json)
  INTO v_entity
  FROM legal_entities
  WHERE id=v_entity_id AND workspace_id=d.workspace_id AND active=true;
 END IF;

 RETURN jsonb_build_object(
  'workspace_id', d.workspace_id,
  'proposal_id', d.proposal_id,
  'deal_id', d.deal_id,
  'legal_entity_id', v_entity_id,
  'legal_entity', v_entity,
  'prepared_terms', d.prepared_terms,
  'template', jsonb_build_object('id',t.id,'body_html',t.body_html,'defaults',t.defaults,'service_type',t.service_type),
  'supplier', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('company_id',r.company_id,'contact_id',r.contact_id,'legal_entity_id',coalesce(d.legal_entity_id, r.legal_entity_id)) END
 );
END $function$;

-- 3. Allow legal approver to change legal_entity_id on editable contract_drafts with audit event.
CREATE OR REPLACE FUNCTION public.contract_draft_set_legal_entity(p_draft uuid, p_legal_entity uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 d public.contract_drafts;
 v_ws uuid;
 v_from_name text;
 v_to_name text;
BEGIN
 IF is_read_only_view() THEN
  RAISE EXCEPTION 'Sessão somente leitura.' USING ERRCODE='42501';
 END IF;
 v_ws := (work_access_context()->>'workspace')::uuid;
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft FOR UPDATE;
 IF d.id IS NULL OR d.workspace_id IS DISTINCT FROM v_ws OR NOT contract_draft_is_approver(d.workspace_id, auth.uid()) THEN
  RAISE EXCEPTION 'Sem permissão para alterar a empresa prestadora desta minuta.' USING ERRCODE='42501';
 END IF;
 IF d.status NOT IN ('pending_legal', 'changes_requested') THEN
  RAISE EXCEPTION 'A empresa prestadora só pode ser alterada enquanto a minuta estiver em revisão jurídica.' USING ERRCODE='22023';
 END IF;
 SELECT name INTO v_to_name
 FROM legal_entities
 WHERE id=p_legal_entity AND workspace_id=d.workspace_id AND active=true;
 IF v_to_name IS NULL THEN
  RAISE EXCEPTION 'Empresa prestadora inativa ou indisponível neste workspace.' USING ERRCODE='23514';
 END IF;
 IF d.legal_entity_id IS NOT DISTINCT FROM p_legal_entity THEN
  RETURN jsonb_build_object('id', d.id, 'revision', d.revision, 'legal_entity_id', d.legal_entity_id, 'changed', false);
 END IF;
 IF d.legal_entity_id IS NOT NULL THEN
  SELECT name INTO v_from_name FROM legal_entities WHERE id=d.legal_entity_id AND workspace_id=d.workspace_id;
 END IF;
 UPDATE contract_drafts
 SET legal_entity_id=p_legal_entity, revision=revision+1, updated_at=now()
 WHERE id=d.id;
 INSERT INTO contract_draft_events(workspace_id, draft_id, actor_id, kind, detail)
 VALUES(
  d.workspace_id,
  d.id,
  auth.uid(),
  'legal_entity_changed',
  jsonb_build_object(
   'from_id', d.legal_entity_id,
   'from_name', v_from_name,
   'to_id', p_legal_entity,
   'to_name', v_to_name,
   'revision', d.revision+1
  )
 );
 RETURN jsonb_build_object(
  'id', d.id,
  'revision', d.revision+1,
  'legal_entity_id', p_legal_entity,
  'from_name', v_from_name,
  'to_name', v_to_name,
  'changed', true
 );
END $function$;

REVOKE ALL ON FUNCTION public.contract_draft_set_legal_entity(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_set_legal_entity(uuid, uuid) TO authenticated;

-- 4. Allow authorized contract editor to change legal entity on editable contracts (draft/in_review/in_negotiation, unsigned, not locked by accepted draft).
CREATE OR REPLACE FUNCTION public.contract_set_legal_entity(p_contract uuid, p_legal_entity uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 c public.contracts;
 v_ws uuid;
 v_prev uuid;
 v_from_name text;
 v_to_name text;
BEGIN
 IF is_read_only_view() THEN
  RAISE EXCEPTION 'Sessão somente leitura.' USING ERRCODE='42501';
 END IF;
 PERFORM work_area_authorize('techcontracts.contracts', 'update', p_contract);
 v_ws := (work_access_context()->>'workspace')::uuid;
 SELECT * INTO c FROM contracts WHERE id=p_contract FOR UPDATE;
 IF c.id IS NULL OR c.workspace_id IS DISTINCT FROM v_ws THEN
  RAISE EXCEPTION 'Contrato indisponível neste workspace.' USING ERRCODE='42501';
 END IF;
 IF c.status::text NOT IN ('draft', 'in_review', 'in_negotiation') OR c.signed_at IS NOT NULL THEN
  RAISE EXCEPTION 'A empresa prestadora só pode ser alterada enquanto o contrato estiver em rascunho ou revisão. Após assinado, formalize por termo aditivo.' USING ERRCODE='23514';
 END IF;
 IF coalesce(c.metadata ? 'accepted_contract_draft', false) THEN
  RAISE EXCEPTION 'Condições aprovadas na minuta aceita são imutáveis. Formalize mudanças por termo aditivo.' USING ERRCODE='23514';
 END IF;
 SELECT name INTO v_to_name
 FROM legal_entities
 WHERE id=p_legal_entity AND workspace_id=c.workspace_id AND active=true;
 IF v_to_name IS NULL THEN
  RAISE EXCEPTION 'Empresa prestadora inativa ou indisponível neste workspace.' USING ERRCODE='23514';
 END IF;
 v_prev := coalesce(c.contracting_legal_entity_id, c.legal_entity_id);
 IF c.contracting_legal_entity_id IS NOT DISTINCT FROM p_legal_entity AND c.legal_entity_id IS NOT DISTINCT FROM p_legal_entity THEN
  RETURN jsonb_build_object('id', c.id, 'legal_entity_id', p_legal_entity, 'changed', false);
 END IF;
 IF v_prev IS NOT NULL THEN
  SELECT name INTO v_from_name FROM legal_entities WHERE id=v_prev AND workspace_id=c.workspace_id;
 END IF;
 UPDATE contracts
 SET contracting_legal_entity_id=p_legal_entity, legal_entity_id=p_legal_entity, updated_at=now()
 WHERE id=c.id;
 RETURN jsonb_build_object(
  'id', c.id,
  'legal_entity_id', p_legal_entity,
  'from_name', v_from_name,
  'to_name', v_to_name,
  'changed', true
 );
END $function$;

REVOKE ALL ON FUNCTION public.contract_set_legal_entity(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contract_set_legal_entity(uuid, uuid) TO authenticated;

-- 5. Audit contracting_legal_entity_id changes in contract_change_audit (independent of other field changes).
CREATE OR REPLACE FUNCTION public.contract_change_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 typ text;
 payload jsonb;
 related uuid;
 v_old_le uuid;
 v_new_le uuid;
 v_from_name text;
 v_to_name text;
BEGIN
 v_old_le := coalesce(OLD.contracting_legal_entity_id, OLD.legal_entity_id);
 v_new_le := coalesce(NEW.contracting_legal_entity_id, NEW.legal_entity_id);
 IF v_new_le IS DISTINCT FROM v_old_le THEN
  IF v_old_le IS NOT NULL THEN
   SELECT name INTO v_from_name FROM legal_entities WHERE id=v_old_le AND workspace_id=NEW.workspace_id;
  END IF;
  IF v_new_le IS NOT NULL THEN
   SELECT name INTO v_to_name FROM legal_entities WHERE id=v_new_le AND workspace_id=NEW.workspace_id;
  END IF;
  INSERT INTO contract_events(workspace_id, contract_id, actor_id, event_type, payload)
  VALUES(
   NEW.workspace_id,
   NEW.id,
   auth.uid(),
   'legal_entity_changed',
   jsonb_build_object('from_id', v_old_le, 'from_name', v_from_name, 'to_id', v_new_le, 'to_name', v_to_name)
  );
 END IF;

 IF NEW.parent_contract_id IS DISTINCT FROM OLD.parent_contract_id THEN typ:=CASE WHEN NEW.parent_contract_id IS NULL THEN 'parent_unlinked' ELSE 'parent_linked' END;payload:=jsonb_build_object('from',OLD.parent_contract_id,'to',NEW.parent_contract_id,'parent_contract_id',NEW.parent_contract_id,'previous_parent_contract_id',OLD.parent_contract_id,'child_contract_id',NEW.id,'child_title',NEW.title);related:=coalesce(NEW.parent_contract_id,OLD.parent_contract_id);
 ELSIF NEW.amendment_of_id IS DISTINCT FROM OLD.amendment_of_id THEN typ:=CASE WHEN NEW.amendment_of_id IS NULL THEN 'amendment_unlinked' ELSE 'amendment_linked' END;payload:=jsonb_build_object('from',OLD.amendment_of_id,'to',NEW.amendment_of_id,'amendment_of_id',NEW.amendment_of_id,'previous_parent_contract_id',OLD.amendment_of_id,'child_contract_id',NEW.id,'child_title',NEW.title);related:=coalesce(NEW.amendment_of_id,OLD.amendment_of_id);
 ELSIF NEW.document_kind IS DISTINCT FROM OLD.document_kind THEN typ:='document_kind_corrected';payload:=jsonb_build_object('from',OLD.document_kind,'to',NEW.document_kind,'title_before',OLD.title,'title_after',NEW.title);
 ELSIF NEW.role IS DISTINCT FROM OLD.role THEN typ:='role_recalculated';payload:=jsonb_build_object('from',OLD.role,'to',NEW.role,'title_before',OLD.title,'title_after',NEW.title);
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN typ:='status_changed';payload:=jsonb_build_object('from',OLD.status,'to',NEW.status);
 ELSE RETURN NEW;END IF;
 INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) VALUES(NEW.workspace_id,NEW.id,auth.uid(),typ,payload);
 IF related IS NOT NULL THEN INSERT INTO contract_events(workspace_id,contract_id,actor_id,event_type,payload) SELECT NEW.workspace_id,related,auth.uid(),typ,payload WHERE EXISTS(SELECT 1 FROM contracts WHERE id=related AND workspace_id=NEW.workspace_id);END IF;
 RETURN NEW;
END $function$;

-- 6. Propagate accepted draft legal_entity_id into newly created contracts in contract_accepted_draft_guard.
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
    (NEW.body_html,NEW.contracting_legal_entity_id,NEW.legal_entity_id,NEW.total_value,NEW.currency,NEW.payment_method,NEW.payment_terms,NEW.metadata->'accepted_contract_draft') IS DISTINCT FROM
    (OLD.body_html,OLD.contracting_legal_entity_id,OLD.legal_entity_id,OLD.total_value,OLD.currency,OLD.payment_method,OLD.payment_terms,OLD.metadata->'accepted_contract_draft') THEN
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
 IF d.legal_entity_id IS NOT NULL THEN
  NEW.contracting_legal_entity_id:=d.legal_entity_id;
  NEW.legal_entity_id:=d.legal_entity_id;
 END IF;
 NEW.number:=coalesce(nullif(d.prepared_terms->>'number',''),NEW.number);
 IF nullif(d.prepared_terms->>'starts_at','') IS NOT NULL THEN
  NEW.starts_at:=(d.prepared_terms->>'starts_at')::date;NEW.ends_at:=nullif(d.prepared_terms->>'ends_at','')::date;
 END IF;
 NEW.metadata:=coalesce(NEW.metadata,'{}')||jsonb_build_object('accepted_contract_draft',jsonb_build_object('id',d.id,'revision',d.revision,'client_decided_at',d.client_decided_at,'decided_at',d.decided_at,'prepared_terms',d.prepared_terms));
 RETURN NEW;
END $function$;

-- 7. Block changing legal_entity_id on already accepted quotes.
CREATE OR REPLACE FUNCTION public.sales_quote_process_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c jsonb:=sales_access_context();BEGIN
 IF auth.uid() IS NULL OR auth.role()='service_role' THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status::text<>'draft' OR NEW.accepted_at IS NOT NULL OR NEW.declined_at IS NOT NULL OR NEW.paid_at IS NOT NULL THEN RAISE EXCEPTION 'Crie a cotação como rascunho.' USING ERRCODE='42501';END IF;RETURN NEW;
 END IF;
 IF OLD.status::text='accepted' AND NEW.legal_entity_id IS DISTINCT FROM OLD.legal_entity_id THEN
  RAISE EXCEPTION 'Cotação aceita não pode ter a empresa prestadora alterada.' USING ERRCODE='23514';
 END IF;
 IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN RAISE EXCEPTION 'Pagamento exige confirmação do provedor.' USING ERRCODE='42501';END IF;
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status::text IN('published','sent') THEN
   IF NOT sales_context_access(c,OLD.workspace_id,'techsales.quote_send','manage',ARRAY[coalesce(OLD.assigned_to,OLD.owner_id)]) OR OLD.status::text IN('accepted','declined') OR (NEW.valid_until IS NOT NULL AND NEW.valid_until<(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date) THEN RAISE EXCEPTION 'Sem permissão ou cotação indisponível para envio.' USING ERRCODE='42501';END IF;
   IF NEW.status::text='sent' THEN NEW.sent_at:=clock_timestamp();END IF;
  ELSIF NEW.status::text IN('accepted','declined') OR OLD.status::text IN('accepted','declined') THEN
   IF NOT sales_record_context_access(c,'quotes',OLD.id,'approve') THEN RAISE EXCEPTION 'Decisão manual exige permissão de aprovação.' USING ERRCODE='42501';END IF;
   IF NEW.status::text='accepted' THEN NEW.accepted_at:=clock_timestamp();NEW.declined_at:=NULL;
   ELSIF NEW.status::text='declined' THEN NEW.declined_at:=clock_timestamp();NEW.accepted_at:=NULL;END IF;
  END IF;
 ELSIF (NEW.accepted_at,NEW.declined_at,NEW.signature_name) IS DISTINCT FROM (OLD.accepted_at,OLD.declined_at,OLD.signature_name) THEN
  RAISE EXCEPTION 'Resposta da cotação imutável sem decisão autorizada.' USING ERRCODE='42501';
 END IF;
 IF (NEW.payment_link_url,NEW.payment_session_id) IS DISTINCT FROM (OLD.payment_link_url,OLD.payment_session_id) AND NOT sales_context_access(c,OLD.workspace_id,'techsales.quote_send','manage',ARRAY[coalesce(OLD.assigned_to,OLD.owner_id)]) THEN RAISE EXCEPTION 'Link de pagamento não autorizado.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $function$;