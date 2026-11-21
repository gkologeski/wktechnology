-- NOTIFICA-CENTRAL P9. Project occurrences reuse the existing private proof,
-- Workflow queue/tick and delivery ledger. No channel, rule or grant is enabled.
ALTER TABLE public.notification_business_event_proofs
 DROP CONSTRAINT notification_business_event_proofs_source_table_check;
ALTER TABLE public.notification_business_event_proofs
 ADD CONSTRAINT notification_business_event_proofs_source_table_check
 CHECK(source_table IN('deals','proposals','contracts','projects','project_tasks','project_milestones'));
CREATE INDEX notification_project_due_window ON public.projects(workspace_id,due_at,id) WHERE due_at IS NOT NULL;
CREATE INDEX notification_project_task_due_window ON public.project_tasks(workspace_id,due_at,id) WHERE due_at IS NOT NULL;
CREATE INDEX notification_project_milestone_due_window ON public.project_milestones(workspace_id,due_at,id) WHERE due_at IS NOT NULL;

CREATE OR REPLACE FUNCTION techerp_api.notification_business_category(p_key text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT CASE
 WHEN p_key IN('crm.deal.won','crm.deal.lost','crm.deal.stage_changed') THEN 'deal_stage'
 WHEN p_key IN('crm.proposal.accepted','contracts.signature.completed','projects.project.started') THEN 'workflow'
 WHEN p_key='contracts.draft.accepted' THEN 'approval'
 WHEN p_key IN('contracts.contract.expiring','contracts.contract.renewal_due','projects.project.overdue','projects.task.overdue','projects.milestone.due') THEN 'task' END $$;

-- All newly inserted project events, including the unchanged generic producer
-- and future resumes, share the cost boundary. INSERT-only preserves historical
-- rows/proofs; alphabetical trigger order runs before business_guard/resume.
CREATE FUNCTION techerp_api.notification_project_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$ BEGIN
 IF NEW.entity='projects' THEN NEW.before:=NEW.before-'planned_cost';NEW.after:=NEW.after-'planned_cost';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_project_snapshot() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_a_project_snapshot BEFORE INSERT ON public.workflow_events
 FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_project_snapshot();

CREATE OR REPLACE FUNCTION techerp_api.notification_business_emit(p_workspace uuid,p_key text,p_entity text,p_source uuid,
 p_producer_table text,p_producer uuid,p_occurrence text,p_before jsonb DEFAULT NULL,
 p_reference uuid DEFAULT NULL,p_revision text DEFAULT NULL,p_workflow uuid DEFAULT NULL,p_version integer DEFAULT NULL,
 p_due date DEFAULT NULL,p_days integer DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE source jsonb;event public.workflow_events;existing uuid;owner uuid;BEGIN
 IF techerp_api.notification_business_category(p_key) IS NULL OR p_entity NOT IN('deals','proposals','contracts','projects','project_tasks','project_milestones')
 OR p_workspace IS NULL OR p_source IS NULL OR p_producer IS NULL OR p_occurrence IS NULL
 OR public.is_read_only_view() OR public.is_test_record(p_source) THEN RETURN NULL;END IF;
 EXECUTE format('SELECT to_jsonb(s) FROM public.%I s WHERE id=$1 AND workspace_id=$2',p_entity) INTO source USING p_source,p_workspace;
 IF source IS NULL OR nullif(source->>'deleted_at','') IS NOT NULL THEN RETURN NULL;END IF;
 -- Project cost is separately projected by work_cost_projection. It cannot
 -- enter a shared event snapshot, including the old row, even for a cost reader.
 IF p_entity='projects' THEN source:=source-'planned_cost';p_before:=p_before-'planned_cost';END IF;
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

-- A custom status is authoritative by its category and exact tenant/list
-- binding. An orphan/unknown category never turns a completed task into overdue.
CREATE FUNCTION techerp_api.notification_project_task_open(p_task public.project_tasks) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF p_task.id IS NULL OR p_task.status::text NOT IN('todo','doing','review') THEN RETURN false;END IF;
 IF p_task.custom_status_id IS NULL THEN RETURN true;END IF;
 RETURN EXISTS(SELECT 1 FROM public.project_task_statuses s WHERE s.id=p_task.custom_status_id
  AND s.workspace_id=p_task.workspace_id AND s.list_id=p_task.list_id AND s.category IN('todo','doing'));
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_project_task_open(public.project_tasks) FROM PUBLIC,anon,authenticated,service_role;

-- Starts are real transitions, never an imported/created active row or a resume.
CREATE FUNCTION techerp_api.notification_project_started_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR OLD.status::text IS DISTINCT FROM 'planning'
 OR NEW.status::text IS DISTINCT FROM 'active' OR public.is_read_only_view() OR public.is_test_record(NEW.id) THEN RETURN NEW;END IF;
 PERFORM techerp_api.notification_business_emit(NEW.workspace_id,'projects.project.started','projects',NEW.id,
  'projects',NEW.id,NEW.id||':'||txid_current(),to_jsonb(OLD));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_project_started_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_project_started AFTER UPDATE OF status ON public.projects
 FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_project_started_capture();

CREATE OR REPLACE FUNCTION techerp_api.notification_business_proof_current(p public.notification_business_event_proofs)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE draft public.contract_drafts;contract public.contracts;project public.projects;task public.project_tasks;
 milestone public.project_milestones;deadline date;today date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;BEGIN
 IF p.event_id IS NULL OR public.is_test_record(p.source_id) THEN RETURN false;END IF;
 IF p.event_key IN('projects.project.started','projects.project.overdue') THEN
  SELECT * INTO project FROM public.projects WHERE id=p.source_id AND workspace_id=p.workspace_id;
  IF project.id IS NULL THEN RETURN false;END IF;
  IF p.event_key='projects.project.started' THEN RETURN project.status::text='active';END IF;
  RETURN coalesce(project.status::text IN('planning','active') AND p.days_before=-1
   AND project.due_at=p.due_date AND project.due_at<today,false);
 ELSIF p.event_key='projects.task.overdue' THEN
  SELECT * INTO task FROM public.project_tasks WHERE id=p.source_id AND workspace_id=p.workspace_id;
  SELECT * INTO project FROM public.projects WHERE id=task.project_id AND workspace_id=p.workspace_id;
  RETURN coalesce(task.project_id=p.reference_id AND project.id IS NOT NULL
   AND project.status::text IN('planning','active','on_hold') AND techerp_api.notification_project_task_open(task)
   AND p.days_before=-1 AND task.due_at=p.due_date AND task.due_at<today,false);
 ELSIF p.event_key='projects.milestone.due' THEN
  SELECT * INTO milestone FROM public.project_milestones WHERE id=p.source_id AND workspace_id=p.workspace_id;
  SELECT * INTO project FROM public.projects WHERE id=milestone.project_id AND workspace_id=p.workspace_id;
  RETURN coalesce(milestone.project_id=p.reference_id AND project.id IS NOT NULL
   AND project.status::text IN('planning','active','on_hold') AND milestone.status::text IN('pending','in_progress')
   AND milestone.completed_at IS NULL AND milestone.due_at=p.due_date AND p.days_before BETWEEN 1 AND 365
   AND today BETWEEN milestone.due_at-p.days_before AND milestone.due_at,false);
 ELSIF p.event_key='contracts.draft.accepted' THEN
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

CREATE OR REPLACE FUNCTION public.notification_business_event_check(p_event uuid,p_workflow uuid,p_version integer) RETURNS boolean
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
 IF proof.event_key IN('contracts.contract.expiring','contracts.contract.renewal_due','projects.milestone.due') THEN
  IF jsonb_typeof(config->'days_before') IS DISTINCT FROM 'number' OR coalesce(config->>'days_before','') !~ '^[0-9]{1,3}$'
   OR(config->>'days_before')::integer NOT BETWEEN 1 AND 365 OR (config->>'days_before')::integer IS DISTINCT FROM proof.days_before THEN RETURN false;END IF;
 ELSIF proof.event_key IN('projects.project.overdue','projects.task.overdue') THEN
  IF config?'days_before' OR proof.days_before IS DISTINCT FROM -1 OR proof.due_date IS NULL
   OR ((proof.due_date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')<wf.last_published_at THEN RETURN false;END IF;
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

-- The existing persistent cursor's historical contract_id column stores the
-- source UUID; event_key binds its table. -1 means overdue, never a public offset.
-- A later tick may recover a crossing after publication, but cannot backfill a
-- crossing that predates publication. All dates use the same Brazilian calendar.
CREATE OR REPLACE FUNCTION public.notification_business_due_tick(p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;candidate record;config jsonb;key text;entity text;query text;offset_days integer;
 today date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;occurrence text;event uuid;enqueued integer:=0;candidates integer:=0;BEGIN
 PERFORM techerp_api.notification_service();
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Limite de eventos inválido.' USING ERRCODE='22023';END IF;
 FOR wf IN SELECT w.* FROM public.workflows w WHERE w.enabled AND w.status='published' AND w.last_published_at IS NOT NULL
  AND NOT(w.trigger?'time_based') AND w.entity IN('contracts','projects','project_tasks','project_milestones')
  AND w.trigger#>>'{notification_event,key}' IN('contracts.contract.expiring','contracts.contract.renewal_due',
   'projects.project.overdue','projects.task.overdue','projects.milestone.due')
  ORDER BY md5(w.id::text||date_trunc('minute',now())::text) LIMIT 200 LOOP
  IF candidates>=p_limit THEN RETURN jsonb_build_object('enqueued',enqueued);END IF;
  config:=wf.trigger->'notification_event';key:=config->>'key';
  entity:=CASE WHEN key IN('contracts.contract.expiring','contracts.contract.renewal_due') THEN 'contracts'
   WHEN key='projects.project.overdue' THEN 'projects' WHEN key='projects.task.overdue' THEN 'project_tasks'
   WHEN key='projects.milestone.due' THEN 'project_milestones' END;
  IF wf.entity IS DISTINCT FROM entity OR jsonb_typeof(config) IS DISTINCT FROM 'object'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(config) k WHERE k NOT IN('key','days_before')) THEN CONTINUE;END IF;
  IF key IN('projects.project.overdue','projects.task.overdue') THEN
   IF config?'days_before' THEN CONTINUE;END IF;offset_days:=-1;
  ELSE
   IF jsonb_typeof(config->'days_before') IS DISTINCT FROM 'number' OR coalesce(config->>'days_before','') !~ '^[0-9]{1,3}$' THEN CONTINUE;END IF;
   offset_days:=(config->>'days_before')::integer;IF offset_days NOT BETWEEN 1 AND 365 THEN CONTINUE;END IF;
  END IF;
  IF NOT public.is_workspace_member(wf.workspace_id,coalesce(wf.execution_user_id,wf.owner_id))
   OR NOT public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',wf.published_version))) THEN CONTINUE;END IF;
  query:=CASE entity
   WHEN 'contracts' THEN $query$
    SELECT c.id,CASE WHEN $2='contracts.contract.renewal_due' THEN c.ends_at-c.notice_days ELSE c.ends_at END AS due_date,NULL::uuid AS reference_id
    FROM public.contracts c WHERE c.workspace_id=$1 AND c.status IN('active','renewing') AND c.ends_at IS NOT NULL
     AND (($2='contracts.contract.expiring' AND c.ends_at BETWEEN $4 AND $4+$3)
      OR ($2='contracts.contract.renewal_due' AND c.auto_renew AND c.notice_days BETWEEN 0 AND 3650 AND c.ends_at-c.notice_days BETWEEN $4 AND $4+$3))
     AND NOT EXISTS(SELECT 1 FROM public.notification_business_due_cursors d WHERE d.workflow_id=$6 AND d.contract_id=c.id
      AND d.event_key=$2 AND d.days_before=$3 AND d.due_date=CASE WHEN $2='contracts.contract.renewal_due' THEN c.ends_at-c.notice_days ELSE c.ends_at END)
    ORDER BY md5(c.id::text||date_trunc('minute',now())::text) LIMIT $5 $query$
   WHEN 'projects' THEN $query$
    SELECT p.id,p.due_at AS due_date,NULL::uuid AS reference_id FROM public.projects p
    WHERE p.workspace_id=$1 AND p.status IN('planning','active') AND p.due_at<$4
     AND ((p.due_at+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')>=$7
     AND NOT EXISTS(SELECT 1 FROM public.notification_business_due_cursors d WHERE d.workflow_id=$6 AND d.contract_id=p.id
      AND d.event_key=$2 AND d.days_before=$3 AND d.due_date=p.due_at)
    ORDER BY md5(p.id::text||date_trunc('minute',now())::text) LIMIT $5 $query$
   WHEN 'project_tasks' THEN $query$
    SELECT t.id,t.due_at AS due_date,t.project_id AS reference_id FROM public.project_tasks t
    JOIN public.projects p ON p.id=t.project_id AND p.workspace_id=t.workspace_id
    LEFT JOIN public.project_task_statuses s ON s.id=t.custom_status_id AND s.workspace_id=t.workspace_id AND s.list_id=t.list_id
    WHERE t.workspace_id=$1 AND p.status IN('planning','active','on_hold') AND t.status IN('todo','doing','review') AND t.due_at<$4
     AND (t.custom_status_id IS NULL OR s.category IN('todo','doing'))
     AND ((t.due_at+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')>=$7
     AND NOT EXISTS(SELECT 1 FROM public.notification_business_due_cursors d WHERE d.workflow_id=$6 AND d.contract_id=t.id
      AND d.event_key=$2 AND d.days_before=$3 AND d.due_date=t.due_at)
    ORDER BY md5(t.id::text||date_trunc('minute',now())::text) LIMIT $5 $query$
   WHEN 'project_milestones' THEN $query$
    SELECT m.id,m.due_at AS due_date,m.project_id AS reference_id FROM public.project_milestones m
    JOIN public.projects p ON p.id=m.project_id AND p.workspace_id=m.workspace_id
    WHERE m.workspace_id=$1 AND p.status IN('planning','active','on_hold') AND m.status IN('pending','in_progress')
     AND m.completed_at IS NULL AND m.due_at BETWEEN $4 AND $4+$3
     AND NOT EXISTS(SELECT 1 FROM public.notification_business_due_cursors d WHERE d.workflow_id=$6 AND d.contract_id=m.id
      AND d.event_key=$2 AND d.days_before=$3 AND d.due_date=m.due_at)
    ORDER BY md5(m.id::text||date_trunc('minute',now())::text) LIMIT $5 $query$ END;
  FOR candidate IN EXECUTE query USING wf.workspace_id,key,offset_days,today,p_limit-candidates,wf.id,wf.last_published_at LOOP
   candidates:=candidates+1;
   IF public.is_test_record(candidate.id) OR NOT public.sales_worker_authorize('workflows',wf.id,
    jsonb_build_array(jsonb_build_object('workflow_version',wf.published_version),jsonb_build_object('record_table',entity,'id',candidate.id)))
    OR NOT techerp_api.notification_source_visible(wf.workspace_id,coalesce(wf.execution_user_id,wf.owner_id),entity,candidate.id) THEN CONTINUE;END IF;
   occurrence:=wf.id||':'||candidate.id||':'||candidate.due_date||':'||offset_days;
   event:=techerp_api.notification_business_emit(wf.workspace_id,key,entity,candidate.id,entity,candidate.id,occurrence,NULL,
    candidate.reference_id,candidate.due_date::text,wf.id,wf.published_version,candidate.due_date,offset_days);
   IF event IS NOT NULL THEN enqueued:=enqueued+1;END IF;
   IF candidates>=p_limit THEN RETURN jsonb_build_object('enqueued',enqueued);END IF;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('enqueued',enqueued);
END $$;


-- Canonical milestone destinations. This helper is private delegation only:
-- dispatch has already checked the executor and each recipient, and central
-- projections retain their source-visibility gate. No client supplies a URL.
CREATE FUNCTION techerp_api.notification_project_milestone_href(p_workspace uuid,p_milestone uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE parent uuid;BEGIN
 IF p_workspace IS NULL OR p_milestone IS NULL THEN RETURN NULL;END IF;
 SELECT m.project_id INTO parent FROM public.project_milestones m
 JOIN public.projects p ON p.id=m.project_id AND p.workspace_id=m.workspace_id
 WHERE m.id=p_milestone AND m.workspace_id=p_workspace;
 IF parent IS NULL THEN RETURN NULL;END IF;
 RETURN '/projects/'||parent||'?tab=milestones&milestoneId='||p_milestone;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_project_milestone_href(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Replace the existing bodies with identical source, recipient and delivery
-- controls, adding only the destination of project milestones. Existing OIDs,
-- owners and EXECUTE ACLs are retained by CREATE OR REPLACE.


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
    WHEN 'project_milestones' THEN techerp_api.notification_project_milestone_href(w,p_record)
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
    WHEN 'project_milestones' THEN techerp_api.notification_project_milestone_href(w,p_record)
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
   'link',CASE WHEN p_scope='legacy' THEN NULL WHEN source_table='project_milestones' THEN techerp_api.notification_project_milestone_href(p_workspace,source_id) ELSE link END,
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
  'id',n.id,'type',n.type,'eventKey',coalesce(c.event_key,'legacy.'||n.type),'title',n.title,'body',n.body,'link',CASE WHEN c.source_table='project_milestones' THEN techerp_api.notification_project_milestone_href(p_workspace,c.source_id) ELSE n.link END,'entity',n.entity,'entity_id',n.entity_id,
  'moduleKey',techerp_api.notification_business_module(c.event_key,p_workspace,u,c.source_table,c.source_id),
  'created_at',n.created_at,'read_at',n.read_at,'snoozed_until',n.snoozed_until
 ) ORDER BY n.created_at DESC,n.id DESC),'[]'::jsonb),'checkedAt',statement_timestamp()) INTO result
 FROM public.notifications n JOIN public.notification_workspace_context c ON c.notification_id=n.id
 WHERE n.id=ANY(p_ids) AND n.user_id=u AND n.workspace_id=p_workspace AND c.workspace_id=p_workspace
  AND n.entity_id=c.source_id AND n.created_at<=statement_timestamp()
  AND techerp_api.notification_center_source_visible(p_workspace,u,c.source_table,c.source_id);
 RETURN result;
END $$;

NOTIFY pgrst,'reload schema';
