-- NOTIFICA-CENTRAL P8. Named occurrences use the existing Workflow event/run
-- engine and delivery ledger. No rule, grant, channel or historical event is enabled.
ALTER TABLE public.workflow_events ADD COLUMN notification_event_key text,
 ADD COLUMN notification_parent_event_id uuid;
ALTER TABLE public.notification_workspace_context ADD COLUMN event_key text;

CREATE FUNCTION techerp_api.notification_business_category(p_key text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT CASE
 WHEN p_key IN('crm.deal.won','crm.deal.lost','crm.deal.stage_changed') THEN 'deal_stage'
 WHEN p_key IN('crm.proposal.accepted','contracts.signature.completed') THEN 'workflow'
 WHEN p_key='contracts.draft.accepted' THEN 'approval'
 WHEN p_key IN('contracts.contract.expiring','contracts.contract.renewal_due') THEN 'task' END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_category(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.notification_business_event_proofs(
 event_id uuid PRIMARY KEY REFERENCES public.workflow_events(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 root_event_id uuid NOT NULL REFERENCES public.workflow_events(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 workspace_id uuid NOT NULL,event_key text NOT NULL CHECK(techerp_api.notification_business_category(event_key) IS NOT NULL),
 source_table text NOT NULL CHECK(source_table IN('deals','proposals','contracts')),source_id uuid NOT NULL,
 producer_table text NOT NULL,producer_id uuid NOT NULL,reference_id uuid,source_revision text,
 occurrence_key text NOT NULL,payload_hash text NOT NULL,
 workflow_id uuid,workflow_version integer,due_date date,days_before integer,
 parent_event_id uuid,resume_cursor integer,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(workspace_id,event_key,occurrence_key)
);
CREATE UNIQUE INDEX notification_business_resume_proof ON public.notification_business_event_proofs(parent_event_id,workflow_id,workflow_version,resume_cursor)
 WHERE parent_event_id IS NOT NULL;
CREATE INDEX notification_business_root_proof ON public.notification_business_event_proofs(root_event_id);
ALTER TABLE public.notification_business_event_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_business_event_proofs FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.notification_business_due_cursors(
 workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,contract_id uuid NOT NULL,
 event_key text NOT NULL,due_date date NOT NULL,days_before integer NOT NULL,
 event_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workflow_id,contract_id,event_key,due_date,days_before)
);
ALTER TABLE public.notification_business_due_cursors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_business_due_cursors FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX notification_contract_due_window ON public.contracts(workspace_id,ends_at,id)
 WHERE ends_at IS NOT NULL;
CREATE INDEX notification_contract_renewal_window ON public.contracts(workspace_id,(ends_at-notice_days),id)
 WHERE ends_at IS NOT NULL AND auto_renew AND notice_days BETWEEN 0 AND 3650;

CREATE FUNCTION techerp_api.notification_business_event_hash(p_event public.workflow_events) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('workspace',p_event.workspace_id,'owner',p_event.owner_id,
 'entity',p_event.entity,'record',p_event.entity_id,'type',p_event.event_type,'before',p_event.before,'after',p_event.after,
 'key',p_event.notification_event_key,'parent',p_event.notification_parent_event_id,
 'workflow',p_event.resume_workflow_id,'version',p_event.workflow_version,'cursor',p_event.resume_cursor)::text,'UTF8')),'hex')
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_event_hash(public.workflow_events) FROM PUBLIC,anon,authenticated,service_role;

-- Only literal database producers call this private emitter. The source tenant
-- and owner are read from the actual record, never accepted from an event payload.
CREATE FUNCTION techerp_api.notification_business_emit(p_workspace uuid,p_key text,p_entity text,p_source uuid,
 p_producer_table text,p_producer uuid,p_occurrence text,p_before jsonb DEFAULT NULL,
 p_reference uuid DEFAULT NULL,p_revision text DEFAULT NULL,p_workflow uuid DEFAULT NULL,p_version integer DEFAULT NULL,
 p_due date DEFAULT NULL,p_days integer DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE source jsonb;event public.workflow_events;existing uuid;owner uuid;BEGIN
 IF techerp_api.notification_business_category(p_key) IS NULL OR p_entity NOT IN('deals','proposals','contracts')
 OR p_workspace IS NULL OR p_source IS NULL OR p_producer IS NULL OR p_occurrence IS NULL
 OR public.is_read_only_view() OR public.is_test_record(p_source) THEN RETURN NULL;END IF;
 EXECUTE format('SELECT to_jsonb(s) FROM public.%I s WHERE id=$1 AND workspace_id=$2',p_entity) INTO source USING p_source,p_workspace;
 IF source IS NULL OR nullif(source->>'deleted_at','') IS NOT NULL THEN RETURN NULL;END IF;
 owner:=coalesce(nullif(source->>'owner_id','')::uuid,(SELECT created_by FROM public.workspaces WHERE id=p_workspace));
 IF owner IS NULL THEN RETURN NULL;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-business:'||p_workspace||':'||p_key||':'||p_occurrence,0));
 SELECT event_id INTO existing FROM public.notification_business_event_proofs WHERE workspace_id=p_workspace AND event_key=p_key AND occurrence_key=p_occurrence;
 IF existing IS NOT NULL THEN RETURN CASE WHEN p_due IS NULL THEN existing END;END IF;
 IF p_due IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM public.notification_business_due_cursors WHERE workflow_id=p_workflow AND contract_id=p_source
   AND event_key=p_key AND due_date=p_due AND days_before=p_days) THEN RETURN NULL;END IF;
 END IF;
 event.id:=gen_random_uuid();event.workspace_id:=p_workspace;event.owner_id:=owner;event.entity:=p_entity;event.entity_id:=p_source;
 event.event_type:='updated';event.before:=p_before;event.after:=source;event.notification_event_key:=p_key;
 INSERT INTO public.notification_business_event_proofs(event_id,root_event_id,workspace_id,event_key,source_table,source_id,producer_table,producer_id,
 reference_id,source_revision,occurrence_key,payload_hash,workflow_id,workflow_version,due_date,days_before)
 VALUES(event.id,event.id,p_workspace,p_key,p_entity,p_source,p_producer_table,p_producer,p_reference,p_revision,p_occurrence,
 techerp_api.notification_business_event_hash(event),p_workflow,p_version,p_due,p_days);
 INSERT INTO public.workflow_events(id,workspace_id,owner_id,entity,entity_id,event_type,before,after,notification_event_key)
 VALUES(event.id,p_workspace,owner,p_entity,p_source,'updated',p_before,source,p_key) RETURNING * INTO event;
 IF event.id IS NULL THEN DELETE FROM public.notification_business_event_proofs WHERE workspace_id=p_workspace AND event_key=p_key AND occurrence_key=p_occurrence;RETURN NULL;END IF;
 IF p_due IS NOT NULL THEN INSERT INTO public.notification_business_due_cursors(workflow_id,contract_id,event_key,due_date,days_before,event_id)
  VALUES(p_workflow,p_source,p_key,p_due,p_days,event.id) ON CONFLICT DO NOTHING;END IF;
 RETURN event.id;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_emit(uuid,text,text,uuid,text,uuid,text,jsonb,uuid,text,uuid,integer,date,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_business_deal_outcome(p_workspace uuid,p_pipeline uuid,p_stage_id text,p_stage text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_pipeline IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.pipelines WHERE id=p_pipeline AND workspace_id=p_workspace) THEN RETURN 'open';END IF;
 RETURN public.deal_stage_type(p_pipeline,p_stage_id,p_stage);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_deal_outcome(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_business_sales_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE key text;before_kind text;after_kind text;occurrence text;BEGIN
 IF public.is_read_only_view() OR public.is_test_record(NEW.id) OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='deals' THEN
  IF NEW.deleted_at IS NOT NULL OR ROW(NEW.stage,NEW.stage_id,NEW.pipeline_id) IS NOT DISTINCT FROM ROW(OLD.stage,OLD.stage_id,OLD.pipeline_id) THEN RETURN NEW;END IF;
  before_kind:=techerp_api.notification_business_deal_outcome(OLD.workspace_id,OLD.pipeline_id,OLD.stage_id,OLD.stage::text);
  after_kind:=techerp_api.notification_business_deal_outcome(NEW.workspace_id,NEW.pipeline_id,NEW.stage_id,NEW.stage::text);
  -- One business classification per transition: new outcomes take precedence
  -- over the ordinary stage event; reopening remains a stage change.
  key:=CASE WHEN after_kind='won' AND before_kind<>'won' THEN 'crm.deal.won'
   WHEN after_kind='lost' AND before_kind<>'lost' THEN 'crm.deal.lost' ELSE 'crm.deal.stage_changed' END;
  occurrence:=NEW.id||':'||txid_current()||':'||encode(sha256(convert_to(jsonb_build_array(OLD.stage,OLD.stage_id,OLD.pipeline_id,NEW.stage,NEW.stage_id,NEW.pipeline_id)::text,'UTF8')),'hex');
  PERFORM techerp_api.notification_business_emit(NEW.workspace_id,key,'deals',NEW.id,'deals',NEW.id,occurrence,to_jsonb(OLD));
 ELSE
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status::text IS DISTINCT FROM 'accepted' OR NEW.locked IS DISTINCT FROM true OR NEW.decided_at IS NULL THEN RETURN NEW;END IF;
  IF NEW.deal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.deals WHERE id=NEW.deal_id AND workspace_id=NEW.workspace_id AND deleted_at IS NULL) THEN RETURN NEW;END IF;
  occurrence:=NEW.id||':'||NEW.version||':'||NEW.decided_at;
  PERFORM techerp_api.notification_business_emit(NEW.workspace_id,'crm.proposal.accepted','proposals',NEW.id,'proposals',NEW.id,
   occurrence,to_jsonb(OLD),NEW.deal_id,NEW.version::text);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_sales_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_business_deal AFTER UPDATE OF stage,stage_id,pipeline_id ON public.deals FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_business_sales_capture();
CREATE TRIGGER notification_business_proposal AFTER UPDATE OF status ON public.proposals FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_business_sales_capture();

-- A material change to the signed snapshot or a revoked/replaced envelope
-- invalidates pending named notifications, including native ordinary contracts.
CREATE FUNCTION techerp_api.notification_business_signature_valid(p_workspace uuid,p_contract uuid,p_evidence uuid,p_document uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.hiring_contract_evidence;d public.esign_documents;BEGIN
 SELECT * INTO e FROM public.hiring_contract_evidence WHERE id=p_evidence AND workspace_id=p_workspace AND contract_id=p_contract AND revoked_at IS NULL;
 IF e.id IS NULL OR e.contract_hash IS DISTINCT FROM public.hiring_contract_fingerprint(p_contract)
 OR NOT EXISTS(SELECT 1 FROM public.contracts WHERE id=p_contract AND workspace_id=p_workspace) THEN RETURN false;END IF;
 IF e.kind='native' THEN
  SELECT * INTO d FROM public.esign_documents WHERE id=e.document_id AND workspace_id=p_workspace;
  RETURN coalesce((p_document IS NULL OR p_document=d.id) AND d.status::text='completed' AND d.completed_at IS NOT NULL AND d.sealed_at IS NOT NULL
   AND d.content_hash=e.document_hash AND encode(extensions.digest(convert_to(d.body,'UTF8'),'sha256'),'hex')=e.document_hash
   AND(d.expires_at IS NULL OR d.completed_at<=d.expires_at)
   AND NOT EXISTS(SELECT 1 FROM public.ats_offers WHERE esign_document_id=d.id)
   AND EXISTS(SELECT 1 FROM public.esign_signers WHERE document_id=d.id AND workspace_id=p_workspace)
   AND EXISTS(SELECT 1 FROM public.esign_signers WHERE id=e.customer_signer_id AND document_id=d.id AND workspace_id=p_workspace AND status::text='signed' AND signed_at IS NOT NULL)
   AND EXISTS(SELECT 1 FROM public.esign_signers WHERE id=e.issuer_signer_id AND document_id=d.id AND workspace_id=p_workspace AND status::text='signed' AND signed_at IS NOT NULL)
   AND NOT EXISTS(SELECT 1 FROM public.esign_signers WHERE document_id=d.id AND(workspace_id IS DISTINCT FROM p_workspace OR status::text<>'signed' OR signed_at IS NULL)),false);
 END IF;
 RETURN e.kind='external' AND EXISTS(SELECT 1 FROM public.contract_forsign_operations o
  WHERE o.workspace_id=p_workspace AND o.contract_id=p_contract AND o.evidence_id=e.id AND o.status='evidence_recorded'
   AND o.operation_id IS NOT NULL AND o.contract_hash=e.contract_hash)
 AND EXISTS(SELECT 1 FROM storage.objects s WHERE s.bucket_id='contract-signature-evidence' AND s.name=e.file_path
  AND s.user_metadata->>'sha256'=e.file_hash AND s.user_metadata->>'contract_hash'=e.contract_hash);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_signature_valid(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_business_contract_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE source public.deals;proposal public.proposals;e record;occurrence text;BEGIN
 IF public.is_read_only_view() THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='contract_drafts' THEN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR OLD.status IS DISTINCT FROM 'sent' OR NEW.status IS DISTINCT FROM 'accepted'
   OR NEW.client_decided_at IS NULL OR NEW.decided_at IS NULL OR OLD.public_token IS NULL
   OR NEW.public_token IS DISTINCT FROM OLD.public_token OR NEW.client_acceptance_bypassed_at IS NOT NULL THEN RETURN NEW;END IF;
  SELECT * INTO proposal FROM public.proposals WHERE id=NEW.proposal_id AND workspace_id=NEW.workspace_id AND deal_id=NEW.deal_id AND status::text='accepted' AND locked AND decided_at IS NOT NULL;
  SELECT * INTO source FROM public.deals WHERE id=NEW.deal_id AND workspace_id=NEW.workspace_id AND deleted_at IS NULL;
  IF proposal.id IS NULL OR source.id IS NULL THEN RETURN NEW;END IF;
  PERFORM techerp_api.notification_business_emit(NEW.workspace_id,'contracts.draft.accepted','deals',source.id,'contract_drafts',NEW.id,
   NEW.id||':'||NEW.revision,NULL,NEW.proposal_id,NEW.revision::text);
 ELSIF TG_TABLE_NAME='esign_documents' THEN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status::text<>'completed' THEN RETURN NEW;END IF;
  FOR e IN SELECT id,contract_id,recorded_by FROM public.hiring_contract_evidence WHERE document_id=NEW.id AND workspace_id=NEW.workspace_id AND kind='native' AND revoked_at IS NULL LOOP
   IF techerp_api.notification_business_signature_valid(NEW.workspace_id,e.contract_id,e.id,NEW.id) THEN
    PERFORM techerp_api.notification_business_emit(NEW.workspace_id,'contracts.signature.completed','contracts',e.contract_id,'esign_documents',NEW.id,e.id::text,NULL,e.id);
   END IF;
  END LOOP;
 ELSE
  IF NEW.status<>'evidence_recorded' OR NEW.evidence_id IS NULL OR OLD.evidence_id IS NOT DISTINCT FROM NEW.evidence_id THEN RETURN NEW;END IF;
  IF techerp_api.notification_business_signature_valid(NEW.workspace_id,NEW.contract_id,NEW.evidence_id) THEN
   PERFORM techerp_api.notification_business_emit(NEW.workspace_id,'contracts.signature.completed','contracts',NEW.contract_id,
    'contract_forsign_operations',NEW.id,NEW.evidence_id::text,NULL,NEW.evidence_id);
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_contract_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_business_draft AFTER UPDATE OF status ON public.contract_drafts FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_business_contract_capture();
CREATE TRIGGER notification_business_native_signature AFTER UPDATE OF status ON public.esign_documents FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_business_contract_capture();
CREATE TRIGGER notification_business_forsign_signature AFTER UPDATE OF evidence_id,status ON public.contract_forsign_operations FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_business_contract_capture();

CREATE FUNCTION techerp_api.notification_business_proof_current(p public.notification_business_event_proofs)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE draft public.contract_drafts;contract public.contracts;deadline date;BEGIN
 IF p.event_id IS NULL OR public.is_test_record(p.source_id) THEN RETURN false;END IF;
 IF p.event_key='contracts.draft.accepted' THEN
  SELECT * INTO draft FROM public.contract_drafts WHERE id=p.producer_id AND workspace_id=p.workspace_id AND deal_id=p.source_id;
  RETURN coalesce(draft.status='accepted' AND draft.client_decided_at IS NOT NULL AND draft.decided_at IS NOT NULL
   AND draft.client_acceptance_bypassed_at IS NULL AND draft.revision::text=p.source_revision
   AND EXISTS(SELECT 1 FROM public.proposals WHERE id=draft.proposal_id AND workspace_id=p.workspace_id AND deal_id=p.source_id
    AND status::text='accepted' AND locked AND decided_at IS NOT NULL),false);
 ELSIF p.event_key='contracts.signature.completed' THEN
  RETURN techerp_api.notification_business_signature_valid(p.workspace_id,p.source_id,p.reference_id,
   CASE WHEN p.producer_table='esign_documents' THEN p.producer_id END);
 ELSIF p.event_key IN('contracts.contract.expiring','contracts.contract.renewal_due') THEN
  SELECT * INTO contract FROM public.contracts WHERE id=p.source_id AND workspace_id=p.workspace_id AND status::text IN('active','renewing');
  IF contract.id IS NULL OR contract.ends_at IS NULL OR p.days_before NOT BETWEEN 1 AND 365 THEN RETURN false;END IF;
  deadline:=contract.ends_at;
  IF p.event_key='contracts.contract.renewal_due' THEN
   IF NOT coalesce(contract.auto_renew,false) OR contract.notice_days IS NULL OR contract.notice_days NOT BETWEEN 0 AND 3650 THEN RETURN false;END IF;
   deadline:=deadline-contract.notice_days;
  END IF;
  RETURN deadline=p.due_date AND (now() AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN deadline-p.days_before AND deadline;
 END IF;
 RETURN p.event_key IN('crm.deal.won','crm.deal.lost','crm.deal.stage_changed','crm.proposal.accepted');
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_proof_current(public.notification_business_event_proofs) FROM PUBLIC,anon,authenticated,service_role;

-- Delay and approval resumptions retain the original business occurrence. Merely
-- copying a public key/parent column cannot produce this private proof.
CREATE FUNCTION techerp_api.notification_business_resume_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE parent public.workflow_events;proof public.notification_business_event_proofs;root_event public.workflow_events;
 root_proof public.notification_business_event_proofs;wf public.workflows;run public.workflow_runs;BEGIN
 IF NEW.notification_parent_event_id IS NULL THEN RETURN NEW;END IF;
 IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL OR public.is_read_only_view()
 OR NEW.notification_event_key IS NULL OR NEW.resume_workflow_id IS NULL OR NEW.workflow_version IS NULL OR NEW.resume_cursor IS NULL OR NEW.resume_cursor<0 THEN
  RAISE EXCEPTION 'Retomada sem prova de origem.' USING ERRCODE='42501';END IF;
 SELECT * INTO parent FROM public.workflow_events WHERE id=NEW.notification_parent_event_id;
 SELECT * INTO proof FROM public.notification_business_event_proofs WHERE event_id=parent.id;
 SELECT * INTO root_proof FROM public.notification_business_event_proofs WHERE event_id=proof.root_event_id;
 SELECT * INTO root_event FROM public.workflow_events WHERE id=root_proof.event_id;
 SELECT * INTO wf FROM public.workflows WHERE id=NEW.resume_workflow_id AND workspace_id=NEW.workspace_id AND entity=NEW.entity
  AND enabled AND status='published' AND published_version=NEW.workflow_version;
 SELECT * INTO run FROM public.workflow_runs WHERE event_id=parent.id AND workflow_id=NEW.resume_workflow_id AND workspace_id=NEW.workspace_id
  AND entity=NEW.entity AND entity_id=NEW.entity_id AND NOT is_test AND owner_id=wf.owner_id
  AND status::text IN('running','waiting_approval') ORDER BY started_at DESC LIMIT 1;
 IF proof.event_id IS NULL OR root_proof.event_id IS NULL OR root_event.id IS NULL OR wf.id IS NULL OR run.id IS NULL
 OR root_proof.root_event_id IS DISTINCT FROM root_proof.event_id OR root_proof.parent_event_id IS NOT NULL
 OR root_event.notification_parent_event_id IS NOT NULL
 OR root_proof.payload_hash IS DISTINCT FROM techerp_api.notification_business_event_hash(root_event)
 OR ROW(proof.workspace_id,proof.event_key,proof.source_table,proof.source_id,proof.producer_table,proof.producer_id,
  proof.reference_id,proof.source_revision,proof.due_date,proof.days_before) IS DISTINCT FROM
  ROW(root_proof.workspace_id,root_proof.event_key,root_proof.source_table,root_proof.source_id,root_proof.producer_table,root_proof.producer_id,
  root_proof.reference_id,root_proof.source_revision,root_proof.due_date,root_proof.days_before)
 OR proof.workspace_id IS DISTINCT FROM NEW.workspace_id
 OR proof.source_table IS DISTINCT FROM NEW.entity OR proof.source_id IS DISTINCT FROM NEW.entity_id OR proof.event_key IS DISTINCT FROM NEW.notification_event_key
 OR proof.payload_hash IS DISTINCT FROM techerp_api.notification_business_event_hash(parent)
 OR wf.trigger#>>'{notification_event,key}' IS DISTINCT FROM proof.event_key
 OR(proof.workflow_id IS NOT NULL AND(proof.workflow_id IS DISTINCT FROM wf.id OR proof.workflow_version IS DISTINCT FROM NEW.workflow_version))
 OR(NEW.after-ARRAY['__wf_state','__wf_wait','__wf_path']) IS DISTINCT FROM(parent.after-ARRAY['__wf_state','__wf_wait','__wf_path'])
 OR NEW.before IS DISTINCT FROM parent.before THEN RAISE EXCEPTION 'Retomada sem prova de origem.' USING ERRCODE='42501';END IF;
 INSERT INTO public.notification_business_event_proofs(event_id,root_event_id,workspace_id,event_key,source_table,source_id,producer_table,producer_id,
  reference_id,source_revision,occurrence_key,payload_hash,workflow_id,workflow_version,due_date,days_before,parent_event_id,resume_cursor)
 VALUES(NEW.id,proof.root_event_id,proof.workspace_id,proof.event_key,proof.source_table,proof.source_id,proof.producer_table,proof.producer_id,
  proof.reference_id,proof.source_revision,'resume:'||parent.id||':'||wf.id||':'||NEW.workflow_version||':'||NEW.resume_cursor,
  techerp_api.notification_business_event_hash(NEW),wf.id,NEW.workflow_version,proof.due_date,proof.days_before,parent.id,NEW.resume_cursor)
 ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_resume_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_business_resume BEFORE INSERT ON public.workflow_events FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_business_resume_capture();

CREATE FUNCTION techerp_api.notification_business_event_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.notification_event_key IS NOT NULL AND coalesce(auth.role(),'')='authenticated' THEN
   RAISE EXCEPTION 'Ocorrência comprovada não pode ser removida pelo cliente.' USING ERRCODE='42501';END IF;RETURN OLD;
 ELSIF TG_OP='UPDATE' THEN
  IF OLD.notification_event_key IS NOT NULL OR NEW.notification_event_key IS NOT NULL OR OLD.notification_parent_event_id IS NOT NULL OR NEW.notification_parent_event_id IS NOT NULL THEN
   IF techerp_api.notification_business_event_hash(OLD) IS DISTINCT FROM techerp_api.notification_business_event_hash(NEW) THEN
    RAISE EXCEPTION 'A origem e o conteúdo da ocorrência são imutáveis.' USING ERRCODE='42501';END IF;
  END IF;RETURN NEW;
 END IF;
 IF NEW.notification_event_key IS NULL AND NEW.notification_parent_event_id IS NULL THEN RETURN NEW;END IF;
 IF NEW.notification_parent_event_id IS NOT NULL AND coalesce(auth.role(),'')='service_role' AND auth.uid() IS NULL THEN RETURN NEW;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.notification_business_event_proofs p WHERE p.event_id=NEW.id
  AND p.workspace_id=NEW.workspace_id AND p.event_key=NEW.notification_event_key AND p.payload_hash=techerp_api.notification_business_event_hash(NEW)) THEN
  RAISE EXCEPTION 'Evento especializado exige origem comprovada pelo banco.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_event_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_business_guard BEFORE INSERT OR UPDATE OR DELETE ON public.workflow_events FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_business_event_guard();

CREATE FUNCTION public.notification_business_event_check(p_event uuid,p_workflow uuid,p_version integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event public.workflow_events;proof public.notification_business_event_proofs;root_event public.workflow_events;
 root_proof public.notification_business_event_proofs;wf public.workflows;executor uuid;config jsonb;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO event FROM public.workflow_events WHERE id=p_event;
 SELECT * INTO proof FROM public.notification_business_event_proofs WHERE event_id=p_event;
 SELECT * INTO root_proof FROM public.notification_business_event_proofs WHERE event_id=proof.root_event_id;
 SELECT * INTO root_event FROM public.workflow_events WHERE id=root_proof.event_id;
 SELECT * INTO wf FROM public.workflows WHERE id=p_workflow AND workspace_id=event.workspace_id AND entity=event.entity
  AND enabled AND status='published' AND published_version=p_version;
 config:=wf.trigger->'notification_event';
 IF wf.id IS NULL OR wf.last_published_at IS NULL OR proof.event_id IS NULL OR root_proof.event_id IS NULL OR root_event.id IS NULL
 OR techerp_api.notification_business_category(event.notification_event_key) IS NULL
 OR wf.trigger?'time_based' OR jsonb_typeof(config) IS DISTINCT FROM 'object' OR config->>'key' IS DISTINCT FROM proof.event_key
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(config) k WHERE k NOT IN('key','days_before'))
 OR proof.workspace_id IS DISTINCT FROM event.workspace_id OR proof.source_table IS DISTINCT FROM event.entity
 OR proof.source_id IS DISTINCT FROM event.entity_id OR proof.event_key IS DISTINCT FROM event.notification_event_key
 OR proof.payload_hash IS DISTINCT FROM techerp_api.notification_business_event_hash(event)
 OR root_proof.root_event_id IS DISTINCT FROM root_proof.event_id OR root_proof.parent_event_id IS NOT NULL
 OR root_event.notification_parent_event_id IS NOT NULL
 OR root_proof.payload_hash IS DISTINCT FROM techerp_api.notification_business_event_hash(root_event)
 OR root_proof.workspace_id IS DISTINCT FROM root_event.workspace_id OR root_proof.source_table IS DISTINCT FROM root_event.entity
 OR root_proof.source_id IS DISTINCT FROM root_event.entity_id OR root_proof.event_key IS DISTINCT FROM root_event.notification_event_key
 OR ROW(proof.workspace_id,proof.event_key,proof.source_table,proof.source_id,proof.producer_table,proof.producer_id,
  proof.reference_id,proof.source_revision,proof.due_date,proof.days_before) IS DISTINCT FROM
  ROW(root_proof.workspace_id,root_proof.event_key,root_proof.source_table,root_proof.source_id,root_proof.producer_table,root_proof.producer_id,
  root_proof.reference_id,root_proof.source_revision,root_proof.due_date,root_proof.days_before)
 OR(proof.workflow_id IS NOT NULL AND(proof.workflow_id IS DISTINCT FROM wf.id OR proof.workflow_version IS DISTINCT FROM p_version))
 OR(root_proof.workflow_id IS NOT NULL AND(root_proof.workflow_id IS DISTINCT FROM wf.id OR root_proof.workflow_version IS DISTINCT FROM p_version))
 OR(event.workflow_version IS NOT NULL AND event.workflow_version IS DISTINCT FROM p_version)
 OR(event.resume_workflow_id IS NOT NULL AND event.resume_workflow_id IS DISTINCT FROM wf.id)
 OR NOT techerp_api.notification_business_proof_current(root_proof) THEN RETURN false;END IF;
 IF proof.event_key IN('contracts.contract.expiring','contracts.contract.renewal_due') THEN
  IF jsonb_typeof(config->'days_before') IS DISTINCT FROM 'number' OR coalesce(config->>'days_before','') !~ '^[0-9]{1,3}$'
   OR(config->>'days_before')::integer NOT BETWEEN 1 AND 365 OR (config->>'days_before')::integer IS DISTINCT FROM proof.days_before THEN RETURN false;END IF;
 ELSIF config?'days_before' THEN RETURN false;END IF;
 -- Each resume captured its immutable immediate parent and inherited this
 -- private root. Recheck the occurrence once, without limiting wait/poll depth.
 IF root_proof.created_at<wf.last_published_at THEN RETURN false;END IF;
 executor:=coalesce(wf.execution_user_id,wf.owner_id);
 RETURN public.is_workspace_member(wf.workspace_id,executor)
  AND techerp_api.notification_source_visible(wf.workspace_id,executor,wf.entity,event.entity_id)
  AND public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',p_version),
   CASE WHEN wf.entity IN('deals','proposals') THEN jsonb_build_object('table',wf.entity,'id',event.entity_id,'action','view')
   ELSE jsonb_build_object('record_table',wf.entity,'id',event.entity_id) END));
END $$;
REVOKE ALL ON FUNCTION public.notification_business_event_check(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_business_event_check(uuid,uuid,integer) TO service_role;

CREATE FUNCTION public.notification_business_due_tick(p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;contract public.contracts;config jsonb;deadline date;offset_days integer;today date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;
 occurrence text;event uuid;enqueued integer:=0;candidates integer:=0;BEGIN
 PERFORM techerp_api.notification_service();
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Limite de eventos inválido.' USING ERRCODE='22023';END IF;
 FOR wf IN SELECT * FROM public.workflows WHERE enabled AND status='published' AND entity='contracts'
  AND NOT(trigger?'time_based') AND last_published_at IS NOT NULL
  AND trigger#>>'{notification_event,key}' IN('contracts.contract.expiring','contracts.contract.renewal_due')
  ORDER BY md5(id::text||date_trunc('minute',now())::text) LIMIT 200 LOOP
  config:=wf.trigger->'notification_event';
  IF candidates>=p_limit THEN RETURN jsonb_build_object('enqueued',enqueued);END IF;
  IF jsonb_typeof(config->'days_before') IS DISTINCT FROM 'number' OR coalesce(config->>'days_before','') !~ '^[0-9]{1,3}$' THEN CONTINUE;END IF;
  offset_days:=(config->>'days_before')::integer;IF offset_days NOT BETWEEN 1 AND 365 THEN CONTINUE;END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(config) k WHERE k NOT IN('key','days_before'))
   OR NOT public.is_workspace_member(wf.workspace_id,coalesce(wf.execution_user_id,wf.owner_id))
   OR NOT public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',wf.published_version))) THEN CONTINUE;END IF;
  FOR contract IN SELECT c.* FROM public.contracts c WHERE c.workspace_id=wf.workspace_id AND c.status IN('active','renewing')
   AND c.ends_at IS NOT NULL AND(
    (config->>'key'='contracts.contract.expiring' AND c.ends_at BETWEEN today AND today+offset_days)
    OR(config->>'key'='contracts.contract.renewal_due' AND c.auto_renew AND c.notice_days BETWEEN 0 AND 3650
     AND c.ends_at-c.notice_days BETWEEN today AND today+offset_days))
   AND NOT EXISTS(SELECT 1 FROM public.notification_business_due_cursors d WHERE d.workflow_id=wf.id AND d.contract_id=c.id
    AND d.event_key=config->>'key' AND d.days_before=offset_days AND d.due_date=CASE WHEN config->>'key'='contracts.contract.renewal_due' THEN c.ends_at-c.notice_days ELSE c.ends_at END)
   ORDER BY md5(c.id::text||date_trunc('minute',now())::text) LIMIT(p_limit-candidates) LOOP
   candidates:=candidates+1;IF candidates>p_limit THEN RETURN jsonb_build_object('enqueued',enqueued);END IF;
   IF public.is_test_record(contract.id) THEN CONTINUE;END IF;
   deadline:=contract.ends_at;
   IF config->>'key'='contracts.contract.renewal_due' THEN
    IF NOT coalesce(contract.auto_renew,false) OR contract.notice_days IS NULL OR contract.notice_days NOT BETWEEN 0 AND 3650 THEN CONTINUE;END IF;
    deadline:=deadline-contract.notice_days;
   END IF;
   IF today NOT BETWEEN deadline-offset_days AND deadline OR NOT public.sales_worker_authorize('workflows',wf.id,
    jsonb_build_array(jsonb_build_object('workflow_version',wf.published_version),jsonb_build_object('record_table','contracts','id',contract.id)))
    OR NOT techerp_api.notification_source_visible(wf.workspace_id,coalesce(wf.execution_user_id,wf.owner_id),'contracts',contract.id) THEN CONTINUE;END IF;
   occurrence:=wf.id||':'||contract.id||':'||deadline||':'||offset_days;
   IF EXISTS(SELECT 1 FROM public.notification_business_event_proofs WHERE workspace_id=wf.workspace_id AND event_key=config->>'key' AND occurrence_key=occurrence) THEN CONTINUE;END IF;
   event:=techerp_api.notification_business_emit(wf.workspace_id,config->>'key','contracts',contract.id,'contracts',contract.id,occurrence,NULL,NULL,
    deadline::text,wf.id,wf.published_version,deadline,offset_days);
   IF event IS NOT NULL THEN enqueued:=enqueued+1;END IF;
   IF enqueued>=p_limit THEN RETURN jsonb_build_object('enqueued',enqueued);END IF;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('enqueued',enqueued);
END $$;
REVOKE ALL ON FUNCTION public.notification_business_due_tick(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_business_due_tick(integer) TO service_role;

-- Proposal acceptance uses its proposal as the origin. Keep the existing event,
-- run and approval read/decision gates under caller RLS; add only this P8 source.
CREATE OR REPLACE FUNCTION public.sales_event_reference_access(e text,i uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE t text;allowed boolean;w uuid:=(sales_access_context()->>'workspace')::uuid;BEGIN
 IF e='proposals' THEN RETURN sales_record_access('proposals',i,'view');END IF;
 IF e IN('lead','leads','contact','contacts','company','companies','deal','deals','ticket','tickets') THEN
  t:=CASE e WHEN 'lead' THEN 'leads' WHEN 'contact' THEN 'contacts' WHEN 'company' THEN 'companies' WHEN 'deal' THEN 'deals' WHEN 'ticket' THEN 'tickets' ELSE e END;
  RETURN sales_record_access(t,i,'view');
 END IF;
 IF e NOT IN('ats_jobs','ats_candidates','ats_applications','ats_interviews','people','projects','project_tasks','project_milestones','contracts','financial_entries','bank_payments','financial_recurrences','legal_entities','customer_invoices','subscription_invoices') OR i IS NULL OR w IS NULL THEN RETURN false;END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND workspace_id=$2)',e) INTO allowed USING i,w;
 RETURN coalesce(allowed,false);
END$$;
REVOKE ALL ON FUNCTION public.sales_event_reference_access(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_event_reference_access(text,uuid) TO authenticated;

-- Preserve the existing approval decision and its subject/RLS gate. A named
-- resume uses the original occurrence's source snapshot, plus only durable
-- internal path/state frames from the approved wait, then is rehydrated normally.
CREATE OR REPLACE FUNCTION public.sales_workflow_approval_decide(p_actor uuid,p_id uuid,p_decision text,p_comment text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a workflow_approvals;wf workflows;r jsonb;run_status text;parent workflow_events;key text;resume_after jsonb;BEGIN
 SELECT * INTO a FROM workflow_approvals WHERE id=p_id FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Aprovação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO wf FROM workflows WHERE id=a.workflow_id AND workspace_id=a.workspace_id AND enabled AND status='published' FOR SHARE;
 SELECT status::text INTO run_status FROM workflow_runs WHERE id=a.run_id AND workflow_id=a.workflow_id AND workspace_id=a.workspace_id FOR UPDATE;
 IF wf.id IS NULL OR run_status IS DISTINCT FROM 'waiting_approval' THEN RAISE EXCEPTION 'A execução não está pronta para decisão.' USING ERRCODE='42501';END IF;
 r:=techerp_api.sales_approval_decide(p_actor,a.workspace_id,p_id,p_decision,p_comment,wf.published_version);
 IF p_decision='approved' THEN
  SELECT e.* INTO parent FROM workflow_events e JOIN workflow_runs run ON run.event_id=e.id WHERE run.id=a.run_id AND run.workflow_id=wf.id AND run.workspace_id=a.workspace_id;
  SELECT event_key INTO key FROM notification_business_event_proofs WHERE event_id=parent.id;
  IF parent.notification_event_key IS NOT NULL AND(key IS NULL OR NOT public.notification_business_event_check(parent.id,wf.id,wf.published_version)) THEN
   RAISE EXCEPTION 'A ocorrência original da aprovação não é mais válida.' USING ERRCODE='42501';END IF;
  resume_after:=CASE WHEN key IS NULL THEN a.event_snapshot->'after' ELSE(parent.after-ARRAY['__wf_wait','__wf_state','__wf_path'])||jsonb_strip_nulls(jsonb_build_object(
   '__wf_wait',a.event_snapshot#>'{after,__wf_wait}','__wf_state',a.event_snapshot#>'{after,__wf_state}','__wf_path',a.event_snapshot#>'{after,__wf_path}')) END;
  INSERT INTO workflow_events(workspace_id,owner_id,entity,entity_id,event_type,before,after,resume_workflow_id,resume_cursor,workflow_version,notification_event_key,notification_parent_event_id)
  VALUES(a.workspace_id,coalesce(wf.execution_user_id,wf.owner_id),a.entity,a.entity_id,CASE WHEN key IS NULL THEN 'created' ELSE parent.event_type END,
   CASE WHEN key IS NULL THEN a.event_snapshot->'before' ELSE parent.before END,resume_after,a.workflow_id,a.resume_cursor,a.workflow_version,key,CASE WHEN key IS NOT NULL THEN parent.id END);
  UPDATE workflow_runs SET status='approved',finished_at=clock_timestamp() WHERE id=a.run_id;
 ELSE UPDATE workflow_runs SET status='rejected',finished_at=clock_timestamp(),error='Aprovação rejeitada' WHERE id=a.run_id;END IF;
 RETURN jsonb_build_object('ok',true,'decision',p_decision);
END $$;

CREATE FUNCTION techerp_api.notification_business_run_key(p_workflow uuid,p_run uuid,p_version integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;run public.workflow_runs;event public.workflow_events;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO wf FROM public.workflows WHERE id=p_workflow AND enabled AND status='published' AND published_version=p_version;
 SELECT * INTO run FROM public.workflow_runs WHERE id=p_run AND workflow_id=wf.id AND workspace_id=wf.workspace_id
  AND owner_id=wf.owner_id AND entity=wf.entity AND NOT is_test;
 SELECT * INTO event FROM public.workflow_events WHERE id=run.event_id AND workspace_id=wf.workspace_id AND entity=wf.entity AND entity_id=run.entity_id;
 IF wf.id IS NULL OR run.id IS NULL OR event.id IS NULL THEN RETURN NULL;END IF;
 IF event.notification_event_key IS NULL THEN
  RETURN CASE WHEN wf.trigger?'notification_event' THEN NULL ELSE 'legacy.workflow' END;
 END IF;
 IF NOT public.notification_business_event_check(event.id,wf.id,p_version) THEN RETURN NULL;END IF;
 RETURN event.notification_event_key;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_run_key(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_business_module(p_key text,p_workspace uuid,p_user uuid,p_table text,p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF techerp_api.notification_business_category(p_key) IS NOT NULL THEN
  IF NOT techerp_api.notification_center_source_visible(p_workspace,p_user,p_table,p_id) THEN RETURN NULL;END IF;
  RETURN split_part(p_key,'.',1);
 END IF;
 RETURN techerp_api.notification_center_source_module(p_workspace,p_user,p_table,p_id);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_module(text,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_external_event_preference(p_workspace uuid,p_user uuid,p_channel text,p_event text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE category text;legacy jsonb;settings jsonb;allowed boolean:=false;section text;entry record;BEGIN
 IF p_event='legacy.workflow' THEN RETURN techerp_api.notification_external_preference(p_workspace,p_user,p_channel);END IF;
 category:=techerp_api.notification_business_category(p_event);
 IF category IS NULL OR p_channel<>'email' OR NOT public.is_workspace_member(p_workspace,p_user) THEN RETURN false;END IF;
 SELECT notification_preferences INTO legacy FROM public.profiles WHERE id=p_user;
 IF NOT FOUND THEN RETURN false;END IF;
 IF legacy IS NOT NULL AND legacy<>'null'::jsonb THEN
  IF jsonb_typeof(legacy)<>'object' THEN RETURN false;END IF;
  IF legacy?category THEN
   IF jsonb_typeof(legacy->category)<>'object' THEN RETURN false;END IF;
   IF legacy->category?'email' THEN allowed:=legacy#>ARRAY[category,'email']='true'::jsonb;END IF;
  END IF;
 END IF;
 SELECT p.settings INTO settings FROM public.notification_user_preferences p WHERE workspace_id=p_workspace AND user_id=p_user;
 IF settings IS NOT NULL THEN
  IF jsonb_typeof(settings)<>'object' THEN RETURN false;END IF;
  FOREACH section IN ARRAY ARRAY['categories','eventOverrides'] LOOP
   IF settings?section THEN
    IF jsonb_typeof(settings->section)<>'object' THEN RETURN false;END IF;
    FOR entry IN SELECT j.key,j.value FROM jsonb_each(settings->section)j LOOP
     IF((section='categories' AND entry.key IN('mention','assignment','deal_stage','ticket','task','sla','message','workflow','approval','hiring','form','portfolio','platform'))
      OR(section='eventOverrides' AND(techerp_api.notification_business_category(entry.key) IS NOT NULL
       OR techerp_api.notification_center_category(CASE WHEN left(entry.key,7)='legacy.' THEN substr(entry.key,8) END) IS NOT NULL)))
      AND jsonb_typeof(entry.value)<>'object' THEN RETURN false;END IF;
    END LOOP;
   END IF;
  END LOOP;
  IF settings#>ARRAY['categories',category,'email'] IS NOT NULL THEN allowed:=settings#>ARRAY['categories',category,'email']='true'::jsonb;END IF;
  IF settings#>ARRAY['eventOverrides',p_event,'email'] IS NOT NULL THEN allowed:=settings#>ARRAY['eventOverrides',p_event,'email']='true'::jsonb;END IF;
 END IF;
 RETURN coalesce(allowed,false);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_external_event_preference(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;

-- WhatsApp's personal opt-in remains mandatory. This optional workspace/event
-- overlay can only narrow it; an absent value retains the existing consent gate.
CREATE FUNCTION techerp_api.notification_whatsapp_event_preference(p_workspace uuid,p_user uuid,p_event text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE category text;settings jsonb;allowed boolean:=true;section text;entry record;BEGIN
 category:=coalesce(techerp_api.notification_business_category(p_event),
  techerp_api.notification_center_category(CASE WHEN left(p_event,7)='legacy.' THEN substr(p_event,8) END));
 IF category IS NULL OR NOT public.is_workspace_member(p_workspace,p_user) THEN RETURN false;END IF;
 SELECT p.settings INTO settings FROM public.notification_user_preferences p WHERE workspace_id=p_workspace AND user_id=p_user;
 IF settings IS NULL THEN RETURN true;END IF;
 IF jsonb_typeof(settings)<>'object' THEN RETURN false;END IF;
 FOREACH section IN ARRAY ARRAY['categories','eventOverrides'] LOOP
  IF settings?section THEN
   IF jsonb_typeof(settings->section)<>'object' THEN RETURN false;END IF;
   FOR entry IN SELECT j.key,j.value FROM jsonb_each(settings->section)j LOOP
    IF((section='categories' AND entry.key IN('mention','assignment','deal_stage','ticket','task','sla','message','workflow','approval','hiring','form','portfolio','platform'))
     OR(section='eventOverrides' AND(techerp_api.notification_business_category(entry.key) IS NOT NULL
      OR techerp_api.notification_center_category(CASE WHEN left(entry.key,7)='legacy.' THEN substr(entry.key,8) END) IS NOT NULL)))
     AND jsonb_typeof(entry.value)<>'object' THEN RETURN false;END IF;
   END LOOP;
  END IF;
 END LOOP;
 IF settings#>ARRAY['categories',category,'whatsapp'] IS NOT NULL THEN allowed:=settings#>ARRAY['categories',category,'whatsapp']='true'::jsonb;END IF;
 IF settings#>ARRAY['eventOverrides',p_event,'whatsapp'] IS NOT NULL THEN allowed:=settings#>ARRAY['eventOverrides',p_event,'whatsapp']='true'::jsonb;END IF;
 RETURN coalesce(allowed,false);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_event_preference(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.notification_delivery_intents DROP CONSTRAINT notification_delivery_intents_event_key_check;
ALTER TABLE public.notification_delivery_intents ADD CONSTRAINT notification_delivery_intents_event_key_check
 CHECK(event_key='legacy.workflow' OR techerp_api.notification_business_category(event_key) IS NOT NULL);
ALTER TABLE public.notification_slack_intents ADD COLUMN event_key text NOT NULL DEFAULT 'legacy.workflow';


-- Reapply the existing authorization, recipient, preference, history and ledger
-- boundaries with only trusted named-event identity threaded through them.
CREATE OR REPLACE FUNCTION public.notification_center_preferences_save(p_workspace uuid,p_patch jsonb,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace,true);stored jsonb;result jsonb;
 current_revision integer;group_key text;entry record;channel record;group_value jsonb;q jsonb;new_revision integer;
 categories text[]:=ARRAY['mention','assignment','deal_stage','ticket','task','sla','message','workflow','approval','hiring','form','portfolio','platform'];
 event_types text[]:=ARRAY['mention','assignment','deal_stage','ticket','task','sla','message','workflow','approval',
  'role_profile','role_profile_approval','hiring_approval','hiring_preparation_approval','hiring_formalization',
  'form_submission','portfolio_conflict','sequence_handoff','security_scan','platform_alert',
  'sla.first_response_breach','sla.resolution_breach','sla.at_risk'];
BEGIN
 IF p_revision IS NULL OR p_revision<0 OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
  OR octet_length(p_patch::text)>32768 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch)k
   WHERE k NOT IN('categories','eventOverrides','quiet','summary')) THEN
  RAISE EXCEPTION 'Preferências inválidas.' USING ERRCODE='22023';END IF;
 FOREACH group_key IN ARRAY ARRAY['categories','eventOverrides'] LOOP
  IF p_patch?group_key THEN
   IF jsonb_typeof(p_patch->group_key)<>'object' THEN
    RAISE EXCEPTION 'Grupo de preferências inválido.' USING ERRCODE='22023';END IF;
   FOR entry IN SELECT key,value FROM jsonb_each(p_patch->group_key) LOOP
    IF (group_key='categories' AND NOT entry.key=ANY(categories))
     OR (group_key='eventOverrides' AND NOT(entry.key=ANY(ARRAY(SELECT 'legacy.'||t FROM unnest(event_types)t)) OR techerp_api.notification_business_category(entry.key) IS NOT NULL))
     OR (entry.value<>'null'::jsonb AND jsonb_typeof(entry.value)<>'object') THEN
     RAISE EXCEPTION 'Grupo de preferências inválido.' USING ERRCODE='22023';END IF;
    IF entry.value<>'null'::jsonb THEN
     FOR channel IN SELECT key,value FROM jsonb_each(entry.value) LOOP
      IF channel.key NOT IN('inapp','email','sound','shake','whatsapp')
       OR jsonb_typeof(channel.value) NOT IN('boolean','null') THEN
       RAISE EXCEPTION 'Canal de preferência inválido.' USING ERRCODE='22023';END IF;
     END LOOP;
    END IF;
   END LOOP;
  END IF;
 END LOOP;
 IF p_patch?'quiet' THEN
  q:=p_patch->'quiet';
  IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR NOT(q?'enabled' AND q?'timezone' AND q?'start' AND q?'end')
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(q)k WHERE k NOT IN('enabled','timezone','start','end'))
   OR jsonb_typeof(q->'enabled') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(q->'timezone') IS DISTINCT FROM 'string' OR length(q->>'timezone')>80
   OR (q->>'timezone'<>'UTC' AND strpos(q->>'timezone','/')=0)
   OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE lower(name)=lower(q->>'timezone'))
   OR jsonb_typeof(q->'start') IS DISTINCT FROM 'string' OR jsonb_typeof(q->'end') IS DISTINCT FROM 'string'
   OR q->>'start' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR q->>'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
   OR ((q->>'enabled')::boolean AND q->>'start'=q->>'end') THEN
   RAISE EXCEPTION 'Período de silêncio inválido.' USING ERRCODE='22023';END IF;
 END IF;
 IF p_patch?'summary' AND (jsonb_typeof(p_patch->'summary') IS DISTINCT FROM 'string'
  OR p_patch->>'summary' NOT IN('none','daily','weekly')) THEN
  RAISE EXCEPTION 'Resumo inválido.' USING ERRCODE='22023';END IF;
 -- Serialize both the first insert and subsequent revisions per user/workspace.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':'||u::text,0));
 SELECT settings,revision INTO stored,current_revision FROM public.notification_user_preferences
  WHERE workspace_id=p_workspace AND user_id=u FOR UPDATE;
 IF coalesce(current_revision,0)<>p_revision THEN
  -- A stale client revision is not a transient serialization failure. PT409
  -- returns HTTP 409 immediately instead of triggering PostgREST auto-retries.
  RAISE EXCEPTION 'As preferências foram alteradas em outra sessão. Recarregue e tente novamente.' USING ERRCODE='PT409';END IF;
 result:=coalesce(stored,'{}'::jsonb);
 FOREACH group_key IN ARRAY ARRAY['categories','eventOverrides'] LOOP
  IF p_patch?group_key THEN
   IF jsonb_typeof(result->group_key) IS DISTINCT FROM 'object' THEN result:=jsonb_set(result,ARRAY[group_key],'{}');END IF;
   FOR entry IN SELECT key,value FROM jsonb_each(p_patch->group_key) LOOP
    IF entry.value='null'::jsonb THEN result:=result#-ARRAY[group_key,entry.key];
    ELSE
     group_value:=result#>ARRAY[group_key,entry.key];
     IF jsonb_typeof(group_value) IS DISTINCT FROM 'object' THEN group_value:='{}';END IF;
     FOR channel IN SELECT key,value FROM jsonb_each(entry.value) LOOP
      IF channel.value='null'::jsonb THEN group_value:=group_value-channel.key;
      ELSE group_value:=jsonb_set(group_value,ARRAY[channel.key],channel.value);END IF;
     END LOOP;
     IF group_value='{}'::jsonb THEN result:=result#-ARRAY[group_key,entry.key];
     ELSE result:=jsonb_set(result,ARRAY[group_key,entry.key],group_value);END IF;
    END IF;
   END LOOP;
  END IF;
 END LOOP;
 IF p_patch?'quiet' THEN result:=jsonb_set(result,'{quiet}',
  (CASE WHEN jsonb_typeof(result->'quiet')='object' THEN result->'quiet' ELSE '{}'::jsonb END)||(p_patch->'quiet'));END IF;
 IF p_patch?'summary' THEN result:=jsonb_set(result,'{summary}',p_patch->'summary');END IF;
 new_revision:=p_revision+1;
 INSERT INTO public.notification_user_preferences(workspace_id,user_id,revision,settings)
  VALUES(p_workspace,u,new_revision,result)
  ON CONFLICT(workspace_id,user_id) DO UPDATE SET revision=EXCLUDED.revision,settings=EXCLUDED.settings,updated_at=clock_timestamp();
 RETURN jsonb_build_object('settings',result,'revision',new_revision);
END $$;

CREATE OR REPLACE FUNCTION public.notification_event_inapp(p_workspace uuid,p_user uuid,p_event text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE prefs jsonb;settings jsonb;category text;t text;value jsonb;q jsonb;section text;entry record;allowed boolean:=true;BEGIN
 IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL
  OR p_workspace IS NULL OR p_user IS NULL OR p_event IS NULL
  OR NOT public.is_workspace_member(p_workspace,p_user) THEN RETURN false;END IF;
 t:=CASE WHEN left(p_event,7)='legacy.' THEN substr(p_event,8) END;
 category:=coalesce(techerp_api.notification_business_category(p_event),techerp_api.notification_center_category(t));
 IF category IS NULL THEN RETURN false;END IF;
 SELECT notification_preferences INTO prefs FROM public.profiles WHERE id=p_user;
 IF NOT FOUND THEN RETURN false;END IF;
 IF prefs IS NOT NULL AND prefs<>'null'::jsonb THEN
  IF jsonb_typeof(prefs)<>'object' THEN allowed:=false;
  ELSIF prefs?category THEN
   value:=prefs->category;
   allowed:=jsonb_typeof(value)='object' AND (NOT value?'inapp' OR value->'inapp'='true'::jsonb);
  END IF;
 END IF;
 SELECT p.settings INTO settings FROM public.notification_user_preferences p
  WHERE p.workspace_id=p_workspace AND p.user_id=p_user;
 -- Malformed known sections/groups or a malformed routine fail closed across
 -- the overlay, exactly as the shared TypeScript normalizer. Unknown future keys
 -- remain stored but cannot introduce recipients or known channel eligibility.
 IF settings IS NOT NULL THEN
  IF jsonb_typeof(settings)<>'object' THEN RETURN false;END IF;
  FOREACH section IN ARRAY ARRAY['categories','eventOverrides'] LOOP
   IF settings?section THEN
    IF jsonb_typeof(settings->section)<>'object' THEN RETURN false;END IF;
    FOR entry IN SELECT j.key,j.value FROM jsonb_each(settings->section)j LOOP
     IF ((section='categories' AND entry.key IN('mention','assignment','deal_stage','ticket','task','sla','message','workflow','approval','hiring','form','portfolio','platform'))
      OR (section='eventOverrides' AND(techerp_api.notification_business_category(entry.key) IS NOT NULL OR techerp_api.notification_center_category(CASE WHEN left(entry.key,7)='legacy.' THEN substr(entry.key,8) END) IS NOT NULL)))
      AND jsonb_typeof(entry.value)<>'object' THEN RETURN false;END IF;
    END LOOP;
   END IF;
  END LOOP;
  IF settings?'quiet' THEN
   q:=settings->'quiet';
   IF jsonb_typeof(q)<>'object' OR NOT(q?'enabled' AND q?'timezone' AND q?'start' AND q?'end')
    OR jsonb_typeof(q->'enabled') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(q->'timezone') IS DISTINCT FROM 'string' OR length(q->>'timezone')>80
    OR (q->>'timezone'<>'UTC' AND strpos(q->>'timezone','/')=0)
    OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE lower(name)=lower(q->>'timezone'))
    OR jsonb_typeof(q->'start') IS DISTINCT FROM 'string' OR jsonb_typeof(q->'end') IS DISTINCT FROM 'string'
    OR q->>'start' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR q->>'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR (q->>'enabled'='true' AND q->>'start'=q->>'end') THEN RETURN false;END IF;
  END IF;
 END IF;
 IF settings#>ARRAY['categories',category,'inapp'] IS NOT NULL THEN
  allowed:=settings#>ARRAY['categories',category,'inapp']='true'::jsonb;
 END IF;
 IF settings#>ARRAY['eventOverrides',p_event,'inapp'] IS NOT NULL THEN
  allowed:=settings#>ARRAY['eventOverrides',p_event,'inapp']='true'::jsonb;
 END IF;
 RETURN coalesce(allowed,false);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_external_preference(p_ws uuid,p_user uuid,p_channel text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p jsonb;s jsonb;v jsonb;allowed boolean:=false;section text;entry record;q jsonb;BEGIN
 IF p_channel<>'email' OR NOT public.is_workspace_member(p_ws,p_user) THEN RETURN false;END IF;
 SELECT notification_preferences INTO p FROM public.profiles WHERE id=p_user;
 IF NOT FOUND THEN RETURN false;END IF;
 IF p IS NOT NULL AND p<>'null'::jsonb THEN
  IF jsonb_typeof(p)<>'object' THEN RETURN false;END IF;
  IF p?'workflow' THEN
   IF jsonb_typeof(p->'workflow')<>'object' THEN RETURN false;END IF;
   IF p->'workflow'?'email' THEN allowed:=p#>'{workflow,email}'='true'::jsonb;END IF;
  END IF;
 END IF;
 SELECT settings INTO s FROM public.notification_user_preferences WHERE workspace_id=p_ws AND user_id=p_user;
 IF s IS NOT NULL THEN
  IF jsonb_typeof(s)<>'object' THEN RETURN false;END IF;
  FOREACH section IN ARRAY ARRAY['categories','eventOverrides'] LOOP
   IF s?section THEN
    IF jsonb_typeof(s->section)<>'object' THEN RETURN false;END IF;
    FOR entry IN SELECT j.key,j.value FROM jsonb_each(s->section) j LOOP
     IF((section='categories' AND entry.key IN('mention','assignment','deal_stage','ticket','task','sla','message','workflow','approval','hiring','form','portfolio','platform'))
      OR(section='eventOverrides' AND(techerp_api.notification_business_category(entry.key) IS NOT NULL OR techerp_api.notification_center_category(CASE WHEN left(entry.key,7)='legacy.' THEN substr(entry.key,8) END) IS NOT NULL)))
      AND jsonb_typeof(entry.value)<>'object' THEN RETURN false;END IF;
    END LOOP;
   END IF;
  END LOOP;
  IF s#>'{categories,workflow,email}' IS NOT NULL THEN allowed:=s#>'{categories,workflow,email}'='true'::jsonb;END IF;
  IF s#>'{eventOverrides,legacy.workflow,email}' IS NOT NULL THEN allowed:=s#>'{eventOverrides,legacy.workflow,email}'='true'::jsonb;END IF;
 END IF;
 RETURN coalesce(allowed,false);
END $$;

CREATE OR REPLACE FUNCTION public.notification_workflow_dispatch(
  p_workflow uuid,p_run uuid,p_version integer,p_entity text,p_record uuid,
  p_rules jsonb,p_title text,p_body text,p_step text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;run public.workflow_runs;ev public.workflow_events;
  w uuid;executor uuid;source jsonb;rule jsonb;kind text;rule_id uuid;
  recipients uuid[]:='{}';selected uuid[];recipient uuid;source_project uuid;
  manager uuid;leader jsonb;policy public.hiring_area_policies;
  issues text[]:='{}';candidate_count integer:=0;sent_count integer:=0;
  excluded_count integer:=0;duplicate_count integer:=0;created uuid;
  prefs jsonb;inapp boolean;title text;body text;href text;dedupe text;
 resolved_event text;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Execução reservada ao motor de Workflows.' USING ERRCODE='42501';
  END IF;
  -- Check the ORIGINAL request before any private subject context drops session_id.
  IF public.is_read_only_view() THEN
    RAISE EXCEPTION 'Execução de teste não pode emitir notificações.' USING ERRCODE='42501';
  END IF;
  IF p_workflow IS NULL OR p_run IS NULL OR p_version IS NULL OR p_version<1
    OR p_record IS NULL OR p_entity IS NULL OR p_step IS NULL
    OR length(p_step) NOT BETWEEN 1 AND 300 OR btrim(p_step)=''
    OR p_title IS NULL OR btrim(p_title)='' OR length(p_title)>200
    OR length(coalesce(p_body,''))>2000 OR jsonb_typeof(p_rules) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Configuração de notificação inválida.' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_rules) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Informe de um a dez seletores de destinatários.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO wf FROM public.workflows
    WHERE id=p_workflow AND enabled AND status='published' AND published_version=p_version
      AND entity=p_entity FOR SHARE;
  IF wf.id IS NULL THEN
    RAISE EXCEPTION 'Workflow indisponível ou versão desatualizada.' USING ERRCODE='42501';
  END IF;
  w:=wf.workspace_id;executor:=coalesce(wf.execution_user_id,wf.owner_id);
  SELECT * INTO run FROM public.workflow_runs
    WHERE id=p_run AND workflow_id=p_workflow AND workspace_id=w
      AND entity=p_entity AND entity_id=p_record AND status='running' AND NOT is_test
      AND owner_id=wf.owner_id FOR UPDATE;
  IF run.id IS NULL OR NOT public.is_workspace_member(w,executor) THEN
    RAISE EXCEPTION 'Execução de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO ev FROM public.workflow_events
    WHERE id=run.event_id AND workspace_id=w AND entity=p_entity AND entity_id=p_record;
  IF ev.id IS NULL OR (ev.workflow_version IS NOT NULL AND ev.workflow_version<>p_version)
    OR NOT public.sales_worker_authorize('workflows',p_workflow,
      jsonb_build_array(jsonb_build_object('workflow_version',p_version),
        CASE WHEN p_entity IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities')
          THEN jsonb_build_object('table',p_entity,'id',p_record,'action','view')
          ELSE jsonb_build_object('record_table',p_entity,'id',p_record) END))
    OR NOT techerp_api.notification_source_visible(w,executor,p_entity,p_record) THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  resolved_event:=techerp_api.notification_business_run_key(p_workflow,p_run,p_version);
  IF resolved_event IS NULL THEN RAISE EXCEPTION 'Ocorrência de notificação sem prova válida.' USING ERRCODE='42501';END IF;
  -- p_entity has passed the exact table allowlist in the private source bridge.
  EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 AND workspace_id=$2',p_entity)
    INTO source USING p_record,w;
  IF source IS NULL THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;

  FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    IF jsonb_typeof(rule) IS DISTINCT FROM 'object'
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(rule) k WHERE k NOT IN('kind','id')) THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    kind:=rule->>'kind';rule_id:=NULL;selected:='{}';
    IF kind IS NULL OR kind NOT IN('workflow_owner','user','source_responsible','source_creator',
      'area_manager','pending_approvers','project_members','team','job_role','followers') THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    IF kind IN('user','team','job_role') THEN
      IF coalesce(rule->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Identificador de destinatário inválido.' USING ERRCODE='22023';
      END IF;
      rule_id:=(rule->>'id')::uuid;
    ELSIF rule?'id' THEN
      RAISE EXCEPTION 'Seletor não aceita identificador manual.' USING ERRCODE='22023';
    END IF;
    CASE kind
      WHEN 'workflow_owner' THEN selected:=ARRAY[executor];
      WHEN 'user' THEN selected:=ARRAY[rule_id];
      WHEN 'source_creator' THEN
        -- owner_id is not universally a creator; never infer it when provenance is absent.
        selected:=ARRAY[nullif(source->>'created_by','')::uuid];
      WHEN 'source_responsible' THEN
        CASE p_entity
          WHEN 'tickets' THEN selected:=ARRAY[coalesce(nullif(source->>'assignee_id','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_jobs' THEN selected:=ARRAY[coalesce(nullif(source->>'recruiter_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_interviews' THEN selected:=ARRAY[coalesce(nullif(source->>'interviewer_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'project_tasks' THEN
            SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM (
              SELECT DISTINCT x FROM (
              SELECT nullif(source->>'assignee_id','')::uuid x
              UNION SELECT value::uuid FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(source->'assignee_ids')='array' THEN source->'assignee_ids' ELSE '[]'::jsonb END)
              ) ids WHERE x IS NOT NULL ORDER BY x LIMIT 201
            ) s;
          ELSE selected:=ARRAY[coalesce(nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
        END CASE;
      WHEN 'area_manager' THEN
        manager:=NULL;
        IF p_entity='people' THEN
          SELECT profile_id INTO manager FROM public.people m
            WHERE m.id=nullif(source->>'manager_id','')::uuid AND m.workspace_id=w
              AND NOT coalesce((to_jsonb(m)->>'archived')::boolean,false);
        ELSIF p_entity='deals' THEN
          leader:=techerp_api.notification_deal_leader(w,executor,p_record);
          IF leader->>'status'='ok' THEN manager:=nullif(leader->>'leader_id','')::uuid;
          ELSIF leader->>'status'='ambiguous' THEN issues:=array_append(issues,'recipient_source_ambiguous');
          END IF;
        ELSIF p_entity='ats_jobs' THEN
          SELECT * INTO policy FROM public.hiring_area_policies
            WHERE workspace_id=w AND area_id=nullif(source->>'hiring_area_id','')::uuid;
          IF EXISTS(SELECT 1 FROM public.hiring_demand_requests r
            WHERE r.workspace_id=w AND r.job_id=p_record AND r.revision=nullif(source->>'hiring_revision','')::integer) THEN
            -- Only the canonical request records who asked and which substitute was
            -- selected. The job creator is not necessarily that requester.
            SELECT s.approver_id INTO manager FROM public.hiring_demand_requests r
              JOIN public.hiring_demand_steps s ON s.request_id=r.id AND s.workspace_id=r.workspace_id
              WHERE r.workspace_id=w AND r.job_id=p_record
                AND r.revision=nullif(source->>'hiring_revision','')::integer
                AND r.policy_revision=policy.revision AND r.status IN('pending','approved')
                AND s.stage='manager' AND s.status IN('pending','approved');
          ELSE manager:=policy.manager_id;END IF;
        END IF;
        selected:=ARRAY[manager];
      WHEN 'pending_approvers' THEN
        IF p_entity='contracts' THEN
          SELECT coalesce(array_agg(DISTINCT approver_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_id FROM public.contract_approvals a WHERE a.workspace_id=w AND a.contract_id=p_record
              AND source->>'status'='in_review'
              AND a.status='pending' AND a.superseded_at IS NULL AND a.approver_id IS NOT NULL
              AND techerp_api.notification_contract_approver(w,a.approver_id,a.id)
              AND a.sort_order=(SELECT min(b.sort_order) FROM public.contract_approvals b
                WHERE b.workspace_id=w AND b.contract_id=p_record AND b.status='pending' AND b.superseded_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM public.contract_approvals prior
                WHERE prior.workspace_id=w AND prior.contract_id=p_record AND prior.superseded_at IS NULL
                  AND prior.sort_order<a.sort_order AND prior.status<>'approved')
            ORDER BY a.approver_id LIMIT 201
          ) pending;
        ELSE
          SELECT coalesce(array_agg(DISTINCT approver_user_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_user_id FROM public.workflow_approvals a
              JOIN public.workflow_runs pending_run ON pending_run.id=a.run_id
                AND pending_run.workflow_id=a.workflow_id AND pending_run.workspace_id=a.workspace_id
                AND pending_run.entity=a.entity AND pending_run.entity_id=a.entity_id
                AND pending_run.status='waiting_approval' AND NOT pending_run.is_test
              WHERE a.workspace_id=w AND a.workflow_id=p_workflow
              AND a.workflow_version=p_version AND a.entity=p_entity AND a.entity_id=p_record
              AND a.status='pending' AND a.approver_user_id IS NOT NULL
              AND public.sales_workflow_approval_recipient(p_workflow,a.approver_user_id,p_entity,p_record,p_version)
            ORDER BY a.approver_user_id LIMIT 201
          ) pending;
        END IF;
      WHEN 'project_members' THEN
        source_project:=CASE WHEN p_entity='projects' THEN p_record
          WHEN p_entity IN('project_tasks','project_milestones') THEN nullif(source->>'project_id','')::uuid END;
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.project_members m JOIN public.projects p
            ON p.id=m.project_id AND p.workspace_id=m.workspace_id
            WHERE m.workspace_id=w AND p.id=source_project AND p.workspace_id=w
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'team' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_group_members m JOIN public.user_groups g ON g.id=m.group_id
            WHERE g.id=rule_id AND g.workspace_id=w ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'job_role' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_job_roles m JOIN public.job_roles r ON r.id=m.role_id
            WHERE r.id=rule_id AND m.workspace_id=w AND (r.workspace_id IS NULL OR r.workspace_id=w)
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'followers' THEN issues:=array_append(issues,'followers_unavailable');
    END CASE;
    SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM unnest(selected) x WHERE x IS NOT NULL;
    IF cardinality(selected)=0 AND kind<>'followers' THEN
      issues:=array_append(issues,'recipient_source_unavailable');
    END IF;
    recipients:=recipients||selected;
  END LOOP;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO recipients FROM unnest(recipients) x WHERE x IS NOT NULL;
  candidate_count:=cardinality(recipients);
  IF candidate_count>200 THEN
    RETURN jsonb_build_object('sent',0,'candidates',candidate_count,'excluded',candidate_count,
      'issues',jsonb_build_array('recipient_limit_exceeded'),'duplicate',0);
  END IF;

  -- Never render the executor's snapshot into a different user's notification.
  IF strpos(p_title,'{{')>0 OR strpos(coalesce(p_body,''),'{{')>0 THEN
    title:='Atualização no TechERP';body:='Acesse o registro para consultar os detalhes.';
  ELSE title:=p_title;body:=p_body;
  END IF;
  href:=CASE p_entity
    WHEN 'leads' THEN '/leads/'||p_record WHEN 'contacts' THEN '/contacts/'||p_record
    WHEN 'companies' THEN '/companies/'||p_record WHEN 'deals' THEN '/deals/'||p_record
    WHEN 'tickets' THEN '/tickets/'||p_record WHEN 'ats_jobs' THEN '/ats/jobs/'||p_record
    WHEN 'ats_candidates' THEN '/candidates/'||p_record WHEN 'people' THEN '/people/'||p_record
    WHEN 'projects' THEN '/projects/'||p_record
    WHEN 'project_tasks' THEN '/projects/tasks?taskId='||p_record
    WHEN 'contracts' THEN '/contracts/'||p_record
    WHEN 'financial_entries' THEN '/finance/entries/'||p_record WHEN 'services' THEN '/services/'||p_record
    WHEN 'proposals' THEN '/proposals/'||p_record ELSE NULL END;
  FOREACH recipient IN ARRAY recipients LOOP
    IF NOT public.is_workspace_member(w,recipient)
      OR NOT techerp_api.notification_source_visible(w,recipient,p_entity,p_record) THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    SELECT notification_preferences INTO prefs FROM public.profiles WHERE id=recipient;
    IF NOT FOUND THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    inapp:=public.notification_event_inapp(w,recipient,resolved_event);
    IF NOT coalesce(inapp,false) THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'preferences_disabled');CONTINUE;
    END IF;
    dedupe:='workflow-notification:'||p_run||':'||p_step||':'||recipient;
    created:=NULL;
    INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
      VALUES(w,executor,recipient,'workflow',title,body,href,p_entity,p_record,dedupe)
      ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id INTO created;
    IF created IS NOT NULL THEN UPDATE public.notification_workspace_context SET event_key=resolved_event WHERE notification_id=created AND workspace_id=w;sent_count:=sent_count+1;
    ELSIF EXISTS(SELECT 1 FROM public.notifications WHERE dedupe_key=dedupe) THEN duplicate_count:=duplicate_count+1;
    ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'notification_not_created');
    END IF;
  END LOOP;
  IF sent_count=0 AND duplicate_count=0 AND cardinality(issues)=0 THEN
    issues:=ARRAY['no_eligible_recipients'];
  END IF;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO issues FROM unnest(issues) x;
  RETURN jsonb_build_object('sent',sent_count,'candidates',candidate_count,'excluded',excluded_count,
    'issues',to_jsonb(issues),'duplicate',duplicate_count);
END $$;

CREATE OR REPLACE FUNCTION public.notification_workflow_dispatch_v2(
  p_workflow uuid,p_run uuid,p_version integer,p_entity text,p_record uuid,
  p_rules jsonb,p_title text,p_body text,p_step text,p_delivery jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;run public.workflow_runs;ev public.workflow_events;
  w uuid;executor uuid;source jsonb;rule jsonb;kind text;rule_id uuid;
  recipients uuid[]:='{}';selected uuid[];recipient uuid;source_project uuid;
  manager uuid;leader jsonb;policy public.hiring_area_policies;
  issues text[]:='{}';candidate_count integer:=0;sent_count integer:=0;
  excluded_count integer:=0;duplicate_count integer:=0;created uuid;
  prefs jsonb;inapp boolean;title text;body text;href text;dedupe text;
  config jsonb;channels jsonb;fallback text;intent_id uuid;intent_existed boolean;job_id uuid;
  queued_count integer:=0;requested_channel text;
 resolved_event text;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Execução reservada ao motor de Workflows.' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_delivery) IS DISTINCT FROM 'object' OR
   EXISTS(SELECT 1 FROM jsonb_object_keys(p_delivery) k WHERE k NOT IN('channels','fallback'))
   OR jsonb_typeof(p_delivery->'channels') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Canais de notificação inválidos.' USING ERRCODE='22023';END IF;
  channels:=p_delivery->'channels';fallback:=coalesce(p_delivery->>'fallback','none');
  IF jsonb_array_length(channels) NOT BETWEEN 1 AND 3 OR fallback NOT IN('none','email')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(channels)c WHERE jsonb_typeof(c)<>'string' OR c#>>'{}' NOT IN('inapp','email','whatsapp'))
   OR(SELECT count(DISTINCT c) FROM jsonb_array_elements(channels)c)<>jsonb_array_length(channels)
   OR(fallback='email' AND(NOT channels?'whatsapp' OR channels?'email')) THEN
   RAISE EXCEPTION 'Canais ou fallback inválidos.' USING ERRCODE='22023';END IF;
  SELECT jsonb_agg(c ORDER BY c) INTO channels FROM jsonb_array_elements(channels)c;
  config:=jsonb_build_object('channels',channels,'fallback',fallback);
  -- Check the ORIGINAL request before any private subject context drops session_id.
  IF public.is_read_only_view() THEN
    RAISE EXCEPTION 'Execução de teste não pode emitir notificações.' USING ERRCODE='42501';
  END IF;
  IF p_workflow IS NULL OR p_run IS NULL OR p_version IS NULL OR p_version<1
    OR p_record IS NULL OR p_entity IS NULL OR p_step IS NULL
    OR length(p_step) NOT BETWEEN 1 AND 300 OR btrim(p_step)=''
    OR p_title IS NULL OR btrim(p_title)='' OR length(p_title)>200
    OR length(coalesce(p_body,''))>2000 OR jsonb_typeof(p_rules) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Configuração de notificação inválida.' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_rules) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Informe de um a dez seletores de destinatários.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO wf FROM public.workflows
    WHERE id=p_workflow AND enabled AND status='published' AND published_version=p_version
      AND entity=p_entity FOR SHARE;
  IF wf.id IS NULL THEN
    RAISE EXCEPTION 'Workflow indisponível ou versão desatualizada.' USING ERRCODE='42501';
  END IF;
  w:=wf.workspace_id;executor:=coalesce(wf.execution_user_id,wf.owner_id);
  SELECT * INTO run FROM public.workflow_runs
    WHERE id=p_run AND workflow_id=p_workflow AND workspace_id=w
      AND entity=p_entity AND entity_id=p_record AND status='running' AND NOT is_test
      AND owner_id=wf.owner_id FOR UPDATE;
  IF run.id IS NULL OR NOT public.is_workspace_member(w,executor) THEN
    RAISE EXCEPTION 'Execução de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO ev FROM public.workflow_events
    WHERE id=run.event_id AND workspace_id=w AND entity=p_entity AND entity_id=p_record;
  IF ev.id IS NULL OR (ev.workflow_version IS NOT NULL AND ev.workflow_version<>p_version)
    OR NOT public.sales_worker_authorize('workflows',p_workflow,
      jsonb_build_array(jsonb_build_object('workflow_version',p_version),
        CASE WHEN p_entity IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities')
          THEN jsonb_build_object('table',p_entity,'id',p_record,'action','view')
          ELSE jsonb_build_object('record_table',p_entity,'id',p_record) END))
    OR NOT techerp_api.notification_source_visible(w,executor,p_entity,p_record) THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  IF(channels?'email' OR fallback='email') AND NOT techerp_api.notification_transport_allowed(w,executor,'email')
   OR channels?'whatsapp' AND NOT techerp_api.notification_transport_allowed(w,executor,'whatsapp') THEN
   RAISE EXCEPTION 'Executor sem permissão atual para o canal externo.' USING ERRCODE='42501';END IF;
  resolved_event:=techerp_api.notification_business_run_key(p_workflow,p_run,p_version);
  IF resolved_event IS NULL THEN RAISE EXCEPTION 'Ocorrência de notificação sem prova válida.' USING ERRCODE='42501';END IF;
  -- p_entity has passed the exact table allowlist in the private source bridge.
  EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 AND workspace_id=$2',p_entity)
    INTO source USING p_record,w;
  IF source IS NULL THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;

  FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    IF jsonb_typeof(rule) IS DISTINCT FROM 'object'
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(rule) k WHERE k NOT IN('kind','id')) THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    kind:=rule->>'kind';rule_id:=NULL;selected:='{}';
    IF kind IS NULL OR kind NOT IN('workflow_owner','user','source_responsible','source_creator',
      'area_manager','pending_approvers','project_members','team','job_role','followers') THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    IF kind IN('user','team','job_role') THEN
      IF coalesce(rule->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Identificador de destinatário inválido.' USING ERRCODE='22023';
      END IF;
      rule_id:=(rule->>'id')::uuid;
    ELSIF rule?'id' THEN
      RAISE EXCEPTION 'Seletor não aceita identificador manual.' USING ERRCODE='22023';
    END IF;
    CASE kind
      WHEN 'workflow_owner' THEN selected:=ARRAY[executor];
      WHEN 'user' THEN selected:=ARRAY[rule_id];
      WHEN 'source_creator' THEN
        -- owner_id is not universally a creator; never infer it when provenance is absent.
        selected:=ARRAY[nullif(source->>'created_by','')::uuid];
      WHEN 'source_responsible' THEN
        CASE p_entity
          WHEN 'tickets' THEN selected:=ARRAY[coalesce(nullif(source->>'assignee_id','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_jobs' THEN selected:=ARRAY[coalesce(nullif(source->>'recruiter_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_interviews' THEN selected:=ARRAY[coalesce(nullif(source->>'interviewer_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'project_tasks' THEN
            SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM (
              SELECT DISTINCT x FROM (
              SELECT nullif(source->>'assignee_id','')::uuid x
              UNION SELECT value::uuid FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(source->'assignee_ids')='array' THEN source->'assignee_ids' ELSE '[]'::jsonb END)
              ) ids WHERE x IS NOT NULL ORDER BY x LIMIT 201
            ) s;
          ELSE selected:=ARRAY[coalesce(nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
        END CASE;
      WHEN 'area_manager' THEN
        manager:=NULL;
        IF p_entity='people' THEN
          SELECT profile_id INTO manager FROM public.people m
            WHERE m.id=nullif(source->>'manager_id','')::uuid AND m.workspace_id=w
              AND NOT coalesce((to_jsonb(m)->>'archived')::boolean,false);
        ELSIF p_entity='deals' THEN
          leader:=techerp_api.notification_deal_leader(w,executor,p_record);
          IF leader->>'status'='ok' THEN manager:=nullif(leader->>'leader_id','')::uuid;
          ELSIF leader->>'status'='ambiguous' THEN issues:=array_append(issues,'recipient_source_ambiguous');
          END IF;
        ELSIF p_entity='ats_jobs' THEN
          SELECT * INTO policy FROM public.hiring_area_policies
            WHERE workspace_id=w AND area_id=nullif(source->>'hiring_area_id','')::uuid;
          IF EXISTS(SELECT 1 FROM public.hiring_demand_requests r
            WHERE r.workspace_id=w AND r.job_id=p_record AND r.revision=nullif(source->>'hiring_revision','')::integer) THEN
            -- Only the canonical request records who asked and which substitute was
            -- selected. The job creator is not necessarily that requester.
            SELECT s.approver_id INTO manager FROM public.hiring_demand_requests r
              JOIN public.hiring_demand_steps s ON s.request_id=r.id AND s.workspace_id=r.workspace_id
              WHERE r.workspace_id=w AND r.job_id=p_record
                AND r.revision=nullif(source->>'hiring_revision','')::integer
                AND r.policy_revision=policy.revision AND r.status IN('pending','approved')
                AND s.stage='manager' AND s.status IN('pending','approved');
          ELSE manager:=policy.manager_id;END IF;
        END IF;
        selected:=ARRAY[manager];
      WHEN 'pending_approvers' THEN
        IF p_entity='contracts' THEN
          SELECT coalesce(array_agg(DISTINCT approver_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_id FROM public.contract_approvals a WHERE a.workspace_id=w AND a.contract_id=p_record
              AND source->>'status'='in_review'
              AND a.status='pending' AND a.superseded_at IS NULL AND a.approver_id IS NOT NULL
              AND techerp_api.notification_contract_approver(w,a.approver_id,a.id)
              AND a.sort_order=(SELECT min(b.sort_order) FROM public.contract_approvals b
                WHERE b.workspace_id=w AND b.contract_id=p_record AND b.status='pending' AND b.superseded_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM public.contract_approvals prior
                WHERE prior.workspace_id=w AND prior.contract_id=p_record AND prior.superseded_at IS NULL
                  AND prior.sort_order<a.sort_order AND prior.status<>'approved')
            ORDER BY a.approver_id LIMIT 201
          ) pending;
        ELSE
          SELECT coalesce(array_agg(DISTINCT approver_user_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_user_id FROM public.workflow_approvals a
              JOIN public.workflow_runs pending_run ON pending_run.id=a.run_id
                AND pending_run.workflow_id=a.workflow_id AND pending_run.workspace_id=a.workspace_id
                AND pending_run.entity=a.entity AND pending_run.entity_id=a.entity_id
                AND pending_run.status='waiting_approval' AND NOT pending_run.is_test
              WHERE a.workspace_id=w AND a.workflow_id=p_workflow
              AND a.workflow_version=p_version AND a.entity=p_entity AND a.entity_id=p_record
              AND a.status='pending' AND a.approver_user_id IS NOT NULL
              AND public.sales_workflow_approval_recipient(p_workflow,a.approver_user_id,p_entity,p_record,p_version)
            ORDER BY a.approver_user_id LIMIT 201
          ) pending;
        END IF;
      WHEN 'project_members' THEN
        source_project:=CASE WHEN p_entity='projects' THEN p_record
          WHEN p_entity IN('project_tasks','project_milestones') THEN nullif(source->>'project_id','')::uuid END;
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.project_members m JOIN public.projects p
            ON p.id=m.project_id AND p.workspace_id=m.workspace_id
            WHERE m.workspace_id=w AND p.id=source_project AND p.workspace_id=w
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'team' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_group_members m JOIN public.user_groups g ON g.id=m.group_id
            WHERE g.id=rule_id AND g.workspace_id=w ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'job_role' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_job_roles m JOIN public.job_roles r ON r.id=m.role_id
            WHERE r.id=rule_id AND m.workspace_id=w AND (r.workspace_id IS NULL OR r.workspace_id=w)
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'followers' THEN issues:=array_append(issues,'followers_unavailable');
    END CASE;
    SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM unnest(selected) x WHERE x IS NOT NULL;
    IF cardinality(selected)=0 AND kind<>'followers' THEN
      issues:=array_append(issues,'recipient_source_unavailable');
    END IF;
    recipients:=recipients||selected;
  END LOOP;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO recipients FROM unnest(recipients) x WHERE x IS NOT NULL;
  candidate_count:=cardinality(recipients);
  IF candidate_count>200 THEN
    RETURN jsonb_build_object('sent',0,'candidates',candidate_count,'excluded',candidate_count,
      'issues',jsonb_build_array('recipient_limit_exceeded'),'duplicate',0);
  END IF;

  -- Never render the executor's snapshot into a different user's notification.
  IF strpos(p_title,'{{')>0 OR strpos(coalesce(p_body,''),'{{')>0 THEN
    title:='Atualização no TechERP';body:='Acesse o registro para consultar os detalhes.';
  ELSE title:=p_title;body:=p_body;
  END IF;
  href:=CASE p_entity
    WHEN 'leads' THEN '/leads/'||p_record WHEN 'contacts' THEN '/contacts/'||p_record
    WHEN 'companies' THEN '/companies/'||p_record WHEN 'deals' THEN '/deals/'||p_record
    WHEN 'tickets' THEN '/tickets/'||p_record WHEN 'ats_jobs' THEN '/ats/jobs/'||p_record
    WHEN 'ats_candidates' THEN '/candidates/'||p_record WHEN 'people' THEN '/people/'||p_record
    WHEN 'projects' THEN '/projects/'||p_record
    WHEN 'project_tasks' THEN '/projects/tasks?taskId='||p_record
    WHEN 'contracts' THEN '/contracts/'||p_record
    WHEN 'financial_entries' THEN '/finance/entries/'||p_record WHEN 'services' THEN '/services/'||p_record
    WHEN 'proposals' THEN '/proposals/'||p_record ELSE NULL END;
  FOREACH recipient IN ARRAY recipients LOOP
    IF NOT public.is_workspace_member(w,recipient)
      OR NOT techerp_api.notification_source_visible(w,recipient,p_entity,p_record) THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    SELECT notification_preferences INTO prefs FROM public.profiles WHERE id=recipient;
    IF NOT FOUND THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    intent_id:=NULL;
    INSERT INTO public.notification_delivery_intents(workspace_id,workflow_id,run_id,workflow_version,step_path,
     source_table,source_id,recipient_user_id,event_key,delivery_config,payload_content_neutral)
    VALUES(w,p_workflow,p_run,p_version,p_step,p_entity,p_record,recipient,resolved_event,config,
     jsonb_build_object('title','Atualização no TechERP','body','Consulte a central de notificações do TechERP.','href',href))
    ON CONFLICT(workspace_id,run_id,step_path,recipient_user_id) DO NOTHING RETURNING id INTO intent_id;
    intent_existed:=intent_id IS NULL;
    IF intent_existed THEN
     SELECT id INTO intent_id FROM public.notification_delivery_intents WHERE workspace_id=w AND run_id=p_run AND step_path=p_step
      AND recipient_user_id=recipient AND workflow_id=p_workflow AND workflow_version=p_version AND source_table=p_entity AND source_id=p_record
      AND delivery_config=config AND event_key=resolved_event;
     IF intent_id IS NULL THEN RAISE EXCEPTION 'A ocorrência já possui outra configuração.' USING ERRCODE='22023';END IF;
    END IF;
    FOR requested_channel IN SELECT value#>>'{}' FROM jsonb_array_elements(channels) LOOP
     IF requested_channel='inapp' THEN CONTINUE;END IF;
     job_id:=NULL;
     INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,
      next_attempt_at,notification_intent_id)
     VALUES(w,p_workflow,'nfd:'||intent_id||':'||requested_channel,p_step,requested_channel,'user:'||recipient,'queued',0,now(),intent_id)
     ON CONFLICT(notification_intent_id,channel) WHERE notification_intent_id IS NOT NULL DO NOTHING RETURNING id INTO job_id;
     IF job_id IS NOT NULL THEN queued_count:=queued_count+1;END IF;
    END LOOP;
    inapp:=channels?'inapp' AND public.notification_event_inapp(w,recipient,resolved_event);
    IF inapp THEN
     dedupe:='workflow-notification:'||p_run||':'||p_step||':'||recipient;created:=NULL;
     INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
      VALUES(w,executor,recipient,'workflow',title,body,href,p_entity,p_record,dedupe)
      ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id INTO created;
     IF created IS NOT NULL THEN UPDATE public.notification_workspace_context SET event_key=resolved_event WHERE notification_id=created AND workspace_id=w;sent_count:=sent_count+1;
     ELSE SELECT id INTO created FROM public.notifications WHERE dedupe_key=dedupe;
      IF created IS NOT NULL THEN duplicate_count:=duplicate_count+1;
      ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'notification_not_created');END IF;
     END IF;
     IF created IS NOT NULL THEN UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;END IF;
    ELSE
     IF channels?'inapp' THEN excluded_count:=excluded_count+1;issues:=array_append(issues,'preferences_disabled');END IF;
     IF intent_existed THEN duplicate_count:=duplicate_count+1;END IF;
    END IF;
  END LOOP;
  IF sent_count=0 AND duplicate_count=0 AND queued_count=0 AND cardinality(issues)=0 THEN
    issues:=ARRAY['no_eligible_recipients'];
  END IF;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO issues FROM unnest(issues) x;
  RETURN jsonb_build_object('sent',sent_count,'candidates',candidate_count,'excluded',excluded_count,
    'issues',to_jsonb(issues),'duplicate',duplicate_count,'queued',queued_count,'suppressed',0);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_intent_context(p_intent uuid,p_channel text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;wf public.workflows;r public.workflow_runs;executor uuid;
 p public.notification_delivery_policies;c public.notification_delivery_consents;email text;phone text;quiet timestamptz;
 href text; resolved_event text;
BEGIN
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_intent;
 IF i.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=i.workflow_id AND workspace_id=i.workspace_id
  AND status='published' AND enabled AND published_version=i.workflow_version AND entity=i.source_table;
 IF wf.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 SELECT * INTO r FROM public.workflow_runs WHERE id=i.run_id AND workflow_id=wf.id AND workspace_id=i.workspace_id
  AND entity=i.source_table AND entity_id=i.source_id AND owner_id=wf.owner_id AND NOT is_test
  AND status NOT IN('failed','cancelled','canceled','error');
 IF r.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','run_unavailable');END IF;
 resolved_event:=techerp_api.notification_business_run_key(i.workflow_id,i.run_id,i.workflow_version);
 IF resolved_event IS NULL OR i.event_key IS DISTINCT FROM resolved_event THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 executor:=coalesce(wf.execution_user_id,wf.owner_id);
 IF NOT public.is_workspace_member(i.workspace_id,executor) OR NOT public.is_workspace_member(i.workspace_id,i.recipient_user_id)
 OR NOT techerp_api.notification_source_visible(i.workspace_id,executor,i.source_table,i.source_id)
 OR NOT techerp_api.notification_source_visible(i.workspace_id,i.recipient_user_id,i.source_table,i.source_id)
 OR NOT public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',i.workflow_version),
 CASE WHEN i.source_table IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities')
 THEN jsonb_build_object('table',i.source_table,'id',i.source_id,'action','view')
 ELSE jsonb_build_object('record_table',i.source_table,'id',i.source_id)END)) THEN
  RETURN jsonb_build_object('allowed',false,'reason','recipient_unavailable');END IF;
 IF NOT techerp_api.notification_transport_allowed(i.workspace_id,executor,p_channel) THEN
  RETURN jsonb_build_object('allowed',false,'reason','executor_transport_forbidden');END IF;
 SELECT * INTO p FROM public.notification_delivery_policies WHERE workspace_id=i.workspace_id;
 IF p_channel='whatsapp' AND EXISTS(SELECT 1 FROM public.notification_whatsapp_health h WHERE h.workspace_id=i.workspace_id
  AND h.paused_until='infinity'::timestamptz AND(NOT coalesce(p.whatsapp_enabled,false) OR h.connection_id IN(
   SELECT n.connection_id FROM public.wa_cloud_numbers n WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id))) THEN
  RETURN jsonb_build_object('allowed',false,'reason','provider_rate_limited');END IF;
 IF p.workspace_id IS NULL OR(p_channel='email' AND NOT p.email_enabled) OR(p_channel='whatsapp' AND NOT p.whatsapp_enabled) THEN
  RETURN jsonb_build_object('allowed',false,'reason','policy_disabled');END IF;
 IF p_channel='email' THEN
  IF NOT techerp_api.notification_external_event_preference(i.workspace_id,i.recipient_user_id,'email',i.event_key) THEN
   RETURN jsonb_build_object('allowed',false,'reason','preferences_disabled');END IF;
  SELECT u.email INTO email FROM auth.users u WHERE u.id=i.recipient_user_id AND u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL AND length(u.email)<=320 AND strpos(u.email,'@')>1;
  IF email IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','email_unconfirmed');END IF;
 ELSIF p_channel='whatsapp' THEN
  SELECT p2.phone INTO phone FROM public.profiles p2 WHERE id=i.recipient_user_id;
  SELECT * INTO c FROM public.notification_delivery_consents WHERE workspace_id=i.workspace_id AND user_id=i.recipient_user_id;
  IF c.user_id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','consent_missing');END IF;
  IF c.revoked_at IS NOT NULL OR c.granted_at IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','consent_revoked');END IF;
  IF phone IS NULL OR phone !~ '^\+[1-9][0-9]{7,14}$' OR phone IS DISTINCT FROM c.phone THEN
   RETURN jsonb_build_object('allowed',false,'reason','endpoint_changed');END IF;
  IF p.wa_sender_id IS NULL OR p.wa_template_name IS NULL OR p.wa_template_language IS NULL
   OR p.wa_estimated_unit_micros<=0 OR p.wa_daily_budget_micros<p.wa_estimated_unit_micros THEN
   RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n JOIN public.wa_cloud_connections connection ON connection.id=n.connection_id AND connection.workspace_id=n.workspace_id
    WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id AND n.available AND n.status='CONNECTED'
     AND connection.enabled AND connection.webhook_verified_at IS NOT NULL) THEN
   RETURN jsonb_build_object('allowed',false,'reason','sender_unavailable');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id
    AND upper(coalesce(n.quality_rating,'')) IN('GREEN','HIGH')) THEN
   RETURN jsonb_build_object('allowed',false,'reason','provider_rate_limited');END IF;
  IF EXISTS(SELECT 1 FROM public.whatsapp_number_suppressions s WHERE s.workspace_id=i.workspace_id
   AND s.phone_key=public.wa_phone_key(phone) AND s.released_at IS NULL AND s.expires_at>now()) THEN
   RETURN jsonb_build_object('allowed',false,'reason','recipient_suppressed');END IF;
  IF NOT techerp_api.notification_whatsapp_event_preference(i.workspace_id,i.recipient_user_id,i.event_key) THEN
   RETURN jsonb_build_object('allowed',false,'reason','preferences_disabled');END IF;
 ELSE RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 quiet:=techerp_api.notification_quiet_until(i.workspace_id,i.recipient_user_id);
 IF quiet='infinity'::timestamptz THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_preferences');END IF;
 IF quiet IS NOT NULL THEN RETURN jsonb_build_object('allowed',false,'reason','quiet_hours','nextAttemptAt',quiet);END IF;
 href:=i.payload_content_neutral->>'href';
 RETURN jsonb_build_object('allowed',true,'workspaceId',i.workspace_id,'workflowId',i.workflow_id,'runId',i.run_id,
  'recipientId',i.recipient_user_id,'email',email,'phone',phone,'senderPhoneNumberId',CASE WHEN p_channel='whatsapp' THEN p.wa_sender_id END,
  'templateName',CASE WHEN p_channel='whatsapp' THEN p.wa_template_name END,'templateLanguage',CASE WHEN p_channel='whatsapp' THEN p.wa_template_language END,
  'policyRevision',p.revision,'consentRevision',CASE WHEN p_channel='whatsapp' THEN c.revision END,
  'endpointHash',encode(sha256(convert_to(p_channel||':'||coalesce(email,phone),'UTF8')),'hex'),
  'source',jsonb_build_object('table',i.source_table,'id',i.source_id,'href',href));
END $$;

CREATE OR REPLACE FUNCTION public.notification_workflow_slack_dispatch(p_workspace uuid,p_workflow uuid,p_run uuid,p_step_path text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;r public.workflow_runs;p public.notification_slack_policies;s public.slack_integrations;i uuid;created uuid;c jsonb; resolved_event text;
BEGIN
 PERFORM techerp_api.notification_service();
 IF p_version IS NULL OR p_version<1 OR p_step_path IS NULL OR length(p_step_path) NOT BETWEEN 1 AND 300 OR btrim(p_step_path)='' THEN
 RAISE EXCEPTION 'Etapa Slack inválida.' USING ERRCODE='22023';END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=p_workflow AND workspace_id=p_workspace AND status='published' AND enabled AND published_version=p_version FOR SHARE;
 SELECT * INTO r FROM public.workflow_runs WHERE id=p_run AND workflow_id=p_workflow AND workspace_id=p_workspace
 AND entity=wf.entity AND owner_id=wf.owner_id AND status='running' AND NOT is_test FOR UPDATE;
 IF wf.id IS NULL OR r.id IS NULL THEN RAISE EXCEPTION 'Execução Slack indisponível.' USING ERRCODE='42501';END IF;
 resolved_event:=techerp_api.notification_business_run_key(wf.id,r.id,p_version);
 IF resolved_event IS NULL THEN RAISE EXCEPTION 'Ocorrência Slack sem prova válida.' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.notification_slack_policies WHERE workspace_id=p_workspace;
 IF p.workspace_id IS NULL OR NOT p.enabled OR p.integration_id IS NULL THEN RETURN jsonb_build_object('result','suppressed','reason','policy_disabled');END IF;
 SELECT * INTO s FROM public.slack_integrations WHERE id=p.integration_id AND workspace_id=p_workspace;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Integração Slack indisponível.' USING ERRCODE='42501';END IF;
 INSERT INTO public.notification_slack_intents(workspace_id,workflow_id,run_id,workflow_version,step_path,source_table,source_id,integration_id,endpoint_revision,endpoint_hash,policy_revision,event_key)
 VALUES(p_workspace,wf.id,r.id,wf.published_version,p_step_path,r.entity,r.entity_id,p.integration_id,s.notification_endpoint_revision,encode(sha256(convert_to(s.access_token,'UTF8')),'hex'),p.revision,resolved_event)
 ON CONFLICT(workspace_id,run_id,workflow_version,step_path,integration_id) DO NOTHING RETURNING id INTO i;
 IF i IS NULL THEN SELECT id INTO i FROM public.notification_slack_intents WHERE workspace_id=p_workspace AND run_id=r.id
 AND workflow_version=wf.published_version AND step_path=p_step_path AND integration_id=p.integration_id;END IF;
 c:=techerp_api.notification_slack_context(i);
 IF NOT coalesce((c->>'allowed')::boolean,false) THEN RAISE EXCEPTION 'Canal ou origem Slack indisponível: %.',c->>'reason' USING ERRCODE='42501';END IF;
 INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,status,attempts,notification_slack_intent_id)
 VALUES(p_workspace,wf.id,'notification-slack:'||p_workspace||':'||r.id||':'||wf.published_version||':'||p_step_path||':'||p.integration_id,p_step_path,'slack','queued',0,i)
 ON CONFLICT(notification_slack_intent_id,channel) WHERE notification_slack_intent_id IS NOT NULL DO NOTHING RETURNING id INTO created;
 RETURN jsonb_build_object('result',CASE WHEN created IS NULL THEN 'duplicate' ELSE 'queued' END,'deliveryId',coalesce(created,(SELECT id FROM public.workflow_deliveries WHERE notification_slack_intent_id=i AND channel='slack')));
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_slack_context(p_intent uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_slack_intents;wf public.workflows;r public.workflow_runs;ev public.workflow_events;
 p public.notification_slack_policies;s public.slack_integrations;executor uuid;matches integer; resolved_event text;
BEGIN
 SELECT * INTO i FROM public.notification_slack_intents WHERE id=p_intent;
 IF i.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=i.workflow_id AND workspace_id=i.workspace_id AND enabled AND status='published'
 AND published_version=i.workflow_version AND entity=i.source_table;
 IF wf.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 SELECT * INTO r FROM public.workflow_runs WHERE id=i.run_id AND workflow_id=wf.id AND workspace_id=i.workspace_id
 AND entity=i.source_table AND entity_id=i.source_id AND owner_id=wf.owner_id AND NOT is_test AND status NOT IN('failed','cancelled','canceled','error');
 SELECT * INTO ev FROM public.workflow_events WHERE id=r.event_id AND workspace_id=i.workspace_id AND entity=i.source_table AND entity_id=i.source_id
 AND(workflow_version IS NULL OR workflow_version=i.workflow_version);
 executor:=coalesce(wf.execution_user_id,wf.owner_id);
 IF r.id IS NULL OR ev.id IS NULL OR NOT public.is_workspace_member(i.workspace_id,executor)
 OR NOT techerp_api.notification_source_visible(i.workspace_id,executor,i.source_table,i.source_id)
 OR NOT public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',i.workflow_version),
 CASE WHEN i.source_table IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities') THEN jsonb_build_object('table',i.source_table,'id',i.source_id,'action','view')
 ELSE jsonb_build_object('record_table',i.source_table,'id',i.source_id) END)) THEN
 RETURN jsonb_build_object('allowed',false,'reason','executor_unavailable');END IF;
 resolved_event:=techerp_api.notification_business_run_key(wf.id,r.id,i.workflow_version);
 IF resolved_event IS NULL OR i.event_key IS DISTINCT FROM resolved_event THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 SELECT count(*) INTO matches FROM techerp_api.notification_slack_actions(wf.actions) a WHERE a.step_path=i.step_path
 AND a.action->>'type'='send_slack' AND nullif(btrim(a.action->>'channel'),'') IS NULL;
 IF matches=0 THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 SELECT * INTO p FROM public.notification_slack_policies WHERE workspace_id=i.workspace_id;
 IF p.workspace_id IS NULL OR NOT p.enabled OR p.integration_id IS DISTINCT FROM i.integration_id THEN
 RETURN jsonb_build_object('allowed',false,'reason','policy_disabled');END IF;
 SELECT * INTO s FROM public.slack_integrations WHERE id=i.integration_id AND workspace_id=i.workspace_id;
 IF p.revision IS DISTINCT FROM i.policy_revision OR s.notification_endpoint_revision IS DISTINCT FROM i.endpoint_revision
 OR encode(sha256(convert_to(s.access_token,'UTF8')),'hex') IS DISTINCT FROM i.endpoint_hash THEN
 RETURN jsonb_build_object('allowed',false,'reason','endpoint_changed');END IF;
 IF s.id IS NULL OR nullif(btrim(s.access_token),'') IS NULL OR NOT techerp_api.notification_slack_integration_access(i.workspace_id,executor,s.id,true) THEN
 RETURN jsonb_build_object('allowed',false,'reason','executor_transport_forbidden');END IF;
 RETURN jsonb_build_object('allowed',true,'workspaceId',i.workspace_id,'workflowId',i.workflow_id,'runId',i.run_id,
 'integrationId',s.id,'endpointRevision',s.notification_endpoint_revision,
 'endpointHash',encode(sha256(convert_to(s.access_token,'UTF8')),'hex'),'policyRevision',p.revision,'templateVersion',p.template_version);
END $$;

CREATE OR REPLACE FUNCTION public.notification_center_list(p_workspace uuid,p_scope text DEFAULT 'workspace',
 p_status text DEFAULT 'all',p_category text DEFAULT NULL,p_q text DEFAULT '',p_cursor jsonb DEFAULT NULL,
 p_cutoff timestamptz DEFAULT NULL,p_module text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);cutoff timestamptz:=coalesce(p_cutoff,statement_timestamp());
 cursor_at timestamptz;cursor_id uuid;pattern text;result jsonb;BEGIN
 IF p_scope IS NULL OR p_scope NOT IN('workspace','legacy') OR p_status IS NULL
  OR p_status NOT IN('all','unread','read','snoozed') OR p_q IS NULL OR length(p_q)>120
  OR (p_category IS NOT NULL AND p_category NOT IN('mention','assignment','deal_stage','ticket','task','sla','message',
   'workflow','approval','hiring','form','portfolio','platform')) OR cutoff>statement_timestamp()+interval '1 second' THEN
  RAISE EXCEPTION 'Filtro de notificações inválido.' USING ERRCODE='22023';END IF;
 IF p_module IS NOT NULL AND p_module NOT IN('crm','ats','people','contracts','projects','finance') THEN
  RAISE EXCEPTION 'Módulo de notificações inválido.' USING ERRCODE='22023';END IF;
 IF p_cursor IS NOT NULL AND p_cursor<>'null'::jsonb THEN
  IF p_cutoff IS NULL OR jsonb_typeof(p_cursor)<>'object'
   OR NOT p_cursor?'createdAt' OR NOT p_cursor?'id'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cursor)k WHERE k NOT IN('createdAt','id')) THEN
   RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END IF;
  BEGIN cursor_at:=(p_cursor->>'createdAt')::timestamptz;cursor_id:=(p_cursor->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END;
  IF cursor_at IS NULL OR cursor_id IS NULL OR cursor_at>cutoff THEN
   RAISE EXCEPTION 'Cursor de notificações inválido.' USING ERRCODE='22023';END IF;
 END IF;
 pattern:='%'||replace(replace(replace(btrim(p_q),'\','\\'),'%','\%'),'_','\_')||'%';
 WITH candidates AS NOT MATERIALIZED (
  SELECT n.*,c.source_table,c.source_id,c.event_key AS proven_event_key,c.workspace_id AS proven_workspace FROM public.notifications n
  LEFT JOIN public.notification_workspace_context c ON c.notification_id=n.id
  WHERE n.user_id=u AND n.created_at<=cutoff
   AND ((p_scope='workspace' AND c.workspace_id=p_workspace AND n.workspace_id=c.workspace_id AND n.entity_id=c.source_id)
    OR (p_scope='legacy' AND c.notification_id IS NULL))
   AND (p_category IS NULL OR coalesce(techerp_api.notification_business_category(c.event_key),techerp_api.notification_center_category(n.type))=p_category)
   AND (p_module IS NULL OR (p_scope='workspace' AND techerp_api.notification_business_module(c.event_key,p_workspace,u,c.source_table,c.source_id)=p_module))
   AND (btrim(p_q)='' OR (p_scope='workspace' AND (n.title ILIKE pattern ESCAPE '\' OR n.body ILIKE pattern ESCAPE '\')))
 ),page AS MATERIALIZED (
  SELECT * FROM candidates n WHERE
   (p_scope='legacy' OR techerp_api.notification_center_source_visible(p_workspace,u,n.source_table,n.source_id))
   AND (p_status='snoozed' AND n.snoozed_until>statement_timestamp()
    OR p_status<>'snoozed' AND (n.snoozed_until IS NULL OR n.snoozed_until<=statement_timestamp())
     AND (p_status='all' OR p_status='unread' AND n.read_at IS NULL OR p_status='read' AND n.read_at IS NOT NULL))
   AND (cursor_at IS NULL OR (n.created_at,n.id)<(cursor_at,cursor_id))
  ORDER BY created_at DESC,id DESC LIMIT 31
 ),unread AS (
  SELECT 1 FROM candidates n WHERE n.read_at IS NULL
   AND (n.snoozed_until IS NULL OR n.snoozed_until<=statement_timestamp())
   AND (p_scope='legacy' OR techerp_api.notification_center_source_visible(p_workspace,u,n.source_table,n.source_id)) LIMIT 100
 ),items AS (SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 30),last_item AS (
  SELECT created_at,id FROM items ORDER BY created_at,id LIMIT 1
 ) SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',id,'type',type,'eventKey',coalesce(proven_event_key,'legacy.'||type),'title',CASE WHEN p_scope='legacy' THEN 'Notificação do histórico pessoal' ELSE title END,
   'body',CASE WHEN p_scope='legacy' THEN 'Este aviso não possui origem de workspace comprovada. Consulte seus registros no TechERP.' ELSE body END,
   'link',CASE WHEN p_scope='legacy' THEN NULL ELSE link END,
   'entity',CASE WHEN p_scope='legacy' THEN NULL ELSE entity END,
   'entity_id',CASE WHEN p_scope='legacy' THEN NULL ELSE entity_id END,
   'moduleKey',CASE WHEN p_scope='legacy' THEN NULL ELSE techerp_api.notification_business_module(proven_event_key,p_workspace,u,source_table,source_id) END,
   'created_at',created_at,'read_at',read_at,'snoozed_until',snoozed_until
  ) ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
  'unread',(SELECT count(*) FROM unread),'unreadCapped',(SELECT count(*)=100 FROM unread),
  'nextCursor',CASE WHEN (SELECT count(*) FROM page)>30 THEN
   (SELECT jsonb_build_object('createdAt',created_at,'id',id) FROM last_item) ELSE NULL END,'cutoff',cutoff) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.notification_center_lookup(p_workspace uuid,p_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);result jsonb;BEGIN
 IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 30 OR coalesce(array_ndims(p_ids),0)<>1 THEN
  RAISE EXCEPTION 'Selecione de um a trinta avisos.' USING ERRCODE='22023';END IF;
 IF array_position(p_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Selecione de um a trinta avisos.' USING ERRCODE='22023';END IF;
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object(
  'id',n.id,'type',n.type,'eventKey',coalesce(c.event_key,'legacy.'||n.type),'title',n.title,'body',n.body,'link',n.link,'entity',n.entity,'entity_id',n.entity_id,
  'moduleKey',techerp_api.notification_business_module(c.event_key,p_workspace,u,c.source_table,c.source_id),
  'created_at',n.created_at,'read_at',n.read_at,'snoozed_until',n.snoozed_until
 ) ORDER BY n.created_at DESC,n.id DESC),'[]'::jsonb),'checkedAt',statement_timestamp()) INTO result
 FROM public.notifications n JOIN public.notification_workspace_context c ON c.notification_id=n.id
 WHERE n.id=ANY(p_ids) AND n.user_id=u AND n.workspace_id=p_workspace AND c.workspace_id=p_workspace
  AND n.entity_id=c.source_id AND n.created_at<=statement_timestamp()
  AND techerp_api.notification_center_source_visible(p_workspace,u,c.source_table,c.source_id);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.notification_delivery_history_personal_v1(p_workspace uuid,p_cursor jsonb DEFAULT NULL,p_status text DEFAULT NULL,
 p_channel text DEFAULT NULL,p_scope text DEFAULT 'own') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);c jsonb:=public.work_access_context();at timestamptz;item uuid;result jsonb;BEGIN
 IF p_scope IS NULL OR p_scope NOT IN('own','workspace') OR (p_scope='workspace' AND NOT(c->'keys'?'system.notification_deliveries.view.workspace')) THEN
  RAISE EXCEPTION 'Sem permissão para este histórico.' USING ERRCODE='42501';END IF;
 IF p_channel IS NOT NULL AND p_channel NOT IN('inapp','email','whatsapp') OR p_status IS NOT NULL AND p_status NOT IN('available','queued','in_flight','sent','retry_scheduled','failed','uncertain','deduped','accepted','delivered','read','suppressed') THEN
  RAISE EXCEPTION 'Filtro inválido.' USING ERRCODE='22023';END IF;
 IF p_cursor IS NOT NULL AND p_cursor<>'null'::jsonb THEN
  IF jsonb_typeof(p_cursor)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cursor) k WHERE k NOT IN('createdAt','id')) THEN
   RAISE EXCEPTION 'Cursor inválido.' USING ERRCODE='22023';END IF;
  BEGIN at:=(p_cursor->>'createdAt')::timestamptz;item:=(p_cursor->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Cursor inválido.' USING ERRCODE='22023';END;
  IF at IS NULL OR item IS NULL THEN RAISE EXCEPTION 'Cursor inválido.' USING ERRCODE='22023';END IF;
 END IF;
 WITH matched AS NOT MATERIALIZED(
  SELECT d.id,d.channel,d.status,d.reason_code,d.attempts,d.created_at,d.updated_at,i.recipient_user_id,i.workflow_id,d.provider_id,i.event_key
  FROM public.workflow_deliveries d JOIN public.notification_delivery_intents i ON i.id=d.notification_intent_id
  WHERE i.workspace_id=p_workspace AND(p_scope='workspace' OR i.recipient_user_id=u)
   AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id)
  UNION ALL
  SELECT n.id,'inapp',CASE WHEN n.read_at IS NULL THEN 'available' ELSE 'read' END,NULL::text,0,
   n.created_at,coalesce(n.read_at,n.created_at),i.recipient_user_id,i.workflow_id,NULL::text,i.event_key
  FROM public.notification_delivery_intents i JOIN public.notifications n ON n.id=i.notification_id AND n.user_id=i.recipient_user_id
  WHERE i.workspace_id=p_workspace AND(p_scope='workspace' OR i.recipient_user_id=u)
   AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id)
 ),page AS MATERIALIZED(SELECT * FROM matched WHERE(p_channel IS NULL OR channel=p_channel)
 AND(p_status IS NULL OR status=p_status) AND(at IS NULL OR(created_at,id)<(at,item))
 ORDER BY created_at DESC,id DESC LIMIT 51),items AS(SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 50)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'channel',channel,'status',status,'eventKey',event_key,
 'reason_code',reason_code,'attempts',attempts,'created_at',created_at,'updated_at',updated_at,'workflow_id',workflow_id,'provider_id',provider_id,
 'recipient_user_id',CASE WHEN recipient_user_id=u OR p_scope='workspace' THEN recipient_user_id END,
 'recipient_name',CASE WHEN recipient_user_id=u THEN 'Você' ELSE 'Destinatário do workflow' END)
 ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
 'nextCursor',CASE WHEN(SELECT count(*) FROM page)>50 THEN(SELECT jsonb_build_object('createdAt',created_at,'id',id)
 FROM items ORDER BY created_at,id LIMIT 1)ELSE NULL END) INTO result;RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.notification_delivery_history(p_workspace uuid,p_cursor jsonb DEFAULT NULL,p_status text DEFAULT NULL,
 p_channel text DEFAULT NULL,p_scope text DEFAULT 'own') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);original jsonb;result jsonb;at timestamptz;item uuid;BEGIN
 -- The original function remains authoritative for scope, status and cursor validation.
 original:=public.notification_delivery_history_personal_v1(p_workspace,p_cursor,p_status,CASE WHEN p_channel='slack' THEN NULL ELSE p_channel END,p_scope);
 IF p_scope='own' THEN
 IF p_channel='slack' THEN RETURN jsonb_build_object('items','[]'::jsonb,'nextCursor',NULL);END IF;RETURN original;END IF;
 IF p_channel IS NOT NULL AND p_channel<>'slack' THEN RETURN original;END IF;
 IF p_cursor IS NOT NULL AND p_cursor<>'null'::jsonb THEN at:=(p_cursor->>'createdAt')::timestamptz;item:=(p_cursor->>'id')::uuid;END IF;
 WITH slack_items AS MATERIALIZED(
 SELECT jsonb_build_object('id',d.id,'channel','slack','status',d.status,'reason_code',d.reason_code,'attempts',d.attempts,
 'created_at',d.created_at,'updated_at',d.updated_at,'workflow_id',i.workflow_id,'eventKey',i.event_key,'provider_id',NULL,
 'recipient_user_id',NULL,'recipient_name','Canal Slack do workspace') payload,d.created_at,d.id
 FROM public.workflow_deliveries d JOIN public.notification_slack_intents i ON i.id=d.notification_slack_intent_id
 WHERE i.workspace_id=p_workspace AND public.notification_delivery_visible(d.id)
 AND(p_status IS NULL OR d.status=p_status) AND(at IS NULL OR(d.created_at,d.id)<(at,item))
 ORDER BY d.created_at DESC,d.id DESC LIMIT 51
 ),matched AS(
 SELECT payload,created_at,id FROM slack_items
 UNION ALL SELECT x,(x->>'created_at')::timestamptz,(x->>'id')::uuid
 FROM jsonb_array_elements(original->'items')x WHERE p_channel IS NULL
 ),page AS MATERIALIZED(SELECT * FROM matched ORDER BY created_at DESC,id DESC LIMIT 51),items AS(
 SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 50)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(payload ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
 'nextCursor',CASE WHEN(SELECT count(*)>50 FROM page) OR(p_channel IS NULL AND original->'nextCursor'<>'null'::jsonb)
 THEN(SELECT jsonb_build_object('createdAt',created_at,'id',id) FROM items ORDER BY created_at,id LIMIT 1) ELSE NULL END) INTO result;
 RETURN result;
END $$;

-- An opt-out specific to WhatsApp does not opt into email. Only a rule whose
-- owner explicitly chose email fallback may queue it, and its claim rechecks
-- that recipient's email preference and the ordinary email authorization.
CREATE OR REPLACE FUNCTION techerp_api.notification_fallback(p_intent uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;BEGIN
 IF p_reason IS NULL OR p_reason NOT IN('policy_disabled','sender_unavailable','invalid_template','invalid_configuration','provider_rejected',
 'recipient_suppressed','consent_missing','executor_transport_forbidden','quota_exceeded','budget_exceeded','budget_currency_changed','provider_permanent','preferences_disabled') THEN RETURN;END IF;
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_intent;
 IF i.delivery_config->>'fallback'<>'email' THEN RETURN;END IF;
 INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,next_attempt_at,notification_intent_id,reason_code)
 VALUES(i.workspace_id,i.workflow_id,'nfd:'||i.id||':email',i.step_path,'email','user:'||i.recipient_user_id,'queued',0,now(),i.id,'fallback_pending')
 ON CONFLICT(notification_intent_id,channel) WHERE notification_intent_id IS NOT NULL DO NOTHING;
END $$;

NOTIFY pgrst,'reload schema';
