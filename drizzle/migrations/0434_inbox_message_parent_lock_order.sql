-- A legacy notification owns the advisory notice lock before service_agent_enqueue
-- tries FOR UPDATE on its parent. Concurrent message inserts already hold FK
-- KEY SHARE locks on that parent: this reverses the order and deadlocks.
-- Serialize on the exact tenant/account parent BEFORE FK and AFTER triggers.
CREATE FUNCTION techerp_api.inbox_message_parent_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.direction IS DISTINCT FROM 'inbound' THEN RETURN NEW;END IF;
 IF TG_TABLE_NAME='email_messages' THEN
  PERFORM 1 FROM public.email_threads t
   WHERE t.id=NEW.thread_id AND t.workspace_id=NEW.workspace_id AND t.account_id=NEW.account_id
   FOR UPDATE;
 ELSIF TG_TABLE_NAME='live_chat_messages' THEN
  PERFORM 1 FROM public.live_chat_sessions s
   WHERE s.id=NEW.session_id AND s.workspace_id=NEW.workspace_id
   FOR UPDATE;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_message_parent_lock() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_message_parent_lock BEFORE INSERT ON public.email_messages
 FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_message_parent_lock();
CREATE TRIGGER inbox_message_parent_lock BEFORE INSERT ON public.live_chat_messages
 FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_message_parent_lock();
COMMENT ON FUNCTION techerp_api.inbox_message_parent_lock() IS 'Lock order: exact workspace/account conversation row, then inbox-notice advisory lock. No occurrence, permission, notification, or transport side effect. Prevents FK KEY SHARE/advisory/FOR UPDATE cycle with legacy service-agent ingestion.';
DO $verify$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='inbox_runtime_release_guard' AND tgenabled='O') THEN
  RAISE EXCEPTION 'Draft release lock must remain enabled';
 END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
