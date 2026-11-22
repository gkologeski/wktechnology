CREATE TEMP TABLE inbox_capture_preservation ON COMMIT DROP AS SELECT p.oid,to_jsonb(p)-'prosrc' AS metadata,coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid=p.oid) OR (d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid)),'[]') AS dependencies FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='techerp_api' AND p.proname='notification_business_resume_capture';
CREATE TEMP TABLE inbox_chat_policy_preservation ON COMMIT DROP AS SELECT p.oid,to_jsonb(p)-'polwithcheck' AS metadata FROM pg_policy p WHERE p.polrelid='public.live_chat_messages'::regclass AND p.polname='chat_scope_insert_live_chat_messages';
CREATE OR REPLACE FUNCTION techerp_api.notification_business_resume_capture()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
 OR (techerp_api.inbox_event_channel(proof.event_key) IS NOT NULL AND (root_proof.occurred_at IS NULL OR proof.occurred_at IS DISTINCT FROM root_proof.occurred_at OR techerp_api.inbox_proof_chain_current(parent.id,wf.id,NEW.workflow_version) IS NOT TRUE))
 OR NEW.before IS DISTINCT FROM parent.before THEN RAISE EXCEPTION 'Retomada sem prova de origem.' USING ERRCODE='42501';END IF;
 INSERT INTO public.notification_business_event_proofs(event_id,root_event_id,workspace_id,event_key,source_table,source_id,producer_table,producer_id,
  reference_id,source_revision,occurrence_key,payload_hash,workflow_id,workflow_version,due_date,days_before,parent_event_id,resume_cursor,occurred_at)
 VALUES(NEW.id,proof.root_event_id,proof.workspace_id,proof.event_key,proof.source_table,proof.source_id,proof.producer_table,proof.producer_id,
  proof.reference_id,proof.source_revision,'resume:'||parent.id||':'||wf.id||':'||NEW.workflow_version||':'||NEW.resume_cursor,
  techerp_api.notification_business_event_hash(NEW),wf.id,NEW.workflow_version,proof.due_date,proof.days_before,parent.id,NEW.resume_cursor,(CASE WHEN techerp_api.inbox_event_channel(proof.event_key) IS NOT NULL THEN root_proof.occurred_at END))
 ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN NEW;
END $$;
-- Exact published 0122 predicate. Keep policy, role list and all other restrictive/deny policies.
ALTER POLICY chat_scope_insert_live_chat_messages ON public.live_chat_messages
WITH CHECK (
  public.is_platform_admin(auth.uid())
  OR (direction = 'outbound' AND author_user_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.live_chat_sessions s
                   WHERE s.id = live_chat_messages.session_id
                     AND s.workspace_id = live_chat_messages.workspace_id
                     AND (s.workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.create.workspace'))
                          OR (s.workspace_id IN (SELECT public.my_perm_workspaces('techsales.inbox.chat.create.own'))
                              AND s.assignee_id = auth.uid()))))
);
DO $$ BEGIN
 IF (SELECT count(*) FROM inbox_capture_preservation)<>1 OR (SELECT count(*) FROM inbox_chat_policy_preservation)<>1 THEN RAISE EXCEPTION 'Missing preservation target.'; END IF;
 IF EXISTS(SELECT 1 FROM inbox_capture_preservation s LEFT JOIN pg_proc p ON p.oid=s.oid WHERE p.oid IS NULL OR s.metadata IS DISTINCT FROM to_jsonb(p)-'prosrc' OR s.dependencies IS DISTINCT FROM coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid=p.oid) OR (d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid)),'[]')) THEN RAISE EXCEPTION 'Function OID/ACL/dependency/security metadata changed.'; END IF;
 IF EXISTS(SELECT 1 FROM inbox_chat_policy_preservation s LEFT JOIN pg_policy p ON p.oid=s.oid WHERE p.oid IS NULL OR s.metadata IS DISTINCT FROM to_jsonb(p)-'polwithcheck') THEN RAISE EXCEPTION 'Policy OID/roles/command/restrictiveness changed.'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
