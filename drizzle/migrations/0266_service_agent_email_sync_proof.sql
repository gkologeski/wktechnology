-- Gmail synchronization may persist the accepted outbound before the delivery callback.
-- Match only trusted provider proof or the current authorized nonce+body+mailbox; real human mail still takes over.
CREATE OR REPLACE FUNCTION public.service_agent_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ch text:=CASE TG_TABLE_NAME WHEN 'email_messages' THEN 'email' ELSE 'chat' END;src uuid;
BEGIN
 src:=CASE ch WHEN 'email' THEN (to_jsonb(NEW)->>'thread_id')::uuid ELSE (to_jsonb(NEW)->>'session_id')::uuid END;
 IF NEW.direction='inbound' AND coalesce(auth.role(),'')='service_role' THEN
  BEGIN PERFORM public.service_agent_enqueue(ch,NEW.id);
  EXCEPTION WHEN OTHERS THEN
   INSERT INTO public.service_agent_ingest_errors(workspace_id,channel,message_id,error)
   VALUES(NEW.workspace_id,ch,NEW.id,left(SQLSTATE||': '||SQLERRM,500)) ON CONFLICT(channel,message_id) DO UPDATE SET error=excluded.error;
  END;
 ELSIF NEW.direction='outbound' AND NOT EXISTS(SELECT 1 FROM public.service_agent_jobs j JOIN public.service_agent_sessions s ON s.id=j.session_id
  WHERE j.workspace_id=NEW.workspace_id AND s.channel=ch AND s.source_id=src AND j.send_started_at IS NOT NULL
  AND (j.outbound_message_id=NEW.id OR (ch='email' AND EXISTS(
   SELECT 1 FROM public.email_threads t JOIN public.email_accounts a ON a.id=t.account_id AND a.workspace_id=t.workspace_id
   WHERE t.id=src AND t.workspace_id=NEW.workspace_id AND a.id=(to_jsonb(NEW)->>'account_id')::uuid
   AND lower(a.email)=lower(to_jsonb(NEW)->>'from_email')) AND (
    (j.provider_message_id IS NOT NULL AND j.provider_message_id=to_jsonb(NEW)->>'provider_message_id') OR
    (j.status IN('running','uncertain') AND nullif(j.draft_payload->>'delivery_header','') IS NOT NULL
     AND j.draft_payload->>'delivery_header'=to_jsonb(NEW)->>'message_id_header' AND j.draft_text=to_jsonb(NEW)->>'body_text')
   )))
  AND coalesce(auth.role(),'')='service_role') THEN
  UPDATE public.service_agent_sessions SET ai_owner='human',ai_version=ai_version+1 WHERE workspace_id=NEW.workspace_id AND channel=ch AND source_id=src AND ai_owner='ai' AND coalesce(nullif(to_jsonb(NEW)->>'sent_at','')::timestamptz,NEW.created_at)>=coalesce(last_inbound_at,created_at);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_message_event() FROM PUBLIC,anon,authenticated;
