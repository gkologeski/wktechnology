-- Jornada comercial: additive, no grants to roles and no rewrite of historical contracts.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
VALUES('techcontracts.contract_drafts.create.workspace','techcontracts','contract_drafts','create','workspace','Preparar minuta de proposta aceita','Abre uma minuta para revisão jurídica a partir de proposta aceita e visível; não aprova nem envia ao cliente.',true)
ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.deal_contract_draft_prepare(p_proposal uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;p public.proposals;
BEGIN
 IF auth.uid() IS NULL OR w IS NULL OR coalesce((c->>'read_only')::boolean,true)
 OR NOT is_workspace_member(w,auth.uid()) OR NOT user_has_permission(auth.uid(),w,'techcontracts.contract_drafts.create.workspace')
 OR NOT user_has_permission(auth.uid(),w,'techcontracts.contract_drafts.view.workspace')
 OR NOT sales_record_access('proposals',p_proposal,'view') THEN
  RAISE EXCEPTION 'Sem permissão para preparar a minuta.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO p FROM proposals WHERE id=p_proposal AND workspace_id=w FOR UPDATE;
 IF p.id IS NULL OR p.status::text<>'accepted' OR NOT p.locked OR p.decided_at IS NULL OR p.deal_id IS NULL
 OR NOT sales_record_access('deals',p.deal_id,'view') THEN
  RAISE EXCEPTION 'Selecione uma proposta aceita e um negócio visível neste workspace.' USING ERRCODE='42501';
 END IF;
 RETURN contract_draft_open(w,p.id,auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.deal_contract_draft_prepare(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.deal_contract_draft_prepare(uuid) TO authenticated;

ALTER TABLE public.contract_drafts ADD COLUMN prepared_terms jsonb NOT NULL DEFAULT '{}';

-- Preserve actual text revisions from this release onward, never reconstruct past versions.
CREATE TABLE public.contract_draft_versions(
 draft_id uuid NOT NULL REFERENCES public.contract_drafts(id) ON DELETE CASCADE,
 revision integer NOT NULL,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 body_html text NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(draft_id,revision)
);
ALTER TABLE public.contract_draft_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_draft_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.contract_draft_versions TO authenticated;
GRANT ALL ON public.contract_draft_versions TO service_role;
CREATE POLICY contract_draft_versions_read ON public.contract_draft_versions FOR SELECT TO authenticated
USING(workspace_id=(SELECT (public.work_access_context()->>'workspace')::uuid) AND EXISTS(SELECT 1 FROM public.contract_drafts d WHERE d.id=draft_id AND d.workspace_id=contract_draft_versions.workspace_id));
CREATE OR REPLACE FUNCTION public.capture_contract_draft_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO contract_draft_versions(draft_id,revision,workspace_id,body_html)
 VALUES(NEW.id,NEW.revision,NEW.workspace_id,NEW.body_html) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_contract_draft_version() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_contract_draft_version AFTER INSERT OR UPDATE ON public.contract_drafts
FOR EACH ROW EXECUTE FUNCTION public.capture_contract_draft_version();
INSERT INTO contract_draft_versions(draft_id,revision,workspace_id,body_html)
SELECT id,revision,workspace_id,body_html FROM public.contract_drafts ON CONFLICT DO NOTHING;

-- Only new commercial main contracts: old rows remain intact. The accepted text, not a
-- regenerated template, is the definitive body. Preserve its provenance in protected metadata.
CREATE OR REPLACE FUNCTION public.contract_accepted_draft_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE d public.contract_drafts;s jsonb;
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.contract_accepted_draft_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER contract_accepted_draft_guard BEFORE INSERT OR UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.contract_accepted_draft_guard();
CREATE UNIQUE INDEX contracts_journey_one_origin ON public.contracts(workspace_id,proposal_id)
WHERE document_kind='main' AND role='provider' AND metadata ? 'accepted_contract_draft';

-- Limited merge source for a listed legal approver; business records are still read via
-- the caller's RLS in the server. No arbitrary template/workspace expansion.
CREATE OR REPLACE FUNCTION public.contract_draft_merge_source(p_draft uuid,p_template uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.contract_drafts;t public.contract_templates;
BEGIN
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft;
 IF d.id IS NULL OR d.workspace_id IS DISTINCT FROM (work_access_context()->>'workspace')::uuid OR NOT contract_draft_is_approver(d.workspace_id,auth.uid()) OR is_read_only_view() THEN
  RAISE EXCEPTION 'Sem permissão para preparar o texto desta minuta.' USING ERRCODE='42501';END IF;
 SELECT * INTO t FROM contract_templates WHERE id=p_template AND workspace_id=d.workspace_id AND coalesce(status,'active')<>'archived';
 IF t.id IS NULL THEN RAISE EXCEPTION 'Modelo indisponível neste workspace.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('workspace_id',d.workspace_id,'proposal_id',d.proposal_id,'deal_id',d.deal_id,
  'prepared_terms',d.prepared_terms,'template',jsonb_build_object('id',t.id,'body_html',t.body_html,'defaults',t.defaults,'service_type',t.service_type));
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_merge_source(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_merge_source(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contract_draft_ready_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status IN('approved','sent','accepted') AND
 (NEW.body_html ~ '\{\{[^}]+\}\}' OR NEW.body_html ~ '\[\[[^]]+\]\]') THEN
  RAISE EXCEPTION 'Preencha as informações pendentes antes de aprovar ou enviar a minuta.' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_ready_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER contract_draft_ready_guard BEFORE INSERT OR UPDATE ON public.contract_drafts
FOR EACH ROW EXECUTE FUNCTION public.contract_draft_ready_guard();

CREATE OR REPLACE FUNCTION public.contract_draft_reopen(p_draft uuid,p_revision integer,p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.contract_drafts;
BEGIN
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft;
 IF d.id IS NULL OR d.workspace_id IS DISTINCT FROM (work_access_context()->>'workspace')::uuid OR is_read_only_view() OR NOT contract_draft_is_approver(d.workspace_id,auth.uid()) THEN
  RAISE EXCEPTION 'Sem permissão para revisar esta minuta.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(d.proposal_id::text,0));
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft FOR UPDATE;
 IF d.revision<>p_revision THEN RAISE EXCEPTION 'A minuta foi alterada. Recarregue a página.' USING ERRCODE='40001';END IF;
 IF length(btrim(coalesce(p_note,'')))<10 THEN RAISE EXCEPTION 'Informe o motivo da nova revisão.' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM public.contracts WHERE proposal_id=d.proposal_id AND workspace_id=d.workspace_id) THEN
  RAISE EXCEPTION 'Já existe contrato desta proposta. Formalize mudanças por aditivo.' USING ERRCODE='23514';END IF;
 UPDATE contract_drafts SET status='pending_legal',revision=revision+1,decided_at=NULL,decided_by=NULL,
 decision_note=NULL,client_decided_at=NULL,client_name=NULL,client_note=NULL,public_token=NULL,sent_at=NULL,sent_by=NULL,sent_to=NULL,updated_at=now() WHERE id=d.id;
 INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
 VALUES(d.workspace_id,d.id,auth.uid(),'reopened',jsonb_build_object('note',left(btrim(p_note),2000),'previous_revision',d.revision));
 RETURN jsonb_build_object('id',d.id,'revision',d.revision+1,'status','pending_legal');
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_reopen(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_reopen(uuid,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.contract_draft_review_prepared(p_draft uuid,p_revision integer,p_decision text,p_template uuid,p_body text,p_note text,p_terms jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;d public.contract_drafts;s date;e date;
BEGIN
 SELECT * INTO d FROM contract_drafts WHERE id=p_draft FOR UPDATE;
 IF d.id IS NULL OR d.workspace_id IS DISTINCT FROM (work_access_context()->>'workspace')::uuid OR is_read_only_view() OR NOT contract_draft_is_approver(d.workspace_id,auth.uid()) THEN
  RAISE EXCEPTION 'Sem permissão para revisar esta minuta.' USING ERRCODE='42501';END IF;
 IF p_terms IS NOT NULL THEN
  IF jsonb_typeof(p_terms)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_terms)k WHERE k NOT IN('starts_at','ends_at','number')) THEN RAISE EXCEPTION 'Dados de vigência inválidos.' USING ERRCODE='22023';END IF;
  IF length(coalesce(p_terms->>'number',''))>100 THEN RAISE EXCEPTION 'Número do documento inválido.' USING ERRCODE='22023';END IF;
  s:=nullif(p_terms->>'starts_at','')::date;e:=nullif(p_terms->>'ends_at','')::date;
  IF s IS NULL OR (e IS NOT NULL AND e<s) THEN RAISE EXCEPTION 'Confira o início e término da vigência.' USING ERRCODE='22023';END IF;
 END IF;
 result:=contract_draft_review(p_draft,p_revision,p_decision,p_template,p_body,p_note);
 IF p_terms IS NOT NULL THEN
  UPDATE contract_drafts SET prepared_terms=jsonb_build_object('starts_at',s,'ends_at',e,'number',nullif(p_terms->>'number','')) WHERE id=p_draft;
  IF d.prepared_terms IS DISTINCT FROM p_terms THEN
   INSERT INTO contract_draft_events(workspace_id,draft_id,actor_id,kind,detail)
   VALUES(d.workspace_id,d.id,auth.uid(),'terms_updated',jsonb_build_object('previous',d.prepared_terms,'current',p_terms,'revision',p_revision+1));
  END IF;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.contract_draft_review_prepared(uuid,integer,text,uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contract_draft_review_prepared(uuid,integer,text,uuid,text,text,jsonb) TO authenticated;

-- Worker already reads this immutable snapshot under actor-scoped delegated creation.
GRANT EXECUTE ON FUNCTION public.proposal_contract_source(uuid) TO service_role;
