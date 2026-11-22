ALTER TABLE public.inbox_response_receipts ADD COLUMN transport_state text NOT NULL DEFAULT 'accepted' CHECK(transport_state IN('reserved','accepted'));
ALTER TABLE public.inbox_response_receipts ADD COLUMN transport_payload jsonb;
ALTER TABLE public.unipile_delivery_receipts ADD COLUMN inbox_request jsonb;
CREATE FUNCTION techerp_api.inbox_unipile_receipt_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $guard$
BEGIN
 IF TG_OP='DELETE' AND OLD.status='sent' THEN RAISE EXCEPTION 'Recibo aceito imutável.' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.status='sent' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Recibo aceito imutável.' USING ERRCODE='42501'; END IF;
  IF OLD.inbox_request IS NOT NULL AND NEW.inbox_request IS DISTINCT FROM OLD.inbox_request THEN RAISE EXCEPTION 'Pedido canônico imutável.' USING ERRCODE='42501'; END IF;
  IF ROW(NEW.account_id,NEW.request_key,NEW.created_at) IS DISTINCT FROM ROW(OLD.account_id,OLD.request_key,OLD.created_at) THEN RAISE EXCEPTION 'Origem do transporte imutável.' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $guard$;
REVOKE ALL ON FUNCTION techerp_api.inbox_unipile_receipt_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_unipile_receipt_guard BEFORE UPDATE OR DELETE ON public.unipile_delivery_receipts FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_unipile_receipt_guard();
CREATE FUNCTION techerp_api.inbox_response_insert_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $guard$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NEW.confirmed_at>clock_timestamp() OR NOT techerp_api.inbox_account_current(NEW.workspace_id,NEW.channel,NEW.account_id) THEN RAISE EXCEPTION 'Recibo fora do transporte canônico.' USING ERRCODE='42501'; END IF;
 IF NEW.transport_state='reserved' THEN
  IF NEW.origin<>'gmail_send' OR NEW.channel<>'email' OR NEW.provider_id<>'reserved:'||NEW.source_id::text OR NEW.actor_id IS NULL OR NOT public.is_workspace_member(NEW.workspace_id,NEW.actor_id) THEN RAISE EXCEPTION 'Reserva inválida.' USING ERRCODE='42501'; END IF;
  NEW.inbound_id:=NULL; RETURN NEW;
 END IF;
 -- Never accept a caller-selected inbound. Resolve only persisted canonical input.
 SELECT o.message_id INTO NEW.inbound_id FROM public.inbox_channel_occurrences o
 WHERE o.workspace_id=NEW.workspace_id AND o.channel=NEW.channel AND o.account_id=NEW.account_id AND o.conversation_id=NEW.conversation_id
 AND o.event_key='shared.'||NEW.channel||'.message_received' AND o.occurred_at<=NEW.confirmed_at AND o.received_at<=NEW.confirmed_at
 AND techerp_api.inbox_message_evidence_current(o.id) ORDER BY o.occurred_at DESC,o.id LIMIT 1;
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION techerp_api.inbox_response_insert_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_response_insert_guard BEFORE INSERT ON public.inbox_response_receipts FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_response_insert_guard();
CREATE FUNCTION techerp_api.inbox_response_source_current(p_receipt uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $source$
DECLARE r public.inbox_response_receipts; u public.unipile_delivery_receipts; j public.service_agent_jobs; s public.service_agent_sessions;
 effect public.prospecting_sequence_effects; run public.prospecting_sequence_runs; actor uuid; ctx jsonb; owners uuid[];
BEGIN
 SELECT * INTO r FROM public.inbox_response_receipts WHERE id=p_receipt AND transport_state='accepted';
 IF r.id IS NULL THEN RETURN false; END IF;
 actor:=r.actor_id;
 IF r.origin='unipile_send' THEN
  SELECT * INTO u FROM public.unipile_delivery_receipts WHERE id=r.source_id AND account_id=r.account_id AND status='sent';
  IF u.id IS NULL OR u.inbox_request->>'endpoint' IS DISTINCT FROM 'message.send' OR u.inbox_request->>'body' IS NULL
   OR encode(sha256(convert_to(u.inbox_request->>'body','UTF8')),'hex') IS DISTINCT FROM r.body_hash
   OR coalesce(u.response#>>'{data,message_id}',u.response->>'message_id',u.response#>>'{data,message,id}',u.response#>>'{message,id}',CASE WHEN coalesce(u.response#>>'{data,object}',u.response->>'object','')<>'Chat' THEN coalesce(u.response#>>'{data,id}',u.response->>'id') END) IS DISTINCT FROM r.provider_id
   OR u.updated_at IS DISTINCT FROM r.confirmed_at THEN RETURN false; END IF;
  SELECT owner_id INTO actor FROM public.unipile_accounts WHERE id=r.account_id AND workspace_id=r.workspace_id;
  IF actor IS DISTINCT FROM r.actor_id THEN RETURN false; END IF;
 ELSIF r.origin='service_job' THEN
  SELECT * INTO j FROM public.service_agent_jobs WHERE id=r.source_id AND workspace_id=r.workspace_id AND status='sent';
  SELECT * INTO s FROM public.service_agent_sessions WHERE id=j.session_id AND workspace_id=r.workspace_id AND channel=r.channel AND source_id=r.conversation_id;
  IF j.id IS NULL OR s.id IS NULL OR j.send_token IS NULL OR j.send_started_at IS NULL OR j.outbound_message_id IS DISTINCT FROM r.message_id OR j.provider_message_id IS DISTINCT FROM r.provider_id OR encode(sha256(convert_to(j.draft_text,'UTF8')),'hex') IS DISTINCT FROM r.body_hash THEN RETURN false; END IF;
  SELECT owner_id INTO actor FROM public.sdr_enrollments WHERE id=s.enrollment_id AND workspace_id=r.workspace_id;
 ELSIF r.origin='gmail_send' AND r.transport_payload IS NULL THEN
  SELECT * INTO effect FROM public.prospecting_sequence_effects WHERE id=r.source_id AND workspace_id=r.workspace_id AND kind='email' AND status='succeeded';
  SELECT * INTO run FROM public.prospecting_sequence_runs WHERE id=effect.run_id AND workspace_id=r.workspace_id;
  IF effect.id IS NULL OR run.id IS NULL OR effect.provider_receipt->>'messageId' IS DISTINCT FROM r.provider_id OR effect.sender->>'sourceKey' IS DISTINCT FROM r.account_id::text OR encode(sha256(convert_to(effect.provider_receipt->>'body','UTF8')),'hex') IS DISTINCT FROM r.body_hash THEN RETURN false; END IF;
  actor:=run.owner_id;
  IF actor IS DISTINCT FROM r.actor_id THEN RETURN false; END IF;
 ELSIF r.origin='gmail_send' THEN
  -- This immutable private payload was stored immediately after messages.send accepted,
  -- before any history/notification projection. Client message edits cannot mint it.
  IF r.channel<>'email' OR r.transport_payload->>'provider_id' IS DISTINCT FROM r.provider_id OR r.transport_payload->>'thread_id' IS NULL
   OR encode(sha256(convert_to(coalesce(r.transport_payload->>'body',''),'UTF8')),'hex') IS DISTINCT FROM r.body_hash
   OR NOT EXISTS(SELECT 1 FROM public.email_threads WHERE id=r.conversation_id AND workspace_id=r.workspace_id AND account_id=r.account_id AND provider_thread_id=r.transport_payload->>'thread_id') THEN RETURN false; END IF;
 ELSIF r.origin<>'human_chat' THEN RETURN false; END IF;
 IF actor IS NULL OR NOT public.is_workspace_member(r.workspace_id,actor) OR NOT techerp_api.inbox_subject_conversation(r.workspace_id,actor,r.channel,r.account_id,r.conversation_id) THEN RETURN false; END IF;
 ctx:=public.work_subject_context(r.workspace_id,actor);
 IF r.channel='linkedin' THEN
  SELECT ARRAY[owner_id] INTO owners FROM public.linkedin_conversations WHERE id=r.conversation_id AND workspace_id=r.workspace_id AND account_id=r.account_id;
  RETURN public.linkedin_inbox_access(ctx,r.workspace_id,owners[1],'create');
 ELSIF r.channel='email' THEN SELECT ARRAY[owner_id,assigned_to] INTO owners FROM public.email_threads WHERE id=r.conversation_id AND workspace_id=r.workspace_id AND account_id=r.account_id;
 ELSE SELECT ARRAY[owner_id,assignee_id] INTO owners FROM public.live_chat_sessions WHERE id=r.conversation_id AND workspace_id=r.workspace_id; END IF;
 RETURN public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||r.channel,'create',owners);
END $source$;
REVOKE ALL ON FUNCTION techerp_api.inbox_response_source_current(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION techerp_api.inbox_response_emit(p_receipt uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $emit$
DECLARE r public.inbox_response_receipts; evidence uuid;
BEGIN
 SELECT * INTO r FROM public.inbox_response_receipts WHERE id=p_receipt AND transport_state='accepted';
 IF NOT FOUND OR r.inbound_id IS NULL OR NOT techerp_api.inbox_response_source_current(r.id) OR NOT techerp_api.inbox_response_projected(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.provider_id,r.body_hash) THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('inbox-first:'||r.workspace_id||':'||r.channel||':'||r.conversation_id,0));
 -- Reserves only a real response to canonical input. Outbound prospecting before
 -- any input, reserved attempts and failed deliveries cannot consume first response.
 IF EXISTS(SELECT 1 FROM public.inbox_response_receipts earlier WHERE earlier.transport_state='accepted' AND earlier.inbound_id IS NOT NULL AND earlier.workspace_id=r.workspace_id AND earlier.channel=r.channel AND earlier.conversation_id=r.conversation_id AND ROW(earlier.confirmed_at,earlier.id)<ROW(r.confirmed_at,r.id)) THEN RETURN NULL; END IF;
 INSERT INTO public.inbox_channel_evidence(workspace_id,channel,account_id,conversation_id,provider_id,message_id,provenance,envelope_hash,body_hash,occurred_at,received_at,actor_id)
 VALUES(r.workspace_id,r.channel,r.account_id,r.conversation_id,'response:'||r.id,r.message_id,'confirmed_response',encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex'),r.body_hash,r.confirmed_at,r.confirmed_at,r.actor_id) ON CONFLICT(channel,account_id,provider_id) DO NOTHING;
 SELECT id INTO evidence FROM public.inbox_channel_evidence WHERE channel=r.channel AND account_id=r.account_id AND provider_id='response:'||r.id;
 RETURN techerp_api.inbox_record(evidence,'first_response',r.message_id,r.inbound_id);
END $emit$;
CREATE FUNCTION techerp_api.inbox_projection_response_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $capture$
DECLARE r record; u record; e record; channel text; conversation uuid;
BEGIN
 -- Sync/self/client edits are never transport confirmation. Only a private
 -- previously accepted transport receipt can match this projection.
 IF auth.role() IS DISTINCT FROM 'service_role' OR NEW.direction<>'outbound' THEN RETURN NEW; END IF;
 channel:=CASE WHEN TG_TABLE_NAME='email_messages' THEN 'email' ELSE 'linkedin' END;
 conversation:=CASE WHEN channel='email' THEN (to_jsonb(NEW)->>'thread_id')::uuid ELSE (to_jsonb(NEW)->>'conversation_id')::uuid END;
 IF channel='linkedin' THEN
  SELECT d.*,a.owner_id INTO u FROM public.unipile_delivery_receipts d JOIN public.unipile_accounts a ON a.id=d.account_id AND a.workspace_id=NEW.workspace_id
   WHERE d.account_id=NEW.account_id AND d.status='sent' AND d.inbox_request->>'endpoint'='message.send'
   AND coalesce(d.response#>>'{data,message_id}',d.response->>'message_id',d.response#>>'{data,message,id}',d.response#>>'{message,id}',CASE WHEN coalesce(d.response#>>'{data,object}',d.response->>'object','')<>'Chat' THEN coalesce(d.response#>>'{data,id}',d.response->>'id') END)=NEW.provider_message_id;
  IF FOUND THEN PERFORM techerp_api.inbox_response_record(NEW.workspace_id,'linkedin',NEW.account_id,conversation,NEW.id,NEW.provider_message_id,u.inbox_request->>'body',u.owner_id,'unipile_send',u.id,u.updated_at); END IF;
 ELSE
  SELECT fx.*,rn.owner_id INTO e FROM public.prospecting_sequence_effects fx JOIN public.prospecting_sequence_runs rn ON rn.id=fx.run_id AND rn.workspace_id=NEW.workspace_id
   WHERE fx.id=NEW.id AND fx.workspace_id=NEW.workspace_id AND fx.kind='email' AND fx.status='succeeded' AND fx.provider_receipt->>'messageId'=NEW.provider_message_id;
  IF FOUND THEN PERFORM techerp_api.inbox_response_record(NEW.workspace_id,'email',NEW.account_id,conversation,NEW.id,NEW.provider_message_id,e.provider_receipt->>'body',e.owner_id,'gmail_send',e.id,e.finished_at); END IF;
 END IF;
 FOR r IN SELECT id FROM public.inbox_response_receipts WHERE workspace_id=NEW.workspace_id AND channel=channel AND account_id=NEW.account_id AND conversation_id=conversation AND message_id=NEW.id AND transport_state='accepted' LOOP
  PERFORM techerp_api.inbox_response_emit(r.id);
 END LOOP;
 RETURN NEW;
END $capture$;
REVOKE ALL ON FUNCTION techerp_api.inbox_projection_response_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_email_response_capture AFTER INSERT OR UPDATE ON public.email_messages FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_projection_response_capture();
CREATE TRIGGER inbox_linkedin_response_capture AFTER INSERT OR UPDATE ON public.linkedin_messages FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_projection_response_capture();
NOTIFY pgrst,'reload schema';
