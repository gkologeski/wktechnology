CREATE TEMP TABLE inbox_chain_preservation ON COMMIT DROP AS SELECT p.oid,to_jsonb(p)-'prosrc' AS metadata,coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid=p.oid) OR (d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid)),'[]') AS dependencies FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='techerp_api' AND p.proname='inbox_proof_chain_current';
CREATE OR REPLACE FUNCTION techerp_api.inbox_proof_chain_current(p_event uuid,p_workflow uuid,p_version integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e record; p record; root record; rp record; w record; a record; o record;
 cursor_id uuid:=p_event; visited uuid[]:='{}'; snapshot jsonb;
BEGIN
 SELECT * INTO w FROM public.workflows WHERE id=p_workflow;
 IF NOT FOUND THEN RETURN false; END IF;
 IF techerp_api.inbox_configuration_current(w.id,coalesce(w.execution_user_id,w.owner_id),w.workspace_id) IS NOT TRUE
  OR w.published_version IS DISTINCT FROM p_version THEN RETURN false; END IF;
 SELECT * INTO p FROM public.notification_business_event_proofs WHERE event_id=p_event;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO rp FROM public.notification_business_event_proofs WHERE event_id=p.root_event_id;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO root FROM public.workflow_events WHERE id=rp.event_id;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO o FROM public.inbox_channel_occurrences WHERE id=rp.source_id AND workspace_id=w.workspace_id;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO a FROM public.inbox_workflow_activations WHERE workflow_id=w.id AND workspace_id=w.workspace_id AND workflow_version=p_version;
 IF NOT FOUND THEN RETURN false; END IF;
 snapshot:=techerp_api.inbox_snapshot(o.id);
 IF rp.root_event_id IS DISTINCT FROM rp.event_id OR rp.parent_event_id IS NOT NULL OR root.notification_parent_event_id IS NOT NULL
  OR root.resume_workflow_id IS NOT NULL OR root.resume_cursor IS NOT NULL
  OR root.after IS DISTINCT FROM snapshot OR rp.due_date IS NOT NULL OR rp.days_before IS NOT NULL
  OR o.occurred_at<a.activated_at OR o.received_at<a.activated_at
  OR o.event_key IS DISTINCT FROM w.trigger#>>'{notification_event,key}'
  OR techerp_api.notification_business_proof_current(jsonb_populate_record(NULL::public.notification_business_event_proofs,to_jsonb(rp))) IS NOT TRUE
  OR (coalesce(w.trigger#>'{notification_event,account_ids}','[]')<>'[]' AND NOT(w.trigger#>'{notification_event,account_ids}' ? o.account_id::text)) THEN RETURN false; END IF;
 LOOP
  IF cursor_id IS NULL OR cursor_id=ANY(visited) OR cardinality(visited)>=100 THEN RETURN false; END IF;
  visited:=array_append(visited,cursor_id);
  SELECT * INTO e FROM public.workflow_events WHERE id=cursor_id;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO p FROM public.notification_business_event_proofs WHERE event_id=cursor_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF ROW(p.workspace_id,p.source_table,p.source_id,p.event_key) IS DISTINCT FROM ROW(e.workspace_id,e.entity,e.entity_id,e.notification_event_key)
   OR ROW(p.workspace_id,p.event_key,p.source_table,p.source_id,p.producer_table,p.producer_id,p.reference_id,p.source_revision,p.occurred_at,p.due_date,p.days_before,p.root_event_id)
    IS DISTINCT FROM ROW(rp.workspace_id,rp.event_key,rp.source_table,rp.source_id,rp.producer_table,rp.producer_id,rp.reference_id,rp.source_revision,rp.occurred_at,rp.due_date,rp.days_before,rp.event_id)
   OR p.occurrence_key IS DISTINCT FROM (CASE WHEN p.event_id=rp.event_id THEN rp.occurrence_key ELSE 'resume:'||p.parent_event_id||':'||w.id||':'||p_version||':'||p.resume_cursor END)
   OR p.payload_hash IS DISTINCT FROM techerp_api.notification_business_event_hash(jsonb_populate_record(NULL::public.workflow_events,to_jsonb(e)))
   OR p.parent_event_id IS DISTINCT FROM e.notification_parent_event_id OR p.resume_cursor IS DISTINCT FROM e.resume_cursor
   OR (p.workflow_id IS NOT NULL AND (p.workflow_id IS DISTINCT FROM w.id OR p.workflow_version IS DISTINCT FROM p_version))
   OR (e.workflow_version IS NOT NULL AND e.workflow_version IS DISTINCT FROM p_version)
   OR (e.resume_workflow_id IS NOT NULL AND e.resume_workflow_id IS DISTINCT FROM w.id) THEN RETURN false; END IF;
  IF p.event_id=rp.event_id THEN EXIT; END IF;
  IF p.parent_event_id IS NULL OR p.workflow_id IS DISTINCT FROM w.id OR p.workflow_version IS DISTINCT FROM p_version
   OR e.resume_workflow_id IS DISTINCT FROM w.id OR p.resume_cursor IS NULL THEN RETURN false; END IF;
  cursor_id:=p.parent_event_id;
 END LOOP;
 RETURN techerp_api.inbox_subject_visible(w.workspace_id,coalesce(w.execution_user_id,w.owner_id),o.id)
  AND public.sales_worker_authorize('workflows',w.id,jsonb_build_array(jsonb_build_object('workflow_version',p_version),jsonb_build_object('record_table','inbox_channel_occurrences','id',o.id,'action','view')));
END $$;
DO $$ BEGIN
 IF (SELECT count(*) FROM inbox_chain_preservation)<>1 OR EXISTS(SELECT 1 FROM inbox_chain_preservation s LEFT JOIN pg_proc p ON p.oid=s.oid WHERE p.oid IS NULL OR s.metadata IS DISTINCT FROM to_jsonb(p)-'prosrc' OR s.dependencies IS DISTINCT FROM coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype) FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid=p.oid) OR (d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid)),'[]')) THEN RAISE EXCEPTION 'Function OID/ACL/dependency/security metadata changed.'; END IF;
END $$;
