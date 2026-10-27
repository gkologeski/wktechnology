CREATE FUNCTION public.service_agent_finish_decision(p_job uuid,p_lease uuid,p_status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE reason text;BEGIN
 IF p_status NOT IN('ready','drafted') THEN RAISE EXCEPTION 'Estado inválido.';END IF;
 PERFORM 1 FROM public.service_agent_jobs WHERE id=p_job FOR UPDATE;
 reason:=public.service_agent_guard(p_job,p_lease);IF reason<>'ok' THEN RETURN reason;END IF;
 UPDATE public.service_agent_jobs SET status=p_status,lease_token=NULL,updated_at=now() WHERE id=p_job;
 RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.service_agent_finish_decision(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_finish_decision(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.service_agent_inbox_state(p_channel text,p_source uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context();w uuid:=(c->>'workspace')::uuid;s public.service_agent_sessions;j public.service_agent_jobs;e public.sdr_enrollments;label text;r text;
BEGIN
 r:=CASE p_channel WHEN 'email' THEN 'email_threads' WHEN 'chat' THEN 'live_chat_sessions' ELSE NULL END;
 IF w IS NULL OR r IS NULL OR NOT public.sales_record_access(r,p_source,'view') THEN RAISE EXCEPTION 'Conversa indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE workspace_id=w AND channel=p_channel AND source_id=p_source;
 IF NOT FOUND THEN RETURN jsonb_build_object('active',false);END IF;
 SELECT * INTO e FROM public.sdr_enrollments WHERE id=s.enrollment_id AND workspace_id=w;
 SELECT name INTO label FROM public.sdr_playbooks WHERE id=e.playbook_id AND workspace_id=w;
 SELECT * INTO j FROM public.service_agent_jobs WHERE session_id=s.id AND workspace_id=w ORDER BY created_at DESC,id DESC LIMIT 1;
 -- Inbox access reveals only the proposed reply, never private prompts/tool traces/credentials.
 RETURN jsonb_build_object('active',true,'session_id',s.id,'agent_name',coalesce(e.channel_identity->>'displayName',label),
 'identity_verified',s.identity_verified,'context_approved',s.context_approved,
 'can_verify',coalesce(c->'keys' ? 'system.channels.approve.workspace',false) AND NOT coalesce((c->>'read_only')::boolean,true) AND public.sales_record_access(r,p_source,'update'),
 'owner',s.ai_owner,'can_control',public.sales_record_access(r,p_source,'update'),
 'status',j.status,'draft',CASE WHEN j.status='drafted' AND j.conversation_version=s.ai_version THEN j.draft_text ELSE NULL END,
 'delivery_uncertain',EXISTS(SELECT 1 FROM public.service_agent_jobs WHERE session_id=s.id AND status='uncertain'));
END $$;
REVOKE ALL ON FUNCTION public.service_agent_inbox_state(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.service_agent_inbox_state(text,uuid) TO authenticated;

CREATE FUNCTION public.service_agent_set_owner(p_channel text,p_source uuid,p_owner text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context();w uuid:=(c->>'workspace')::uuid;s public.service_agent_sessions;e public.sdr_enrollments;r text;
BEGIN
 r:=CASE p_channel WHEN 'email' THEN 'email_threads' WHEN 'chat' THEN 'live_chat_sessions' ELSE NULL END;
 IF w IS NULL OR coalesce((c->>'read_only')::boolean,true) OR p_owner NOT IN('ai','human','paused') OR r IS NULL
 OR NOT public.sales_record_access(r,p_source,'view') OR NOT public.sales_record_access(r,p_source,'update') THEN RAISE EXCEPTION 'Sem permissão para controlar este atendimento.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE workspace_id=w AND channel=p_channel AND source_id=p_source FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento não encontrado.';END IF;
 SELECT * INTO e FROM public.sdr_enrollments WHERE id=s.enrollment_id AND workspace_id=w FOR UPDATE;
 IF p_owner='ai' AND e.opted_out_at IS NOT NULL THEN RAISE EXCEPTION 'Descadastro ativo: o agente não pode ser retomado.' USING ERRCODE='42501';END IF;
 UPDATE public.service_agent_sessions SET ai_owner=p_owner,ai_version=ai_version+1 WHERE id=s.id;
 IF p_owner='ai' THEN
  UPDATE public.service_agent_jobs SET status='skipped',error='delivery_reviewed_by_human',draft_payload=coalesce(draft_payload,'{}')||jsonb_build_object('reviewed_by',auth.uid(),'reviewed_at',now()) WHERE session_id=s.id AND status='uncertain';
  UPDATE public.sdr_enrollments SET status='active',cancel_reason=NULL,follow_up_at=NULL WHERE id=e.id;
  IF NOT public.sales_worker_authorize('sdr_enrollments',e.id,'[]') THEN RAISE EXCEPTION 'Agente ou canal indisponível; confira a configuração e as permissões.' USING ERRCODE='42501';END IF;
 END IF;
 UPDATE public.service_agent_jobs SET status='skipped',error='ownership_changed',lease_token=NULL WHERE session_id=s.id AND status IN('queued','ready','drafted');
END $$;
REVOKE ALL ON FUNCTION public.service_agent_set_owner(text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.service_agent_set_owner(text,uuid,text) TO authenticated;

CREATE FUNCTION public.service_agent_notify_draft()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.service_agent_sessions;recipient uuid;publisher uuid;
BEGIN
 IF NEW.status<>'drafted' OR OLD.status='drafted' THEN RETURN NEW;END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE id=NEW.session_id AND workspace_id=NEW.workspace_id;
 IF s.channel='email' THEN SELECT coalesce(assigned_to,owner_id) INTO recipient FROM public.email_threads WHERE id=s.source_id AND workspace_id=s.workspace_id;
 ELSE SELECT assignee_id INTO recipient FROM public.live_chat_sessions WHERE id=s.source_id AND workspace_id=s.workspace_id;END IF;
 IF recipient IS NULL OR NOT public.is_workspace_member(s.workspace_id,recipient) THEN
  SELECT v.published_by INTO publisher FROM public.sdr_enrollments e JOIN public.sdr_agent_versions v ON v.playbook_id=e.playbook_id AND v.workspace_id=e.workspace_id AND v.status='published' WHERE e.id=s.enrollment_id;
  recipient:=publisher;
 END IF;
 IF recipient IS NOT NULL AND public.is_workspace_member(s.workspace_id,recipient) AND NOT EXISTS(
  SELECT 1 FROM public.notifications WHERE user_id=recipient AND owner_id=s.workspace_id AND entity='service_agent_session' AND entity_id=s.id AND read_at IS NULL) THEN
  INSERT INTO public.notifications(owner_id,workspace_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
  VALUES(s.workspace_id,s.workspace_id,recipient,'mention',CASE WHEN NEW.draft_payload->>'intent'='handoff' THEN 'Atendimento humano solicitado' ELSE 'Resposta do agente aguarda revisão' END,
   'Abra a conversa para revisar o atendimento.','/inbox/'||s.channel||'?conversation='||s.source_id::text,'service_agent_session',s.id,'service-agent:'||NEW.id::text)
  ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'service_agent_notify_draft: %',SQLERRM;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_notify_draft() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER service_agent_notify_draft AFTER UPDATE OF status ON public.service_agent_jobs FOR EACH ROW EXECUTE FUNCTION public.service_agent_notify_draft();

-- Same authenticated worker wake as WhatsApp; no new credential or public trigger.
CREATE TRIGGER service_agent_jobs_wake AFTER INSERT ON public.service_agent_jobs FOR EACH ROW WHEN(NEW.status='queued') EXECUTE FUNCTION public.sdr_wake_worker();
