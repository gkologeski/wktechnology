CREATE TABLE public.inbox_transition_receipts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,channel text NOT NULL CHECK(channel IN('email','chat','linkedin')),
 account_id uuid NOT NULL,conversation_id uuid NOT NULL,actor_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('conversation_assigned','conversation_status_changed')),
 previous_value text,next_value text,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(previous_value IS DISTINCT FROM next_value)
);
GRANT SELECT,INSERT ON public.inbox_transition_receipts TO service_role;
ALTER TABLE public.inbox_transition_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inbox_transition_receipts FROM PUBLIC,anon,authenticated;
CREATE TRIGGER inbox_transition_receipt_immutable BEFORE UPDATE OR DELETE ON public.inbox_transition_receipts FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_immutable_proof();
CREATE FUNCTION techerp_api.inbox_capture_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $capture$
DECLARE before_row jsonb:=to_jsonb(OLD);after_row jsonb:=to_jsonb(NEW);channel text;field text;kind text;account uuid;
 receipt record;evidence uuid;context jsonb;fields text[];
BEGIN
 -- Only real authenticated human updates attest these transitions.
 -- Service sync, history/backfill, auto-reopen and seed do not have this identity.
 IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL
  OR public.is_workspace_member(NEW.workspace_id,auth.uid()) IS NOT TRUE OR public.is_read_only_view() IS TRUE THEN RETURN NEW; END IF;
 context:=public.work_access_context();
 IF context->>'workspace' IS DISTINCT FROM NEW.workspace_id::text OR context->>'actor' IS DISTINCT FROM auth.uid()::text THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='email_threads' THEN channel:='email';fields:=ARRAY['assigned_to'];account:=NEW.account_id;
 ELSIF TG_TABLE_NAME='live_chat_sessions' THEN channel:='chat';fields:=ARRAY['assignee_id','status'];account:=NEW.workspace_id;
 ELSIF TG_TABLE_NAME='linkedin_conversations' THEN channel:='linkedin';fields:=ARRAY['status'];account:=NEW.account_id;
 ELSE RETURN NEW; END IF;
 IF techerp_api.inbox_account_current(NEW.workspace_id,channel,account) IS NOT TRUE THEN RETURN NEW; END IF;
 FOREACH field IN ARRAY fields LOOP
  IF before_row->field IS NOT DISTINCT FROM after_row->field THEN CONTINUE; END IF;
  IF channel='linkedin' THEN
   IF public.linkedin_inbox_access(context,NEW.workspace_id,NEW.owner_id,'manage') IS NOT TRUE THEN RAISE EXCEPTION 'Transição sem autorização.' USING ERRCODE='42501'; END IF;
  ELSE
   IF public.sales_record_access(TG_TABLE_NAME,NEW.id,'update') IS NOT TRUE THEN RAISE EXCEPTION 'Transição sem autorização.' USING ERRCODE='42501'; END IF;
   IF field IN('assigned_to','assignee_id') AND public.sales_record_access(TG_TABLE_NAME,NEW.id,'assign') IS NOT TRUE THEN RAISE EXCEPTION 'Atribuição sem autorização.' USING ERRCODE='42501'; END IF;
  END IF;
  kind:=CASE WHEN field='status' THEN 'conversation_status_changed' ELSE 'conversation_assigned' END;
  INSERT INTO public.inbox_transition_receipts(workspace_id,channel,account_id,conversation_id,actor_id,kind,previous_value,next_value)
   VALUES(NEW.workspace_id,channel,account,NEW.id,auth.uid(),kind,before_row->>field,after_row->>field) RETURNING * INTO receipt;
  INSERT INTO public.inbox_channel_evidence(workspace_id,channel,account_id,conversation_id,provider_id,provenance,envelope_hash,occurred_at,received_at,actor_id)
   VALUES(receipt.workspace_id,channel,account,NEW.id,'transition:'||receipt.id,'human_transition',encode(sha256(convert_to(to_jsonb(receipt)::text,'UTF8')),'hex'),receipt.occurred_at,receipt.occurred_at,receipt.actor_id) RETURNING id INTO evidence;
  PERFORM techerp_api.inbox_record(evidence,kind,NULL,NULL,receipt.previous_value,receipt.next_value);
 END LOOP;
 RETURN NEW;
END $capture$;
REVOKE ALL ON FUNCTION techerp_api.inbox_capture_transition() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_email_assignment_capture AFTER UPDATE OF assigned_to ON public.email_threads FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_capture_transition();
CREATE TRIGGER inbox_chat_transition_capture AFTER UPDATE OF assignee_id,status ON public.live_chat_sessions FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_capture_transition();
CREATE TRIGGER inbox_linkedin_status_capture AFTER UPDATE OF status ON public.linkedin_conversations FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_capture_transition();
CREATE FUNCTION techerp_api.inbox_transition_evidence_current(p_occurrence uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $proof$
 SELECT EXISTS(SELECT 1 FROM public.inbox_channel_occurrences o JOIN public.inbox_channel_evidence e ON e.id=o.envelope_id
 JOIN public.inbox_transition_receipts r ON e.provider_id='transition:'||r.id::text
 WHERE o.id=p_occurrence AND o.event_key='shared.'||r.channel||'.'||r.kind
 AND ROW(o.workspace_id,o.channel,o.account_id,o.conversation_id,o.actor_id,o.previous_status,o.status,o.occurred_at,o.received_at)
 IS NOT DISTINCT FROM ROW(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.actor_id,r.previous_value,r.next_value,r.occurred_at,r.occurred_at)
 AND ROW(e.workspace_id,e.channel,e.account_id,e.conversation_id,e.actor_id,e.occurred_at,e.received_at)
 IS NOT DISTINCT FROM ROW(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.actor_id,r.occurred_at,r.occurred_at)
 AND e.provenance='human_transition' AND e.envelope_hash=encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')
 AND techerp_api.inbox_account_current(r.workspace_id,r.channel,r.account_id));
$proof$;
REVOKE ALL ON FUNCTION techerp_api.inbox_transition_evidence_current(uuid) FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
