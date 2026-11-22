CREATE TABLE techerp_api.inbox_response_history_barriers(workspace_id uuid NOT NULL,channel text NOT NULL,account_id uuid NOT NULL,conversation_id uuid NOT NULL,blocked_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(workspace_id,channel,account_id,conversation_id));
REVOKE ALL ON techerp_api.inbox_response_history_barriers FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_response_history_barrier_immutable BEFORE UPDATE OR DELETE ON techerp_api.inbox_response_history_barriers FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_immutable_proof();
-- Backfill a private negative-only barrier, never an occurrence or a confirmed receipt.
INSERT INTO techerp_api.inbox_response_history_barriers(workspace_id,channel,account_id,conversation_id)
SELECT DISTINCT x.workspace_id,x.channel,x.account_id,x.conversation_id FROM(
 SELECT workspace_id,'email'::text channel,account_id,thread_id conversation_id FROM public.email_messages WHERE direction='outbound'
 UNION ALL SELECT workspace_id,'linkedin',account_id,conversation_id FROM public.linkedin_messages WHERE direction='outbound'
 UNION ALL SELECT workspace_id,'chat',workspace_id,session_id FROM public.live_chat_messages WHERE direction='outbound') x
WHERE techerp_api.inbox_response_history_blocked(x.workspace_id,x.channel,x.account_id,x.conversation_id) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION techerp_api.inbox_response_history_blocked(p_workspace uuid,p_channel text,p_account uuid,p_conversation uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM techerp_api.inbox_response_history_barriers b WHERE b.workspace_id=p_workspace AND b.channel=p_channel AND b.account_id=p_account AND b.conversation_id=p_conversation)
 OR EXISTS(WITH outbound AS(
 SELECT id,created_at FROM public.email_messages WHERE p_channel='email' AND workspace_id=p_workspace AND account_id=p_account AND thread_id=p_conversation AND direction='outbound'
 UNION ALL SELECT id,created_at FROM public.linkedin_messages WHERE p_channel='linkedin' AND workspace_id=p_workspace AND account_id=p_account AND conversation_id=p_conversation AND direction='outbound'
 UNION ALL SELECT id,created_at FROM public.live_chat_messages WHERE p_channel='chat' AND workspace_id=p_workspace AND session_id=p_conversation AND direction='outbound'), incoming AS(
 SELECT coalesce(received_at,created_at) at FROM public.email_messages WHERE p_channel='email' AND workspace_id=p_workspace AND account_id=p_account AND thread_id=p_conversation AND direction='inbound'
 UNION ALL SELECT created_at FROM public.linkedin_messages WHERE p_channel='linkedin' AND workspace_id=p_workspace AND account_id=p_account AND conversation_id=p_conversation AND direction='inbound'
 UNION ALL SELECT created_at FROM public.live_chat_messages WHERE p_channel='chat' AND workspace_id=p_workspace AND session_id=p_conversation AND direction='inbound')
 SELECT 1 FROM outbound m WHERE m.created_at<techerp_api.inbox_response_epoch() AND NOT EXISTS(
 SELECT 1 FROM public.inbox_response_receipts r WHERE r.workspace_id=p_workspace AND r.channel=p_channel AND r.account_id=p_account AND r.conversation_id=p_conversation AND r.message_id=m.id AND r.transport_state='accepted' AND r.inbound_id IS NULL AND NOT EXISTS(SELECT 1 FROM incoming i WHERE i.at<=r.confirmed_at)));
$$;
CREATE FUNCTION techerp_api.inbox_response_history_latch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE row_data jsonb; w uuid; channel_name text; account uuid; conversation uuid;
BEGIN
 row_data:=CASE WHEN TG_OP='INSERT' THEN to_jsonb(NEW) ELSE to_jsonb(OLD) END;
 w:=(row_data->>'workspace_id')::uuid; channel_name:=CASE TG_TABLE_NAME WHEN 'email_messages' THEN 'email' WHEN 'linkedin_messages' THEN 'linkedin' ELSE 'chat' END;
 account:=CASE WHEN channel_name='chat' THEN w ELSE (row_data->>'account_id')::uuid END;
 conversation:=(row_data->>CASE channel_name WHEN 'email' THEN 'thread_id' WHEN 'linkedin' THEN 'conversation_id' ELSE 'session_id' END)::uuid;
 IF techerp_api.inbox_response_history_blocked(w,channel_name,account,conversation) THEN
 INSERT INTO techerp_api.inbox_response_history_barriers(workspace_id,channel,account_id,conversation_id) VALUES(w,channel_name,account,conversation) ON CONFLICT DO NOTHING;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_response_history_latch() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_email_history_insert AFTER INSERT ON public.email_messages FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_response_history_latch();
CREATE TRIGGER inbox_email_history_change BEFORE UPDATE OR DELETE ON public.email_messages FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_response_history_latch();
CREATE TRIGGER inbox_linkedin_history_insert AFTER INSERT ON public.linkedin_messages FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_response_history_latch();
CREATE TRIGGER inbox_linkedin_history_change BEFORE UPDATE OR DELETE ON public.linkedin_messages FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_response_history_latch();
CREATE TRIGGER inbox_chat_history_insert AFTER INSERT ON public.live_chat_messages FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_response_history_latch();
CREATE TRIGGER inbox_chat_history_change BEFORE UPDATE OR DELETE ON public.live_chat_messages FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_response_history_latch();
CREATE OR REPLACE FUNCTION techerp_api.inbox_response_evidence_current(p_occurrence uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.inbox_channel_occurrences o JOIN public.inbox_channel_evidence e ON e.id=o.envelope_id
 JOIN public.inbox_response_receipts r ON e.provider_id='response:'||r.id::text
 JOIN public.inbox_channel_occurrences incoming ON incoming.message_id=r.inbound_id AND incoming.workspace_id=r.workspace_id AND incoming.channel=r.channel AND incoming.account_id=r.account_id AND incoming.conversation_id=r.conversation_id AND incoming.event_key='shared.'||r.channel||'.message_received'
 WHERE o.id=p_occurrence AND o.event_key='shared.'||r.channel||'.first_response'
 AND ROW(o.workspace_id,o.channel,o.account_id,o.conversation_id,o.message_id,o.inbound_id,o.actor_id,o.occurred_at,o.received_at) IS NOT DISTINCT FROM ROW(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.inbound_id,r.actor_id,r.confirmed_at,r.confirmed_at)
 AND ROW(e.workspace_id,e.channel,e.account_id,e.conversation_id,e.message_id,e.actor_id,e.occurred_at,e.received_at) IS NOT DISTINCT FROM ROW(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.message_id,r.actor_id,r.confirmed_at,r.confirmed_at)
 AND e.provenance='confirmed_response' AND e.body_hash=r.body_hash AND e.envelope_hash=encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')
 AND techerp_api.inbox_response_eligible(r.id)
 AND (r.confirmed_at<techerp_api.inbox_response_epoch() OR NOT techerp_api.inbox_response_history_blocked(r.workspace_id,r.channel,r.account_id,r.conversation_id)));
$$;
NOTIFY pgrst,'reload schema';
