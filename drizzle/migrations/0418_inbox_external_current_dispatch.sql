CREATE OR REPLACE FUNCTION public.notification_workflow_dispatch_v2(p_workflow uuid,p_run uuid,p_version integer,p_entity text,p_record uuid,p_rules jsonb,p_title text,p_body text,p_step text,p_delivery jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf record;run record;ev record;w uuid;executor uuid;source jsonb;rule jsonb;kind text;rule_id uuid;recipients uuid[]:='{}';selected uuid[];recipient uuid;source_project uuid;manager uuid;leader jsonb;policy record;issues text[]:='{}';candidate_count integer:=0;sent_count integer:=0;excluded_count integer:=0;duplicate_count integer:=0;created uuid;prefs jsonb;inapp boolean;title text;body text;href text;dedupe text;config jsonb;channels jsonb;fallback text;intent_id uuid;intent_existed boolean;job_id uuid;queued_count integer:=0;requested_channel text;resolved_event text;saved_step jsonb;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Execução reservada ao motor de Workflows.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_delivery) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_delivery) k WHERE k NOT IN('channels','fallback','priority','followup')) OR jsonb_typeof(p_delivery->'channels') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Canais de notificação inválidos.' USING ERRCODE='22023';END IF;
 channels:=p_delivery->'channels';fallback:=coalesce(p_delivery->>'fallback','none');
 IF jsonb_array_length(channels) NOT BETWEEN 1 AND 3 OR fallback NOT IN('none','email') OR EXISTS(SELECT 1 FROM jsonb_array_elements(channels)c WHERE jsonb_typeof(c)<>'string' OR c#>>'{}' NOT IN('inapp','email','whatsapp')) OR(SELECT count(DISTINCT c) FROM jsonb_array_elements(channels)c)<>jsonb_array_length(channels) OR(fallback='email' AND(NOT channels?'whatsapp' OR channels?'email')) THEN RAISE EXCEPTION 'Canais ou fallback inválidos.' USING ERRCODE='22023';END IF;
 SELECT jsonb_agg(c ORDER BY c) INTO channels FROM jsonb_array_elements(channels)c;
 config:=jsonb_build_object('channels',channels,'fallback',fallback)||(p_delivery-ARRAY['channels','fallback']);
 IF public.is_read_only_view() THEN RAISE EXCEPTION 'Execução de teste não pode emitir notificações.' USING ERRCODE='42501';END IF;
 IF p_workflow IS NULL OR p_run IS NULL OR p_version IS NULL OR p_version<1 OR p_record IS NULL OR p_entity IS NULL OR p_step IS NULL OR length(p_step) NOT BETWEEN 1 AND 300 OR btrim(p_step)='' OR p_title IS NULL OR btrim(p_title)='' OR length(p_title)>200 OR length(coalesce(p_body,''))>2000 OR jsonb_typeof(p_rules) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Configuração de notificação inválida.' USING ERRCODE='22023';END IF;
 IF jsonb_array_length(p_rules) NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Informe de um a dez seletores de destinatários.' USING ERRCODE='22023';END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=p_workflow AND enabled AND status='published' AND published_version=p_version AND entity=p_entity FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workflow indisponível ou versão desatualizada.' USING ERRCODE='42501';END IF;
 w:=wf.workspace_id;executor:=coalesce(wf.execution_user_id,wf.owner_id);
 SELECT * INTO run FROM public.workflow_runs WHERE id=p_run AND workflow_id=p_workflow AND workspace_id=w AND entity=p_entity AND entity_id=p_record AND status='running' AND NOT is_test AND owner_id=wf.owner_id FOR UPDATE;
 IF NOT FOUND OR NOT public.is_workspace_member(w,executor) THEN RAISE EXCEPTION 'Execução de notificação indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO ev FROM public.workflow_events WHERE id=run.event_id AND workspace_id=w AND entity=p_entity AND entity_id=p_record;
 IF NOT FOUND OR (ev.workflow_version IS NOT NULL AND ev.workflow_version<>p_version) OR NOT public.sales_worker_authorize('workflows',p_workflow,jsonb_build_array(jsonb_build_object('workflow_version',p_version),CASE WHEN p_entity IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities') THEN jsonb_build_object('table',p_entity,'id',p_record,'action','view') ELSE jsonb_build_object('record_table',p_entity,'id',p_record) END)) OR NOT techerp_api.notification_source_visible(w,executor,p_entity,p_record) THEN RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';END IF;
 IF(channels?'email' OR fallback='email') AND NOT techerp_api.notification_transport_allowed(w,executor,'email') OR channels?'whatsapp' AND NOT techerp_api.notification_transport_allowed(w,executor,'whatsapp') THEN RAISE EXCEPTION 'Executor sem permissão atual para o canal externo.' USING ERRCODE='42501';END IF;
 resolved_event:=techerp_api.notification_business_run_key(p_workflow,p_run,p_version);
 IF resolved_event IS NULL THEN RAISE EXCEPTION 'Ocorrência de notificação sem prova válida.' USING ERRCODE='42501';END IF;
 IF NOT techerp_api.notification_schedule_delivery_valid(config,resolved_event) THEN RAISE EXCEPTION 'Configuração temporal de notificação inválida.' USING ERRCODE='22023';END IF;
 IF p_delivery?'priority' OR p_delivery?'followup' THEN
  saved_step:=techerp_api.notification_schedule_step(p_workflow,p_version,p_step);
  IF saved_step IS NULL OR techerp_api.notification_schedule_config(saved_step->'delivery') IS DISTINCT FROM jsonb_strip_nulls(config) OR saved_step->'recipients' IS DISTINCT FROM p_rules THEN RAISE EXCEPTION 'O passo publicado não corresponde à configuração temporal.' USING ERRCODE='42501';END IF;
 END IF;
 IF resolved_event='people.approval.pending' AND p_rules IS DISTINCT FROM '[{"kind":"pending_approvers"}]'::jsonb THEN RAISE EXCEPTION 'A aprovação exige seu aprovador vigente.' USING ERRCODE='42501';END IF;
 source:=techerp_api.notification_source_snapshot(p_entity,p_record,w);
 IF source IS NULL THEN RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';END IF;
 IF p_entity='whatsapp_messages' THEN source:=jsonb_build_object('assigned_to',(SELECT c.assigned_to FROM public.whatsapp_messages m JOIN public.whatsapp_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id WHERE m.id=p_record AND m.workspace_id=w));END IF;
 FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
  IF jsonb_typeof(rule) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(rule) k WHERE k NOT IN('kind','id')) THEN RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';END IF;
  kind:=rule->>'kind';rule_id:=NULL;selected:='{}';
  IF kind IS NULL OR kind NOT IN('workflow_owner','user','source_responsible','source_creator','area_manager','pending_approvers','project_members','team','job_role','followers') THEN RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';END IF;
  IF kind IN('user','team','job_role') THEN
   IF coalesce(rule->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Identificador de destinatário inválido.' USING ERRCODE='22023';END IF;
   rule_id:=(rule->>'id')::uuid;
  ELSIF rule?'id' THEN RAISE EXCEPTION 'Seletor não aceita identificador manual.' USING ERRCODE='22023';END IF;
  CASE kind
   WHEN 'workflow_owner' THEN selected:=ARRAY[executor];WHEN 'user' THEN selected:=ARRAY[rule_id];
   WHEN 'source_creator' THEN selected:=ARRAY[CASE WHEN p_entity='hiring_fiscal_documents' THEN nullif(source->>'uploaded_by','')::uuid ELSE nullif(source->>'created_by','')::uuid END];
   WHEN 'source_responsible' THEN
    CASE p_entity
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
  IF cardinality(selected)=0 AND kind<>'followers' THEN issues:=array_append(issues,'recipient_source_unavailable');END IF;
  recipients:=recipients||selected;
 END LOOP;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO recipients FROM unnest(recipients) x WHERE x IS NOT NULL;candidate_count:=cardinality(recipients);
 IF candidate_count>200 THEN RETURN jsonb_build_object('sent',0,'candidates',candidate_count,'excluded',candidate_count,'issues',jsonb_build_array('recipient_limit_exceeded'),'duplicate',0);END IF;
 IF strpos(p_title,'{{')>0 OR strpos(coalesce(p_body,''),'{{')>0 THEN title:='Atualização no TechERP';body:='Acesse o registro para consultar os detalhes.';ELSE title:=p_title;body:=p_body;END IF;
 href:=CASE p_entity WHEN 'whatsapp_messages' THEN techerp_api.notification_whatsapp_href(w,p_record)
 WHEN 'leads' THEN '/leads/'||p_record WHEN 'contacts' THEN '/contacts/'||p_record WHEN 'companies' THEN '/companies/'||p_record WHEN 'deals' THEN '/deals/'||p_record WHEN 'tickets' THEN '/tickets/'||p_record WHEN 'ats_jobs' THEN '/ats/jobs/'||p_record WHEN 'ats_candidates' THEN '/candidates/'||p_record
 WHEN 'ats_applications' THEN techerp_api.notification_hr_href(w,p_entity,p_record) WHEN 'ats_interviews' THEN techerp_api.notification_hr_href(w,p_entity,p_record) WHEN 'ats_offers' THEN techerp_api.notification_hr_href(w,p_entity,p_record) WHEN 'people_documents' THEN techerp_api.notification_hr_href(w,p_entity,p_record) WHEN 'hiring_fiscal_documents' THEN techerp_api.notification_finance_fiscal_href(w,p_record) WHEN 'hiring_preparation_requests' THEN techerp_api.notification_hr_href(w,p_entity,p_record) WHEN 'people' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
 WHEN 'projects' THEN '/projects/'||p_record WHEN 'project_tasks' THEN '/projects/tasks?taskId='||p_record WHEN 'project_milestones' THEN techerp_api.notification_project_milestone_href(w,p_record) WHEN 'contracts' THEN '/contracts/'||p_record WHEN 'financial_entries' THEN '/finance/entries/'||p_record WHEN 'services' THEN '/services/'||p_record WHEN 'proposals' THEN '/proposals/'||p_record ELSE NULL END;
 FOREACH recipient IN ARRAY recipients LOOP
  IF NOT public.is_workspace_member(w,recipient) OR NOT techerp_api.notification_source_visible(w,recipient,p_entity,p_record) OR NOT techerp_api.notification_people_recipient(ev.id,recipient) THEN excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;END IF;
  SELECT notification_preferences INTO prefs FROM public.profiles WHERE id=recipient;
  IF NOT FOUND THEN excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;END IF;
  intent_id:=NULL;
  INSERT INTO public.notification_delivery_intents(workspace_id,workflow_id,run_id,workflow_version,step_path,source_table,source_id,recipient_user_id,event_key,delivery_config,payload_content_neutral) VALUES(w,p_workflow,p_run,p_version,p_step,p_entity,p_record,recipient,resolved_event,config,jsonb_build_object('title','Atualização no TechERP','body','Consulte a central de notificações do TechERP.','href',href)) ON CONFLICT(workspace_id,run_id,step_path,recipient_user_id) DO NOTHING RETURNING id INTO intent_id;
  intent_existed:=intent_id IS NULL;
  IF intent_existed THEN SELECT id INTO intent_id FROM public.notification_delivery_intents WHERE workspace_id=w AND run_id=p_run AND step_path=p_step AND recipient_user_id=recipient AND workflow_id=p_workflow AND workflow_version=p_version AND source_table=p_entity AND source_id=p_record AND delivery_config=config AND event_key=resolved_event;
   IF intent_id IS NULL THEN RAISE EXCEPTION 'A ocorrência já possui outra configuração.' USING ERRCODE='22023';END IF;END IF;
  IF resolved_event='people.approval.pending' OR ((resolved_event='shared.message.received' OR techerp_api.inbox_event_channel(resolved_event) IS NOT NULL) AND techerp_api.notification_inbox_existing_inapp(ev.id,recipient) IS NOT NULL) THEN
   created:=CASE WHEN resolved_event='shared.message.received' OR techerp_api.inbox_event_channel(resolved_event) IS NOT NULL THEN techerp_api.notification_inbox_existing_inapp(ev.id,recipient) ELSE techerp_api.notification_people_existing_inapp(ev.id,recipient) END;
   IF (resolved_event='shared.message.received' OR techerp_api.inbox_event_channel(resolved_event) IS NOT NULL) AND created IS NOT NULL THEN UPDATE public.notification_workspace_context SET event_key=resolved_event WHERE notification_id=created AND workspace_id=w;END IF;
   IF created IS NULL THEN RAISE EXCEPTION 'A aprovação mudou antes da entrega.' USING ERRCODE='42501';END IF;
   UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;
  END IF;
  FOR requested_channel IN SELECT value#>>'{}' FROM jsonb_array_elements(channels) LOOP
   IF requested_channel='inapp' THEN CONTINUE;END IF;job_id:=NULL;
   INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,next_attempt_at,notification_intent_id) VALUES(w,p_workflow,'nfd:'||intent_id||':'||requested_channel,p_step,requested_channel,'user:'||recipient,'queued',0,now(),intent_id) ON CONFLICT(notification_intent_id,channel) WHERE notification_intent_id IS NOT NULL DO NOTHING RETURNING id INTO job_id;
   IF job_id IS NOT NULL THEN queued_count:=queued_count+1;END IF;
  END LOOP;
  inapp:=channels?'inapp' AND public.notification_event_inapp(w,recipient,resolved_event);
  IF inapp THEN
   IF resolved_event='people.approval.pending' OR ((resolved_event='shared.message.received' OR techerp_api.inbox_event_channel(resolved_event) IS NOT NULL) AND techerp_api.notification_inbox_existing_inapp(ev.id,recipient) IS NOT NULL) THEN
    created:=CASE WHEN resolved_event='shared.message.received' OR techerp_api.inbox_event_channel(resolved_event) IS NOT NULL THEN techerp_api.notification_inbox_existing_inapp(ev.id,recipient) ELSE techerp_api.notification_people_existing_inapp(ev.id,recipient) END;
    IF (resolved_event='shared.message.received' OR techerp_api.inbox_event_channel(resolved_event) IS NOT NULL) AND created IS NOT NULL THEN UPDATE public.notification_workspace_context SET event_key=resolved_event WHERE notification_id=created AND workspace_id=w;END IF;
    IF created IS NOT NULL THEN duplicate_count:=duplicate_count+1;UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');END IF;
   ELSE
    dedupe:='workflow-notification:'||p_run||':'||p_step||':'||recipient;created:=NULL;
    INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key) VALUES(w,executor,recipient,'workflow',title,body,href,p_entity,p_record,dedupe) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id INTO created;
    IF created IS NOT NULL THEN UPDATE public.notification_workspace_context SET event_key=resolved_event WHERE notification_id=created AND workspace_id=w;sent_count:=sent_count+1;
    ELSE SELECT id INTO created FROM public.notifications WHERE dedupe_key=dedupe;IF created IS NOT NULL THEN duplicate_count:=duplicate_count+1;ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'notification_not_created');END IF;END IF;
    IF created IS NOT NULL THEN UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;END IF;
   END IF;
  ELSE IF channels?'inapp' THEN excluded_count:=excluded_count+1;issues:=array_append(issues,'preferences_disabled');END IF;IF intent_existed THEN duplicate_count:=duplicate_count+1;END IF;END IF;
  PERFORM techerp_api.notification_schedule_capture(intent_id);
 END LOOP;
 IF sent_count=0 AND duplicate_count=0 AND queued_count=0 AND cardinality(issues)=0 THEN issues:=ARRAY['no_eligible_recipients'];END IF;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO issues FROM unnest(issues) x;
 RETURN jsonb_build_object('sent',sent_count,'candidates',candidate_count,'excluded',excluded_count,'issues',to_jsonb(issues),'duplicate',duplicate_count,'queued',queued_count,'suppressed',0);
END $$;
