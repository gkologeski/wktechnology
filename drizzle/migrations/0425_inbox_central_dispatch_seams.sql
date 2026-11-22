CREATE FUNCTION techerp_api.notification_inbox_href(p_workspace uuid,p_occurrence uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT '/inbox/'||channel||'?conversation='||conversation_id::text FROM public.inbox_channel_occurrences
 WHERE id=p_occurrence AND workspace_id=p_workspace AND channel IN('email','chat','linkedin')
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_inbox_href(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION techerp_api.notification_inbox_existing_inapp(p_event uuid,p_user uuid)
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
 PERFORM pg_advisory_xact_lock(hashtextextended('inbox-notice:'||e.workspace_id||':'||o.conversation_id||':'||p_user,0));
 conversation_table:=CASE o.channel WHEN 'email' THEN 'email_threads' WHEN 'chat' THEN 'live_chat_sessions' WHEN 'linkedin' THEN 'linkedin_conversations' END;
 SELECT n.id INTO existing FROM public.notifications n JOIN public.notification_workspace_context c ON c.notification_id=n.id AND c.workspace_id=n.workspace_id
 WHERE n.workspace_id=e.workspace_id AND n.user_id=p_user AND n.read_at IS NULL
  AND ((n.type='message' AND n.entity='inbox_conversation' AND n.entity_id=o.conversation_id
    AND c.source_table=conversation_table AND c.source_id=o.conversation_id)
   OR (n.type='workflow' AND n.entity='inbox_channel_occurrences' AND c.source_table='inbox_channel_occurrences'
    AND c.source_id=n.entity_id AND EXISTS(SELECT 1 FROM public.inbox_channel_occurrences previous
      WHERE previous.id=n.entity_id AND previous.workspace_id=e.workspace_id AND previous.channel=o.channel
       AND previous.account_id=o.account_id AND previous.conversation_id=o.conversation_id)))
 ORDER BY n.created_at DESC,n.id LIMIT 1 FOR SHARE OF n;
 RETURN existing;
END $$;
-- Existing dispatch routines stay byte-identical: these BEFORE INSERT seams normalize their shared output.
CREATE FUNCTION techerp_api.inbox_notification_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.entity='inbox_channel_occurrences' THEN
  IF NOT public.is_workspace_member(NEW.workspace_id,NEW.user_id)
   OR techerp_api.inbox_subject_visible(NEW.workspace_id,NEW.user_id,NEW.entity_id) IS NOT TRUE THEN
   RAISE EXCEPTION 'Conversa indisponível para destinatário.' USING ERRCODE='42501';
  END IF;
  NEW.link:=techerp_api.notification_inbox_href(NEW.workspace_id,NEW.entity_id);
  IF NEW.link IS NULL THEN RAISE EXCEPTION 'Referência Inbox inválida.' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_notification_insert_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_notification_insert_guard BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_notification_insert_guard();
CREATE FUNCTION techerp_api.inbox_intent_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run record; wf record; href text;
BEGIN
 IF NEW.source_table<>'inbox_channel_occurrences' THEN RETURN NEW; END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=NEW.workflow_id AND workspace_id=NEW.workspace_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workflow indisponível.' USING ERRCODE='42501'; END IF;
 SELECT * INTO run FROM public.workflow_runs WHERE id=NEW.run_id AND workflow_id=wf.id AND workspace_id=NEW.workspace_id
  AND entity=NEW.source_table AND entity_id=NEW.source_id AND NOT is_test;
 IF NOT FOUND OR run.owner_id IS DISTINCT FROM wf.owner_id
  OR (NEW.occurrence_kind='initial' AND run.status<>'running')
  OR techerp_api.inbox_proof_chain_current(run.event_id,wf.id,NEW.workflow_version) IS NOT TRUE
  OR techerp_api.inbox_subject_visible(NEW.workspace_id,NEW.recipient_user_id,NEW.source_id) IS NOT TRUE THEN
  RAISE EXCEPTION 'Ocorrência ou destinatário indisponível.' USING ERRCODE='42501';
 END IF;
 href:=techerp_api.notification_inbox_href(NEW.workspace_id,NEW.source_id);
 NEW.payload_content_neutral:=jsonb_set(NEW.payload_content_neutral,'{href}',to_jsonb(href));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_intent_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_intent_guard BEFORE INSERT OR UPDATE ON public.notification_delivery_intents FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_intent_guard();
-- Every queued/resumed delivery is checked again at the actual worker write seam.
CREATE FUNCTION techerp_api.inbox_delivery_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i record; r record;
BEGIN
 IF NEW.notification_intent_id IS NULL OR NEW.status NOT IN('queued','sending','processing','retrying') THEN RETURN NEW; END IF;
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=NEW.notification_intent_id AND source_table='inbox_channel_occurrences';
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT * INTO r FROM public.workflow_runs WHERE id=i.run_id AND workflow_id=i.workflow_id AND workspace_id=i.workspace_id AND NOT is_test;
 IF NOT FOUND OR techerp_api.inbox_proof_chain_current(r.event_id,i.workflow_id,i.workflow_version) IS NOT TRUE
  OR techerp_api.inbox_subject_visible(i.workspace_id,i.recipient_user_id,i.source_id) IS NOT TRUE THEN
  RAISE EXCEPTION 'Entrega Inbox revogada.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_delivery_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_delivery_guard BEFORE INSERT OR UPDATE ON public.workflow_deliveries FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_delivery_guard();
NOTIFY pgrst,'reload schema';
