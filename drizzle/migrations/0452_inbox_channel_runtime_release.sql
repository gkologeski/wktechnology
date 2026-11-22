-- Release availability only. Authorization, evidence, consent, RLS and grants remain intact.
DO $release$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.workflows'::regclass
   AND tgname='inbox_runtime_release_guard' AND tgenabled='O')
   OR to_regprocedure('techerp_api.inbox_proof_chain_current(uuid,uuid,integer)') IS NULL
   OR to_regprocedure('techerp_api.notification_business_resume_capture()') IS NULL
   OR to_regprocedure('public.inbox_gmail_recovery_project(uuid,uuid,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'Inbox runtime release prerequisites missing.'; END IF;
 IF EXISTS(SELECT 1 FROM (VALUES
  ('shared.email.message_received'),('shared.email.conversation_created'),
  ('shared.email.conversation_assigned'),('shared.email.first_response'),
  ('shared.chat.message_received'),('shared.chat.conversation_created'),
  ('shared.chat.conversation_assigned'),('shared.chat.conversation_status_changed'),('shared.chat.first_response'),
  ('shared.linkedin.message_received'),('shared.linkedin.conversation_created'),
  ('shared.linkedin.conversation_status_changed'),('shared.linkedin.first_response')
 ) supported(event_key) WHERE techerp_api.inbox_event_channel(supported.event_key) IS NULL)
  OR techerp_api.inbox_event_channel('shared.message.received') IS NOT NULL
  OR has_function_privilege('authenticated','public.inbox_gmail_recovery_claim(uuid,uuid,uuid,integer)','EXECUTE')
  OR has_function_privilege('anon','public.inbox_gmail_recovery_project(uuid,uuid,uuid,uuid)','EXECUTE')
  OR has_table_privilege('authenticated','public.inbox_response_receipts','SELECT')
  OR has_table_privilege('anon','public.inbox_response_receipts','SELECT')
 THEN RAISE EXCEPTION 'Inbox runtime release boundary check failed.'; END IF;
END $release$;
DROP TRIGGER inbox_runtime_release_guard ON public.workflows;
NOTIFY pgrst,'reload schema';
