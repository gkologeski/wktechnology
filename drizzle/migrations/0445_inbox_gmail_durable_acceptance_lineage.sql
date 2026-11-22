CREATE FUNCTION techerp_api.inbox_gmail_acceptance_lineage_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $guard$
DECLARE v_parent public.inbox_response_receipts;
BEGIN
 IF NEW.transport_payload ? 'acceptance_id' THEN
  SELECT ir.* INTO v_parent FROM public.inbox_response_receipts ir WHERE ir.id=(NEW.transport_payload->>'acceptance_id')::uuid AND ir.origin='gmail_send' AND ir.transport_state='accepted';
  IF NOT FOUND OR auth.role() IS DISTINCT FROM 'service_role' OR NEW.origin<>'gmail_send' OR NEW.transport_state<>'accepted' OR v_parent.transport_payload ? 'acceptance_id'
   OR ROW(NEW.workspace_id,NEW.channel,NEW.account_id,NEW.actor_id,NEW.message_id,NEW.provider_id,NEW.body_hash,NEW.confirmed_at) IS DISTINCT FROM ROW(v_parent.workspace_id,v_parent.channel,v_parent.account_id,v_parent.actor_id,v_parent.message_id,v_parent.provider_id,v_parent.body_hash,v_parent.confirmed_at)
   OR (NEW.transport_payload-'acceptance_id') IS DISTINCT FROM v_parent.transport_payload
   OR NOT EXISTS(SELECT 1 FROM public.email_threads et WHERE et.id=NEW.conversation_id AND et.workspace_id=NEW.workspace_id AND et.account_id=NEW.account_id AND et.provider_thread_id=NEW.transport_payload->>'thread_id')
  THEN RAISE EXCEPTION 'Reconciliação exige o mesmo aceite privado imutável.' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION techerp_api.inbox_gmail_acceptance_lineage_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_gmail_acceptance_lineage_guard BEFORE INSERT ON public.inbox_response_receipts FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_gmail_acceptance_lineage_guard();
COMMENT ON FUNCTION techerp_api.inbox_gmail_acceptance_lineage_guard() IS 'Canonical Gmail acceptance is append-only before projection reads; a reconciliation receipt must preserve the original acceptance and real thread identity.';
DO $check$ BEGIN
 IF position('ir.channel=v_channel' IN pg_get_functiondef('techerp_api.inbox_projection_response_capture()'::regprocedure))=0 OR position('channel=channel' IN pg_get_functiondef('techerp_api.inbox_projection_response_capture()'::regprocedure))>0 THEN RAISE EXCEPTION 'Projection aliases must remain qualified as fixed in 0441'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='inbox_runtime_release_guard' AND tgenabled='O') THEN RAISE EXCEPTION 'Inbox release lock must remain enabled'; END IF;
END $check$;
NOTIFY pgrst,'reload schema';
