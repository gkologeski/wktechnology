CREATE OR REPLACE FUNCTION public.inbox_gmail_recovery_project(p_workspace uuid,p_account uuid,p_token uuid,p_receipt uuid)
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
   VALUES(r.message_id,p_workspace,p_account,conversation,r.transport_payload->>'provider_id','outbound',r.actor_id,m.from_email,m.from_name,coalesce(m.to_emails,ARRAY[]::text[]),coalesce(m.cc_emails,ARRAY[]::text[]),coalesce(m.bcc_emails,ARRAY[]::text[]),m.subject,m.body_html,m.body_text,m.snippet,m.in_reply_to,m.headers,coalesce(m.has_attachments,false),m.attachments,coalesce(m.sent_at,r.confirmed_at))
   ON CONFLICT(account_id,provider_message_id) DO NOTHING;
  IF NOT techerp_api.inbox_response_projected(p_workspace,'email',p_account,conversation,r.message_id,r.transport_payload->>'provider_id',r.body_hash)
   OR NOT techerp_api.inbox_response_source_current(canonical) THEN RAISE EXCEPTION 'Projeção divergente.' USING ERRCODE='42501'; END IF;
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
NOTIFY pgrst,'reload schema';
