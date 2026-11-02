-- A shared phone/address is not authority to overwrite another CRM association.
CREATE FUNCTION public.prospecting_sequence_person_matches(p_run uuid,p_contact uuid,p_lead uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run;
 SELECT * INTO p FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id AND workspace_id=r.workspace_id;
 IF p.id IS NULL THEN RETURN false;END IF;
 IF p_contact IS NOT NULL AND NOT(p.entity='contact' AND p.source_id=p_contact) AND NOT(encode(sha256(convert_to('contact:'||p_contact::text,'UTF8')),'hex')=ANY(p.identity_keys)) THEN RETURN false;END IF;
 IF p_lead IS NOT NULL AND NOT(p.entity='lead' AND p.source_id=p_lead) AND NOT EXISTS(SELECT 1 FROM public.leads l WHERE l.id=p_lead AND l.workspace_id=r.workspace_id AND l.deleted_at IS NULL AND encode(sha256(convert_to('contact:'||l.converted_contact_id::text,'UTF8')),'hex')=ANY(p.identity_keys)) THEN RETURN false;END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_person_matches(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_person_matches(uuid,uuid,uuid) TO service_role;
CREATE FUNCTION public.prospecting_sequence_whatsapp_identity(p_run uuid,p_phone_id text,p_phones jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT workspace_id INTO w FROM public.prospecting_sequence_runs WHERE id=p_run;
 IF w IS NULL OR jsonb_typeof(p_phones) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 RETURN NOT EXISTS(SELECT 1 FROM public.whatsapp_conversations c WHERE c.workspace_id=w AND (c.wa_phone_number_id=p_phone_id OR c.wa_phone_number_id IS NULL) AND regexp_replace(c.contact_phone,'\D','','g') IN(SELECT regexp_replace(v,'\D','','g') FROM jsonb_array_elements_text(p_phones) v) AND NOT public.prospecting_sequence_person_matches(p_run,c.contact_id,c.lead_id));
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_whatsapp_identity(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_whatsapp_identity(uuid,text,jsonb) TO service_role;
CREATE FUNCTION public.prospecting_sequence_reply_thread(p_run uuid,p_lease uuid,p_recipient text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;step jsonb;prior uuid[];m public.email_messages;t public.email_threads;ctx jsonb;BEGIN
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run;
 step:=c->'definition'->'steps'->r.cursor;
 IF step->>'type'<>'email' OR step->>'thread'<>'reply' THEN RAISE EXCEPTION 'Etapa sem referência de resposta.' USING ERRCODE='22023';END IF;
 SELECT array_agg((s.value->>'id')::uuid) INTO prior FROM jsonb_array_elements(c->'definition'->'steps') WITH ORDINALITY s WHERE s.ordinality<=r.cursor AND s.value->>'type'='email' AND s.value->>'accountId'=step->>'accountId';
 SELECT em.* INTO m FROM public.prospecting_sequence_effects e JOIN public.email_messages em ON em.id=e.id AND em.workspace_id=r.workspace_id WHERE e.run_id=r.id AND e.step_id=ANY(prior) AND e.status='succeeded' AND e.projection_state='complete' ORDER BY e.finished_at DESC,e.id DESC LIMIT 1;
 SELECT * INTO t FROM public.email_threads WHERE id=m.thread_id AND workspace_id=r.workspace_id AND account_id=m.account_id;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);
 IF m.id IS NULL OR t.id IS NULL OR nullif(m.message_id_header,'') IS NULL OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.email','view',ARRAY[coalesce(t.assigned_to,t.owner_id)]) OR NOT public.prospecting_sequence_person_matches(r.id,t.contact_id,t.lead_id) THEN RAISE EXCEPTION 'Conversa de e-mail indisponível ou sem autorização atual.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.service_channel_accounts account WHERE account.id::text=step->>'accountId' AND account.workspace_id=r.workspace_id AND account.channel='email' AND account.enabled AND account.source_key=m.account_id::text) THEN RAISE EXCEPTION 'A conta da conversa mudou. Inicie uma nova conversa.' USING ERRCODE='22023';END IF;
 IF NOT coalesce(p_recipient=ANY(m.to_emails),false) THEN RAISE EXCEPTION 'O destinatário mudou. Inicie uma nova conversa ou revise o contato antes de responder.' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('threadId',t.provider_thread_id,'messageIdHeader',m.message_id_header);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_reply_thread(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_reply_thread(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_delivery_access(p_run uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;ctx jsonb;step jsonb;a public.service_channel_accounts;r public.prospecting_sequence_runs;kind text;BEGIN
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run;
 step:=c->'definition'->'steps'->r.cursor;kind:=step->>'type';
 IF kind NOT IN('email','whatsapp') THEN RAISE EXCEPTION 'Etapa sem canal de mensagem.';END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);
 IF NOT (ctx->'keys' ? 'system.channels.view.workspace') OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'view',ARRAY[r.owner_id]) OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Canal sem acesso atual.' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM public.service_channel_accounts WHERE id=(step->>'accountId')::uuid AND workspace_id=r.workspace_id AND channel=kind AND enabled;
 IF a.id IS NULL OR kind='email' AND NOT EXISTS(SELECT 1 FROM public.email_accounts ea WHERE ea.id::text=a.source_key AND ea.workspace_id=r.workspace_id AND ea.owner_id=r.owner_id AND ea.provider='gmail' AND ea.status='connected') THEN RAISE EXCEPTION 'Conta indisponível.' USING ERRCODE='42501';END IF;
 IF kind='whatsapp' AND NOT public.prospecting_sequence_whatsapp_identity(r.id,a.source_key,c#>'{source,phones}') THEN RAISE EXCEPTION 'Conversa vinculada a outro cadastro. Revise as associações antes de enviar.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('id',a.id,'sourceKey',a.source_key,'displayName',a.display_name,'channel',a.channel);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_delivery_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_delivery_access(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_delivery_commit(p_effect uuid,p_token uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;
 step jsonb;a public.service_channel_accounts;account uuid;thread uuid;message uuid;v_provider text;old_workspace uuid;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 IF pg_column_size(p_payload)>64000 THEN RAISE EXCEPTION 'Recibo excede limite.';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND kind IN('email','whatsapp') FOR UPDATE;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 IF e.status='succeeded' AND e.projection_state='complete' THEN RETURN e.id;END IF;
 PERFORM public.prospecting_sequence_receipt_store(e.id,e.token,p_payload);
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect;
 IF e.status NOT IN('sending','uncertain','succeeded') THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 v_provider:=nullif(p_payload->>'messageId','');
 IF v_provider IS NULL OR length(v_provider)>512 THEN RAISE EXCEPTION 'Identificador de envio ausente.';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=e.run_id;
 SELECT * INTO p FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id AND workspace_id=r.workspace_id;
 SELECT s INTO step FROM public.prospecting_sequence_versions v CROSS JOIN LATERAL jsonb_array_elements(v.definition->'steps') s WHERE v.id=r.version_id AND s->>'id'=e.step_id::text;
 a.id:=e.account_id;a.source_key:=e.sender->>'sourceKey';a.channel:=e.kind;
 IF a.id IS NULL OR a.source_key IS NULL OR step IS NULL OR p.id IS NULL THEN RAISE EXCEPTION 'Origem do recibo indisponível.';END IF;
 IF e.kind='whatsapp' AND NOT public.prospecting_sequence_whatsapp_identity(r.id,a.source_key,jsonb_build_array(p_payload->>'to')) THEN RAISE EXCEPTION 'Conversa vinculada a outro cadastro. Recibo preservado para revisão.' USING ERRCODE='42501';END IF;
 IF e.kind='email' THEN
  account:=a.source_key::uuid;
  IF nullif(p_payload->>'threadId','') IS NULL OR nullif(p_payload->>'to','') IS NULL THEN RAISE EXCEPTION 'Recibo de e-mail incompleto.';END IF;
  INSERT INTO public.email_threads(workspace_id,owner_id,assigned_to,account_id,provider_thread_id,subject,snippet,last_message_at,contact_id,lead_id,identity_status)
  VALUES(r.workspace_id,r.owner_id,r.owner_id,account,p_payload->>'threadId',p_payload->>'subject',left(p_payload->>'body',200),e.finished_at,CASE WHEN p.entity='contact' THEN p.source_id END,CASE WHEN p.entity='lead' THEN p.source_id END,'matched')
  ON CONFLICT(account_id,provider_thread_id) DO UPDATE SET last_message_at=greatest(email_threads.last_message_at,excluded.last_message_at) WHERE email_threads.workspace_id=r.workspace_id RETURNING id INTO thread;
  IF thread IS NULL THEN RAISE EXCEPTION 'Thread fora do workspace.' USING ERRCODE='42501';END IF;
  INSERT INTO public.email_messages(id,workspace_id,owner_id,account_id,thread_id,provider_message_id,direction,from_email,to_emails,subject,body_text,message_id_header,in_reply_to,sent_at)
  VALUES(e.id,r.workspace_id,r.owner_id,account,thread,v_provider,'outbound',p_payload->>'from',ARRAY[p_payload->>'to'],p_payload->>'subject',p_payload->>'body',p_payload->>'messageIdHeader',p_payload->>'inReplyTo',e.finished_at)
  ON CONFLICT(account_id,provider_message_id) DO NOTHING RETURNING id INTO message;
  IF message IS NULL THEN SELECT id INTO message FROM public.email_messages WHERE workspace_id=r.workspace_id AND account_id=account AND provider_message_id=v_provider;END IF;
 ELSE
  IF nullif(p_payload->>'from','') IS NULL OR nullif(p_payload->>'to','') IS NULL THEN RAISE EXCEPTION 'Recibo de WhatsApp incompleto.';END IF;
  SELECT id,workspace_id INTO thread,old_workspace FROM public.whatsapp_conversations WHERE contact_phone=p_payload->>'to' AND twilio_number=p_payload->>'from' FOR UPDATE;
  IF thread IS NOT NULL AND old_workspace<>r.workspace_id THEN RAISE EXCEPTION 'Conversa fora do workspace.' USING ERRCODE='42501';END IF;
  IF thread IS NULL THEN
   INSERT INTO public.whatsapp_conversations(workspace_id,owner_id,assigned_to,contact_id,lead_id,contact_phone,twilio_number,provider,wa_phone_number_id,conversation_origin,last_message_at,last_message_preview,origin_template_name,origin_wa_message_id,identity_status)
   VALUES(r.workspace_id,r.owner_id,r.owner_id,CASE WHEN p.entity='contact' THEN p.source_id END,CASE WHEN p.entity='lead' THEN p.source_id END,p_payload->>'to',p_payload->>'from','meta',a.source_key,'campaign',e.finished_at,left(p_payload->>'body',200),step->>'templateName',v_provider,'matched') RETURNING id INTO thread;
  ELSE
   UPDATE public.whatsapp_conversations SET contact_id=CASE WHEN contact_id IS NULL AND lead_id IS NULL AND p.entity='contact' THEN p.source_id ELSE contact_id END,lead_id=CASE WHEN contact_id IS NULL AND lead_id IS NULL AND p.entity='lead' THEN p.source_id ELSE lead_id END,last_message_at=greatest(last_message_at,e.finished_at),last_message_preview=CASE WHEN last_message_at IS NULL OR last_message_at<=e.finished_at THEN left(p_payload->>'body',200) ELSE last_message_preview END,conversation_origin=CASE WHEN last_message_at IS NULL OR last_message_at<=e.finished_at THEN 'campaign' ELSE conversation_origin END,origin_template_name=CASE WHEN last_message_at IS NULL OR last_message_at<=e.finished_at THEN step->>'templateName' ELSE origin_template_name END,origin_wa_message_id=CASE WHEN last_message_at IS NULL OR last_message_at<=e.finished_at THEN v_provider ELSE origin_wa_message_id END WHERE id=thread AND workspace_id=r.workspace_id;
  END IF;
  INSERT INTO public.whatsapp_messages(id,workspace_id,owner_id,conversation_id,direction,body,from_number,to_number,provider,wa_message_id,status,is_template,template_name,sent_by,sent_at)
  VALUES(e.id,r.workspace_id,r.owner_id,thread,'outbound',p_payload->>'body',p_payload->>'from',p_payload->>'to','meta',v_provider,'sent',true,step->>'templateName',r.owner_id,e.finished_at)
  ON CONFLICT(wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING RETURNING id INTO message;
  IF message IS NULL THEN SELECT id INTO message FROM public.whatsapp_messages WHERE workspace_id=r.workspace_id AND wa_message_id=v_provider;END IF;
 END IF;
 IF message IS NULL THEN RAISE EXCEPTION 'Mensagem não registrada no workspace.';END IF;
 UPDATE public.prospecting_sequence_effects SET projection_state='complete' WHERE id=e.id;
 UPDATE public.prospecting_sequence_runs SET state='active',reason='inbox_projection_complete',updated_at=now() WHERE id=r.id AND state='paused' AND reason='receipt_projection_pending';
 RETURN message;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_delivery_commit(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_delivery_commit(uuid,uuid,jsonb) TO service_role;
