-- INBOX-EXECUCAO: preserve canonical function identities and dependencies.
DO $capture$
DECLARE fingerprint jsonb;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl::text,'deps',
  (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]') FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid=p.oid) OR (d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid))) ORDER BY p.oid)
 INTO fingerprint FROM pg_proc p WHERE p.oid IN ('techerp_api.notification_schedule_recipients(uuid,jsonb)'::regprocedure,'public.notify_assigned_inbox_message()'::regprocedure);
 PERFORM set_config('app.inbox_execution_catalog',fingerprint::text,true);
END $capture$;
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
 -- This helper is private, but it must independently refuse stale Inbox proof/executors.
 IF p_entity='inbox_channel_occurrences' THEN
  IF ev.id IS NULL OR ROW(ev.workspace_id,ev.entity,ev.entity_id) IS DISTINCT FROM ROW(w,p_entity,p_record)
   OR ev.notification_event_key IS DISTINCT FROM resolved_event
   OR NOT EXISTS(SELECT 1 FROM public.workflow_runs r WHERE r.id=i.run_id AND r.workspace_id=w
     AND r.workflow_id=p_workflow AND r.owner_id=wf.owner_id AND r.entity=p_entity AND r.entity_id=p_record AND NOT r.is_test)
   OR techerp_api.inbox_proof_chain_current(ev.id,p_workflow,p_version) IS NOT TRUE THEN
   RETURN '{}'::uuid[];
  END IF;
 END IF;
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
CREATE OR REPLACE FUNCTION public.notify_assigned_inbox_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user_id uuid;v_workspace_id uuid;v_channel text;v_conversation_id uuid;v_sender text;v_body text;v_link text;v_preferences jsonb;v_is_active boolean;
 channel_key text;account uuid;
BEGIN
 IF NEW.direction IS DISTINCT FROM 'inbound' THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='whatsapp_messages' THEN
  SELECT c.assigned_to,coalesce(c.workspace_id,c.owner_id),c.id,c.contact_phone INTO v_user_id,v_workspace_id,v_conversation_id,v_sender FROM public.whatsapp_conversations c WHERE c.id=NEW.conversation_id;
  v_channel:='WhatsApp';v_body:=NEW.body;v_link:='/inbox/whatsapp?conversation='||NEW.conversation_id::text;
 ELSIF TG_TABLE_NAME='email_messages' THEN
  SELECT t.assigned_to,t.workspace_id,t.id,coalesce(NEW.from_name,NEW.from_email,t.subject,'Remetente'),t.account_id INTO v_user_id,v_workspace_id,v_conversation_id,v_sender,account FROM public.email_threads t WHERE t.id=NEW.thread_id AND t.workspace_id=NEW.workspace_id AND t.account_id=NEW.account_id;
  channel_key:='email';v_channel:='E-mail';v_body:=coalesce(NEW.snippet,NEW.body_text,NEW.subject);v_link:='/inbox/email?conversation='||v_conversation_id::text;
 ELSIF TG_TABLE_NAME='live_chat_messages' THEN
  SELECT s.assignee_id,s.workspace_id,s.id,coalesce(s.visitor_name,s.visitor_email,'Visitante') INTO v_user_id,v_workspace_id,v_conversation_id,v_sender FROM public.live_chat_sessions s WHERE s.id=NEW.session_id AND s.workspace_id=NEW.workspace_id;
  account:=v_workspace_id;channel_key:='chat';v_channel:='Chat ao vivo';v_body:=NEW.body;v_link:='/inbox/chat?conversation='||v_conversation_id::text;
 ELSE RETURN NEW;END IF;
 IF v_user_id IS NULL OR v_workspace_id IS NULL OR v_conversation_id IS NULL THEN RETURN NEW;END IF;
 -- Preserve the WhatsApp legacy branch; email/chat use active membership and real conversation RLS.
 IF channel_key IS NULL THEN
  SELECT EXISTS(SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id=v_workspace_id AND wm.user_id=v_user_id AND coalesce(wm.status,'active')<>'inactive'
    UNION ALL SELECT 1 FROM public.workspaces w WHERE w.id=v_workspace_id AND w.created_by=v_user_id) INTO v_is_active;
 ELSE
  v_is_active:=public.is_workspace_member(v_workspace_id,v_user_id);
  IF v_is_active THEN
   v_is_active:=techerp_api.inbox_subject_conversation_visible(v_workspace_id,v_user_id,channel_key,account,v_conversation_id);
  END IF;
 END IF;
 IF NOT coalesce(v_is_active,false) THEN RETURN NEW;END IF;
 SELECT p.notification_preferences INTO v_preferences FROM public.profiles p WHERE p.id=v_user_id;
 IF coalesce((v_preferences#>>'{message,inapp}')::boolean,true) IS NOT TRUE THEN RETURN NEW;END IF;
 IF channel_key IS NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(v_workspace_id::text||':'||v_user_id::text||':'||v_conversation_id::text,0));
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended('inbox-notice:'||v_workspace_id||':'||v_conversation_id||':'||v_user_id,0));
 END IF;
 IF EXISTS(SELECT 1 FROM public.notifications n WHERE n.workspace_id=v_workspace_id AND n.user_id=v_user_id AND n.read_at IS NULL
   AND ((n.type='message' AND n.entity='inbox_conversation' AND n.entity_id=v_conversation_id)
    OR (channel_key IS NOT NULL AND n.type='workflow' AND n.entity='inbox_channel_occurrences' AND EXISTS(
      SELECT 1 FROM public.inbox_channel_occurrences o JOIN public.notification_workspace_context c ON c.notification_id=n.id AND c.workspace_id=o.workspace_id AND c.source_table='inbox_channel_occurrences' AND c.source_id=o.id
      WHERE o.id=n.entity_id AND o.workspace_id=v_workspace_id AND o.channel=channel_key AND o.account_id=account AND o.conversation_id=v_conversation_id)))) THEN RETURN NEW;END IF;
 INSERT INTO public.notifications(owner_id,workspace_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
 VALUES(v_workspace_id,v_workspace_id,v_user_id,'message','Nova mensagem no '||v_channel,
 left(coalesce(v_sender,'Cliente')||CASE WHEN nullif(btrim(coalesce(v_body,'')),'') IS NULL THEN '' ELSE ': '||regexp_replace(v_body,'<[^>]+>',' ','g') END,240),v_link,'inbox_conversation',v_conversation_id,TG_TABLE_NAME||':'||NEW.id::text||':'||v_user_id::text)
 ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
 RETURN NEW;
END $$;
DO $verify$
DECLARE fingerprint jsonb;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl::text,'deps',
  (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]') FROM pg_depend d WHERE (d.classid='pg_proc'::regclass AND d.objid=p.oid) OR (d.refclassid='pg_proc'::regclass AND d.refobjid=p.oid))) ORDER BY p.oid)
 INTO fingerprint FROM pg_proc p WHERE p.oid IN ('techerp_api.notification_schedule_recipients(uuid,jsonb)'::regprocedure,'public.notify_assigned_inbox_message()'::regprocedure);
 IF fingerprint IS DISTINCT FROM current_setting('app.inbox_execution_catalog')::jsonb THEN RAISE EXCEPTION 'Canonical Inbox OID/ACL/owner/dependencies changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='inbox_runtime_release_guard' AND tgenabled='O') THEN RAISE EXCEPTION 'Release lock must remain enabled';END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
