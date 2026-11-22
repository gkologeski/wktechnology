CREATE OR REPLACE FUNCTION techerp_api.inbox_gmail_acceptance_lineage_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $guard$
DECLARE v_parent public.inbox_response_receipts;
BEGIN
 IF NEW.transport_payload ? 'acceptance_id' THEN
  SELECT ir.* INTO v_parent FROM public.inbox_response_receipts ir WHERE ir.id=(NEW.transport_payload->>'acceptance_id')::uuid AND ir.origin='gmail_send' AND ir.transport_state='accepted';
  IF NOT FOUND OR auth.role() IS DISTINCT FROM 'service_role' OR NEW.origin<>'gmail_send' OR NEW.transport_state<>'accepted' OR v_parent.transport_payload ? 'acceptance_id'
   OR ROW(NEW.workspace_id,NEW.channel,NEW.account_id,NEW.actor_id,NEW.message_id,NEW.body_hash,NEW.confirmed_at) IS DISTINCT FROM ROW(v_parent.workspace_id,v_parent.channel,v_parent.account_id,v_parent.actor_id,v_parent.message_id,v_parent.body_hash,v_parent.confirmed_at)
   OR NEW.provider_id IS DISTINCT FROM v_parent.transport_payload->>'provider_id'
   OR (v_parent.provider_id IS DISTINCT FROM NEW.provider_id AND v_parent.provider_id IS DISTINCT FROM 'accepted:'||NEW.provider_id)
   OR (NEW.transport_payload-'acceptance_id') IS DISTINCT FROM v_parent.transport_payload
   OR NOT EXISTS(SELECT 1 FROM public.email_threads et WHERE et.id=NEW.conversation_id AND et.workspace_id=NEW.workspace_id AND et.account_id=NEW.account_id AND et.provider_thread_id=NEW.transport_payload->>'thread_id')
  THEN RAISE EXCEPTION 'Reconciliação exige o mesmo aceite privado imutável.' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $guard$;
NOTIFY pgrst,'reload schema';
