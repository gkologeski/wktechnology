-- Correct the executable subject bridge; no replacement authorization path.
CREATE OR REPLACE FUNCTION public.notify_assigned_inbox_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user_id uuid;v_workspace_id uuid;v_channel text;v_conversation_id uuid;v_sender text;v_body text;v_link text;v_preferences jsonb;v_is_active boolean;
 channel_key text;account uuid;
BEGIN
 IF NEW.direction IS DISTINCT FROM 'inbound' THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='whatsapp_messages' THEN
  SELECT c.assigned_to,coalesce(c.workspace_id,c.owner_id),c.id,c.contact_phone INTO v_user_id,v_workspace_id,v_conversation_id,v_sender FROM public.whatsapp_conversations c WHERE c.id=NEW.conversation_id;
  v_channel:='WhatsApp';v_body:=NEW.body;v_link:='/inbox/whatsapp?conversation='||NEW.conversation_id::text;
 ELSIF TG_TABLE_NAME='email_messages' THEN
  SELECT t.assigned_to,t.workspace_id,t.id,coalesce(NEW.from_name,NEW.from_email,t.subject,'Remetente'),t.account_id INTO v_user_id,v_workspace_id,v_conversation_id,v_sender,account FROM public.email_threads t WHERE t.id=NEW.thread_id AND t.workspace_id=NEW.workspace_id AND t.account_id=NEW.account_id;
  channel_key:='email';v_channel:='E-mail';v_body:=coalesce(NEW.snippet,NEW.body_text,NEW.subject);v_link:='/inbox/email?conversation='||v_conversation_id::text;
 ELSIF TG_TABLE_NAME='live_chat_messages' THEN
  SELECT s.assignee_id,s.workspace_id,s.id,coalesce(s.visitor_name,s.visitor_email,'Visitante') INTO v_user_id,v_workspace_id,v_conversation_id,v_sender FROM public.live_chat_sessions s WHERE s.id=NEW.session_id AND s.workspace_id=NEW.workspace_id;
  account:=v_workspace_id;channel_key:='chat';v_channel:='Chat ao vivo';v_body:=NEW.body;v_link:='/inbox/chat?conversation='||v_conversation_id::text;
 ELSE RETURN NEW;END IF;
 IF v_user_id IS NULL OR v_workspace_id IS NULL OR v_conversation_id IS NULL THEN RETURN NEW;END IF;
 IF channel_key IS NULL THEN
  SELECT EXISTS(SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id=v_workspace_id AND wm.user_id=v_user_id AND coalesce(wm.status,'active')<>'inactive'
    UNION ALL SELECT 1 FROM public.workspaces w WHERE w.id=v_workspace_id AND w.created_by=v_user_id) INTO v_is_active;
 ELSE
  v_is_active:=public.is_workspace_member(v_workspace_id,v_user_id);
  IF v_is_active THEN
   v_is_active:=techerp_api.inbox_subject_conversation(v_workspace_id,v_user_id,channel_key,account,v_conversation_id);
  END IF;
 END IF;
 IF NOT coalesce(v_is_active,false) THEN RETURN NEW;END IF;
 SELECT p.notification_preferences INTO v_preferences FROM public.profiles p WHERE p.id=v_user_id;
 IF coalesce((v_preferences#>>'{message,inapp}')::boolean,true) IS NOT TRUE THEN RETURN NEW;END IF;
 IF channel_key IS NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(v_workspace_id::text||':'||v_user_id::text||':'||v_conversation_id::text,0));
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended('inbox-notice:'||v_workspace_id||':'||v_conversation_id||':'||v_user_id,0));
 END IF;
 IF EXISTS(SELECT 1 FROM public.notifications n WHERE n.workspace_id=v_workspace_id AND n.user_id=v_user_id AND n.read_at IS NULL
   AND ((n.type='message' AND n.entity='inbox_conversation' AND n.entity_id=v_conversation_id)
    OR (channel_key IS NOT NULL AND n.type='workflow' AND n.entity='inbox_channel_occurrences' AND EXISTS(
      SELECT 1 FROM public.inbox_channel_occurrences o JOIN public.notification_workspace_context c ON c.notification_id=n.id AND c.workspace_id=o.workspace_id AND c.source_table='inbox_channel_occurrences' AND c.source_id=o.id
      WHERE o.id=n.entity_id AND o.workspace_id=v_workspace_id AND o.channel=channel_key AND o.account_id=account AND o.conversation_id=v_conversation_id)))) THEN RETURN NEW;END IF;
 INSERT INTO public.notifications(owner_id,workspace_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
 VALUES(v_workspace_id,v_workspace_id,v_user_id,'message','Nova mensagem no '||v_channel,
 left(coalesce(v_sender,'Cliente')||CASE WHEN nullif(btrim(coalesce(v_body,'')),'') IS NULL THEN '' ELSE ': '||regexp_replace(v_body,'<[^>]+>',' ','g') END,240),v_link,'inbox_conversation',v_conversation_id,TG_TABLE_NAME||':'||NEW.id::text||':'||v_user_id::text)
 ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
 RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';
