CREATE FUNCTION techerp_api.inbox_notification_context_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o record;
BEGIN
 IF NEW.entity<>'inbox_channel_occurrences' THEN RETURN NEW; END IF;
 SELECT * INTO o FROM public.inbox_channel_occurrences WHERE id=NEW.entity_id AND workspace_id=NEW.workspace_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Origem Inbox inválida.' USING ERRCODE='42501'; END IF;
 INSERT INTO public.notification_workspace_context(notification_id,workspace_id,source_table,source_id,event_key)
 VALUES(NEW.id,NEW.workspace_id,'inbox_channel_occurrences',o.id,o.event_key);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_notification_context_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_notification_context_capture AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_notification_context_capture();
CREATE OR REPLACE FUNCTION techerp_api.inbox_delivery_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i record; r record;
BEGIN
 IF NEW.notification_intent_id IS NULL OR NEW.status NOT IN('queued','in_flight','retry_scheduled') THEN RETURN NEW; END IF;
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=NEW.notification_intent_id AND source_table='inbox_channel_occurrences';
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT * INTO r FROM public.workflow_runs WHERE id=i.run_id AND workflow_id=i.workflow_id AND workspace_id=i.workspace_id AND NOT is_test;
 IF NOT FOUND OR techerp_api.inbox_proof_chain_current(r.event_id,i.workflow_id,i.workflow_version) IS NOT TRUE
  OR techerp_api.inbox_subject_visible(i.workspace_id,i.recipient_user_id,i.source_id) IS NOT TRUE THEN
  RAISE EXCEPTION 'Entrega Inbox revogada.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';
