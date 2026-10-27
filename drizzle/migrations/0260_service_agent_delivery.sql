ALTER TABLE public.service_agent_jobs ADD COLUMN send_token uuid;
ALTER TABLE public.live_chat_messages ADD COLUMN author_name text;
ALTER TABLE public.live_chat_messages ADD COLUMN agent_attachments jsonb;

CREATE FUNCTION public.service_agent_begin_send(p_job uuid)
RETURNS SETOF public.service_agent_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.service_agent_jobs;s public.service_agent_sessions;e public.sdr_enrollments;
BEGIN
 SELECT * INTO j FROM public.service_agent_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND OR j.status<>'ready' OR j.send_started_at IS NOT NULL THEN RETURN;END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE id=j.session_id AND workspace_id=j.workspace_id FOR SHARE;
 IF NOT FOUND OR s.ai_owner<>'ai' OR s.ai_version<>j.conversation_version THEN
  UPDATE public.service_agent_jobs SET status='skipped',error='conversation_changed' WHERE id=j.id;RETURN;END IF;
 SELECT * INTO e FROM public.sdr_enrollments WHERE id=s.enrollment_id AND workspace_id=s.workspace_id;
 IF e.channel_identity IS NULL OR e.channel_identity->>'workspaceId' IS DISTINCT FROM s.workspace_id::text OR e.channel_identity->>'accountId' IS DISTINCT FROM s.account_id::text OR e.channel_identity->>'channel' IS DISTINCT FROM s.channel THEN
  UPDATE public.service_agent_jobs SET status='drafted',error='identity_unavailable' WHERE id=j.id;RETURN;END IF;
 IF NOT public.sales_worker_authorize('sdr_enrollments',e.id,'[]') OR NOT EXISTS(
  SELECT 1 FROM public.sdr_workspace_settings ws JOIN public.sdr_playbooks p ON p.workspace_id=ws.workspace_id
  JOIN public.sdr_agent_versions v ON v.playbook_id=p.id AND v.workspace_id=p.workspace_id AND v.status='published'
  WHERE ws.workspace_id=s.workspace_id AND ws.enabled AND ws.auto_send_enabled AND p.id=e.playbook_id AND p.mode='auto' AND v.id=j.agent_version_id)
 THEN UPDATE public.service_agent_jobs SET status='drafted',error='automatic_send_unavailable' WHERE id=j.id;RETURN;END IF;
 UPDATE public.service_agent_jobs SET status='running',lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',
 send_token=gen_random_uuid(),send_started_at=now(),updated_at=now() WHERE id=j.id RETURNING * INTO j;
 RETURN NEXT j;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_begin_send(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_begin_send(uuid) TO service_role;

-- Chat delivery and proof are one transaction: no uncertain external network send.
CREATE FUNCTION public.service_agent_send_chat(p_job uuid,p_lease uuid,p_attachments jsonb DEFAULT '[]')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.service_agent_jobs;s public.service_agent_sessions;e public.sdr_enrollments;guard text;
BEGIN
 SELECT * INTO j FROM public.service_agent_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job indisponível.';END IF;
 IF j.status='sent' THEN RETURN j.outbound_message_id;END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE id=j.session_id AND workspace_id=j.workspace_id FOR UPDATE;
 IF s.channel<>'chat' THEN RAISE EXCEPTION 'Canal incompatível.';END IF;
 PERFORM 1 FROM public.live_chat_sessions WHERE id=s.source_id AND workspace_id=s.workspace_id FOR UPDATE;
 guard:=public.service_agent_guard(j.id,p_lease);
 IF guard<>'ok' THEN RAISE EXCEPTION 'Envio bloqueado: %',guard USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_attachments)<>'array' OR jsonb_array_length(p_attachments)>10 THEN RAISE EXCEPTION 'Anexos inválidos.';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_attachments) f WHERE NOT EXISTS(
  SELECT 1 FROM public.sdr_materials m WHERE m.id=(f->>'material_id')::uuid AND m.workspace_id=s.workspace_id AND m.active AND m.approved
  AND j.draft_payload->'material_ids' ? m.id::text)) THEN RAISE EXCEPTION 'Material não autorizado.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.sdr_enrollments WHERE id=s.enrollment_id;
 INSERT INTO public.live_chat_messages(id,workspace_id,owner_id,session_id,direction,body,author_name,agent_attachments)
 VALUES(j.outbound_message_id,s.workspace_id,s.workspace_id,s.source_id,'outbound',j.draft_text,e.channel_identity->>'displayName',p_attachments);
 UPDATE public.live_chat_sessions SET last_message_at=now() WHERE id=s.source_id AND workspace_id=s.workspace_id;
 UPDATE public.service_agent_jobs SET status='sent',provider_message_id=j.outbound_message_id::text,sent_at=now(),lease_token=NULL,updated_at=now() WHERE id=j.id;
 UPDATE public.sdr_enrollments SET messages_sent=messages_sent+1,last_action_at=now() WHERE id=e.id;
 RETURN j.outbound_message_id;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_send_chat(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_send_chat(uuid,uuid,jsonb) TO service_role;

-- Provider acceptance is persisted even if permissions or ownership changed while Gmail was in flight.
-- send_token identifies the single authorized attempt and survives an expired worker lease.
CREATE FUNCTION public.service_agent_complete_email(p_job uuid,p_send_token uuid,p_provider_id text,p_header text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.service_agent_jobs;s public.service_agent_sessions;ac public.email_accounts;incoming public.email_messages;t public.email_threads;actual_message uuid;
BEGIN
 SELECT * INTO j FROM public.service_agent_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND OR j.send_token IS DISTINCT FROM p_send_token OR j.send_started_at IS NULL OR nullif(p_provider_id,'') IS NULL OR length(p_provider_id)>200 THEN RAISE EXCEPTION 'Prova de envio inválida.' USING ERRCODE='42501';END IF;
 IF p_header IS DISTINCT FROM j.draft_payload->>'delivery_header' OR nullif(p_header,'') IS NULL THEN RAISE EXCEPTION 'Identificador de entrega inválido.' USING ERRCODE='42501';END IF;
 IF j.status='sent' THEN RETURN j.outbound_message_id;END IF;
 IF j.status NOT IN('running','uncertain','skipped') THEN RAISE EXCEPTION 'Estado de entrega inválido.';END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE id=j.session_id AND workspace_id=j.workspace_id AND channel='email';
 IF NOT FOUND THEN RAISE EXCEPTION 'Conta de envio inválida.';END IF;
 SELECT * INTO t FROM public.email_threads WHERE id=s.source_id AND workspace_id=s.workspace_id;
 SELECT ac0.* INTO ac FROM public.email_accounts ac0 JOIN public.service_channel_accounts a ON a.source_key=ac0.id::text AND a.workspace_id=ac0.workspace_id WHERE a.id=s.account_id AND a.workspace_id=s.workspace_id;
 SELECT * INTO incoming FROM public.email_messages WHERE id=j.inbound_message_id AND thread_id=t.id AND account_id=ac.id AND workspace_id=s.workspace_id AND direction='inbound';
 IF ac.id IS NULL OR incoming.id IS NULL THEN RAISE EXCEPTION 'Origem de envio inválida.';END IF;
 INSERT INTO public.email_messages(id,workspace_id,owner_id,account_id,thread_id,provider_message_id,message_id_header,in_reply_to,direction,from_email,from_name,to_emails,subject,body_text,snippet,sent_at)
 VALUES(j.outbound_message_id,s.workspace_id,ac.owner_id,ac.id,t.id,p_provider_id,p_header,incoming.message_id_header,'outbound',ac.email,
 (SELECT channel_identity->>'displayName' FROM public.sdr_enrollments WHERE id=s.enrollment_id),ARRAY[incoming.from_email],t.subject,j.draft_text,left(j.draft_text,180),now())
 ON CONFLICT DO NOTHING;
 SELECT id INTO actual_message FROM public.email_messages WHERE workspace_id=s.workspace_id AND account_id=ac.id AND provider_message_id=p_provider_id;
 IF actual_message IS NULL THEN RAISE EXCEPTION 'Prova de mensagem indisponível.';END IF;
 UPDATE public.email_threads SET last_message_at=now(),snippet=left(j.draft_text,180),message_count=(SELECT count(*) FROM public.email_messages WHERE thread_id=t.id AND workspace_id=s.workspace_id) WHERE id=t.id;
 UPDATE public.service_agent_jobs SET status='sent',outbound_message_id=actual_message,provider_message_id=p_provider_id,sent_at=now(),lease_token=NULL,updated_at=now() WHERE id=j.id;
 UPDATE public.sdr_enrollments SET messages_sent=messages_sent+1,last_action_at=now() WHERE id=s.enrollment_id;
 RETURN actual_message;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_complete_email(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_complete_email(uuid,uuid,text,text) TO service_role;
