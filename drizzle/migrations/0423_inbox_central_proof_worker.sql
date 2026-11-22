CREATE FUNCTION techerp_api.inbox_selection_valid(p_workspace uuid,p_config jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE channel text; v jsonb;
BEGIN
 IF jsonb_typeof(p_config) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 channel:=techerp_api.inbox_event_channel(p_config->>'key');
 IF channel IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_config) k WHERE k NOT IN('key','channel','account_ids'))
  OR (p_config?'channel' AND p_config->>'channel' IS DISTINCT FROM channel) THEN RETURN false; END IF;
 IF p_config?'account_ids' THEN
  IF jsonb_typeof(p_config->'account_ids') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_config->'account_ids')>100 OR (SELECT count(DISTINCT x) FROM jsonb_array_elements(p_config->'account_ids') x)<>jsonb_array_length(p_config->'account_ids') THEN RETURN false; END IF;
  FOR v IN SELECT * FROM jsonb_array_elements(p_config->'account_ids') LOOP
   IF jsonb_typeof(v) IS DISTINCT FROM 'string' OR v#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
   IF channel='chat' AND v#>>'{}' IS DISTINCT FROM p_workspace::text THEN RETURN false; END IF;
  END LOOP;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_selection_valid(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.inbox_configuration_current(p_workflow uuid,p_user uuid,p_workspace uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w record; channel text; v jsonb;
BEGIN
 SELECT * INTO w FROM public.workflows WHERE id=p_workflow AND workspace_id=p_workspace;
 IF NOT FOUND THEN RETURN false; END IF;
 IF w.entity<>'inbox_channel_occurrences' OR p_user IS DISTINCT FROM coalesce(w.execution_user_id,w.owner_id)
  OR NOT public.is_workspace_member(p_workspace,p_user) OR public.is_read_only_view()
  OR NOT w.enabled OR w.status<>'published' OR w.published_version IS NULL OR w.trigger?'time_based'
  OR techerp_api.inbox_selection_valid(p_workspace,w.trigger->'notification_event') IS NOT TRUE
  OR techerp_api.inbox_actions_valid(w.actions) IS NOT TRUE THEN RETURN false; END IF;
 channel:=techerp_api.inbox_event_channel(w.trigger#>>'{notification_event,key}');
 FOR v IN SELECT * FROM jsonb_array_elements(coalesce(w.trigger#>'{notification_event,account_ids}','[]')) LOOP
  IF techerp_api.inbox_account_current(p_workspace,channel,(v#>>'{}')::uuid) IS NOT TRUE THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_configuration_current(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.inbox_message_evidence_current(p_occurrence uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o record; x record; valid boolean:=false;
BEGIN
 SELECT * INTO o FROM public.inbox_channel_occurrences WHERE id=p_occurrence;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO x FROM public.inbox_channel_evidence WHERE id=o.envelope_id;
 IF NOT FOUND THEN RETURN false; END IF;
 IF ROW(x.workspace_id,x.channel,x.account_id,x.conversation_id,x.occurred_at,x.received_at)
  IS DISTINCT FROM ROW(o.workspace_id,o.channel,o.account_id,o.conversation_id,o.occurred_at,o.received_at)
  OR techerp_api.inbox_account_current(o.workspace_id,o.channel,o.account_id) IS NOT TRUE THEN RETURN false; END IF;
 IF o.event_key='shared.email.message_received' THEN
  SELECT EXISTS(SELECT 1 FROM public.email_messages m
   JOIN public.email_threads t ON t.id=m.thread_id AND t.workspace_id=m.workspace_id AND t.account_id=m.account_id
   JOIN public.gmail_sync_queue q ON q.account_id=m.account_id AND q.provider_message_id=m.provider_message_id AND q.workspace_id=m.workspace_id
   WHERE m.id=x.message_id AND m.id=o.message_id AND m.workspace_id=o.workspace_id AND m.account_id=o.account_id
    AND t.id=o.conversation_id AND m.direction='inbound' AND x.provenance='gmail_incremental'
    AND q.provenance='incremental' AND NOT q.preexisting AND m.created_at>=q.discovered_at
    AND m.received_at=o.occurred_at AND q.discovered_at=o.received_at AND x.provider_id=m.provider_message_id
    AND x.body_hash=encode(sha256(convert_to(coalesce(m.body_text,m.body_html,''),'UTF8')),'hex')
    AND x.envelope_hash=encode(sha256(convert_to(jsonb_build_object('receipt',q.id,'workspace',q.workspace_id,'account',q.account_id,
     'provider_message',q.provider_message_id,'history_from',q.history_from,'history_to',q.history_to,'provenance',q.provenance,
     'discovered_at',q.discovered_at,'message',m.id,'thread',t.id,'provider_thread',t.provider_thread_id,'provider_timestamp',m.received_at)::text,'UTF8')),'hex')) INTO valid;
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
 -- Other transitions stay blocked pending their attested producers.
 RETURN coalesce(valid,false);
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_message_evidence_current(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION techerp_api.notification_business_proof_current(p public.notification_business_event_proofs)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE source jsonb; o record; s jsonb;
BEGIN
 IF techerp_api.inbox_event_channel(p.event_key) IS NOT NULL THEN
  SELECT * INTO o FROM public.inbox_channel_occurrences WHERE id=p.source_id AND workspace_id=p.workspace_id;
  IF NOT FOUND THEN RETURN false; END IF;
  s:=techerp_api.inbox_snapshot(o.id);
  RETURN coalesce(p.event_id IS NOT NULL AND p.source_table='inbox_channel_occurrences' AND p.producer_table='inbox_channel_evidence'
   AND o.event_key=p.event_key AND o.channel=techerp_api.inbox_event_channel(p.event_key) AND p.producer_id=o.envelope_id
   AND p.reference_id=o.conversation_id AND p.occurred_at=o.occurred_at AND p.occurrence_key=o.occurrence_key
   AND p.source_revision=encode(sha256(convert_to(s::text,'UTF8')),'hex')
   AND techerp_api.inbox_message_evidence_current(o.id),false);
 END IF;
 IF p.event_key IS DISTINCT FROM 'shared.message.received' THEN RETURN techerp_api.notification_business_proof_current_before_whatsapp(p); END IF;
 source:=techerp_api.notification_whatsapp_origin(p.source_id,p.producer_id)-'_received_at';
 RETURN coalesce(p.source_table='whatsapp_messages' AND p.producer_table='whatsapp_webhook_events'
  AND source IS NOT NULL AND source->>'workspace_id'=p.workspace_id::text AND source->>'conversation_id'=p.reference_id::text
  AND p.source_revision=encode(sha256(convert_to((source-'assigned_to')::text,'UTF8')),'hex')
  AND (source->>'occurred_at')::timestamptz=p.occurred_at,false);
END $$;
CREATE OR REPLACE FUNCTION techerp_api.sales_worker_check(p_source text,p_id uuid,p_user uuid,p_ws uuid,p_refs jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ref jsonb; remaining jsonb:='[]'; t text;
BEGIN
 IF jsonb_typeof(p_refs) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(p_refs)>100 OR p_user IS NULL OR NOT public.is_workspace_member(p_ws,p_user) THEN RETURN false; END IF;
 FOR ref IN SELECT * FROM jsonb_array_elements(p_refs) LOOP
  IF jsonb_typeof(ref) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF ref?'record_table' AND ref?'table' AND ref->>'record_table' IS DISTINCT FROM ref->>'table' THEN RETURN false; END IF;
  t:=coalesce(ref->>'record_table',ref->>'table');
  IF t IN('inbox_channel_occurrences','whatsapp_messages') THEN
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(ref) k WHERE k NOT IN('record_table','table','id','action')) OR coalesce(ref->>'action','view')<>'view'
    OR coalesce(ref->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  END IF;
  IF t='inbox_channel_occurrences' THEN
   IF techerp_api.inbox_subject_visible(p_ws,p_user,(ref->>'id')::uuid) IS NOT TRUE THEN RETURN false; END IF;
  ELSE remaining:=remaining||jsonb_build_array(ref); END IF;
 END LOOP;
 IF p_source='workflows' AND EXISTS(SELECT 1 FROM public.workflows WHERE id=p_id AND entity='inbox_channel_occurrences')
  AND techerp_api.inbox_configuration_current(p_id,p_user,p_ws) IS NOT TRUE THEN RETURN false; END IF;
 RETURN techerp_api.sales_worker_check_before_inbox_channels(p_source,p_id,p_user,p_ws,remaining);
END $$;
CREATE OR REPLACE TRIGGER inbox_workflow_guard BEFORE INSERT OR UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_workflow_guard();
CREATE OR REPLACE TRIGGER notification_whatsapp_workflow_guard BEFORE INSERT OR UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_whatsapp_workflow_guard();
NOTIFY pgrst,'reload schema';
