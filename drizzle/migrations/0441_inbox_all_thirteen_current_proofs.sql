CREATE OR REPLACE FUNCTION techerp_api.inbox_message_evidence_current(p_occurrence uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $proof$
DECLARE o record;x record;valid boolean:=false;
BEGIN
 SELECT * INTO o FROM public.inbox_channel_occurrences WHERE id=p_occurrence;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO x FROM public.inbox_channel_evidence WHERE id=o.envelope_id;
 IF NOT FOUND THEN RETURN false; END IF;
 IF ROW(x.workspace_id,x.channel,x.account_id,x.conversation_id,x.occurred_at,x.received_at) IS DISTINCT FROM ROW(o.workspace_id,o.channel,o.account_id,o.conversation_id,o.occurred_at,o.received_at) OR techerp_api.inbox_account_current(o.workspace_id,o.channel,o.account_id) IS NOT TRUE THEN RETURN false; END IF;
 IF o.event_key IN('shared.email.conversation_assigned','shared.chat.conversation_assigned','shared.chat.conversation_status_changed','shared.linkedin.conversation_status_changed') THEN RETURN techerp_api.inbox_transition_evidence_current(o.id);
 ELSIF o.event_key IN('shared.email.first_response','shared.chat.first_response','shared.linkedin.first_response') THEN RETURN techerp_api.inbox_response_evidence_current(o.id);
 ELSIF o.event_key IN('shared.email.message_received','shared.email.conversation_created') THEN
  SELECT EXISTS(SELECT 1 FROM public.email_messages m
   JOIN public.email_threads t ON t.id=m.thread_id AND t.workspace_id=m.workspace_id AND t.account_id=m.account_id
   JOIN public.gmail_sync_queue q ON q.account_id=m.account_id AND q.provider_message_id=m.provider_message_id AND q.workspace_id=m.workspace_id
   WHERE m.id=x.message_id AND (m.id=o.message_id OR o.event_key='shared.email.conversation_created' AND o.message_id IS NULL AND t.inbox_creation_receipt=q.id AND t.created_at>=q.discovered_at)
    AND m.workspace_id=o.workspace_id AND m.account_id=o.account_id AND t.id=o.conversation_id AND m.direction='inbound' AND x.provenance='gmail_incremental'
    AND q.provenance='incremental' AND NOT q.preexisting AND m.created_at>=q.discovered_at
    AND m.received_at=o.occurred_at AND q.discovered_at=o.received_at AND x.provider_id=m.provider_message_id
    AND x.body_hash=encode(sha256(convert_to(coalesce(m.body_text,m.body_html,''),'UTF8')),'hex')
    AND x.envelope_hash=encode(sha256(convert_to(jsonb_build_object('receipt',q.id,'workspace',q.workspace_id,'account',q.account_id,'provider_message',q.provider_message_id,'history_from',q.history_from,'history_to',q.history_to,'provenance',q.provenance,'discovered_at',q.discovered_at,'message',m.id,'thread',t.id,'provider_thread',t.provider_thread_id,'provider_timestamp',m.received_at)::text,'UTF8')),'hex')) INTO valid;
 ELSIF o.event_key='shared.chat.message_received' THEN
  SELECT EXISTS(SELECT 1 FROM public.live_chat_messages m JOIN public.inbox_widget_receipts r ON r.message_id=m.id AND r.session_id=m.session_id
   JOIN public.live_chat_sessions t ON t.id=m.session_id AND t.workspace_id=m.workspace_id
   WHERE m.id=x.message_id AND m.id=o.message_id AND m.workspace_id=o.workspace_id AND m.session_id=o.conversation_id
    AND o.account_id=o.workspace_id AND m.direction='inbound' AND x.provenance='widget_session'
    AND r.request_id::text=x.provider_id AND m.created_at=o.occurred_at AND r.received_at=o.received_at
    AND x.body_hash=r.body_hash AND r.body_hash=encode(sha256(convert_to(m.body,'UTF8')),'hex')
    AND x.envelope_hash=encode(sha256(convert_to(t.id::text||':'||r.request_id::text||':'||r.visitor_hash||':'||r.body_hash,'UTF8')),'hex')) INTO valid;
 ELSIF o.event_key='shared.chat.conversation_created' THEN
  SELECT EXISTS(SELECT 1 FROM public.live_chat_sessions t JOIN public.inbox_widget_receipts r ON r.session_id=t.id
   WHERE t.id=o.conversation_id AND t.workspace_id=o.workspace_id AND x.provenance='widget_session'
    AND x.provider_id='session:'||t.id::text AND x.occurred_at=t.created_at AND x.received_at=r.received_at
    AND x.envelope_hash=encode(sha256(convert_to(t.id::text||':'||r.visitor_hash,'UTF8')),'hex')) INTO valid;
 ELSIF o.event_key IN('shared.linkedin.message_received','shared.linkedin.conversation_created') THEN
  SELECT EXISTS(SELECT 1 FROM public.linkedin_messages m
   JOIN public.linkedin_conversations t ON t.id=m.conversation_id AND t.account_id=m.account_id AND t.workspace_id=m.workspace_id
   JOIN public.inbox_unipile_envelopes r ON r.account_id=m.account_id AND r.provider_id=m.provider_message_id
   WHERE m.id=x.message_id AND (o.message_id=m.id OR o.event_key='shared.linkedin.conversation_created')
    AND m.workspace_id=o.workspace_id AND m.account_id=o.account_id AND m.conversation_id=o.conversation_id
    AND m.direction='inbound' AND r.provenance='live_signed' AND NOT r.self_sent AND r.chat_id=t.provider_chat_id
    AND x.provenance='unipile_signed' AND x.provider_id=r.provider_id AND x.occurred_at=r.occurred_at AND x.received_at=r.received_at
    AND x.envelope_hash=r.envelope_hash AND x.body_hash=r.body_hash AND r.body_hash=encode(sha256(convert_to(coalesce(m.body,''),'UTF8')),'hex')) INTO valid;
 END IF;
 RETURN coalesce(valid,false);
END $proof$;
CREATE OR REPLACE FUNCTION techerp_api.inbox_response_evidence_current(p_occurrence uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $proof$
 SELECT EXISTS(SELECT 1 FROM public.inbox_channel_occurrences o JOIN public.inbox_channel_evidence e ON e.id=o.envelope_id
 JOIN public.inbox_response_receipts r ON e.provider_id='response:'||r.id::text
 JOIN public.inbox_channel_occurrences incoming ON incoming.message_id=r.inbound_id AND incoming.workspace_id=r.workspace_id AND incoming.channel=r.channel AND incoming.account_id=r.account_id AND incoming.conversation_id=r.conversation_id AND incoming.event_key='shared.'||r.channel||'.message_received'
 WHERE o.id=p_occurrence AND o.event_key='shared.'||r.channel||'.first_response'
 AND ROW(o.workspace_id,o.channel,o.account_id,o.conversation_id,o.message_id,o.inbound_id,o.actor_id,o.occurred_at,o.received_at) IS NOT DISTINCT FROM ROW(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.inbound_id,r.actor_id,r.confirmed_at,r.confirmed_at)
 AND ROW(e.workspace_id,e.channel,e.account_id,e.conversation_id,e.message_id,e.actor_id,e.occurred_at,e.received_at) IS NOT DISTINCT FROM ROW(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.actor_id,r.confirmed_at,r.confirmed_at)
 AND e.provenance='confirmed_response' AND e.body_hash=r.body_hash AND e.envelope_hash=encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')
 AND techerp_api.inbox_response_source_current(r.id)
 AND techerp_api.inbox_response_projected(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.provider_id,r.body_hash)
 AND incoming.occurred_at<=r.confirmed_at AND incoming.received_at<=r.confirmed_at AND techerp_api.inbox_message_evidence_current(incoming.id));
$proof$;
CREATE OR REPLACE FUNCTION techerp_api.inbox_projection_response_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $capture$
DECLARE r record; u record; e record; v_channel text; v_conversation uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NEW.direction<>'outbound' THEN RETURN NEW; END IF;
 v_channel:=CASE WHEN TG_TABLE_NAME='email_messages' THEN 'email' ELSE 'linkedin' END;
 v_conversation:=CASE WHEN v_channel='email' THEN (to_jsonb(NEW)->>'thread_id')::uuid ELSE (to_jsonb(NEW)->>'conversation_id')::uuid END;
 IF v_channel='linkedin' THEN
  SELECT d.*,a.owner_id INTO u FROM public.unipile_delivery_receipts d JOIN public.unipile_accounts a ON a.id=d.account_id AND a.workspace_id=NEW.workspace_id
   WHERE d.account_id=NEW.account_id AND d.status='sent' AND d.inbox_request->>'endpoint'='message.send'
   AND coalesce(d.response#>>'{data,message_id}',d.response->>'message_id',d.response#>>'{data,message,id}',d.response#>>'{message,id}',CASE WHEN coalesce(d.response#>>'{data,object}',d.response->>'object','')<>'Chat' THEN coalesce(d.response#>>'{data,id}',d.response->>'id') END)=NEW.provider_message_id;
  IF FOUND THEN PERFORM techerp_api.inbox_response_record(NEW.workspace_id,'linkedin',NEW.account_id,v_conversation,NEW.id,NEW.provider_message_id,u.inbox_request->>'body',u.owner_id,'unipile_send',u.id,u.updated_at); END IF;
 ELSE
  SELECT fx.*,rn.owner_id INTO e FROM public.prospecting_sequence_effects fx JOIN public.prospecting_sequence_runs rn ON rn.id=fx.run_id AND rn.workspace_id=NEW.workspace_id
   WHERE fx.id=NEW.id AND fx.workspace_id=NEW.workspace_id AND fx.kind='email' AND fx.status='succeeded' AND fx.provider_receipt->>'messageId'=NEW.provider_message_id;
  IF FOUND THEN PERFORM techerp_api.inbox_response_record(NEW.workspace_id,'email',NEW.account_id,v_conversation,NEW.id,NEW.provider_message_id,e.provider_receipt->>'body',e.owner_id,'gmail_send',e.id,e.finished_at); END IF;
 END IF;
 FOR r IN SELECT ir.id FROM public.inbox_response_receipts ir WHERE ir.workspace_id=NEW.workspace_id AND ir.channel=v_channel AND ir.account_id=NEW.account_id AND ir.conversation_id=v_conversation AND ir.message_id=NEW.id AND ir.transport_state='accepted' LOOP PERFORM techerp_api.inbox_response_emit(r.id); END LOOP;
 RETURN NEW;
END $capture$;
NOTIFY pgrst,'reload schema';
