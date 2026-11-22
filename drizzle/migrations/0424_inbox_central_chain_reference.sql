CREATE FUNCTION techerp_api.inbox_proof_chain_current(p_event uuid,p_workflow uuid,p_version integer)
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
   OR ROW(p.workspace_id,p.event_key,p.source_table,p.source_id,p.producer_table,p.producer_id,p.reference_id,p.source_revision,p.occurrence_key,p.occurred_at,p.due_date,p.days_before,p.root_event_id)
    IS DISTINCT FROM ROW(rp.workspace_id,rp.event_key,rp.source_table,rp.source_id,rp.producer_table,rp.producer_id,rp.reference_id,rp.source_revision,rp.occurrence_key,rp.occurred_at,rp.due_date,rp.days_before,rp.event_id)
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
REVOKE ALL ON FUNCTION techerp_api.inbox_proof_chain_current(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.notification_business_event_check(p_event uuid,p_workflow uuid,p_version integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e record;
BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO e FROM public.workflow_events WHERE id=p_event;
 IF NOT FOUND THEN RETURN false; END IF;
 IF techerp_api.inbox_event_channel(e.notification_event_key) IS NULL THEN
  RETURN public.notification_business_event_check_before_inbox_channels(p_event,p_workflow,p_version);
 END IF;
 RETURN techerp_api.inbox_proof_chain_current(p_event,p_workflow,p_version);
END $$;
CREATE OR REPLACE FUNCTION public.sales_event_reference_access(e text,i uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE t text; w uuid:=(public.sales_access_context()->>'workspace')::uuid;
BEGIN
 IF e='inbox_channel_occurrences' THEN RETURN EXISTS(SELECT 1 FROM public.inbox_channel_occurrences WHERE id=i AND workspace_id=w); END IF;
 IF e='whatsapp_messages' THEN RETURN EXISTS(SELECT 1 FROM public.whatsapp_messages m JOIN public.whatsapp_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id WHERE m.id=i AND m.workspace_id=w); END IF;
 IF e='hiring_fiscal_documents' THEN RETURN public.notification_fiscal_reference_access(i); END IF;
 IF e='proposals' THEN RETURN public.sales_record_access('proposals',i,'view'); END IF;
 IF e IN('lead','leads','contact','contacts','company','companies','deal','deals','ticket','tickets') THEN
  t:=CASE e WHEN 'lead' THEN 'leads' WHEN 'contact' THEN 'contacts' WHEN 'company' THEN 'companies' WHEN 'deal' THEN 'deals' WHEN 'ticket' THEN 'tickets' ELSE e END;
  RETURN public.sales_record_access(t,i,'view');
 END IF;
 IF i IS NULL OR w IS NULL THEN RETURN false; END IF;
 RETURN CASE e
  WHEN 'ats_jobs' THEN EXISTS(SELECT 1 FROM public.ats_jobs WHERE id=i AND workspace_id=w)
  WHEN 'ats_candidates' THEN EXISTS(SELECT 1 FROM public.ats_candidates WHERE id=i AND workspace_id=w)
  WHEN 'ats_applications' THEN EXISTS(SELECT 1 FROM public.ats_applications WHERE id=i AND workspace_id=w)
  WHEN 'ats_interviews' THEN EXISTS(SELECT 1 FROM public.ats_interviews WHERE id=i AND workspace_id=w)
  WHEN 'ats_offers' THEN EXISTS(SELECT 1 FROM public.ats_offers WHERE id=i AND workspace_id=w)
  WHEN 'people_documents' THEN EXISTS(SELECT 1 FROM public.people_documents WHERE id=i AND workspace_id=w)
  WHEN 'hiring_preparation_requests' THEN EXISTS(SELECT 1 FROM public.hiring_preparation_requests WHERE id=i AND workspace_id=w)
  WHEN 'people' THEN EXISTS(SELECT 1 FROM public.people WHERE id=i AND workspace_id=w)
  WHEN 'projects' THEN EXISTS(SELECT 1 FROM public.projects WHERE id=i AND workspace_id=w)
  WHEN 'project_tasks' THEN EXISTS(SELECT 1 FROM public.project_tasks WHERE id=i AND workspace_id=w)
  WHEN 'project_milestones' THEN EXISTS(SELECT 1 FROM public.project_milestones WHERE id=i AND workspace_id=w)
  WHEN 'contracts' THEN EXISTS(SELECT 1 FROM public.contracts WHERE id=i AND workspace_id=w)
  WHEN 'financial_entries' THEN EXISTS(SELECT 1 FROM public.financial_entries WHERE id=i AND workspace_id=w)
  WHEN 'bank_payments' THEN EXISTS(SELECT 1 FROM public.bank_payments WHERE id=i AND workspace_id=w)
  WHEN 'financial_recurrences' THEN EXISTS(SELECT 1 FROM public.financial_recurrences WHERE id=i AND workspace_id=w)
  WHEN 'legal_entities' THEN EXISTS(SELECT 1 FROM public.legal_entities WHERE id=i AND workspace_id=w)
  WHEN 'customer_invoices' THEN EXISTS(SELECT 1 FROM public.customer_invoices WHERE id=i AND workspace_id=w)
  WHEN 'subscription_invoices' THEN EXISTS(SELECT 1 FROM public.subscription_invoices WHERE id=i AND workspace_id=w)
  ELSE false END;
END $$;
NOTIFY pgrst,'reload schema';
