CREATE FUNCTION techerp_api.inbox_current_responsible(p_workspace uuid,p_occurrence uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o record; recipient uuid;
BEGIN
 SELECT * INTO o FROM public.inbox_channel_occurrences WHERE id=p_occurrence AND workspace_id=p_workspace;
 IF NOT FOUND OR NOT techerp_api.inbox_account_current(p_workspace,o.channel,o.account_id) THEN RETURN NULL; END IF;
 IF o.channel='email' THEN
  SELECT assigned_to INTO recipient FROM public.email_threads WHERE id=o.conversation_id AND workspace_id=p_workspace AND account_id=o.account_id FOR SHARE;
 ELSIF o.channel='chat' THEN
  SELECT assignee_id INTO recipient FROM public.live_chat_sessions WHERE id=o.conversation_id AND workspace_id=p_workspace AND o.account_id=p_workspace FOR SHARE;
 ELSIF o.channel='linkedin' THEN
  SELECT assigned_to INTO recipient FROM public.linkedin_conversations WHERE id=o.conversation_id AND workspace_id=p_workspace AND account_id=o.account_id FOR SHARE;
 ELSE RETURN NULL; END IF;
 IF recipient IS NULL OR NOT public.is_workspace_member(p_workspace,recipient) THEN RETURN NULL; END IF;
 RETURN recipient;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_current_responsible(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.notification_inbox_existing_inapp(p_event uuid,p_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e record; o record; conversation_table text; existing uuid;
BEGIN
 SELECT * INTO e FROM public.workflow_events WHERE id=p_event;
 IF NOT FOUND OR p_user IS NULL OR NOT public.is_workspace_member(e.workspace_id,p_user)
  OR NOT techerp_api.notification_source_visible(e.workspace_id,p_user,e.entity,e.entity_id) THEN RETURN NULL; END IF;
 IF e.notification_event_key='shared.message.received' AND e.entity='whatsapp_messages' THEN
  RETURN techerp_api.notification_whatsapp_existing_inapp(p_event,p_user);
 END IF;
 IF e.entity<>'inbox_channel_occurrences' OR techerp_api.inbox_event_channel(e.notification_event_key) IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO o FROM public.inbox_channel_occurrences WHERE id=e.entity_id AND workspace_id=e.workspace_id;
 IF NOT FOUND OR o.event_key IS DISTINCT FROM e.notification_event_key
  OR techerp_api.inbox_current_responsible(e.workspace_id,o.id) IS DISTINCT FROM p_user THEN RETURN NULL; END IF;
 conversation_table:=CASE o.channel WHEN 'email' THEN 'email_threads' WHEN 'chat' THEN 'live_chat_sessions' WHEN 'linkedin' THEN 'linkedin_conversations' END;
 SELECT n.id INTO existing FROM public.notifications n
  JOIN public.notification_workspace_context c ON c.notification_id=n.id AND c.workspace_id=n.workspace_id
  WHERE n.workspace_id=e.workspace_id AND n.user_id=p_user AND n.type='message'
   AND n.entity='inbox_conversation' AND n.entity_id=o.conversation_id AND n.read_at IS NULL
   AND c.source_table=conversation_table AND c.source_id=o.conversation_id
  ORDER BY n.created_at DESC,n.id LIMIT 1 FOR SHARE OF n;
 RETURN existing;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_inbox_existing_inapp(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
