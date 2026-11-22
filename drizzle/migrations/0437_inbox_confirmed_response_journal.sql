CREATE TABLE public.inbox_response_receipts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,channel text NOT NULL CHECK(channel IN('email','chat','linkedin')),
 account_id uuid NOT NULL,conversation_id uuid NOT NULL,message_id uuid NOT NULL,provider_id text NOT NULL,
 body_hash text NOT NULL CHECK(body_hash~'^[a-f0-9]{64}$'),actor_id uuid,inbound_id uuid,
 origin text NOT NULL CHECK(origin IN('human_chat','gmail_send','unipile_send','service_job')),source_id uuid NOT NULL,
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(origin,source_id),UNIQUE(channel,account_id,provider_id)
);
GRANT SELECT,INSERT ON public.inbox_response_receipts TO service_role;
ALTER TABLE public.inbox_response_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inbox_response_receipts FROM PUBLIC,anon,authenticated;
CREATE TRIGGER inbox_response_receipt_immutable BEFORE UPDATE OR DELETE ON public.inbox_response_receipts FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_immutable_proof();

CREATE FUNCTION techerp_api.inbox_response_projected(p_workspace uuid,p_channel text,p_account uuid,p_conversation uuid,p_message uuid,p_provider text,p_hash text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $projection$
BEGIN
 IF techerp_api.inbox_account_current(p_workspace,p_channel,p_account) IS NOT TRUE THEN RETURN false; END IF;
 IF p_channel='email' THEN RETURN EXISTS(SELECT 1 FROM public.email_messages m JOIN public.email_threads t ON t.id=m.thread_id AND t.account_id=m.account_id AND t.workspace_id=m.workspace_id WHERE m.id=p_message AND m.workspace_id=p_workspace AND m.account_id=p_account AND m.thread_id=p_conversation AND m.provider_message_id=p_provider AND m.direction='outbound' AND encode(sha256(convert_to(coalesce(m.body_text,m.body_html,''),'UTF8')),'hex')=p_hash);
 ELSIF p_channel='chat' THEN RETURN p_account=p_workspace AND EXISTS(SELECT 1 FROM public.live_chat_messages m JOIN public.live_chat_sessions t ON t.id=m.session_id AND t.workspace_id=m.workspace_id WHERE m.id=p_message AND m.workspace_id=p_workspace AND m.session_id=p_conversation AND m.id::text=p_provider AND m.direction='outbound' AND encode(sha256(convert_to(m.body,'UTF8')),'hex')=p_hash);
 ELSIF p_channel='linkedin' THEN RETURN EXISTS(SELECT 1 FROM public.linkedin_messages m JOIN public.linkedin_conversations t ON t.id=m.conversation_id AND t.account_id=m.account_id AND t.workspace_id=m.workspace_id WHERE m.id=p_message AND m.workspace_id=p_workspace AND m.account_id=p_account AND m.conversation_id=p_conversation AND m.provider_message_id=p_provider AND m.direction='outbound' AND encode(sha256(convert_to(coalesce(m.body,''),'UTF8')),'hex')=p_hash);
 END IF;
 RETURN false;
END $projection$;
REVOKE ALL ON FUNCTION techerp_api.inbox_response_projected(uuid,text,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.inbox_response_emit(p_receipt uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $emit$
DECLARE r record;evidence uuid;
BEGIN
 SELECT * INTO r FROM public.inbox_response_receipts WHERE id=p_receipt;
 IF NOT FOUND OR r.inbound_id IS NULL OR techerp_api.inbox_response_projected(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.provider_id,r.body_hash) IS NOT TRUE THEN RETURN NULL; END IF;
 -- Same conversation lock as canonical reply commits: concurrency cannot claim twice.
 PERFORM pg_advisory_xact_lock(hashtextextended('inbox-first:'||r.workspace_id||':'||r.channel||':'||r.conversation_id,0));
 IF EXISTS(SELECT 1 FROM public.inbox_response_receipts earlier WHERE earlier.workspace_id=r.workspace_id AND earlier.channel=r.channel AND earlier.conversation_id=r.conversation_id AND earlier.confirmed_at<r.confirmed_at) THEN RETURN NULL; END IF;
 INSERT INTO public.inbox_channel_evidence(workspace_id,channel,account_id,conversation_id,provider_id,message_id,provenance,envelope_hash,body_hash,occurred_at,received_at,actor_id)
 VALUES(r.workspace_id,r.channel,r.account_id,r.conversation_id,'response:'||r.id,r.message_id,'confirmed_response',encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex'),r.body_hash,r.confirmed_at,r.confirmed_at,r.actor_id)
 ON CONFLICT(channel,account_id,provider_id) DO NOTHING;
 SELECT id INTO evidence FROM public.inbox_channel_evidence WHERE channel=r.channel AND account_id=r.account_id AND provider_id='response:'||r.id;
 RETURN techerp_api.inbox_record(evidence,'first_response',r.message_id,r.inbound_id);
END $emit$;
REVOKE ALL ON FUNCTION techerp_api.inbox_response_emit(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.inbox_response_record(p_workspace uuid,p_channel text,p_account uuid,p_conversation uuid,p_message uuid,p_provider text,p_body text,p_actor uuid,p_origin text,p_source uuid,p_confirmed timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $record$
DECLARE receipt record;inbound uuid;digest text:=encode(sha256(convert_to(coalesce(p_body,''),'UTF8')),'hex');
BEGIN
 IF p_source IS NULL OR p_confirmed IS NULL OR p_confirmed>clock_timestamp() OR techerp_api.inbox_response_projected(p_workspace,p_channel,p_account,p_conversation,p_message,p_provider,digest) IS NOT TRUE THEN RAISE EXCEPTION 'Recibo confirmado sem projeção canônica.' USING ERRCODE='42501'; END IF;
 SELECT o.message_id INTO inbound FROM public.inbox_channel_occurrences o
 WHERE o.workspace_id=p_workspace AND o.channel=p_channel AND o.account_id=p_account AND o.conversation_id=p_conversation
 AND o.event_key='shared.'||p_channel||'.message_received' AND o.occurred_at<=p_confirmed AND o.received_at<=p_confirmed
 AND techerp_api.inbox_message_evidence_current(o.id) ORDER BY o.occurred_at DESC,o.id LIMIT 1;
 INSERT INTO public.inbox_response_receipts(workspace_id,channel,account_id,conversation_id,message_id,provider_id,body_hash,actor_id,inbound_id,origin,source_id,confirmed_at)
 VALUES(p_workspace,p_channel,p_account,p_conversation,p_message,p_provider,digest,p_actor,inbound,p_origin,p_source,p_confirmed)
 ON CONFLICT DO NOTHING;
 SELECT * INTO receipt FROM public.inbox_response_receipts WHERE origin=p_origin AND source_id=p_source;
 IF NOT FOUND OR ROW(receipt.workspace_id,receipt.channel,receipt.account_id,receipt.conversation_id,receipt.message_id,receipt.provider_id,receipt.body_hash,receipt.actor_id)
 IS DISTINCT FROM ROW(p_workspace,p_channel,p_account,p_conversation,p_message,p_provider,digest,p_actor) THEN RAISE EXCEPTION 'Recibo de resposta divergente.' USING ERRCODE='23505'; END IF;
 PERFORM techerp_api.inbox_response_emit(receipt.id);
 RETURN receipt.id;
END $record$;
REVOKE ALL ON FUNCTION techerp_api.inbox_response_record(uuid,text,uuid,uuid,uuid,text,text,uuid,text,uuid,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.inbox_response_evidence_current(p_occurrence uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $proof$
 SELECT EXISTS(SELECT 1 FROM public.inbox_channel_occurrences o JOIN public.inbox_channel_evidence e ON e.id=o.envelope_id
 JOIN public.inbox_response_receipts r ON e.provider_id='response:'||r.id::text
 JOIN public.inbox_channel_occurrences incoming ON incoming.message_id=r.inbound_id AND incoming.workspace_id=r.workspace_id AND incoming.channel=r.channel AND incoming.account_id=r.account_id AND incoming.conversation_id=r.conversation_id AND incoming.event_key='shared.'||r.channel||'.message_received'
 WHERE o.id=p_occurrence AND o.event_key='shared.'||r.channel||'.first_response'
 AND ROW(o.workspace_id,o.channel,o.account_id,o.conversation_id,o.message_id,o.inbound_id,o.actor_id,o.occurred_at,o.received_at)
 IS NOT DISTINCT FROM ROW(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.inbound_id,r.actor_id,r.confirmed_at,r.confirmed_at)
 AND ROW(e.workspace_id,e.channel,e.account_id,e.conversation_id,e.message_id,e.actor_id,e.occurred_at,e.received_at)
 IS NOT DISTINCT FROM ROW(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.actor_id,r.confirmed_at,r.confirmed_at)
 AND e.provenance='confirmed_response' AND e.body_hash=r.body_hash AND e.envelope_hash=encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')
 AND techerp_api.inbox_response_projected(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.provider_id,r.body_hash)
 AND incoming.occurred_at<=r.confirmed_at AND incoming.received_at<=r.confirmed_at AND techerp_api.inbox_message_evidence_current(incoming.id));
$proof$;
REVOKE ALL ON FUNCTION techerp_api.inbox_response_evidence_current(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.inbox_chat_outbound_commit(p_workspace uuid,p_actor uuid,p_session uuid,p_request uuid,p_body text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $chat$
DECLARE receipt record;message uuid;context jsonb;keys jsonb;at timestamptz:=clock_timestamp();
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_request IS NULL OR p_body IS NULL OR length(p_body) NOT BETWEEN 1 AND 2000
 OR public.is_workspace_member(p_workspace,p_actor) IS NOT TRUE OR public.is_read_only_view() IS TRUE THEN RAISE EXCEPTION 'Envio não autorizado.' USING ERRCODE='42501'; END IF;
 context:=public.work_subject_context(p_workspace,p_actor);keys:=context->'keys';
 IF NOT (coalesce((keys->>'techsales.inbox.chat.create.own')::boolean,false) OR coalesce((keys->>'techsales.inbox.chat.create.workspace')::boolean,false))
 OR techerp_api.inbox_subject_conversation(p_workspace,p_actor,'chat',p_workspace,p_session) IS NOT TRUE THEN RAISE EXCEPTION 'Envio não autorizado.' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.live_chat_sessions WHERE id=p_session AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conversa indisponível.' USING ERRCODE='42501'; END IF;
 SELECT * INTO receipt FROM public.inbox_response_receipts WHERE origin='human_chat' AND source_id=p_request;
 IF FOUND THEN
  IF ROW(receipt.workspace_id,receipt.conversation_id,receipt.actor_id,receipt.body_hash) IS DISTINCT FROM ROW(p_workspace,p_session,p_actor,encode(sha256(convert_to(p_body,'UTF8')),'hex')) THEN RAISE EXCEPTION 'Tentativa divergente.' USING ERRCODE='23505'; END IF;
  PERFORM techerp_api.inbox_response_emit(receipt.id);RETURN receipt.message_id;
 END IF;
 INSERT INTO public.live_chat_messages(workspace_id,owner_id,session_id,direction,author_user_id,body,created_at)
 VALUES(p_workspace,p_workspace,p_session,'outbound',p_actor,p_body,at) RETURNING id INTO message;
 PERFORM techerp_api.inbox_response_record(p_workspace,'chat',p_workspace,p_session,message,message::text,p_body,p_actor,'human_chat',p_request,at);
 RETURN message;
END $chat$;
REVOKE ALL ON FUNCTION public.inbox_chat_outbound_commit(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_chat_outbound_commit(uuid,uuid,uuid,uuid,text) TO service_role;

CREATE FUNCTION techerp_api.inbox_service_response_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $service$
DECLARE session record;account uuid;conversation uuid;
BEGIN
 -- Private jobs are not an outbound/status-editable client message authority.
 -- Only a canonical service completion crossing into sent can mint this receipt.
 IF auth.role() IS DISTINCT FROM 'service_role' OR NEW.status<>'sent' OR OLD.status='sent' OR NEW.sent_at IS NULL
  OR NEW.send_started_at IS NULL OR NEW.send_token IS NULL OR NEW.outbound_message_id IS NULL OR nullif(NEW.provider_message_id,'') IS NULL THEN RETURN NEW; END IF;
 IF OLD.status NOT IN('running','uncertain','skipped') THEN RAISE EXCEPTION 'Conclusão sem tentativa canônica.' USING ERRCODE='42501'; END IF;
 SELECT * INTO session FROM public.service_agent_sessions WHERE id=NEW.session_id AND workspace_id=NEW.workspace_id;
 IF NOT FOUND OR session.channel NOT IN('email','chat','linkedin') THEN RETURN NEW; END IF;
 conversation:=session.source_id;
 IF session.channel='email' THEN SELECT account_id INTO account FROM public.email_threads WHERE id=conversation AND workspace_id=NEW.workspace_id;
 ELSIF session.channel='linkedin' THEN SELECT account_id INTO account FROM public.linkedin_conversations WHERE id=conversation AND workspace_id=NEW.workspace_id;
 ELSE account:=NEW.workspace_id; END IF;
 PERFORM techerp_api.inbox_response_record(NEW.workspace_id,session.channel,account,conversation,NEW.outbound_message_id,NEW.provider_message_id,NEW.draft_text,NULL,'service_job',NEW.id,NEW.sent_at);
 RETURN NEW;
END $service$;
REVOKE ALL ON FUNCTION techerp_api.inbox_service_response_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_service_response_capture AFTER UPDATE OF status ON public.service_agent_jobs FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_service_response_capture();
NOTIFY pgrst,'reload schema';
