CREATE TABLE techerp_api.inbox_gmail_recovery (
 receipt_id uuid PRIMARY KEY REFERENCES public.inbox_response_receipts(id),
 workspace_id uuid NOT NULL, account_id uuid NOT NULL, accepted_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','claimed','completed')),
 next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 lease_token uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 last_error_code text, completed_at timestamptz
);
REVOKE ALL ON techerp_api.inbox_gmail_recovery FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE techerp_api.inbox_gmail_recovery ENABLE ROW LEVEL SECURITY;
CREATE INDEX inbox_gmail_recovery_due ON techerp_api.inbox_gmail_recovery(workspace_id,account_id,next_attempt_at,accepted_at,receipt_id) WHERE state<>'completed';
CREATE TABLE techerp_api.inbox_gmail_recovery_attempts (
 receipt_id uuid NOT NULL REFERENCES techerp_api.inbox_gmail_recovery(receipt_id),
 attempt integer NOT NULL, token uuid NOT NULL, started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz, outcome text NOT NULL DEFAULT 'running' CHECK(outcome IN('running','completed','retry','expired')), error_code text,
 PRIMARY KEY(receipt_id,attempt)
);
REVOKE ALL ON techerp_api.inbox_gmail_recovery_attempts FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE techerp_api.inbox_gmail_recovery_attempts ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION techerp_api.inbox_gmail_recovery_enqueue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.origin='gmail_send' AND NEW.channel='email' AND NEW.transport_state='accepted'
  AND NOT (NEW.transport_payload ? 'acceptance_id') AND NEW.provider_id='accepted:'||(NEW.transport_payload->>'provider_id')
  AND NEW.transport_payload->>'thread_id' IS NOT NULL THEN
  INSERT INTO techerp_api.inbox_gmail_recovery(receipt_id,workspace_id,account_id,accepted_at)
  VALUES(NEW.id,NEW.workspace_id,NEW.account_id,NEW.confirmed_at) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_gmail_recovery_enqueue() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER inbox_gmail_recovery_enqueue AFTER INSERT ON public.inbox_response_receipts FOR EACH ROW EXECUTE FUNCTION techerp_api.inbox_gmail_recovery_enqueue();
-- Additive queue backfill includes ALL immutable transport acceptances, not a recent sample.
INSERT INTO techerp_api.inbox_gmail_recovery(receipt_id,workspace_id,account_id,accepted_at)
 SELECT r.id,r.workspace_id,r.account_id,r.confirmed_at FROM public.inbox_response_receipts r
 WHERE r.origin='gmail_send' AND r.channel='email' AND r.transport_state='accepted'
 AND NOT (r.transport_payload ? 'acceptance_id') AND r.provider_id='accepted:'||(r.transport_payload->>'provider_id')
 AND r.transport_payload->>'thread_id' IS NOT NULL ON CONFLICT DO NOTHING;
CREATE FUNCTION techerp_api.inbox_gmail_recovery_authorize(p_workspace uuid,p_account uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.email_accounts;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Recuperação privada.' USING ERRCODE='42501'; END IF;
 SELECT ea.* INTO a FROM public.email_accounts ea WHERE ea.id=p_account AND ea.workspace_id=p_workspace FOR SHARE;
 IF NOT FOUND OR a.provider<>'gmail' OR a.status<>'connected' THEN RAISE EXCEPTION 'Conta indisponível.' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.workspace_members wm WHERE wm.workspace_id=p_workspace AND wm.user_id=a.owner_id AND wm.status='active' FOR SHARE;
 IF NOT FOUND OR NOT public.is_workspace_member(p_workspace,a.owner_id)
  OR public.sales_account_job_authorize('email_accounts',p_account) IS NOT TRUE THEN
  RAISE EXCEPTION 'Job sem autorização atual.' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION techerp_api.inbox_gmail_recovery_authorize(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.inbox_gmail_recovery_claim(p_workspace uuid,p_account uuid,p_token uuid,p_limit integer DEFAULT 25)
RETURNS TABLE(receipt_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q record;
BEGIN
 PERFORM techerp_api.inbox_gmail_recovery_authorize(p_workspace,p_account);
 IF p_token IS NULL OR p_limit IS NULL OR p_limit<1 OR p_limit>25 THEN RAISE EXCEPTION 'Lote inválido.' USING ERRCODE='22023'; END IF;
 FOR q IN SELECT r.* FROM techerp_api.inbox_gmail_recovery r WHERE r.workspace_id=p_workspace AND r.account_id=p_account
  AND r.state<>'completed' AND r.next_attempt_at<=clock_timestamp() AND (r.state='pending' OR r.lease_until<=clock_timestamp())
  ORDER BY r.next_attempt_at,r.accepted_at,r.receipt_id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  UPDATE techerp_api.inbox_gmail_recovery_attempts a SET finished_at=clock_timestamp(),outcome='expired',error_code='LEASE_EXPIRED'
   WHERE a.receipt_id=q.receipt_id AND a.attempt=q.attempts AND a.outcome='running';
  UPDATE techerp_api.inbox_gmail_recovery r SET state='claimed',lease_token=p_token,lease_until=clock_timestamp()+interval '5 minutes',attempts=r.attempts+1
   WHERE r.receipt_id=q.receipt_id;
  INSERT INTO techerp_api.inbox_gmail_recovery_attempts(receipt_id,attempt,token) VALUES(q.receipt_id,q.attempts+1,p_token);
  receipt_id:=q.receipt_id; RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.inbox_gmail_recovery_claim(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_gmail_recovery_claim(uuid,uuid,uuid,integer) TO service_role;
CREATE FUNCTION public.inbox_gmail_recovery_project(p_workspace uuid,p_account uuid,p_token uuid,p_receipt uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q techerp_api.inbox_gmail_recovery; r public.inbox_response_receipts; t public.email_threads; m public.email_messages;
 conversation uuid; canonical uuid; source uuid; hex text; ctx jsonb; code text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Recuperação privada.' USING ERRCODE='42501'; END IF;
 SELECT rq.* INTO q FROM techerp_api.inbox_gmail_recovery rq WHERE rq.receipt_id=p_receipt AND rq.workspace_id=p_workspace AND rq.account_id=p_account FOR UPDATE;
 IF NOT FOUND OR q.state<>'claimed' OR q.lease_token IS DISTINCT FROM p_token OR q.lease_until<=clock_timestamp() THEN RETURN false; END IF;
 BEGIN
  PERFORM techerp_api.inbox_gmail_recovery_authorize(p_workspace,p_account);
  SELECT ir.* INTO r FROM public.inbox_response_receipts ir WHERE ir.id=p_receipt AND ir.workspace_id=p_workspace AND ir.account_id=p_account;
  IF r.origin IS DISTINCT FROM 'gmail_send' OR r.channel IS DISTINCT FROM 'email' OR r.transport_state IS DISTINCT FROM 'accepted'
   OR r.transport_payload IS NULL OR r.transport_payload ? 'acceptance_id'
   OR r.provider_id IS DISTINCT FROM 'accepted:'||(r.transport_payload->>'provider_id')
   OR r.transport_payload->>'thread_id' IS NULL OR r.actor_id IS NULL
   OR encode(sha256(convert_to(coalesce(r.transport_payload->>'body',''),'UTF8')),'hex') IS DISTINCT FROM r.body_hash
   OR NOT public.is_workspace_member(p_workspace,r.actor_id)
   OR NOT EXISTS(SELECT 1 FROM public.email_accounts ea WHERE ea.id=p_account AND ea.workspace_id=p_workspace AND ea.owner_id=r.actor_id)
   THEN RAISE EXCEPTION 'Aceite canônico inválido.' USING ERRCODE='42501'; END IF;
  SELECT et.* INTO t FROM public.email_threads et WHERE et.workspace_id=p_workspace AND et.account_id=p_account AND et.provider_thread_id=r.transport_payload->>'thread_id' FOR UPDATE;
  ctx:=public.work_subject_context(p_workspace,r.actor_id);
  IF t.id IS NOT NULL THEN
   conversation:=t.id;
   IF NOT techerp_api.inbox_subject_conversation(p_workspace,r.actor_id,'email',p_account,t.id)
    OR NOT public.sales_context_access(ctx,p_workspace,'techsales.inbox.email','create',ARRAY[t.owner_id,t.assigned_to]) THEN
    RAISE EXCEPTION 'Conversa sem autorização.' USING ERRCODE='42501'; END IF;
  ELSE
   t:=jsonb_populate_record(NULL::public.email_threads,r.transport_payload->'thread');
   IF t.owner_id IS DISTINCT FROM r.actor_id OR NOT public.sales_context_access(ctx,p_workspace,'techsales.inbox.email','view',ARRAY[r.actor_id])
    OR NOT public.sales_context_access(ctx,p_workspace,'techsales.inbox.email','create',ARRAY[r.actor_id]) THEN
    RAISE EXCEPTION 'Criação sem autorização.' USING ERRCODE='42501'; END IF;
   conversation:=r.conversation_id;
   INSERT INTO public.email_threads(id,workspace_id,account_id,owner_id,provider_thread_id,subject,snippet,last_message_at,contact_id,lead_id,deal_id,company_id)
    VALUES(conversation,p_workspace,p_account,r.actor_id,r.transport_payload->>'thread_id',t.subject,t.snippet,t.last_message_at,t.contact_id,t.lead_id,t.deal_id,t.company_id)
    ON CONFLICT(account_id,provider_thread_id) DO NOTHING;
   SELECT et.* INTO t FROM public.email_threads et WHERE et.workspace_id=p_workspace AND et.account_id=p_account AND et.provider_thread_id=r.transport_payload->>'thread_id' FOR UPDATE;
   conversation:=t.id;
   IF conversation IS NULL OR NOT techerp_api.inbox_subject_conversation(p_workspace,r.actor_id,'email',p_account,conversation)
    OR NOT public.sales_context_access(ctx,p_workspace,'techsales.inbox.email','create',ARRAY[t.owner_id,t.assigned_to]) THEN
    RAISE EXCEPTION 'Conversa divergente.' USING ERRCODE='42501'; END IF;
  END IF;
  hex:=encode(sha256(convert_to(format('["gmail-projection","%s"]',r.source_id),'UTF8')),'hex');
  source:=(substr(hex,1,8)||'-'||substr(hex,9,4)||'-4'||substr(hex,14,3)||'-8'||substr(hex,18,3)||'-'||substr(hex,21,12))::uuid;
  INSERT INTO public.inbox_response_receipts(workspace_id,channel,account_id,conversation_id,message_id,provider_id,body_hash,actor_id,origin,source_id,confirmed_at,transport_state,transport_payload)
   VALUES(p_workspace,'email',p_account,conversation,r.message_id,r.transport_payload->>'provider_id',r.body_hash,r.actor_id,'gmail_send',source,r.confirmed_at,'accepted',r.transport_payload||jsonb_build_object('acceptance_id',r.id))
   ON CONFLICT DO NOTHING;
  SELECT ir.id INTO canonical FROM public.inbox_response_receipts ir WHERE ir.workspace_id=p_workspace AND ir.origin='gmail_send' AND ir.source_id=source
   AND ir.conversation_id=conversation AND ir.message_id=r.message_id AND ir.transport_payload->>'acceptance_id'=r.id::text;
  IF canonical IS NULL THEN RAISE EXCEPTION 'Linhagem divergente.' USING ERRCODE='42501'; END IF;
  m:=jsonb_populate_record(NULL::public.email_messages,r.transport_payload->'message');
  IF m.owner_id IS DISTINCT FROM r.actor_id THEN RAISE EXCEPTION 'Autor divergente.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.email_messages(id,workspace_id,account_id,thread_id,provider_message_id,direction,owner_id,from_email,from_name,to_emails,cc_emails,bcc_emails,subject,body_html,body_text,snippet,in_reply_to,headers,has_attachments,attachments,sent_at)
   VALUES(r.message_id,p_workspace,p_account,conversation,r.transport_payload->>'provider_id','outbound',r.actor_id,m.from_email,m.from_name,m.to_emails,m.cc_emails,m.bcc_emails,m.subject,m.body_html,m.body_text,m.snippet,m.in_reply_to,m.headers,coalesce(m.has_attachments,false),m.attachments,coalesce(m.sent_at,r.confirmed_at))
   ON CONFLICT(account_id,provider_message_id) DO NOTHING;
  IF NOT techerp_api.inbox_response_projected(p_workspace,'email',p_account,conversation,r.message_id,r.transport_payload->>'provider_id',r.body_hash)
   OR NOT techerp_api.inbox_response_source_current(canonical) THEN RAISE EXCEPTION 'Projeção divergente.' USING ERRCODE='42501'; END IF;
  -- Only this exact immutable receipt may re-run emission; mirrors are never upgraded.
  PERFORM techerp_api.inbox_response_emit(canonical);
  UPDATE techerp_api.inbox_gmail_recovery rq SET state='completed',completed_at=clock_timestamp(),lease_token=NULL,lease_until=NULL,last_error_code=NULL WHERE rq.receipt_id=p_receipt;
  UPDATE techerp_api.inbox_gmail_recovery_attempts a SET finished_at=clock_timestamp(),outcome='completed' WHERE a.receipt_id=p_receipt AND a.attempt=q.attempts;
  RETURN true;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE;
  UPDATE techerp_api.inbox_gmail_recovery rq SET state='pending',lease_token=NULL,lease_until=NULL,last_error_code=code,
   next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,least(q.attempts-1,7)))::integer) WHERE rq.receipt_id=p_receipt;
  UPDATE techerp_api.inbox_gmail_recovery_attempts a SET finished_at=clock_timestamp(),outcome='retry',error_code=code WHERE a.receipt_id=p_receipt AND a.attempt=q.attempts;
  RETURN false;
 END;
END $$;
REVOKE ALL ON FUNCTION public.inbox_gmail_recovery_project(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_gmail_recovery_project(uuid,uuid,uuid,uuid) TO service_role;
CREATE FUNCTION public.inbox_gmail_recovery_known(p_workspace uuid,p_account uuid,p_provider text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM techerp_api.inbox_gmail_recovery_authorize(p_workspace,p_account);
 RETURN EXISTS(SELECT 1 FROM techerp_api.inbox_gmail_recovery q JOIN public.inbox_response_receipts r ON r.id=q.receipt_id
 WHERE q.workspace_id=p_workspace AND q.account_id=p_account AND r.transport_payload->>'provider_id'=p_provider);
END $$;
REVOKE ALL ON FUNCTION public.inbox_gmail_recovery_known(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_gmail_recovery_known(uuid,uuid,text) TO service_role;
COMMENT ON TABLE techerp_api.inbox_gmail_recovery IS 'Private human Gmail acceptance projection queue. No history cutoff, no reservations or mirrors, no provider send, no user payload access.';
COMMENT ON TABLE techerp_api.inbox_gmail_recovery_attempts IS 'Private audit of bounded claims, SQLSTATE-only errors, lease expiry and atomic projection completion.';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='inbox_runtime_release_guard' AND tgenabled='O') THEN RAISE EXCEPTION 'Inbox release lock must remain enabled'; END IF; END $$;
NOTIFY pgrst,'reload schema';
