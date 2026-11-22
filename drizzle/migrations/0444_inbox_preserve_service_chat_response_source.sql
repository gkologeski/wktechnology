CREATE OR REPLACE FUNCTION techerp_api.inbox_response_source_current(p_receipt uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; u record; j record; s record; effect record; run record; actor uuid; ctx jsonb; owners uuid[];
BEGIN
 SELECT * INTO r FROM public.inbox_response_receipts WHERE id=p_receipt AND transport_state='accepted'; IF NOT FOUND THEN RETURN false; END IF; actor:=r.actor_id;
 IF r.origin='unipile_send' THEN
 SELECT * INTO u FROM public.unipile_delivery_receipts WHERE id=r.source_id AND account_id=r.account_id AND status='sent'; IF NOT FOUND THEN RETURN false; END IF;
 IF u.inbox_request->>'endpoint' IS DISTINCT FROM 'message.send' OR u.inbox_request->>'body' IS NULL OR encode(sha256(convert_to(u.inbox_request->>'body','UTF8')),'hex') IS DISTINCT FROM r.body_hash OR coalesce(u.response#>>'{data,message_id}',u.response->>'message_id',u.response#>>'{data,message,id}',u.response#>>'{message,id}',CASE WHEN coalesce(u.response#>>'{data,object}',u.response->>'object','')<>'Chat' THEN coalesce(u.response#>>'{data,id}',u.response->>'id') END) IS DISTINCT FROM r.provider_id OR u.updated_at IS DISTINCT FROM r.confirmed_at THEN RETURN false; END IF;
 SELECT owner_id INTO actor FROM public.unipile_accounts WHERE id=r.account_id AND workspace_id=r.workspace_id; IF actor IS DISTINCT FROM r.actor_id THEN RETURN false; END IF;
 ELSIF r.origin='service_job' THEN
 SELECT * INTO j FROM public.service_agent_jobs WHERE id=r.source_id AND workspace_id=r.workspace_id AND status='sent'; IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE id=j.session_id AND workspace_id=r.workspace_id AND channel=r.channel AND source_id=r.conversation_id; IF NOT FOUND THEN RETURN false; END IF;
 IF j.send_token IS NULL OR j.send_started_at IS NULL OR j.outbound_message_id IS DISTINCT FROM r.message_id OR j.provider_message_id IS DISTINCT FROM r.provider_id OR encode(sha256(convert_to(j.draft_text,'UTF8')),'hex') IS DISTINCT FROM r.body_hash THEN RETURN false; END IF; SELECT owner_id INTO actor FROM public.sdr_enrollments WHERE id=s.enrollment_id AND workspace_id=r.workspace_id;
 ELSIF r.origin='gmail_send' AND r.transport_payload IS NULL THEN
 SELECT * INTO effect FROM public.prospecting_sequence_effects WHERE id=r.source_id AND workspace_id=r.workspace_id AND kind='email' AND status='succeeded'; IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO run FROM public.prospecting_sequence_runs WHERE id=effect.run_id AND workspace_id=r.workspace_id; IF NOT FOUND THEN RETURN false; END IF;
 IF effect.provider_receipt->>'messageId' IS DISTINCT FROM r.provider_id OR effect.sender->>'sourceKey' IS DISTINCT FROM r.account_id::text OR encode(sha256(convert_to(effect.provider_receipt->>'body','UTF8')),'hex') IS DISTINCT FROM r.body_hash THEN RETURN false; END IF; actor:=run.owner_id; IF actor IS DISTINCT FROM r.actor_id THEN RETURN false; END IF;
 ELSIF r.origin='gmail_send' THEN
 IF r.channel<>'email' OR r.transport_payload->>'provider_id' IS DISTINCT FROM r.provider_id OR r.transport_payload->>'thread_id' IS NULL OR encode(sha256(convert_to(coalesce(r.transport_payload->>'body',''),'UTF8')),'hex') IS DISTINCT FROM r.body_hash OR NOT EXISTS(SELECT 1 FROM public.email_threads WHERE id=r.conversation_id AND workspace_id=r.workspace_id AND account_id=r.account_id AND provider_thread_id=r.transport_payload->>'thread_id') THEN RETURN false; END IF;
 ELSIF r.origin<>'human_chat' THEN RETURN false; END IF;
 IF actor IS NULL OR NOT public.is_workspace_member(r.workspace_id,actor) OR NOT techerp_api.inbox_subject_conversation(r.workspace_id,actor,r.channel,r.account_id,r.conversation_id) THEN RETURN false; END IF;
 ctx:=public.work_subject_context(r.workspace_id,actor);
 IF r.channel='linkedin' THEN SELECT ARRAY[owner_id] INTO owners FROM public.linkedin_conversations WHERE id=r.conversation_id AND workspace_id=r.workspace_id AND account_id=r.account_id; RETURN public.linkedin_inbox_access(ctx,r.workspace_id,owners[1],'create');
 ELSIF r.channel='email' THEN SELECT ARRAY[owner_id,assigned_to] INTO owners FROM public.email_threads WHERE id=r.conversation_id AND workspace_id=r.workspace_id AND account_id=r.account_id;
 ELSE
 IF r.origin='human_chat' AND NOT EXISTS(SELECT 1 FROM public.live_chat_messages m WHERE m.id=r.message_id AND m.inbox_chat_request=m.id AND m.id=r.source_id AND m.author_user_id=r.actor_id AND m.workspace_id=r.workspace_id AND m.session_id=r.conversation_id) THEN RETURN false; END IF;
 SELECT ARRAY[coalesce(assignee_id,owner_id)] INTO owners FROM public.live_chat_sessions WHERE id=r.conversation_id AND workspace_id=r.workspace_id;
 END IF;
 RETURN public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||r.channel,'create',owners);
END $$;
NOTIFY pgrst,'reload schema';
