CREATE OR REPLACE FUNCTION public.linkedin_project_inbound()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a record;cid uuid; envelope record; message_time timestamptz; historical boolean:=false;
BEGIN
 SELECT * INTO a FROM public.unipile_accounts WHERE id=NEW.account_id;
 IF a.workspace_id IS NULL THEN RAISE EXCEPTION 'Account tenant unavailable';END IF;
 SELECT * INTO envelope FROM public.inbox_unipile_envelopes WHERE account_id=NEW.account_id AND provider_id=NEW.provider_message_id;
 IF FOUND THEN historical:=envelope.provenance='history';message_time:=envelope.occurred_at;END IF;
 -- created_at fallback is only ingestion metadata for undated history, never workflow proof.
 message_time:=coalesce(message_time,NEW.created_at);
 INSERT INTO public.linkedin_conversations(workspace_id,owner_id,account_id,provider_chat_id,sender_id,title,snippet,last_message_at)
 VALUES(a.workspace_id,a.owner_id,a.id,NEW.chat_id,NEW.sender_id,NEW.sender_id,left(coalesce(NEW.body,''),240),message_time)
 ON CONFLICT(account_id,provider_chat_id) DO UPDATE SET
  snippet=CASE WHEN EXCLUDED.last_message_at>=linkedin_conversations.last_message_at THEN EXCLUDED.snippet ELSE linkedin_conversations.snippet END,
  last_message_at=greatest(linkedin_conversations.last_message_at,EXCLUDED.last_message_at),
  status=CASE WHEN NOT historical AND EXCLUDED.last_message_at>=linkedin_conversations.last_message_at THEN 'open' ELSE linkedin_conversations.status END
 RETURNING id INTO cid;
 INSERT INTO public.linkedin_messages(workspace_id,conversation_id,account_id,provider_message_id,direction,body,created_at)
 VALUES(a.workspace_id,cid,a.id,NEW.provider_message_id,'inbound',coalesce(NEW.body,''),message_time)
 ON CONFLICT(account_id,provider_message_id) DO NOTHING;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.unipile_receive_message(p_account uuid,p_message text,p_chat text,p_sender text,p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a record;inserted uuid;candidate uuid;paused integer;
BEGIN
 SELECT * INTO a FROM public.unipile_accounts WHERE id=p_account FOR UPDATE;
 IF NOT FOUND OR a.status<>'connected' OR NOT public.unipile_personal_access(public.work_subject_context(a.workspace_id,a.owner_id),a.workspace_id,a.owner_id,'manage') THEN RETURN jsonb_build_object('accepted',false,'reason','account_unavailable');END IF;
 IF nullif(p_message,'') IS NULL OR nullif(p_chat,'') IS NULL OR nullif(p_sender,'') IS NULL OR length(p_message)>256 OR length(p_chat)>256 OR length(p_sender)>256 THEN RAISE EXCEPTION 'Invalid message identifiers';END IF;
 INSERT INTO public.unipile_inbound_messages(account_id,provider_message_id,chat_id,sender_id,body) VALUES(a.id,p_message,p_chat,p_sender,left(p_body,16000)) ON CONFLICT(account_id,provider_message_id) DO NOTHING RETURNING id INTO inserted;
 IF inserted IS NULL THEN RETURN jsonb_build_object('accepted',true,'duplicate',true,'paused',0);END IF;
 IF EXISTS(SELECT 1 FROM public.inbox_unipile_envelopes WHERE account_id=a.id AND provider_id=p_message AND provenance='history') THEN RETURN jsonb_build_object('accepted',true,'duplicate',false,'paused',0);END IF;
 SELECT candidate_id INTO candidate FROM public.unipile_message_log WHERE account_id=a.id AND target_identifier=p_sender AND candidate_id IS NOT NULL ORDER BY created_at DESC LIMIT 1;
 IF candidate IS NOT NULL THEN
  UPDATE public.ats_sourcing_enrollments SET status='replied',finished_at=now(),next_run_at=NULL,last_error='Candidato respondeu no LinkedIn; cadência interrompida' WHERE owner_id=a.owner_id AND workspace_id=a.workspace_id AND candidate_id=candidate AND status='active';GET DIAGNOSTICS paused=ROW_COUNT;
 END IF;
 RETURN jsonb_build_object('accepted',true,'duplicate',false,'paused',coalesce(paused,0));
END $$;
CREATE OR REPLACE FUNCTION public.linkedin_sequence_reply_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.direction<>'inbound' OR EXISTS(SELECT 1 FROM public.inbox_unipile_envelopes WHERE account_id=NEW.account_id AND provider_id=NEW.provider_message_id AND provenance='history') THEN RETURN NEW;END IF;
 INSERT INTO public.prospecting_sequence_reply_wakes(run_id,workspace_id,occurred_at)
 SELECT DISTINCT r.id,r.workspace_id,NEW.created_at FROM public.prospecting_sequence_runs r JOIN public.prospecting_sequence_effects e ON e.run_id=r.id JOIN public.linkedin_messages sent ON sent.id=e.id AND sent.workspace_id=r.workspace_id
 WHERE r.workspace_id=NEW.workspace_id AND r.state IN('active','waiting_task') AND e.kind='linkedin' AND e.status='succeeded' AND sent.conversation_id=NEW.conversation_id AND sent.account_id=NEW.account_id AND NEW.created_at>=e.finished_at
 ON CONFLICT(run_id) DO UPDATE SET occurred_at=greatest(prospecting_sequence_reply_wakes.occurred_at,excluded.occurred_at);
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.service_agent_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ch text:=CASE TG_TABLE_NAME WHEN 'email_messages' THEN 'email' WHEN 'linkedin_messages' THEN 'linkedin' ELSE 'chat' END;src uuid;
BEGIN
 IF ch='linkedin' AND EXISTS(SELECT 1 FROM public.inbox_unipile_envelopes WHERE account_id=NEW.account_id AND provider_id=NEW.provider_message_id AND provenance='history') THEN RETURN NEW;END IF;
 src:=CASE ch WHEN 'email' THEN (to_jsonb(NEW)->>'thread_id')::uuid WHEN 'linkedin' THEN (to_jsonb(NEW)->>'conversation_id')::uuid ELSE (to_jsonb(NEW)->>'session_id')::uuid END;
 IF NEW.direction='inbound' AND coalesce(auth.role(),'')='service_role' THEN
  BEGIN PERFORM public.service_agent_enqueue(ch,NEW.id);
  EXCEPTION WHEN OTHERS THEN
   INSERT INTO public.service_agent_ingest_errors(workspace_id,channel,message_id,error) VALUES(NEW.workspace_id,ch,NEW.id,left(SQLSTATE||': '||SQLERRM,500)) ON CONFLICT(channel,message_id) DO UPDATE SET error=excluded.error;
  END;
 ELSIF NEW.direction='outbound' AND NOT EXISTS(SELECT 1 FROM public.service_agent_jobs j JOIN public.service_agent_sessions s ON s.id=j.session_id
  WHERE j.workspace_id=NEW.workspace_id AND s.channel=ch AND s.source_id=src AND j.send_started_at IS NOT NULL
   AND (j.outbound_message_id=NEW.id OR (ch='email' AND EXISTS(SELECT 1 FROM public.email_threads t JOIN public.email_accounts a ON a.id=t.account_id AND a.workspace_id=t.workspace_id
    WHERE t.id=src AND t.workspace_id=NEW.workspace_id AND a.id=(to_jsonb(NEW)->>'account_id')::uuid AND lower(a.email)=lower(to_jsonb(NEW)->>'from_email') AND (
     (j.provider_message_id IS NOT NULL AND j.provider_message_id=to_jsonb(NEW)->>'provider_message_id') OR (j.status IN('running','uncertain') AND nullif(j.draft_payload->>'delivery_header','') IS NOT NULL AND j.draft_payload->>'delivery_header'=to_jsonb(NEW)->>'message_id_header' AND j.draft_text=to_jsonb(NEW)->>'body_text')))))
   AND coalesce(auth.role(),'')='service_role') THEN
  UPDATE public.service_agent_sessions SET ai_owner='human',ai_version=ai_version+1 WHERE workspace_id=NEW.workspace_id AND channel=ch AND source_id=src AND ai_owner='ai' AND coalesce(nullif(to_jsonb(NEW)->>'sent_at','')::timestamptz,NEW.created_at)>=coalesce(last_inbound_at,created_at);
 END IF;
 RETURN NEW;
END $$;
