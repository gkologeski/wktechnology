ALTER TABLE public.live_chat_messages ADD COLUMN inbox_chat_request uuid;
CREATE OR REPLACE FUNCTION public.inbox_chat_outbound_commit(p_workspace uuid,p_actor uuid,p_session uuid,p_request uuid,p_body text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'Envio exige INSERT sob o usuário real e RLS.' USING ERRCODE='42501'; END $$;
COMMENT ON FUNCTION public.inbox_chat_outbound_commit(uuid,uuid,uuid,uuid,text) IS 'DEPRECATED: privileged INSERT retired; canonical send uses authenticated INSERT/RLS with inbox_chat_request.';
CREATE FUNCTION techerp_api.inbox_chat_request_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF TG_OP='UPDATE' THEN
 IF NEW.inbox_chat_request IS DISTINCT FROM OLD.inbox_chat_request OR (OLD.inbox_chat_request IS NOT NULL AND ROW(NEW.id,NEW.workspace_id,NEW.owner_id,NEW.session_id,NEW.direction,NEW.author_user_id,NEW.body,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.workspace_id,OLD.owner_id,OLD.session_id,OLD.direction,OLD.author_user_id,OLD.body,OLD.created_at)) THEN RAISE EXCEPTION 'Envio canônico imutável.' USING ERRCODE='42501'; END IF; RETURN NEW; END IF;
 IF NEW.inbox_chat_request IS NULL THEN RETURN NEW; END IF;
 IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS DISTINCT FROM NEW.author_user_id OR NEW.id IS DISTINCT FROM NEW.inbox_chat_request OR NEW.direction<>'outbound' OR public.is_workspace_member(NEW.workspace_id,auth.uid()) IS NOT TRUE OR public.is_read_only_view() OR length(NEW.body) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Envio não autorizado.' USING ERRCODE='42501'; END IF;
 NEW.created_at:=clock_timestamp(); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_chat_request_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_chat_request_guard BEFORE INSERT OR UPDATE ON public.live_chat_messages FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_chat_request_guard();
CREATE FUNCTION techerp_api.inbox_chat_insert_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF auth.role()='authenticated' AND NEW.inbox_chat_request=NEW.id AND NEW.author_user_id=auth.uid() THEN
 PERFORM pg_advisory_xact_lock(hashtextextended('inbox-first:'||NEW.workspace_id||':chat:'||NEW.session_id,0));
 PERFORM techerp_api.inbox_response_record(NEW.workspace_id,'chat',NEW.workspace_id,NEW.session_id,NEW.id,NEW.id::text,NEW.body,auth.uid(),'human_chat',NEW.id,NEW.created_at); END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_chat_insert_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_chat_insert_capture AFTER INSERT ON public.live_chat_messages FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_chat_insert_capture();
CREATE OR REPLACE FUNCTION techerp_api.inbox_response_insert_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF NEW.confirmed_at>clock_timestamp() OR techerp_api.inbox_account_current(NEW.workspace_id,NEW.channel,NEW.account_id) IS NOT TRUE THEN RAISE EXCEPTION 'Recibo fora do transporte canônico.' USING ERRCODE='42501'; END IF;
 IF NEW.origin='human_chat' THEN
 IF auth.role()<>'authenticated' OR NEW.actor_id IS DISTINCT FROM auth.uid() OR NEW.transport_state<>'accepted' OR NEW.channel<>'chat' OR NEW.account_id<>NEW.workspace_id OR NEW.source_id<>NEW.message_id OR NOT EXISTS(SELECT 1 FROM public.live_chat_messages m WHERE m.id=NEW.message_id AND m.inbox_chat_request=m.id AND m.author_user_id=auth.uid() AND m.workspace_id=NEW.workspace_id AND m.session_id=NEW.conversation_id AND m.created_at=NEW.confirmed_at AND m.direction='outbound' AND encode(sha256(convert_to(m.body,'UTF8')),'hex')=NEW.body_hash) THEN RAISE EXCEPTION 'Recibo exige INSERT autenticado canônico.' USING ERRCODE='42501'; END IF;
 ELSIF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Recibo fora do transporte canônico.' USING ERRCODE='42501'; END IF;
 IF NEW.transport_state='reserved' THEN
 IF NEW.origin<>'gmail_send' OR NEW.channel<>'email' OR NEW.provider_id<>'reserved:'||NEW.source_id::text OR NEW.actor_id IS NULL OR NOT public.is_workspace_member(NEW.workspace_id,NEW.actor_id) THEN RAISE EXCEPTION 'Reserva inválida.' USING ERRCODE='42501'; END IF; NEW.inbound_id:=NULL; RETURN NEW; END IF;
 SELECT o.message_id INTO NEW.inbound_id FROM public.inbox_channel_occurrences o WHERE o.workspace_id=NEW.workspace_id AND o.channel=NEW.channel AND o.account_id=NEW.account_id AND o.conversation_id=NEW.conversation_id AND o.event_key='shared.'||NEW.channel||'.message_received' AND o.occurred_at<=NEW.confirmed_at AND o.received_at<=NEW.confirmed_at AND techerp_api.inbox_message_evidence_current(o.id) ORDER BY o.occurred_at DESC,o.id LIMIT 1; RETURN NEW;
END $$;
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
 IF NOT EXISTS(SELECT 1 FROM public.live_chat_messages m WHERE m.id=r.message_id AND m.inbox_chat_request=m.id AND m.id=r.source_id AND m.author_user_id=r.actor_id AND m.workspace_id=r.workspace_id AND m.session_id=r.conversation_id) THEN RETURN false; END IF;
 SELECT ARRAY[coalesce(assignee_id,owner_id)] INTO owners FROM public.live_chat_sessions WHERE id=r.conversation_id AND workspace_id=r.workspace_id;
 END IF;
 RETURN public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||r.channel,'create',owners);
END $$;
CREATE TABLE techerp_api.inbox_response_epoch(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),started_at timestamptz NOT NULL DEFAULT clock_timestamp());
REVOKE ALL ON techerp_api.inbox_response_epoch FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO techerp_api.inbox_response_epoch(singleton) VALUES(true);
CREATE TRIGGER inbox_response_epoch_immutable BEFORE UPDATE OR DELETE ON techerp_api.inbox_response_epoch FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_immutable_proof();
CREATE FUNCTION techerp_api.inbox_response_epoch() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT started_at FROM techerp_api.inbox_response_epoch WHERE singleton $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_response_epoch() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.inbox_response_history_blocked(p_workspace uuid,p_channel text,p_account uuid,p_conversation uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 -- Unknown predeployment outbound is quarantined, never promoted to proof.
 IF p_channel='email' THEN RETURN EXISTS(SELECT 1 FROM public.email_messages m WHERE m.workspace_id=p_workspace AND m.account_id=p_account AND m.thread_id=p_conversation AND m.direction='outbound' AND m.created_at<techerp_api.inbox_response_epoch() AND NOT EXISTS(SELECT 1 FROM public.inbox_response_receipts r WHERE r.workspace_id=p_workspace AND r.channel=p_channel AND r.account_id=p_account AND r.conversation_id=p_conversation AND r.message_id=m.id AND r.transport_state='accepted' AND r.inbound_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.email_messages i WHERE i.thread_id=p_conversation AND i.account_id=p_account AND i.workspace_id=p_workspace AND i.direction='inbound' AND coalesce(i.received_at,i.created_at)<=r.confirmed_at)));
 ELSIF p_channel='linkedin' THEN RETURN EXISTS(SELECT 1 FROM public.linkedin_messages m WHERE m.workspace_id=p_workspace AND m.account_id=p_account AND m.conversation_id=p_conversation AND m.direction='outbound' AND m.created_at<techerp_api.inbox_response_epoch() AND NOT EXISTS(SELECT 1 FROM public.inbox_response_receipts r WHERE r.workspace_id=p_workspace AND r.channel=p_channel AND r.account_id=p_account AND r.conversation_id=p_conversation AND r.message_id=m.id AND r.transport_state='accepted' AND r.inbound_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.linkedin_messages i WHERE i.conversation_id=p_conversation AND i.account_id=p_account AND i.workspace_id=p_workspace AND i.direction='inbound' AND i.created_at<=r.confirmed_at)));
 ELSIF p_channel='chat' THEN RETURN EXISTS(SELECT 1 FROM public.live_chat_messages m WHERE m.workspace_id=p_workspace AND m.session_id=p_conversation AND m.direction='outbound' AND m.created_at<techerp_api.inbox_response_epoch() AND NOT EXISTS(SELECT 1 FROM public.inbox_response_receipts r WHERE r.workspace_id=p_workspace AND r.channel=p_channel AND r.conversation_id=p_conversation AND r.message_id=m.id AND r.transport_state='accepted' AND r.inbound_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.live_chat_messages i WHERE i.session_id=p_conversation AND i.workspace_id=p_workspace AND i.direction='inbound' AND i.created_at<=r.confirmed_at)));
 END IF; RETURN true;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_response_history_blocked(uuid,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.inbox_response_eligible(p_receipt uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS(SELECT 1 FROM public.inbox_response_receipts r JOIN public.inbox_channel_occurrences incoming ON incoming.message_id=r.inbound_id AND incoming.workspace_id=r.workspace_id AND incoming.channel=r.channel AND incoming.account_id=r.account_id AND incoming.conversation_id=r.conversation_id AND incoming.event_key='shared.'||r.channel||'.message_received' WHERE r.id=p_receipt AND r.transport_state='accepted' AND incoming.occurred_at<=r.confirmed_at AND incoming.received_at<=r.confirmed_at AND techerp_api.inbox_message_evidence_current(incoming.id) AND techerp_api.inbox_response_source_current(r.id) AND techerp_api.inbox_response_projected(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.provider_id,r.body_hash)); $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_response_eligible(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION techerp_api.inbox_response_emit(p_receipt uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE r record; evidence uuid; BEGIN
 SELECT * INTO r FROM public.inbox_response_receipts WHERE id=p_receipt; IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('inbox-first:'||r.workspace_id||':'||r.channel||':'||r.conversation_id,0));
 IF techerp_api.inbox_response_eligible(r.id) IS NOT TRUE THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.inbox_channel_occurrences o WHERE o.workspace_id=r.workspace_id AND o.channel=r.channel AND o.conversation_id=r.conversation_id AND o.event_key='shared.'||r.channel||'.first_response' AND o.message_id IS DISTINCT FROM r.message_id) THEN RETURN NULL; END IF;
 IF r.confirmed_at<techerp_api.inbox_response_epoch() OR techerp_api.inbox_response_history_blocked(r.workspace_id,r.channel,r.account_id,r.conversation_id) THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.inbox_response_receipts earlier WHERE earlier.workspace_id=r.workspace_id AND earlier.channel=r.channel AND earlier.account_id=r.account_id AND earlier.conversation_id=r.conversation_id AND ROW(earlier.confirmed_at,earlier.id)<ROW(r.confirmed_at,r.id) AND techerp_api.inbox_response_eligible(earlier.id)) THEN RETURN NULL; END IF;
 INSERT INTO public.inbox_channel_evidence(workspace_id,channel,account_id,conversation_id,provider_id,message_id,provenance,envelope_hash,body_hash,occurred_at,received_at,actor_id) VALUES(r.workspace_id,r.channel,r.account_id,r.conversation_id,'response:'||r.id,r.message_id,'confirmed_response',encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex'),r.body_hash,r.confirmed_at,r.confirmed_at,r.actor_id) ON CONFLICT(channel,account_id,provider_id) DO NOTHING;
 SELECT id INTO evidence FROM public.inbox_channel_evidence WHERE channel=r.channel AND account_id=r.account_id AND provider_id='response:'||r.id; RETURN techerp_api.inbox_record(evidence,'first_response',r.message_id,r.inbound_id);
END $$;
NOTIFY pgrst,'reload schema';
