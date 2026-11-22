ALTER TABLE public.email_threads ADD COLUMN inbox_creation_receipt uuid;
COMMENT ON COLUMN public.email_threads.inbox_creation_receipt IS 'Private creation attestation: supplied only by claimed incremental Gmail persistence on INSERT; immutable thereafter. Not a client event authority.';
CREATE FUNCTION techerp_api.inbox_gmail_creation_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $guard$
DECLARE q public.gmail_sync_queue;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.inbox_creation_receipt IS DISTINCT FROM OLD.inbox_creation_receipt THEN RAISE EXCEPTION 'Prova de criação imutável.' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.inbox_creation_receipt IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO q FROM public.gmail_sync_queue WHERE id=NEW.inbox_creation_receipt AND workspace_id=NEW.workspace_id AND account_id=NEW.account_id;
 IF auth.role() IS DISTINCT FROM 'service_role' OR q.id IS NULL OR q.provenance<>'incremental' OR q.preexisting OR q.state<>'pending' OR q.lease_token IS NULL OR q.lease_until<=clock_timestamp() OR NEW.created_at<q.discovered_at OR NOT techerp_api.inbox_account_current(NEW.workspace_id,'email',NEW.account_id) THEN
  RAISE EXCEPTION 'Criação sem recebimento incremental reservado.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION techerp_api.inbox_gmail_creation_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_gmail_creation_guard BEFORE INSERT OR UPDATE ON public.email_threads FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_gmail_creation_guard();
CREATE OR REPLACE FUNCTION public.gmail_sync_finish(p_workspace uuid,p_account uuid,p_id uuid,p_token uuid,p_outcome text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $finish$
DECLARE q public.gmail_sync_queue; m public.email_messages; t public.email_threads; x public.inbox_channel_evidence;
 evidence_id uuid; occurrence_id uuid; envelope text; body_digest text;
BEGIN
 PERFORM public.gmail_sync_queue_authorize(p_workspace,p_account);
 SELECT * INTO q FROM public.gmail_sync_queue WHERE id=p_id AND account_id=p_account AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND OR q.state<>'pending' OR q.lease_token IS DISTINCT FROM p_token OR p_token IS NULL THEN RETURN false; END IF;
 IF p_outcome IS NULL OR p_outcome NOT IN('inserted','existing','skipped','gone') THEN RAISE EXCEPTION 'Resultado inválido.' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.email_messages WHERE account_id=p_account AND workspace_id=p_workspace AND provider_message_id=q.provider_message_id FOR SHARE;
 IF p_outcome IN('inserted','existing') AND m.id IS NULL THEN RAISE EXCEPTION 'Mensagem Gmail ainda não persistida.' USING ERRCODE='42501'; END IF;
 IF m.id IS NOT NULL AND q.provenance='incremental' AND NOT q.preexisting AND m.direction='inbound' THEN
  SELECT * INTO t FROM public.email_threads WHERE id=m.thread_id AND workspace_id=p_workspace AND account_id=p_account FOR SHARE;
  IF t.id IS NULL OR m.received_at IS NULL OR m.created_at<q.discovered_at OR m.received_at>clock_timestamp() OR t.provider_thread_id IS NULL OR NOT techerp_api.inbox_account_current(p_workspace,'email',p_account) OR p_outcome NOT IN('inserted','existing') THEN
   RAISE EXCEPTION 'Mensagem incremental sem prova conciliável.' USING ERRCODE='42501';
  END IF;
  envelope:=encode(sha256(convert_to(jsonb_build_object('receipt',q.id,'workspace',q.workspace_id,'account',q.account_id,'provider_message',q.provider_message_id,'history_from',q.history_from,'history_to',q.history_to,'provenance',q.provenance,'discovered_at',q.discovered_at,'message',m.id,'thread',t.id,'provider_thread',t.provider_thread_id,'provider_timestamp',m.received_at)::text,'UTF8')),'hex');
  body_digest:=encode(sha256(convert_to(coalesce(m.body_text,m.body_html,''),'UTF8')),'hex');
  INSERT INTO public.inbox_channel_evidence(workspace_id,channel,account_id,conversation_id,provider_id,message_id,provenance,envelope_hash,body_hash,occurred_at,received_at)
  VALUES(p_workspace,'email',p_account,t.id,q.provider_message_id,m.id,'gmail_incremental',envelope,body_digest,m.received_at,q.discovered_at) ON CONFLICT(channel,account_id,provider_id) DO NOTHING;
  SELECT * INTO x FROM public.inbox_channel_evidence WHERE channel='email' AND account_id=p_account AND provider_id=q.provider_message_id;
  IF ROW(x.workspace_id,x.conversation_id,x.message_id,x.provenance,x.envelope_hash,x.body_hash,x.occurred_at,x.received_at) IS DISTINCT FROM ROW(p_workspace,t.id,m.id,'gmail_incremental'::text,envelope,body_digest,m.received_at,q.discovered_at) THEN RAISE EXCEPTION 'Evidência Gmail divergente.' USING ERRCODE='42501'; END IF;
  evidence_id:=x.id;
  occurrence_id:=techerp_api.inbox_record(evidence_id,'message_received',m.id);
  IF occurrence_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.inbox_channel_occurrences WHERE id=occurrence_id AND workspace_id=p_workspace AND channel='email' AND account_id=p_account AND conversation_id=t.id AND message_id=m.id AND envelope_id=evidence_id AND occurred_at=m.received_at) THEN RAISE EXCEPTION 'Ocorrência Gmail não conciliada.' USING ERRCODE='42501'; END IF;
  -- Only the queue reserved by the INSERT owns creation. Existing retry reconciles
  -- that same immutable attestation; an older/sync/outbound thread cannot acquire it.
  IF t.inbox_creation_receipt=q.id THEN
   occurrence_id:=techerp_api.inbox_record(evidence_id,'conversation_created',NULL);
   IF occurrence_id IS NULL THEN RAISE EXCEPTION 'Criação Gmail não conciliada.' USING ERRCODE='42501'; END IF;
  END IF;
 END IF;
 UPDATE public.gmail_sync_queue SET state='done',message_id=m.id,outcome=p_outcome,completed_at=clock_timestamp(),lease_token=NULL,lease_until=NULL WHERE id=q.id;
 RETURN true;
END $finish$;
CREATE OR REPLACE FUNCTION techerp_api.inbox_transition_evidence_current(p_occurrence uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $proof$
DECLARE o public.inbox_channel_occurrences; e public.inbox_channel_evidence; r public.inbox_transition_receipts; c jsonb; ctx jsonb; resource text; field text;
BEGIN
 SELECT * INTO o FROM public.inbox_channel_occurrences WHERE id=p_occurrence;
 SELECT * INTO e FROM public.inbox_channel_evidence WHERE id=o.envelope_id;
 SELECT * INTO r FROM public.inbox_transition_receipts WHERE 'transition:'||id::text=e.provider_id;
 IF r.id IS NULL OR o.event_key IS DISTINCT FROM 'shared.'||r.channel||'.'||r.kind
 OR ROW(o.workspace_id,o.channel,o.account_id,o.conversation_id,o.actor_id,o.previous_status,o.status,o.occurred_at,o.received_at) IS DISTINCT FROM ROW(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.actor_id,r.previous_value,r.next_value,r.occurred_at,r.occurred_at)
 OR ROW(e.workspace_id,e.channel,e.account_id,e.conversation_id,e.actor_id,e.occurred_at,e.received_at) IS DISTINCT FROM ROW(r.workspace_id,r.channel,r.account_id,r.conversation_id,r.actor_id,r.occurred_at,r.occurred_at)
 OR e.provenance<>'human_transition' OR e.envelope_hash IS DISTINCT FROM encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')
 OR NOT public.is_workspace_member(r.workspace_id,r.actor_id) OR NOT techerp_api.inbox_account_current(r.workspace_id,r.channel,r.account_id)
 OR NOT techerp_api.inbox_subject_conversation(r.workspace_id,r.actor_id,r.channel,r.account_id,r.conversation_id) THEN RETURN false; END IF;
 IF r.channel='email' THEN SELECT to_jsonb(t) INTO c FROM public.email_threads t WHERE id=r.conversation_id AND workspace_id=r.workspace_id AND account_id=r.account_id;
 ELSIF r.channel='chat' THEN SELECT to_jsonb(t) INTO c FROM public.live_chat_sessions t WHERE id=r.conversation_id AND workspace_id=r.workspace_id;
 ELSIF r.channel='linkedin' THEN SELECT to_jsonb(t) INTO c FROM public.linkedin_conversations t WHERE id=r.conversation_id AND workspace_id=r.workspace_id AND account_id=r.account_id;
 ELSE RETURN false; END IF;
 field:=CASE WHEN r.kind='conversation_status_changed' THEN 'status' WHEN r.channel='chat' THEN 'assignee_id' ELSE 'assigned_to' END;
 IF c IS NULL OR c->>field IS DISTINCT FROM r.next_value THEN RETURN false; END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.actor_id);
 IF r.channel='linkedin' THEN RETURN public.linkedin_inbox_access(ctx,r.workspace_id,(c->>'owner_id')::uuid,'manage'); END IF;
 resource:='techsales.inbox.'||r.channel;
 RETURN public.sales_context_access(ctx,r.workspace_id,resource,'update',ARRAY[(c->>'owner_id')::uuid,(c->>CASE WHEN r.channel='chat' THEN 'assignee_id' ELSE 'assigned_to' END)::uuid])
 AND (r.kind<>'conversation_assigned' OR public.sales_context_access(ctx,r.workspace_id,resource,'assign',ARRAY[(c->>'owner_id')::uuid,(c->>field)::uuid]));
END $proof$;
NOTIFY pgrst,'reload schema';
