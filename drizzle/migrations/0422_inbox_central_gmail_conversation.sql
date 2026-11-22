-- INBOX-CENTRAL: exact thread RLS and current connection are separate from account catalogue.
CREATE FUNCTION techerp_api.inbox_email_thread_rls(p_workspace uuid,p_account uuid,p_conversation uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.role()='authenticated' AND auth.uid() IS NOT NULL
  AND public.work_access_context()->>'workspace'=p_workspace::text
  AND public.work_access_context()->>'actor'=auth.uid()::text
  AND public.is_workspace_member(p_workspace,auth.uid())
  AND EXISTS(SELECT 1 FROM public.email_threads WHERE id=p_conversation AND workspace_id=p_workspace AND account_id=p_account)
$$;
ALTER FUNCTION techerp_api.inbox_email_thread_rls(uuid,uuid,uuid) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.inbox_email_thread_rls(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.inbox_email_thread_rls(uuid,uuid,uuid) TO postgres;
CREATE FUNCTION public.workflow_inbox_email_connection_visible(p_workspace uuid,p_account uuid,p_conversation uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF techerp_api.inbox_email_thread_rls(p_workspace,p_account,p_conversation) IS NOT TRUE THEN RETURN false; END IF;
 RETURN techerp_api.inbox_account_current(p_workspace,'email',p_account);
END $$;
REVOKE ALL ON FUNCTION public.workflow_inbox_email_connection_visible(uuid,uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.workflow_inbox_email_connection_visible(uuid,uuid,uuid) TO authenticated,techerp_api_subject;
COMMENT ON FUNCTION public.workflow_inbox_email_connection_visible(uuid,uuid,uuid) IS 'Boolean connection only after actual thread RLS under the subject role; no account settings, account enumeration, credentials or workflow permission granted.';
CREATE OR REPLACE FUNCTION public.workflow_inbox_conversation_visible(p_workspace uuid,p_channel text,p_account uuid,p_conversation uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_channel='email' THEN
  RETURN EXISTS(SELECT 1 FROM public.email_threads WHERE id=p_conversation AND workspace_id=p_workspace AND account_id=p_account)
   AND public.workflow_inbox_email_connection_visible(p_workspace,p_account,p_conversation);
 END IF;
 IF NOT public.workflow_inbox_account_visible(p_workspace,p_channel,p_account) THEN RETURN false; END IF;
 IF p_channel='chat' THEN RETURN EXISTS(SELECT 1 FROM public.live_chat_sessions WHERE id=p_conversation AND workspace_id=p_workspace); END IF;
 IF p_channel='linkedin' THEN RETURN EXISTS(SELECT 1 FROM public.linkedin_conversations WHERE id=p_conversation AND workspace_id=p_workspace AND account_id=p_account); END IF;
 RETURN false;
END $$;

-- Gmail: immutable discovery, persisted message and provider timestamp are reconciled in the finish transaction.
CREATE OR REPLACE FUNCTION public.gmail_sync_finish(p_workspace uuid,p_account uuid,p_id uuid,p_token uuid,p_outcome text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q public.gmail_sync_queue; m public.email_messages; t public.email_threads;
 x public.inbox_channel_evidence; evidence_id uuid; occurrence_id uuid; envelope text; body_digest text;
BEGIN
 PERFORM public.gmail_sync_queue_authorize(p_workspace,p_account);
 SELECT * INTO q FROM public.gmail_sync_queue WHERE id=p_id AND account_id=p_account AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND OR q.state<>'pending' OR q.lease_token IS DISTINCT FROM p_token OR p_token IS NULL THEN RETURN false; END IF;
 IF p_outcome IS NULL OR p_outcome NOT IN('inserted','existing','skipped','gone') THEN RAISE EXCEPTION 'Resultado inválido.' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.email_messages WHERE account_id=p_account AND workspace_id=p_workspace AND provider_message_id=q.provider_message_id FOR SHARE;
 IF p_outcome IN('inserted','existing') AND m.id IS NULL THEN RAISE EXCEPTION 'Mensagem Gmail ainda não persistida.' USING ERRCODE='42501'; END IF;
 IF m.id IS NOT NULL AND q.provenance='incremental' AND NOT q.preexisting AND m.direction='inbound' THEN
  SELECT * INTO t FROM public.email_threads WHERE id=m.thread_id AND workspace_id=p_workspace AND account_id=p_account FOR SHARE;
  IF t.id IS NULL OR m.received_at IS NULL OR m.created_at<q.discovered_at
   OR m.received_at>clock_timestamp() OR t.provider_thread_id IS NULL
   OR NOT techerp_api.inbox_account_current(p_workspace,'email',p_account)
   OR p_outcome NOT IN('inserted','existing') THEN
   RAISE EXCEPTION 'Mensagem incremental sem prova conciliável.' USING ERRCODE='42501';
  END IF;
  envelope:=encode(sha256(convert_to(jsonb_build_object('receipt',q.id,'workspace',q.workspace_id,'account',q.account_id,
   'provider_message',q.provider_message_id,'history_from',q.history_from,'history_to',q.history_to,
   'provenance',q.provenance,'discovered_at',q.discovered_at,'message',m.id,'thread',t.id,
   'provider_thread',t.provider_thread_id,'provider_timestamp',m.received_at)::text,'UTF8')),'hex');
  body_digest:=encode(sha256(convert_to(coalesce(m.body_text,m.body_html,''),'UTF8')),'hex');
  INSERT INTO public.inbox_channel_evidence(workspace_id,channel,account_id,conversation_id,provider_id,message_id,provenance,envelope_hash,body_hash,occurred_at,received_at)
  VALUES(p_workspace,'email',p_account,t.id,q.provider_message_id,m.id,'gmail_incremental',envelope,body_digest,m.received_at,q.discovered_at)
  ON CONFLICT(channel,account_id,provider_id) DO NOTHING;
  SELECT * INTO x FROM public.inbox_channel_evidence WHERE channel='email' AND account_id=p_account AND provider_id=q.provider_message_id;
  IF ROW(x.workspace_id,x.conversation_id,x.message_id,x.provenance,x.envelope_hash,x.body_hash,x.occurred_at,x.received_at)
   IS DISTINCT FROM ROW(p_workspace,t.id,m.id,'gmail_incremental'::text,envelope,body_digest,m.received_at,q.discovered_at) THEN
   RAISE EXCEPTION 'Evidência Gmail divergente.' USING ERRCODE='42501';
  END IF;
  evidence_id:=x.id;
  occurrence_id:=techerp_api.inbox_record(evidence_id,'message_received',m.id);
  IF occurrence_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.inbox_channel_occurrences
   WHERE id=occurrence_id AND workspace_id=p_workspace AND channel='email' AND account_id=p_account
    AND conversation_id=t.id AND message_id=m.id AND envelope_id=evidence_id AND occurred_at=m.received_at) THEN
   RAISE EXCEPTION 'Ocorrência Gmail não conciliada.' USING ERRCODE='42501';
  END IF;
 END IF;
 UPDATE public.gmail_sync_queue SET state='done',message_id=m.id,outcome=p_outcome,completed_at=clock_timestamp(),lease_token=NULL,lease_until=NULL WHERE id=q.id;
 RETURN true;
END $$;
NOTIFY pgrst,'reload schema';
