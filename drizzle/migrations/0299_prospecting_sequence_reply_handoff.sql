-- Inbound triggers record only a durable wake signal. They never lock/update runs
-- while the provider ingestion holds a conversation lock.
CREATE TABLE public.prospecting_sequence_reply_wakes (
 run_id uuid PRIMARY KEY,workspace_id uuid NOT NULL,occurred_at timestamptz NOT NULL
);
ALTER TABLE public.prospecting_sequence_reply_wakes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospecting_sequence_reply_wakes FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.prospecting_sequence_reply_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE thread uuid;occurred timestamptz;BEGIN
 IF NEW.direction<>'inbound' OR auth.role() IS DISTINCT FROM 'service_role' THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='email_messages' THEN
  IF NOT EXISTS(SELECT 1 FROM public.email_accounts ac WHERE ac.id=NEW.account_id AND ac.workspace_id=NEW.workspace_id AND NOT public.service_agent_email_is_automatic(NEW.headers,NEW.from_email,ac.email)) THEN RETURN NEW;END IF;
  thread:=NEW.thread_id;occurred:=coalesce(NEW.received_at,NEW.created_at);
  INSERT INTO public.prospecting_sequence_reply_wakes(run_id,workspace_id,occurred_at)
  SELECT DISTINCT r.id,r.workspace_id,occurred FROM public.prospecting_sequence_runs r JOIN public.prospecting_sequence_effects e ON e.run_id=r.id JOIN public.email_messages sent ON sent.id=e.id AND sent.workspace_id=r.workspace_id
  WHERE r.workspace_id=NEW.workspace_id AND r.state IN('active','waiting_task') AND e.kind='email' AND e.status='succeeded' AND sent.thread_id=thread AND occurred>=e.finished_at
  AND lower(NEW.from_email)=ANY(SELECT lower(x) FROM unnest(sent.to_emails) x) AND NEW.in_reply_to=sent.message_id_header AND nullif(NEW.in_reply_to,'') IS NOT NULL
  ON CONFLICT(run_id) DO UPDATE SET occurred_at=greatest(prospecting_sequence_reply_wakes.occurred_at,excluded.occurred_at);
 ELSE
  thread:=NEW.conversation_id;occurred:=NEW.created_at;
  INSERT INTO public.prospecting_sequence_reply_wakes(run_id,workspace_id,occurred_at)
  SELECT DISTINCT r.id,r.workspace_id,occurred FROM public.prospecting_sequence_runs r JOIN public.prospecting_sequence_effects e ON e.run_id=r.id JOIN public.whatsapp_messages sent ON sent.id=e.id AND sent.workspace_id=r.workspace_id
  WHERE r.workspace_id=NEW.workspace_id AND r.state IN('active','waiting_task') AND e.kind='whatsapp' AND e.status='succeeded' AND sent.conversation_id=thread AND occurred>=e.finished_at
  AND regexp_replace(NEW.from_number,'\D','','g')=regexp_replace(sent.to_number,'\D','','g')
  ON CONFLICT(run_id) DO UPDATE SET occurred_at=greatest(prospecting_sequence_reply_wakes.occurred_at,excluded.occurred_at);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_reply_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sequence_reply_wake AFTER INSERT ON public.email_messages FOR EACH ROW EXECUTE FUNCTION public.prospecting_sequence_reply_event();
CREATE TRIGGER sequence_reply_wake AFTER INSERT ON public.whatsapp_messages FOR EACH ROW EXECUTE FUNCTION public.prospecting_sequence_reply_event();
CREATE FUNCTION public.prospecting_sequence_wake_replies(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;def jsonb;n integer:=0;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 FOR r IN SELECT rr.* FROM public.prospecting_sequence_runs rr JOIN public.prospecting_sequence_reply_wakes w ON w.run_id=rr.id AND w.workspace_id=rr.workspace_id ORDER BY w.occurred_at,rr.id LIMIT least(greatest(p_limit,1),100) FOR UPDATE OF rr SKIP LOCKED LOOP
  SELECT definition INTO def FROM public.prospecting_sequence_versions WHERE id=r.version_id AND workspace_id=r.workspace_id;
  IF r.state='active' OR r.state='waiting_task' AND coalesce((def#>>'{settings,stopOnReply}')::boolean,true) THEN
   UPDATE public.prospecting_sequence_runs SET state='active',next_run_at=least(next_run_at,now()),updated_at=now() WHERE id=r.id;n:=n+1;
  END IF;
  DELETE FROM public.prospecting_sequence_reply_wakes WHERE run_id=r.id;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_wake_replies(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_wake_replies(integer) TO service_role;
CREATE FUNCTION public.prospecting_sequence_reply_signals(p_run uuid,p_previous uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;pick_previous boolean;definition jsonb;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT v.definition,(v.definition->'steps'->r.cursor->>'type'='wait' AND v.definition->'steps'->r.cursor->>'source'='previous' AND NOT coalesce((v.definition#>>'{settings,stopOnReply}')::boolean,true)) INTO definition,pick_previous FROM public.prospecting_sequence_runs r JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE r.id=p_run;
 WITH replies AS (
  SELECT e.step_id,e.id effect_id,coalesce(inbound.received_at,inbound.created_at) received_at FROM public.prospecting_sequence_effects e JOIN public.prospecting_sequence_runs r ON r.id=e.run_id
  JOIN public.email_messages sent ON sent.id=e.id AND sent.workspace_id=r.workspace_id
  JOIN public.email_messages inbound ON inbound.thread_id=sent.thread_id AND inbound.account_id=sent.account_id AND inbound.workspace_id=sent.workspace_id AND inbound.direction='inbound'
  JOIN public.email_accounts ac ON ac.id=sent.account_id AND ac.workspace_id=sent.workspace_id
  WHERE r.id=p_run AND e.kind='email' AND e.status='succeeded' AND coalesce(inbound.received_at,inbound.created_at)>=e.finished_at
  AND inbound.in_reply_to=sent.message_id_header AND nullif(inbound.in_reply_to,'') IS NOT NULL AND lower(inbound.from_email)=ANY(SELECT lower(x) FROM unnest(sent.to_emails) x)
  AND NOT public.service_agent_email_is_automatic(inbound.headers,inbound.from_email,ac.email)
  UNION ALL
  SELECT e.step_id,e.id effect_id,inbound.created_at received_at FROM public.prospecting_sequence_effects e JOIN public.prospecting_sequence_runs r ON r.id=e.run_id
  JOIN public.whatsapp_messages sent ON sent.id=e.id AND sent.workspace_id=r.workspace_id
  JOIN public.whatsapp_messages inbound ON inbound.conversation_id=sent.conversation_id AND inbound.workspace_id=sent.workspace_id AND inbound.direction='inbound'
  WHERE r.id=p_run AND e.kind='whatsapp' AND e.status='succeeded' AND inbound.created_at>=e.finished_at
  AND regexp_replace(inbound.from_number,'\D','','g')=regexp_replace(sent.to_number,'\D','','g')
 ),chosen AS(SELECT * FROM replies WHERE NOT coalesce(pick_previous,false) OR step_id=p_previous ORDER BY received_at DESC,effect_id DESC LIMIT 1)
 SELECT jsonb_build_object('replied',EXISTS(SELECT 1 FROM replies),'previousReplied',EXISTS(SELECT 1 FROM replies WHERE step_id=p_previous),'responseEffectId',(SELECT effect_id FROM chosen),'responseAgentId',(SELECT coalesce(nullif(step->>'agentId',''),nullif(definition#>>'{settings,agentId}','')) FROM jsonb_array_elements(definition->'steps') step WHERE step->>'id'=(SELECT step_id::text FROM chosen))) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_reply_signals(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_reply_signals(uuid,uuid) TO service_role;

CREATE FUNCTION public.prospecting_sequence_handoff(p_run uuid,p_lease uuid,p_mode text,p_agent uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;cv public.whatsapp_conversations;source uuid;channel_kind text;account public.service_channel_accounts;ctx jsonb;session uuid;enrollment uuid;person uuid;entity_kind text;actual text:=p_mode;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_mode NOT IN('human','agent') THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND lease_token=p_lease AND lease_until>now() AND state='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Execução indisponível.' USING ERRCODE='40001';END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);person:=(c#>>'{person,id}')::uuid;entity_kind:=c#>>'{person,entity}';
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE run_id=r.id AND kind IN('email','whatsapp') AND status='succeeded' AND projection_state='complete' AND (nullif(c#>>'{signals,responseEffectId}','') IS NULL OR id=(c#>>'{signals,responseEffectId}')::uuid) ORDER BY finished_at DESC,id DESC LIMIT 1;
 IF e.id IS NOT NULL THEN
  SELECT * INTO account FROM public.service_channel_accounts WHERE id=e.account_id AND workspace_id=r.workspace_id FOR SHARE;
  IF e.kind='whatsapp' THEN SELECT conversation_id INTO source FROM public.whatsapp_messages WHERE id=e.id AND workspace_id=r.workspace_id;
  ELSE SELECT thread_id INTO source FROM public.email_messages WHERE id=e.id AND workspace_id=r.workspace_id;END IF;
  channel_kind:=e.kind;
 END IF;
 IF p_mode='agent' THEN
  IF p_agent::text IS DISTINCT FROM coalesce(nullif(c#>>'{signals,responseAgentId}',''),CASE WHEN c->'definition'->'steps'->r.cursor->>'type'='agent' THEN nullif(c->'definition'->'steps'->r.cursor->>'agentId','') END,nullif(c#>>'{definition,settings,agentId}','')) THEN RAISE EXCEPTION 'Agente diferente da configuração da sequência.' USING ERRCODE='42501';END IF;
  IF source IS NULL OR p_agent IS NULL OR NOT account.enabled OR NOT account.routing_configured OR NOT EXISTS(SELECT 1 FROM public.service_channel_bindings b JOIN public.sdr_playbooks pb ON pb.id=b.agent_id AND pb.workspace_id=b.workspace_id WHERE b.account_id=account.id AND b.workspace_id=r.workspace_id AND b.agent_id=p_agent AND b.enabled AND b.inbound AND b.campaigns AND pb.enabled AND public.is_workspace_member(r.workspace_id,pb.owner_id) AND EXISTS(SELECT 1 FROM public.sdr_agent_versions av WHERE av.playbook_id=pb.id AND av.workspace_id=r.workspace_id AND av.status='published')) THEN RAISE EXCEPTION 'Agente/canal indisponível.' USING ERRCODE='42501';END IF;
  IF channel_kind='whatsapp' THEN
   SELECT * INTO cv FROM public.whatsapp_conversations WHERE id=source AND workspace_id=r.workspace_id FOR UPDATE;
   IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','view',ARRAY[coalesce(cv.assigned_to,cv.owner_id)]) OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','update',ARRAY[coalesce(cv.assigned_to,cv.owner_id)]) THEN RAISE EXCEPTION 'Conversa sem autorização atual.' USING ERRCODE='42501';END IF;
   IF cv.ai_owner IN('human','paused') THEN actual:='human';ELSE
    -- Existing router owns the enrollment and future inbound processing. Never send an unsolicited AI message here.
    enrollment:=public.sdr_bind_inbound_channel(r.workspace_id,source,account.source_key);
    IF enrollment IS NULL OR NOT EXISTS(SELECT 1 FROM public.sdr_enrollments WHERE id=enrollment AND workspace_id=r.workspace_id AND playbook_id=p_agent AND opted_out_at IS NULL) THEN RAISE EXCEPTION 'Agente não vinculado à conversa.' USING ERRCODE='42501';END IF;
   END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.service_agent_sessions ss JOIN public.sdr_enrollments se ON se.id=ss.enrollment_id AND se.workspace_id=ss.workspace_id WHERE ss.workspace_id=r.workspace_id AND ss.channel='email' AND ss.source_id=source AND se.playbook_id IS DISTINCT FROM p_agent) THEN RAISE EXCEPTION 'Conversa vinculada a outro agente.' USING ERRCODE='42501';END IF;
   IF EXISTS(SELECT 1 FROM public.service_agent_sessions s WHERE s.workspace_id=r.workspace_id AND s.channel='email' AND s.source_id=source AND s.ai_owner IN('human','paused')) THEN actual:='human';END IF;
   -- The existing verified inbound trigger enqueues email. Configuration is checked above; no fabricated inbound job.
  END IF;
 END IF;
 IF actual='human' THEN
  IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.activities','create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Atendimento sem autorização atual.' USING ERRCODE='42501';END IF;
  IF channel_kind='whatsapp' AND source IS NOT NULL THEN
   SELECT * INTO cv FROM public.whatsapp_conversations WHERE id=source AND workspace_id=r.workspace_id FOR UPDATE;
   IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','update',ARRAY[coalesce(cv.assigned_to,cv.owner_id)]) THEN RAISE EXCEPTION 'Conversa sem autorização atual.' USING ERRCODE='42501';END IF;
   UPDATE public.whatsapp_conversations SET ai_owner='human',ai_version=ai_version+1 WHERE id=source AND workspace_id=r.workspace_id AND ai_owner IS DISTINCT FROM 'human' AND ai_owner IS DISTINCT FROM 'paused';
  ELSIF channel_kind='email' AND source IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.email_threads t WHERE t.id=source AND t.workspace_id=r.workspace_id AND public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.email','update',ARRAY[coalesce(t.assigned_to,t.owner_id)])) THEN RAISE EXCEPTION 'Conversa sem autorização atual.' USING ERRCODE='42501';END IF;
   UPDATE public.service_agent_sessions SET ai_owner='human',ai_version=ai_version+1 WHERE workspace_id=r.workspace_id AND channel='email' AND source_id=source AND ai_owner='ai';
  END IF;
  INSERT INTO public.activities(id,workspace_id,owner_id,assigned_to,type,subject,body,due_date,related_contact_id,related_lead_id,external_ids)
  VALUES(r.id,r.workspace_id,r.owner_id,r.owner_id,'task','Atender contato da sequência','A cadência foi interrompida para atendimento humano. Confira a conversa na Inbox antes de entrar em contato.',now(),CASE WHEN entity_kind='contact' THEN person END,CASE WHEN entity_kind='lead' THEN person END,jsonb_build_object('prospecting_sequence_run_id',r.id,'sequence_handoff',true)) ON CONFLICT(id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM public.activities a WHERE a.id=r.id AND a.workspace_id=r.workspace_id AND a.owner_id=r.owner_id AND a.external_ids->>'prospecting_sequence_run_id'=r.id::text AND CASE entity_kind WHEN 'contact' THEN a.related_contact_id=person ELSE a.related_lead_id=person END) THEN RAISE EXCEPTION 'Conflito na atividade de atendimento.' USING ERRCODE='23505';END IF;
  INSERT INTO public.notifications(id,workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
  VALUES(r.id,r.workspace_id,r.owner_id,r.owner_id,'sequence_handoff','Contato aguardando atendimento','A sequência foi interrompida. Consulte a atividade vinculada e a Inbox.','/prospecting/sequences','activities',r.id,'sequence-handoff:'||r.id::text) ON CONFLICT(id) DO NOTHING;
 END IF;
 RETURN actual;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_handoff(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_handoff(uuid,uuid,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_context(p_run uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;v public.prospecting_sequence_versions;
 sources jsonb;s jsonb;signals jsonb;email_reply boolean;wa_reply boolean;last_kind text;call_result text;previous_contact uuid;reply_info jsonb;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND state='active' AND lease_token=p_lease AND lease_until>now();
 IF r.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'assign') THEN RAISE EXCEPTION 'Execução sem autorização atual.' USING ERRCODE='42501';END IF;
 IF (SELECT definition->'steps'->r.cursor->>'type' FROM public.prospecting_sequence_versions WHERE id=r.version_id) IN('email','whatsapp') THEN
  IF NOT public.sales_context_access(public.work_subject_context(r.workspace_id,r.owner_id),r.workspace_id,'techsales.inbox.'||(SELECT definition->'steps'->r.cursor->>'type' FROM public.prospecting_sequence_versions WHERE id=r.version_id),'create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Envio sem autorização atual.' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO p FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id AND workspace_id=r.workspace_id;
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=r.version_id AND workspace_id=r.workspace_id;
 IF p.id IS NULL OR v.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'assign') THEN RAISE EXCEPTION 'Origem indisponível.' USING ERRCODE='42501';END IF;
 sources:=techerp_api.sequence_audience_source(r.workspace_id,r.owner_id,jsonb_build_array(jsonb_build_object('entity',p.entity,'id',p.source_id)));
 s:=sources->(p.entity||':'||p.source_id::text);
 IF s IS NULL THEN RAISE EXCEPTION 'Destinatário sem acesso atual.' USING ERRCODE='42501';END IF;
 SELECT a.outcome INTO call_result FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id WHERE e.run_id=r.id AND e.kind='call' AND e.status='succeeded' AND a.workspace_id=r.workspace_id AND a.completed ORDER BY e.created_at DESC,e.id DESC LIMIT 1;
 SELECT (x.value->>'id')::uuid INTO previous_contact FROM jsonb_array_elements(v.definition->'steps') WITH ORDINALITY x WHERE x.ordinality<=r.cursor AND x.value->>'type' IN('email','whatsapp','call') ORDER BY x.ordinality DESC LIMIT 1;
 reply_info:=public.prospecting_sequence_reply_signals(r.id,previous_contact);
 signals:=jsonb_build_object('previousContactExists',EXISTS(SELECT 1 FROM public.prospecting_sequence_effects WHERE run_id=r.id AND step_id=previous_contact AND status='succeeded'),'replied',(reply_info->>'replied')::boolean,'previousReplied',(reply_info->>'previousReplied')::boolean,'responseEffectId',reply_info->'responseEffectId','responseAgentId',reply_info->'responseAgentId',
 'meetingBooked',EXISTS(SELECT 1 FROM public.meetings m WHERE m.workspace_id=r.workspace_id AND m.created_at>=r.created_at AND m.status NOT IN('cancelled','canceled') AND CASE p.entity WHEN 'contact' THEN m.related_contact_id=p.source_id ELSE m.related_lead_id=p.source_id END),
 'callAnswered',coalesce(call_result='answered',false),'callResultKnown',coalesce(call_result IN('answered','no_answer'),false),
 'optedOut',EXISTS(SELECT 1 FROM public.email_unsubscribes u WHERE u.workspace_id=r.workspace_id AND u.reason IS DISTINCT FROM '__token__' AND lower(btrim(u.email))=lower(btrim(s->>'email')))
 OR EXISTS(SELECT 1 FROM public.sdr_enrollments e WHERE e.workspace_id=r.workspace_id AND e.opted_out_at IS NOT NULL AND (to_jsonb(e)->>'contact_id'=p.source_id::text OR to_jsonb(e)->>'lead_id'=p.source_id::text OR regexp_replace(e.contact_phone,'\D','','g') IN(SELECT regexp_replace(phone,'\D','','g') FROM jsonb_array_elements_text(s->'phones') phone))));
 RETURN jsonb_build_object('run',to_jsonb(r),'person',jsonb_build_object('entity',p.entity,'id',p.source_id),'definition',v.definition,'source',s,'signals',signals);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_context(uuid,uuid) TO service_role;

-- A channel default agent may not steal a sequence configured for a different
-- agent or for human service. No row contents or identity are returned.
CREATE FUNCTION public.prospecting_sequence_agent_route_allowed(p_workspace uuid,p_channel text,p_source uuid,p_agent uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT NOT EXISTS(
  SELECT 1 FROM public.prospecting_sequence_runs r JOIN public.prospecting_sequence_versions v ON v.id=r.version_id AND v.workspace_id=r.workspace_id
  JOIN LATERAL(SELECT e.* FROM public.prospecting_sequence_effects e WHERE e.run_id=r.id AND e.kind=p_channel AND e.status='succeeded' AND
   CASE p_channel WHEN 'email' THEN EXISTS(SELECT 1 FROM public.email_messages m WHERE m.id=e.id AND m.workspace_id=r.workspace_id AND m.thread_id=p_source)
   WHEN 'whatsapp' THEN EXISTS(SELECT 1 FROM public.whatsapp_messages m WHERE m.id=e.id AND m.workspace_id=r.workspace_id AND m.conversation_id=p_source) ELSE false END ORDER BY e.finished_at DESC,e.id DESC LIMIT 1) effect ON true
  JOIN LATERAL(SELECT s FROM jsonb_array_elements(v.definition->'steps') s WHERE s->>'id'=effect.step_id::text) step ON true
  WHERE r.workspace_id=p_workspace AND (r.state IN('active','waiting_task','agent') OR r.state='human' AND EXISTS(SELECT 1 FROM public.activities human_task WHERE human_task.id=r.id AND human_task.workspace_id=r.workspace_id AND NOT human_task.completed)) AND (
   r.state='human' OR
   NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'manage')
   OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'assign')
   OR (v.definition->'steps'->r.cursor->>'type'='wait' AND v.definition->'steps'->r.cursor->>'onReply'='human')
   OR coalesce(nullif(step.s->>'agentId',''),nullif(v.definition#>>'{settings,agentId}','')) IS DISTINCT FROM p_agent::text
  )
 ) INTO allowed;
 RETURN allowed;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_agent_route_allowed(uuid,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_agent_route_allowed(uuid,text,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.service_agent_enqueue(p_channel text,p_message uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;source uuid;v_source_key text;contact uuid;lead uuid;company uuid;deal uuid;occurred timestamptz;cfg public.sdr_playbooks;
 a public.service_channel_accounts;b public.service_channel_bindings;s public.service_agent_sessions;e uuid;j uuid;wait_seconds int;event_id uuid;verified boolean:=false;
BEGIN
 IF p_channel='email' THEN
  SELECT m.workspace_id,t.id,t.account_id::text,t.contact_id,t.lead_id,t.company_id,t.deal_id,coalesce(m.received_at,m.created_at),
   (EXISTS(SELECT 1 FROM public.email_messages sent WHERE sent.thread_id=t.id AND sent.account_id=t.account_id AND sent.workspace_id=t.workspace_id AND sent.direction='outbound'
     AND sent.message_id_header=m.in_reply_to AND nullif(m.in_reply_to,'') IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(sent.to_emails) recipient WHERE lower(recipient)=lower(m.from_email)))
    AND ((t.contact_id IS NULL AND t.lead_id IS NULL)
      OR EXISTS(SELECT 1 FROM public.contacts person WHERE person.id=t.contact_id AND person.workspace_id=t.workspace_id AND lower(person.email)=lower(m.from_email))
      OR (t.contact_id IS NULL AND EXISTS(SELECT 1 FROM public.leads person WHERE person.id=t.lead_id AND person.workspace_id=t.workspace_id AND lower(person.email)=lower(m.from_email)))))
   INTO w,source,v_source_key,contact,lead,company,deal,occurred,verified
   FROM public.email_messages m JOIN public.email_threads t ON t.id=m.thread_id AND t.workspace_id=m.workspace_id AND t.account_id=m.account_id
   JOIN public.email_accounts ac ON ac.id=t.account_id AND ac.workspace_id=t.workspace_id
   WHERE m.id=p_message AND m.direction='inbound' AND NOT public.service_agent_email_is_automatic(m.headers,m.from_email,ac.email)
   FOR UPDATE OF t;
 ELSIF p_channel='chat' THEN
  SELECT m.workspace_id,c.id,c.workspace_id::text,NULL::uuid,NULL::uuid,m.created_at INTO w,source,v_source_key,contact,lead,occurred
   FROM public.live_chat_messages m JOIN public.live_chat_sessions c ON c.id=m.session_id AND c.workspace_id=m.workspace_id
   WHERE m.id=p_message AND m.direction='inbound' AND c.status<>'closed' FOR UPDATE OF c;
 ELSE RETURN NULL;END IF;
 IF w IS NULL OR source IS NULL THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sdr_workspace_settings WHERE workspace_id=w AND enabled) THEN RETURN NULL;END IF;
 SELECT * INTO a FROM public.service_channel_accounts WHERE workspace_id=w AND channel=p_channel AND source_key=v_source_key AND enabled AND routing_configured;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO b FROM public.service_channel_bindings WHERE account_id=a.id AND workspace_id=w AND enabled AND inbound;
 IF NOT FOUND OR occurred<b.updated_at THEN RETURN NULL;END IF;
 IF p_channel='email' AND NOT public.prospecting_sequence_agent_route_allowed(w,p_channel,source,b.agent_id) THEN RETURN NULL;END IF;
 SELECT * INTO cfg FROM public.sdr_playbooks WHERE id=b.agent_id AND workspace_id=w AND enabled;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.sdr_agent_versions WHERE playbook_id=cfg.id AND workspace_id=w AND status='published') THEN RETURN NULL;END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE workspace_id=w AND channel=p_channel AND source_id=source FOR UPDATE;
 IF FOUND THEN
  IF s.ai_owner<>'ai' OR occurred<s.last_inbound_at THEN RETURN NULL;END IF;
  UPDATE public.sdr_enrollments SET status='active',cancel_reason=NULL,follow_up_at=NULL WHERE id=s.enrollment_id AND status='paused' AND opted_out_at IS NULL
   AND cancel_reason IN('out_of_icp','left_company','not_this_person','post_close','no_demand','declined','not_target','private_number','referral_received','referral_declined','other');
  IF NOT EXISTS(SELECT 1 FROM public.sdr_enrollments WHERE id=s.enrollment_id AND playbook_id=cfg.id AND status='active' AND opted_out_at IS NULL) THEN RETURN NULL;END IF;
  IF NOT s.context_approved AND s.channel='email' THEN
   UPDATE public.sdr_enrollments SET contact_id=CASE WHEN verified THEN contact ELSE NULL END,lead_id=CASE WHEN verified THEN lead ELSE NULL END,company_id=NULL,deal_id=NULL,
    qualification_id=CASE WHEN contact_id IS DISTINCT FROM CASE WHEN verified THEN contact ELSE NULL END OR lead_id IS DISTINCT FROM CASE WHEN verified THEN lead ELSE NULL END THEN NULL ELSE qualification_id END
    WHERE id=s.enrollment_id;
  END IF;

 ELSE
  IF (contact IS NOT NULL OR lead IS NOT NULL) AND EXISTS(SELECT 1 FROM public.sdr_enrollments WHERE workspace_id=w AND opted_out_at IS NOT NULL AND
   ((contact IS NOT NULL AND contact_id=contact) OR (lead IS NOT NULL AND lead_id=lead))) THEN RETURN NULL;END IF;
  INSERT INTO public.sdr_enrollments(workspace_id,owner_id,playbook_id,contact_id,lead_id,status,commercial_stage)
   VALUES(w,cfg.owner_id,cfg.id,CASE WHEN verified THEN contact ELSE NULL END,CASE WHEN verified THEN lead ELSE NULL END,'active','awaiting_reply') RETURNING id INTO e;
  INSERT INTO public.service_agent_sessions(workspace_id,account_id,channel,source_id,enrollment_id,identity_verified,last_inbound_at) VALUES(w,a.id,p_channel,source,e,verified,occurred) RETURNING * INTO s;
 END IF;
 INSERT INTO public.service_agent_inbound_events(channel,message_id,session_id) VALUES(p_channel,p_message,s.id) ON CONFLICT DO NOTHING RETURNING message_id INTO event_id;
 IF event_id IS NULL THEN RETURN NULL;END IF;
 UPDATE public.service_agent_sessions SET ai_version=ai_version+1,identity_verified=CASE WHEN context_approved THEN identity_verified ELSE verified END,last_inbound_at=occurred WHERE id=s.id RETURNING * INTO s;
 wait_seconds:=CASE WHEN cfg.guardrails->>'customer_wait_seconds' ~ '^[0-9]{1,3}$' THEN least(300,(cfg.guardrails->>'customer_wait_seconds')::int) ELSE 5 END;
 INSERT INTO public.service_agent_jobs(workspace_id,session_id,inbound_message_id,conversation_version,available_at)
 VALUES(w,s.id,p_message,s.ai_version,now()+make_interval(secs=>wait_seconds))
 ON CONFLICT(session_id) WHERE status='queued' DO UPDATE SET inbound_message_id=excluded.inbound_message_id,
 conversation_version=excluded.conversation_version,available_at=excluded.available_at,updated_at=now() RETURNING id INTO j;
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_enqueue(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_enqueue(text,uuid) TO service_role;
