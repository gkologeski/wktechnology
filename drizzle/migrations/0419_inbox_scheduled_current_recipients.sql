CREATE OR REPLACE FUNCTION techerp_api.notification_schedule_recipients(p_parent uuid,p_rule jsonb)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i record;wf record;ev record;p_workflow uuid;p_version integer;p_entity text;p_record uuid;p_rules jsonb;w uuid;executor uuid;source jsonb;rule jsonb;kind text;rule_id uuid;recipients uuid[]:='{}';selected uuid[];source_project uuid;manager uuid;leader jsonb;policy record;issues text[]:='{}';resolved_event text;
BEGIN
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_parent AND occurrence_kind='initial';
 IF NOT FOUND THEN RETURN '{}'::uuid[];END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=i.workflow_id AND workspace_id=i.workspace_id AND enabled AND status='published' AND published_version=i.workflow_version;
 IF NOT FOUND THEN RETURN '{}'::uuid[];END IF;
 SELECT e.* INTO ev FROM public.workflow_runs r JOIN public.workflow_events e ON e.id=r.event_id WHERE r.id=i.run_id;
 p_workflow:=i.workflow_id;p_version:=i.workflow_version;p_entity:=i.source_table;p_record:=i.source_id;p_rules:=jsonb_build_array(p_rule);w:=i.workspace_id;executor:=coalesce(wf.execution_user_id,wf.owner_id);resolved_event:=i.event_key;
 source:=techerp_api.notification_source_snapshot(p_entity,p_record,w);
 IF source IS NULL THEN RETURN '{}'::uuid[];END IF;
 IF p_entity='whatsapp_messages' THEN source:=jsonb_build_object('assigned_to',(SELECT c.assigned_to FROM public.whatsapp_messages m JOIN public.whatsapp_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id WHERE m.id=p_record AND m.workspace_id=w));END IF;
 FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
  IF jsonb_typeof(rule) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(rule) k WHERE k NOT IN('kind','id')) THEN RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';END IF;
  kind:=rule->>'kind';rule_id:=NULL;selected:='{}';
  IF kind IS NULL OR kind NOT IN('workflow_owner','user','source_responsible','source_creator','area_manager','pending_approvers','project_members','team','job_role','followers') THEN RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';END IF;
  IF kind IN('user','team','job_role') THEN
   IF coalesce(rule->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Identificador de destinatário inválido.' USING ERRCODE='22023';END IF;rule_id:=(rule->>'id')::uuid;
  ELSIF rule?'id' THEN RAISE EXCEPTION 'Seletor não aceita identificador manual.' USING ERRCODE='22023';END IF;
  CASE kind
   WHEN 'workflow_owner' THEN selected:=ARRAY[executor];WHEN 'user' THEN selected:=ARRAY[rule_id];
   WHEN 'source_creator' THEN selected:=ARRAY[CASE WHEN p_entity='hiring_fiscal_documents' THEN nullif(source->>'uploaded_by','')::uuid ELSE nullif(source->>'created_by','')::uuid END];
   WHEN 'source_responsible' THEN CASE p_entity
    WHEN 'inbox_channel_occurrences' THEN selected:=ARRAY[techerp_api.inbox_current_responsible(w,p_record)];
    WHEN 'hiring_fiscal_documents' THEN selected:=ARRAY[techerp_api.notification_finance_fiscal_responsible(w,p_record)];
    WHEN 'tickets' THEN selected:=ARRAY[coalesce(nullif(source->>'assignee_id','')::uuid,nullif(source->>'owner_id','')::uuid)];
    WHEN 'ats_jobs' THEN selected:=ARRAY[coalesce(nullif(source->>'recruiter_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
    WHEN 'ats_interviews' THEN selected:=ARRAY[coalesce(nullif(source->>'interviewer_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
    WHEN 'project_tasks' THEN SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM (SELECT DISTINCT x FROM (SELECT nullif(source->>'assignee_id','')::uuid x UNION SELECT value::uuid FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(source->'assignee_ids')='array' THEN source->'assignee_ids' ELSE '[]'::jsonb END)) ids WHERE x IS NOT NULL ORDER BY x LIMIT 201) s;
    ELSE selected:=ARRAY[coalesce(nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];END CASE;
   WHEN 'area_manager' THEN
    manager:=NULL;
    IF p_entity='people' THEN SELECT profile_id INTO manager FROM public.people m WHERE m.id=nullif(source->>'manager_id','')::uuid AND m.workspace_id=w AND NOT coalesce((to_jsonb(m)->>'archived')::boolean,false);
    ELSIF p_entity='deals' THEN leader:=techerp_api.notification_deal_leader(w,executor,p_record);IF leader->>'status'='ok' THEN manager:=nullif(leader->>'leader_id','')::uuid;ELSIF leader->>'status'='ambiguous' THEN issues:=array_append(issues,'recipient_source_ambiguous');END IF;
    ELSIF p_entity='ats_jobs' THEN SELECT * INTO policy FROM public.hiring_area_policies WHERE workspace_id=w AND area_id=nullif(source->>'hiring_area_id','')::uuid;
     IF EXISTS(SELECT 1 FROM public.hiring_demand_requests r WHERE r.workspace_id=w AND r.job_id=p_record AND r.revision=nullif(source->>'hiring_revision','')::integer) THEN SELECT s.approver_id INTO manager FROM public.hiring_demand_requests r JOIN public.hiring_demand_steps s ON s.request_id=r.id AND s.workspace_id=r.workspace_id WHERE r.workspace_id=w AND r.job_id=p_record AND r.revision=nullif(source->>'hiring_revision','')::integer AND r.policy_revision=policy.revision AND r.status IN('pending','approved') AND s.stage='manager' AND s.status IN('pending','approved');ELSE manager:=policy.manager_id;END IF;
    END IF;selected:=ARRAY[manager];
   WHEN 'pending_approvers' THEN
    IF resolved_event='people.approval.pending' THEN selected:=techerp_api.notification_hr_pending_approvers(ev.id);
    ELSIF p_entity='contracts' THEN SELECT coalesce(array_agg(DISTINCT approver_id),'{}') INTO selected FROM (SELECT DISTINCT a.approver_id FROM public.contract_approvals a WHERE a.workspace_id=w AND a.contract_id=p_record AND source->>'status'='in_review' AND a.status='pending' AND a.superseded_at IS NULL AND a.approver_id IS NOT NULL AND techerp_api.notification_contract_approver(w,a.approver_id,a.id) AND a.sort_order=(SELECT min(b.sort_order) FROM public.contract_approvals b WHERE b.workspace_id=w AND b.contract_id=p_record AND b.status='pending' AND b.superseded_at IS NULL) AND NOT EXISTS(SELECT 1 FROM public.contract_approvals prior WHERE prior.workspace_id=w AND prior.contract_id=p_record AND prior.superseded_at IS NULL AND prior.sort_order<a.sort_order AND prior.status<>'approved') ORDER BY a.approver_id LIMIT 201) pending;
    ELSE SELECT coalesce(array_agg(DISTINCT approver_user_id),'{}') INTO selected FROM (SELECT DISTINCT a.approver_user_id FROM public.workflow_approvals a JOIN public.workflow_runs pending_run ON pending_run.id=a.run_id AND pending_run.workflow_id=a.workflow_id AND pending_run.workspace_id=a.workspace_id AND pending_run.entity=a.entity AND pending_run.entity_id=a.entity_id AND pending_run.status='waiting_approval' AND NOT pending_run.is_test WHERE a.workspace_id=w AND a.workflow_id=p_workflow AND a.workflow_version=p_version AND a.entity=p_entity AND a.entity_id=p_record AND a.status='pending' AND a.approver_user_id IS NOT NULL AND public.sales_workflow_approval_recipient(p_workflow,a.approver_user_id,p_entity,p_record,p_version) ORDER BY a.approver_user_id LIMIT 201) pending;END IF;
   WHEN 'project_members' THEN source_project:=CASE WHEN p_entity='projects' THEN p_record WHEN p_entity IN('project_tasks','project_milestones') THEN nullif(source->>'project_id','')::uuid END;SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (SELECT DISTINCT m.user_id FROM public.project_members m JOIN public.projects p ON p.id=m.project_id AND p.workspace_id=m.workspace_id WHERE m.workspace_id=w AND p.id=source_project AND p.workspace_id=w ORDER BY m.user_id LIMIT 201) s;
   WHEN 'team' THEN SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (SELECT DISTINCT m.user_id FROM public.user_group_members m JOIN public.user_groups g ON g.id=m.group_id WHERE g.id=rule_id AND g.workspace_id=w ORDER BY m.user_id LIMIT 201) s;
   WHEN 'job_role' THEN SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (SELECT DISTINCT m.user_id FROM public.user_job_roles m JOIN public.job_roles r ON r.id=m.role_id WHERE r.id=rule_id AND m.workspace_id=w AND (r.workspace_id IS NULL OR r.workspace_id=w) ORDER BY m.user_id LIMIT 201) s;
   WHEN 'followers' THEN issues:=array_append(issues,'followers_unavailable');END CASE;
  SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM unnest(selected) x WHERE x IS NOT NULL;
  IF cardinality(selected)=0 AND kind<>'followers' THEN issues:=array_append(issues,'recipient_source_unavailable');END IF;recipients:=recipients||selected;
 END LOOP;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO recipients FROM unnest(recipients) x WHERE x IS NOT NULL;
 IF cardinality(recipients)>200 THEN RETURN '{}'::uuid[];END IF;
 IF p_entity='inbox_channel_occurrences' THEN
  SELECT coalesce(array_agg(u ORDER BY u),'{}') INTO recipients FROM unnest(recipients) u WHERE public.is_workspace_member(w,u) AND techerp_api.inbox_subject_visible(w,u,p_record);
 END IF;
 RETURN recipients;
END $$;
