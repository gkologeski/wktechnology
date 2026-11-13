CREATE FUNCTION public.linkedin_record_access_ctx(c jsonb,t text,i uuid,a text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE action text:=CASE a WHEN 'view' THEN 'view' WHEN 'create' THEN 'create' WHEN 'update' THEN 'manage' WHEN 'assign' THEN 'manage' WHEN 'manage' THEN 'manage' END;
BEGIN
 IF action IS NULL THEN RETURN false;END IF;
 IF t='linkedin_conversations' THEN RETURN EXISTS(SELECT 1 FROM public.linkedin_conversations cv WHERE cv.id=i AND public.linkedin_inbox_access(c,cv.workspace_id,cv.owner_id,action));END IF;
 IF t='linkedin_messages' THEN RETURN EXISTS(SELECT 1 FROM public.linkedin_messages m JOIN public.linkedin_conversations cv ON cv.id=m.conversation_id AND cv.workspace_id=m.workspace_id WHERE m.id=i AND public.linkedin_inbox_access(c,cv.workspace_id,cv.owner_id,action));END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.linkedin_record_access_ctx(jsonb,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.linkedin_record_access_ctx(jsonb,text,uuid,text) TO authenticated,service_role;
-- Preserve the installed functions exactly; append only the new private resource cases.
DO $patch$
DECLARE target_function regprocedure;body text;definition text;replacement text;
BEGIN
 FOREACH target_function IN ARRAY ARRAY['public.sales_record_access(text,uuid,text)'::regprocedure,'sales_private.record_access_ctx(jsonb,text,uuid,text)'::regprocedure] LOOP
 SELECT prosrc INTO body FROM pg_proc WHERE pg_proc.oid=target_function;
 IF position('CASE t' IN body)=0 THEN RAISE EXCEPTION 'Unexpected sales access definition';END IF;
 replacement:=replace(body,'CASE t',E'IF t IN(''linkedin_conversations'',''linkedin_messages'') THEN RETURN public.linkedin_record_access_ctx(c,t,i,a);END IF;\n CASE t');
 definition:=pg_get_functiondef(target_function);EXECUTE replace(definition,body,replacement);
 END LOOP;
 target_function:='public.sales_context_access(jsonb,uuid,text,text,uuid[])'::regprocedure;
 SELECT prosrc INTO body FROM pg_proc WHERE pg_proc.oid=target_function;
 IF body !~* '^\s*SELECT\s' THEN RAISE EXCEPTION 'Unexpected sales context definition';END IF;
 replacement:='SELECT CASE WHEN r=''techsales.inbox.linkedin'' THEN public.linkedin_inbox_access(c,w,(c->>''actor'')::uuid,CASE WHEN a IN(''update'',''assign'') THEN ''manage'' ELSE a END) AND (c->>''actor'')::uuid=ANY(responsibles) ELSE ('||regexp_replace(regexp_replace(body,'^\s*SELECT\s+','','i'),';\s*$','')||') END';
 definition:=pg_get_functiondef(target_function);EXECUTE replace(definition,body,replacement);
END $patch$;

-- Extend the shared channel runtime, preserving existing email/chat behavior.
ALTER TABLE public.service_channel_accounts DROP CONSTRAINT service_channel_accounts_channel_check;
ALTER TABLE public.service_channel_accounts ADD CONSTRAINT service_channel_accounts_channel_check CHECK(channel IN('whatsapp','email','chat','linkedin'));
CREATE POLICY service_channel_linkedin_private ON public.service_channel_accounts AS RESTRICTIVE FOR SELECT TO authenticated USING(channel<>'linkedin' OR EXISTS(SELECT 1 FROM public.unipile_accounts a WHERE a.id::text=source_key AND a.workspace_id=service_channel_accounts.workspace_id AND a.owner_id=auth.uid()));
CREATE POLICY service_binding_linkedin_private ON public.service_channel_bindings AS RESTRICTIVE FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.service_channel_accounts a WHERE a.id=account_id AND a.workspace_id=service_channel_bindings.workspace_id));


CREATE OR REPLACE FUNCTION public.service_channel_save(p_account uuid,p_label text,p_name text,p_enabled boolean,
 p_agent uuid,p_agent_name text,p_inbound boolean,p_campaigns boolean,p_agent_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context(); w uuid:=(c->>'workspace')::uuid; ac public.service_channel_accounts; agent_check uuid;
BEGIN
 IF NOT public.service_channel_access(c,w,'manage') THEN RAISE EXCEPTION 'Sem permissão para configurar canais.' USING ERRCODE='42501'; END IF;
 SELECT * INTO ac FROM public.service_channel_accounts WHERE id=p_account AND workspace_id=w FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conta indisponível.' USING ERRCODE='42501'; END IF;
 IF ac.channel='linkedin' AND NOT EXISTS(SELECT 1 FROM unipile_accounts a WHERE a.id::text=ac.source_key AND a.workspace_id=w AND a.owner_id=auth.uid() AND public.unipile_personal_access(c,w,a.owner_id,'manage')) THEN RAISE EXCEPTION 'Personal LinkedIn account unauthorized' USING ERRCODE='42501';END IF;
 FOR agent_check IN SELECT p_agent WHERE p_agent IS NOT NULL UNION SELECT agent_id FROM public.service_channel_bindings WHERE account_id=p_account AND workspace_id=w LOOP
  IF NOT EXISTS(SELECT 1 FROM public.sdr_playbooks p WHERE p.id=agent_check AND p.workspace_id=w
   AND public.sales_context_access(public.sales_access_context(),w,'techsales.marketing.sdr_agent','view',ARRAY[coalesce(p.assigned_to,p.owner_id)])
   AND public.sales_context_access(public.sales_access_context(),w,'techsales.marketing.sdr_agent','update',ARRAY[coalesce(p.assigned_to,p.owner_id)]))
  THEN RAISE EXCEPTION 'Agente indisponível ou sem permissão de edição.' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF p_agent_enabled AND (NOT p_enabled OR p_agent IS NULL OR NOT(p_inbound OR p_campaigns)) THEN
  RAISE EXCEPTION 'Selecione um agente, um modo de atendimento e ative a conta.' USING ERRCODE='23514'; END IF;
 UPDATE public.service_channel_accounts SET label=p_label,display_name=p_name,enabled=p_enabled,routing_configured=true WHERE id=p_account AND workspace_id=w;
 IF p_agent IS NULL THEN
  DELETE FROM public.service_channel_bindings WHERE account_id=p_account AND workspace_id=w;
 ELSE
  INSERT INTO public.service_channel_bindings(account_id,workspace_id,agent_id,display_name,inbound,campaigns,enabled)
   VALUES(p_account,w,p_agent,p_agent_name,p_inbound,p_campaigns,p_agent_enabled)
  ON CONFLICT(account_id) DO UPDATE SET agent_id=excluded.agent_id,display_name=excluded.display_name,
   inbound=excluded.inbound,campaigns=excluded.campaigns,enabled=excluded.enabled,updated_at=now();
 END IF;
END $$;

ALTER TABLE public.service_agent_sessions DROP CONSTRAINT service_agent_sessions_channel_check;
ALTER TABLE public.service_agent_sessions ADD CONSTRAINT service_agent_sessions_channel_check CHECK(channel IN('email','chat','linkedin'));


ALTER TABLE public.service_agent_inbound_events DROP CONSTRAINT service_agent_inbound_events_channel_check;
ALTER TABLE public.service_agent_inbound_events ADD CONSTRAINT service_agent_inbound_events_channel_check CHECK(channel IN('email','chat','linkedin'));


CREATE OR REPLACE FUNCTION public.service_agent_source_context(p_enrollment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.service_agent_sessions;e public.sdr_enrollments;b public.service_channel_bindings;
 a public.service_channel_accounts;u uuid;source_owner uuid;refs jsonb;source_ok boolean:=false;
BEGIN
 SELECT * INTO s FROM public.service_agent_sessions WHERE enrollment_id=p_enrollment;
 IF NOT FOUND OR s.ai_owner<>'ai' THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM public.service_agent_jobs WHERE session_id=s.id AND status='uncertain') THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sdr_workspace_settings WHERE workspace_id=s.workspace_id AND enabled AND tech_breaker_open_at IS NULL) THEN RETURN NULL;END IF;
 SELECT * INTO e FROM public.sdr_enrollments WHERE id=s.enrollment_id AND workspace_id=s.workspace_id AND conversation_id IS NULL;
 IF NOT FOUND OR e.status<>'active' OR e.opted_out_at IS NOT NULL THEN RETURN NULL;END IF;
 SELECT * INTO a FROM public.service_channel_accounts WHERE id=s.account_id AND workspace_id=s.workspace_id AND channel=s.channel AND routing_configured AND enabled;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO b FROM public.service_channel_bindings WHERE account_id=a.id AND workspace_id=s.workspace_id AND agent_id=e.playbook_id AND enabled AND CASE s.origin WHEN 'campaign' THEN campaigns ELSE inbound END;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT v.published_by INTO u FROM public.sdr_playbooks p JOIN public.sdr_agent_versions v ON v.playbook_id=p.id AND v.workspace_id=p.workspace_id AND v.status='published'
 WHERE p.id=e.playbook_id AND p.workspace_id=s.workspace_id AND p.enabled;
 IF u IS NULL OR NOT public.is_workspace_member(s.workspace_id,u) THEN RETURN NULL;END IF;
 IF s.channel='email' THEN
  SELECT t.owner_id,true INTO source_owner,source_ok FROM public.email_threads t JOIN public.email_accounts ac ON ac.id=t.account_id AND ac.workspace_id=t.workspace_id
   WHERE t.id=s.source_id AND t.workspace_id=s.workspace_id AND ac.id::text=a.source_key AND ac.status='connected';
  refs:=jsonb_build_array(jsonb_build_object('table','email_threads','id',s.source_id,'action','update'),
    jsonb_build_object('table','email_accounts','id',a.source_key,'action','view'));
 ELSIF s.channel='linkedin' THEN
  SELECT cv.owner_id,true INTO source_owner,source_ok FROM public.linkedin_conversations cv JOIN public.unipile_accounts ac ON ac.id=cv.account_id AND ac.workspace_id=cv.workspace_id AND ac.owner_id=cv.owner_id
   WHERE cv.id=s.source_id AND cv.workspace_id=s.workspace_id AND cv.status='open' AND ac.id::text=a.source_key AND ac.status='connected';
  u:=source_owner;
  IF NOT public.linkedin_inbox_access(public.work_subject_context(s.workspace_id,u),s.workspace_id,u,'create') THEN RETURN NULL;END IF;
  refs:=jsonb_build_array(jsonb_build_object('table','linkedin_conversations','id',s.source_id,'action','update'));
 ELSE
  SELECT u,true INTO source_owner,source_ok FROM public.live_chat_sessions c WHERE c.id=s.source_id AND c.workspace_id=s.workspace_id AND c.status<>'closed' AND a.source_key=s.workspace_id::text;
  refs:=jsonb_build_array(jsonb_build_object('table','live_chat_sessions','id',s.source_id,'action','update'));
 END IF;
 IF NOT coalesce(source_ok,false) THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('workspace',s.workspace_id,'actor',u,'session',s.id,'refs',refs||jsonb_build_array(
  jsonb_build_object('resource','techsales.inbox.'||s.channel,'action','create','subject_id',source_owner)));
END $$;

CREATE OR REPLACE FUNCTION public.service_agent_enqueue(p_channel text,p_message uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;source uuid;v_source_key text;contact uuid;lead uuid;company uuid;deal uuid;occurred timestamptz;cfg public.sdr_playbooks;
 a public.service_channel_accounts;b public.service_channel_bindings;s public.service_agent_sessions;e uuid;j uuid;wait_seconds int;event_id uuid;verified boolean:=false;v_origin text:='inbound';
BEGIN
 IF p_channel='email' THEN
  SELECT m.workspace_id,t.id,t.account_id::text,t.contact_id,t.lead_id,t.company_id,t.deal_id,coalesce(m.received_at,m.created_at),
   (EXISTS(SELECT 1 FROM public.email_messages sent WHERE sent.thread_id=t.id AND sent.account_id=t.account_id AND sent.workspace_id=t.workspace_id AND sent.direction='outbound'
     AND sent.message_id_header=m.in_reply_to AND nullif(m.in_reply_to,'') IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(sent.to_emails) recipient WHERE lower(recipient)=lower(m.from_email)))
    AND ((t.contact_id IS NULL AND t.lead_id IS NULL)
      OR EXISTS(SELECT 1 FROM public.contacts person WHERE person.id=t.contact_id AND person.workspace_id=t.workspace_id AND lower(person.email)=lower(m.from_email))
      OR (t.contact_id IS NULL AND EXISTS(SELECT 1 FROM public.leads person WHERE person.id=t.lead_id AND person.workspace_id=t.workspace_id AND lower(person.email)=lower(m.from_email)))))
   INTO w,source,v_source_key,contact,lead,company,deal,occurred,verified
   FROM public.email_messages m JOIN public.email_threads t ON t.id=m.thread_id AND t.workspace_id=m.workspace_id AND t.account_id=m.account_id
   JOIN public.email_accounts ac ON ac.id=t.account_id AND ac.workspace_id=t.workspace_id
   WHERE m.id=p_message AND m.direction='inbound' AND NOT public.service_agent_email_is_automatic(m.headers,m.from_email,ac.email)
   FOR UPDATE OF t;
 ELSIF p_channel='chat' THEN
  SELECT m.workspace_id,c.id,c.workspace_id::text,NULL::uuid,NULL::uuid,m.created_at INTO w,source,v_source_key,contact,lead,occurred
   FROM public.live_chat_messages m JOIN public.live_chat_sessions c ON c.id=m.session_id AND c.workspace_id=m.workspace_id
   WHERE m.id=p_message AND m.direction='inbound' AND c.status<>'closed' FOR UPDATE OF c;
 ELSIF p_channel='linkedin' THEN
  SELECT m.workspace_id,c.id,c.account_id::text,c.contact_id,c.lead_id,c.company_id,c.deal_id,m.created_at,c.identity_status IN('manual','matched') AND (c.contact_id IS NOT NULL OR c.lead_id IS NOT NULL)
   INTO w,source,v_source_key,contact,lead,company,deal,occurred,verified
   FROM public.linkedin_messages m JOIN public.linkedin_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id
   WHERE m.id=p_message AND m.direction='inbound' AND c.status='open' FOR UPDATE OF c;
 ELSE RETURN NULL;END IF;
 IF w IS NULL OR source IS NULL THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sdr_workspace_settings WHERE workspace_id=w AND enabled) THEN RETURN NULL;END IF;
 SELECT * INTO a FROM public.service_channel_accounts WHERE workspace_id=w AND channel=p_channel AND source_key=v_source_key AND enabled AND routing_configured;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF p_channel='linkedin' AND EXISTS(SELECT 1 FROM public.linkedin_messages sent JOIN public.prospecting_sequence_effects effect ON effect.id=sent.id AND effect.workspace_id=sent.workspace_id WHERE sent.conversation_id=source AND sent.workspace_id=w AND sent.direction='outbound' AND effect.kind='linkedin' AND effect.status='succeeded') THEN v_origin:='campaign';END IF;
 SELECT * INTO b FROM public.service_channel_bindings WHERE account_id=a.id AND workspace_id=w AND enabled AND CASE v_origin WHEN 'campaign' THEN campaigns ELSE inbound END;
 IF NOT FOUND OR occurred<b.updated_at THEN RETURN NULL;END IF;
 IF p_channel IN('email','linkedin') AND NOT public.prospecting_sequence_agent_route_allowed(w,p_channel,source,b.agent_id) THEN RETURN NULL;END IF;
 SELECT * INTO cfg FROM public.sdr_playbooks WHERE id=b.agent_id AND workspace_id=w AND enabled;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.sdr_agent_versions WHERE playbook_id=cfg.id AND workspace_id=w AND status='published') THEN RETURN NULL;END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE workspace_id=w AND channel=p_channel AND source_id=source FOR UPDATE;
 IF FOUND THEN
  IF s.ai_owner<>'ai' OR occurred<s.last_inbound_at THEN RETURN NULL;END IF;
  UPDATE public.sdr_enrollments SET status='active',cancel_reason=NULL,follow_up_at=NULL WHERE id=s.enrollment_id AND status='paused' AND opted_out_at IS NULL
   AND cancel_reason IN('out_of_icp','left_company','not_this_person','post_close','no_demand','declined','not_target','private_number','referral_received','referral_declined','other');
  IF NOT EXISTS(SELECT 1 FROM public.sdr_enrollments WHERE id=s.enrollment_id AND playbook_id=cfg.id AND status='active' AND opted_out_at IS NULL) THEN RETURN NULL;END IF;
  IF NOT s.context_approved AND s.channel IN('email','linkedin') THEN
   UPDATE public.sdr_enrollments SET contact_id=CASE WHEN verified THEN contact ELSE NULL END,lead_id=CASE WHEN verified THEN lead ELSE NULL END,company_id=NULL,deal_id=NULL,
    qualification_id=CASE WHEN contact_id IS DISTINCT FROM CASE WHEN verified THEN contact ELSE NULL END OR lead_id IS DISTINCT FROM CASE WHEN verified THEN lead ELSE NULL END THEN NULL ELSE qualification_id END
    WHERE id=s.enrollment_id;
  END IF;

 ELSE
  IF (contact IS NOT NULL OR lead IS NOT NULL) AND EXISTS(SELECT 1 FROM public.sdr_enrollments WHERE workspace_id=w AND opted_out_at IS NOT NULL AND
   ((contact IS NOT NULL AND contact_id=contact) OR (lead IS NOT NULL AND lead_id=lead))) THEN RETURN NULL;END IF;
  INSERT INTO public.sdr_enrollments(workspace_id,owner_id,playbook_id,contact_id,lead_id,status,commercial_stage)
   VALUES(w,cfg.owner_id,cfg.id,CASE WHEN verified THEN contact ELSE NULL END,CASE WHEN verified THEN lead ELSE NULL END,'active','awaiting_reply') RETURNING id INTO e;
  INSERT INTO public.service_agent_sessions(workspace_id,account_id,channel,source_id,enrollment_id,identity_verified,last_inbound_at,origin) VALUES(w,a.id,p_channel,source,e,verified,occurred,v_origin) RETURNING * INTO s;
 END IF;
 INSERT INTO public.service_agent_inbound_events(channel,message_id,session_id) VALUES(p_channel,p_message,s.id) ON CONFLICT DO NOTHING RETURNING message_id INTO event_id;
 IF event_id IS NULL THEN RETURN NULL;END IF;
 UPDATE public.service_agent_sessions SET ai_version=ai_version+1,identity_verified=CASE WHEN context_approved THEN identity_verified ELSE verified END,last_inbound_at=occurred WHERE id=s.id RETURNING * INTO s;
 wait_seconds:=CASE WHEN cfg.guardrails->>'customer_wait_seconds' ~ '^[0-9]{1,3}$' THEN least(300,(cfg.guardrails->>'customer_wait_seconds')::int) ELSE 5 END;
 INSERT INTO public.service_agent_jobs(workspace_id,session_id,inbound_message_id,conversation_version,available_at)
 VALUES(w,s.id,p_message,s.ai_version,now()+make_interval(secs=>wait_seconds))
 ON CONFLICT(session_id) WHERE status='queued' DO UPDATE SET inbound_message_id=excluded.inbound_message_id,
 conversation_version=excluded.conversation_version,available_at=excluded.available_at,updated_at=now() RETURNING id INTO j;
 RETURN j;
END $$;

CREATE OR REPLACE FUNCTION public.service_agent_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ch text:=CASE TG_TABLE_NAME WHEN 'email_messages' THEN 'email' WHEN 'linkedin_messages' THEN 'linkedin' ELSE 'chat' END;src uuid;
BEGIN
 src:=CASE ch WHEN 'email' THEN (to_jsonb(NEW)->>'thread_id')::uuid WHEN 'linkedin' THEN (to_jsonb(NEW)->>'conversation_id')::uuid ELSE (to_jsonb(NEW)->>'session_id')::uuid END;
 IF NEW.direction='inbound' AND coalesce(auth.role(),'')='service_role' THEN
  BEGIN PERFORM public.service_agent_enqueue(ch,NEW.id);
  EXCEPTION WHEN OTHERS THEN
   INSERT INTO public.service_agent_ingest_errors(workspace_id,channel,message_id,error)
   VALUES(NEW.workspace_id,ch,NEW.id,left(SQLSTATE||': '||SQLERRM,500)) ON CONFLICT(channel,message_id) DO UPDATE SET error=excluded.error;
  END;
 ELSIF NEW.direction='outbound' AND NOT EXISTS(SELECT 1 FROM public.service_agent_jobs j JOIN public.service_agent_sessions s ON s.id=j.session_id
  WHERE j.workspace_id=NEW.workspace_id AND s.channel=ch AND s.source_id=src AND j.send_started_at IS NOT NULL
  AND (j.outbound_message_id=NEW.id OR (ch='email' AND EXISTS(
   SELECT 1 FROM public.email_threads t JOIN public.email_accounts a ON a.id=t.account_id AND a.workspace_id=t.workspace_id
   WHERE t.id=src AND t.workspace_id=NEW.workspace_id AND a.id=(to_jsonb(NEW)->>'account_id')::uuid
   AND lower(a.email)=lower(to_jsonb(NEW)->>'from_email')) AND (
    (j.provider_message_id IS NOT NULL AND j.provider_message_id=to_jsonb(NEW)->>'provider_message_id') OR
    (j.status IN('running','uncertain') AND nullif(j.draft_payload->>'delivery_header','') IS NOT NULL
     AND j.draft_payload->>'delivery_header'=to_jsonb(NEW)->>'message_id_header' AND j.draft_text=to_jsonb(NEW)->>'body_text')
   )))
  AND coalesce(auth.role(),'')='service_role') THEN
  UPDATE public.service_agent_sessions SET ai_owner='human',ai_version=ai_version+1 WHERE workspace_id=NEW.workspace_id AND channel=ch AND source_id=src AND ai_owner='ai' AND coalesce(nullif(to_jsonb(NEW)->>'sent_at','')::timestamptz,NEW.created_at)>=coalesce(last_inbound_at,created_at);
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.service_agent_inbox_state(p_channel text,p_source uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context();w uuid:=(c->>'workspace')::uuid;s public.service_agent_sessions;j public.service_agent_jobs;e public.sdr_enrollments;label text;r text;
BEGIN
 r:=CASE p_channel WHEN 'email' THEN 'email_threads' WHEN 'chat' THEN 'live_chat_sessions' WHEN 'linkedin' THEN 'linkedin_conversations' ELSE NULL END;
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

CREATE OR REPLACE FUNCTION public.service_agent_set_owner(p_channel text,p_source uuid,p_owner text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context();w uuid:=(c->>'workspace')::uuid;s public.service_agent_sessions;e public.sdr_enrollments;r text;
BEGIN
 r:=CASE p_channel WHEN 'email' THEN 'email_threads' WHEN 'chat' THEN 'live_chat_sessions' WHEN 'linkedin' THEN 'linkedin_conversations' ELSE NULL END;
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

CREATE OR REPLACE FUNCTION public.service_agent_commit_turn(
  p_job uuid,
  p_lease uuid,
  p_evidence jsonb,
  p_qualification jsonb,
  p_enrollment jsonb,
  p_job_patch jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j public.service_agent_jobs;
  cv record;
  e public.sdr_enrollments;
  v_qid uuid;
  v_cur timestamptz;
  v_answers jsonb;
  ev jsonb;
  v_has_state boolean;
  handoff_target uuid; source_table text; assignment_status text;
BEGIN
  SELECT * INTO j FROM public.service_agent_jobs WHERE id = p_job FOR UPDATE;
  IF NOT FOUND THEN RETURN 'job_missing'; END IF;
  IF j.status <> 'running' OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_until < now() THEN RETURN 'lease_lost'; END IF;
  SELECT id, workspace_id, enrollment_id, channel, source_id, ai_owner, ai_version INTO cv
    FROM public.service_agent_sessions WHERE id = j.session_id FOR SHARE;
  IF NOT FOUND OR cv.workspace_id IS DISTINCT FROM j.workspace_id THEN RETURN 'context_mismatch'; END IF;
  IF cv.ai_owner IS DISTINCT FROM 'ai' THEN RETURN 'owner_not_ai'; END IF;
  IF cv.ai_version IS DISTINCT FROM j.conversation_version THEN RETURN 'stale_version'; END IF;
  SELECT * INTO e FROM public.sdr_enrollments WHERE id = cv.enrollment_id FOR UPDATE;
  IF NOT FOUND OR e.workspace_id IS DISTINCT FROM j.workspace_id OR e.conversation_id IS NOT NULL THEN RETURN 'context_mismatch'; END IF;
  IF e.status <> 'active' THEN RETURN 'enrollment_inactive'; END IF;

  IF public.service_agent_guard(p_job,p_lease)<>'ok' THEN RETURN 'permission_revoked'; END IF;

  -- Estado da conversa: compare-and-set ANTES de qualquer escrita.
  v_has_state := p_enrollment IS NOT NULL AND jsonb_typeof(p_enrollment) = 'object'
    AND p_enrollment ? 'conversation_state'
    AND jsonb_typeof(p_enrollment->'conversation_state') = 'object';
  IF v_has_state AND p_enrollment ? 'expected_state_version'
     AND (p_enrollment->>'expected_state_version')::integer IS DISTINCT FROM e.conversation_state_version THEN
    RETURN 'state_changed';
  END IF;

  -- Qualificação canônica (mesma da Prospecção). Decisão humana nunca é alterada.
  -- Compare-and-set por data de alteração E respostas lidas antes da IA.
  IF p_qualification IS NOT NULL AND jsonb_typeof(p_qualification) = 'object' THEN
    v_qid := NULLIF(p_qualification->>'id','')::uuid;
    IF v_qid IS NOT NULL THEN
      SELECT updated_at, answers INTO v_cur, v_answers FROM public.prospecting_qualifications
        WHERE id = v_qid AND workspace_id = j.workspace_id FOR UPDATE;
      IF NOT FOUND THEN RETURN 'qualification_missing'; END IF;
      IF v_cur IS DISTINCT FROM (p_qualification->>'expected_updated_at')::timestamptz
         OR COALESCE(v_answers, '{}'::jsonb) IS DISTINCT FROM COALESCE(p_qualification->'expected_answers', '{}'::jsonb) THEN
        RETURN 'qualification_changed';
      END IF;
      UPDATE public.prospecting_qualifications SET
        answers = p_qualification->'answers',
        score = round((p_qualification->>'score')::numeric)::integer,
        questionnaire_points = (p_qualification->>'questionnaire_points')::numeric,
        icp_points = (p_qualification->>'icp_points')::numeric,
        total_score = (p_qualification->>'total_score')::numeric,
        updated_at = now()
      WHERE id = v_qid;
    ELSE
      IF EXISTS (SELECT 1 FROM public.prospecting_qualifications
                 WHERE workspace_id = j.workspace_id
                   AND questionnaire_id = (p_qualification->>'questionnaire_id')::uuid
                   AND entity = p_qualification->>'entity'
                   AND entity_id = (p_qualification->>'entity_id')::uuid) THEN
        RETURN 'qualification_changed';
      END IF;
      INSERT INTO public.prospecting_qualifications
        (owner_id, workspace_id, questionnaire_id, entity, entity_id, answers, score, questionnaire_points, icp_points, total_score, decision)
      VALUES (
        e.owner_id, j.workspace_id, (p_qualification->>'questionnaire_id')::uuid,
        p_qualification->>'entity', (p_qualification->>'entity_id')::uuid,
        p_qualification->'answers', round((p_qualification->>'score')::numeric)::integer,
        (p_qualification->>'questionnaire_points')::numeric, (p_qualification->>'icp_points')::numeric,
        (p_qualification->>'total_score')::numeric, 'pending')
      RETURNING id INTO v_qid;
    END IF;
    UPDATE public.sdr_enrollments SET qualification_id = v_qid, qualification_score = round((p_qualification->>'total_score')::numeric)::integer
      WHERE id = e.id;
  END IF;

  FOR ev IN SELECT * FROM jsonb_array_elements(COALESCE(p_evidence, '[]'::jsonb)) LOOP
    INSERT INTO public.service_agent_evidence(workspace_id,session_id,enrollment_id,field,question_id,value,source_message_id,excerpt)
    SELECT j.workspace_id,cv.id,e.id,ev->>'field',NULLIF(ev->>'question_id','')::uuid,ev->>'value',m.id,ev->>'excerpt'
    FROM (
     SELECT id,workspace_id,thread_id AS source_id,direction FROM public.email_messages WHERE cv.channel='email'
     UNION ALL SELECT id,workspace_id,session_id,direction FROM public.live_chat_messages WHERE cv.channel='chat'
    ) m WHERE m.id=(ev->>'message_id')::uuid AND m.source_id=cv.source_id AND m.workspace_id=j.workspace_id AND m.direction='inbound'
    ON CONFLICT(session_id,field,source_message_id) DO NOTHING;
  END LOOP;

  -- The configured recipient is read from the published agent's playbook, never model text.
  IF p_job_patch->'draft_payload'->>'intent'='handoff' THEN
    SELECT assigned_to INTO handoff_target FROM public.sdr_playbooks WHERE id=e.playbook_id AND workspace_id=j.workspace_id;
    source_table:=CASE cv.channel WHEN 'email' THEN 'email_threads' WHEN 'linkedin' THEN 'linkedin_conversations' ELSE 'live_chat_sessions' END;
    assignment_status:='unavailable';
    IF cv.channel='linkedin' AND handoff_target IS DISTINCT FROM (SELECT owner_id FROM public.linkedin_conversations WHERE id=cv.source_id) THEN assignment_status:='private_account_owner_only';
    ELSIF handoff_target IS NOT NULL AND public.is_workspace_member(j.workspace_id,handoff_target) THEN
      assignment_status:='not_authorized';
      IF public.sales_worker_authorize('sdr_enrollments',e.id,jsonb_build_array(
        jsonb_build_object('table',source_table,'id',cv.source_id,'action','assign'),
        jsonb_build_object('member_id',handoff_target))) THEN
        IF cv.channel='email' THEN UPDATE public.email_threads SET assigned_to=handoff_target WHERE id=cv.source_id AND workspace_id=j.workspace_id;
        ELSIF cv.channel='linkedin' THEN UPDATE public.linkedin_conversations SET assigned_to=handoff_target WHERE id=cv.source_id AND workspace_id=j.workspace_id;
        ELSE UPDATE public.live_chat_sessions SET assignee_id=handoff_target WHERE id=cv.source_id AND workspace_id=j.workspace_id;END IF;
        assignment_status:='assigned';
      END IF;
    END IF;
    p_job_patch:=jsonb_set(p_job_patch,'{draft_payload}',coalesce(p_job_patch->'draft_payload','{}')||jsonb_build_object('handoff_assignment',assignment_status));
  END IF;

  IF p_enrollment IS NOT NULL AND jsonb_typeof(p_enrollment) = 'object' THEN
    UPDATE public.sdr_enrollments SET
      offers = CASE WHEN p_enrollment ? 'offers' THEN p_enrollment->'offers' ELSE offers END,
      status = COALESCE(p_enrollment->>'status', status),
      handoff_at = CASE WHEN p_enrollment ? 'handoff_at' THEN (p_enrollment->>'handoff_at')::timestamptz ELSE handoff_at END,
      handoff_reason = CASE WHEN p_enrollment ? 'handoff_reason' THEN left(p_enrollment->>'handoff_reason',1000) ELSE handoff_reason END,
      commercial_stage = COALESCE(p_enrollment->>'commercial_stage', commercial_stage),
      opted_out_at = CASE WHEN p_enrollment ? 'opted_out_at' THEN (p_enrollment->>'opted_out_at')::timestamptz ELSE opted_out_at END,
      cancel_reason = CASE WHEN p_enrollment ? 'cancel_reason' THEN p_enrollment->>'cancel_reason' ELSE cancel_reason END,
      follow_up_at = CASE WHEN p_enrollment ? 'follow_up_at' THEN (p_enrollment->>'follow_up_at')::timestamptz ELSE follow_up_at END,
      conversation_state = CASE WHEN v_has_state
        THEN COALESCE(conversation_state, '{}'::jsonb) || (p_enrollment->'conversation_state')
        ELSE conversation_state END,
      conversation_state_version = CASE WHEN v_has_state THEN conversation_state_version + 1 ELSE conversation_state_version END,
      updated_at = now()
    WHERE id = e.id;
  END IF;

  IF p_job_patch IS NOT NULL AND jsonb_typeof(p_job_patch) = 'object' THEN
    UPDATE public.service_agent_jobs SET
      status = COALESCE(p_job_patch->>'status', status),
      draft_text = CASE WHEN p_job_patch ? 'draft_text' THEN p_job_patch->>'draft_text' ELSE draft_text END,
      draft_payload = CASE WHEN p_job_patch ? 'draft_payload' THEN p_job_patch->'draft_payload' ELSE draft_payload END,
      error = CASE WHEN p_job_patch ? 'error' THEN p_job_patch->>'error' ELSE error END,
      lease_token = CASE WHEN COALESCE(p_job_patch->>'status', 'running') = 'running' THEN lease_token ELSE NULL END,
      updated_at = now()
    WHERE id = j.id;
  END IF;
  IF p_job_patch->'draft_payload'->>'intent'='handoff' OR coalesce((p_job_patch->'draft_payload'->>'opt_out')::boolean,false) THEN
    UPDATE public.service_agent_sessions SET ai_owner=CASE WHEN p_job_patch->'draft_payload'->>'intent'='handoff' THEN 'human' ELSE 'paused' END,
      ai_version=ai_version+1 WHERE id=cv.id;
    UPDATE public.service_agent_jobs SET conversation_version=(SELECT ai_version FROM public.service_agent_sessions WHERE id=cv.id) WHERE id=j.id;
  END IF;
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.service_agent_commit_turn(uuid,uuid,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_commit_turn(uuid,uuid,jsonb,jsonb,jsonb,jsonb) TO service_role;

CREATE TRIGGER service_agent_message_event AFTER INSERT ON public.linkedin_messages FOR EACH ROW EXECUTE FUNCTION public.service_agent_message_event();
CREATE FUNCTION public.service_agent_complete_linkedin(p_job uuid,p_send_token uuid,p_provider_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.service_agent_jobs;s public.service_agent_sessions;cv public.linkedin_conversations;actual uuid;
BEGIN
 SELECT * INTO j FROM public.service_agent_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND OR j.send_token IS DISTINCT FROM p_send_token OR j.send_started_at IS NULL OR nullif(p_provider_id,'') IS NULL THEN RAISE EXCEPTION 'Invalid delivery proof' USING ERRCODE='42501';END IF;
 IF j.status='sent' THEN RETURN j.outbound_message_id;END IF;
 IF j.status NOT IN('running','uncertain','skipped') THEN RAISE EXCEPTION 'Invalid delivery state';END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE id=j.session_id AND workspace_id=j.workspace_id;
 IF NOT FOUND OR s.channel<>'linkedin' THEN RAISE EXCEPTION 'Invalid service channel';END IF;
 SELECT * INTO cv FROM public.linkedin_conversations WHERE id=s.source_id AND workspace_id=s.workspace_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conversation unavailable';END IF;
 INSERT INTO public.linkedin_messages(id,workspace_id,conversation_id,account_id,provider_message_id,direction,body)
 VALUES(j.outbound_message_id,s.workspace_id,cv.id,cv.account_id,p_provider_id,'outbound',j.draft_text)
 ON CONFLICT(account_id,provider_message_id) DO UPDATE SET provider_message_id=EXCLUDED.provider_message_id RETURNING id INTO actual;
 UPDATE public.linkedin_conversations SET snippet=left(j.draft_text,240),last_message_at=now() WHERE id=cv.id;
 UPDATE public.service_agent_jobs SET status='sent',outbound_message_id=actual,provider_message_id=p_provider_id,sent_at=now(),lease_token=NULL,updated_at=now() WHERE id=j.id;
 UPDATE public.sdr_enrollments SET messages_sent=messages_sent+1,last_action_at=now() WHERE id=s.enrollment_id;
 RETURN actual;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_complete_linkedin(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_complete_linkedin(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.service_agent_verify_identity(p_channel text,p_source uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context();w uuid:=(c->>'workspace')::uuid;
 s public.service_agent_sessions;r text;person_contact uuid;person_lead uuid;company uuid;deal uuid;ref record;
BEGIN
 r:=CASE p_channel WHEN 'email' THEN 'email_threads' WHEN 'chat' THEN 'live_chat_sessions' WHEN 'linkedin' THEN 'linkedin_conversations' END;
 IF w IS NULL OR r IS NULL OR coalesce((c->>'read_only')::boolean,true)
 OR NOT coalesce(c->'keys' ? 'system.channels.approve.workspace',false)
 OR NOT public.sales_record_access(r,p_source,'view') OR NOT public.sales_record_access(r,p_source,'update')
 THEN RAISE EXCEPTION 'Sem permissão para confirmar identidade.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE workspace_id=w AND channel=p_channel AND source_id=p_source FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento indisponível.' USING ERRCODE='42501';END IF;
 IF p_channel='email' THEN
  SELECT contact_id,lead_id,company_id,deal_id INTO person_contact,person_lead,company,deal FROM public.email_threads WHERE id=p_source AND workspace_id=w FOR UPDATE;
 ELSIF p_channel='linkedin' THEN SELECT contact_id,lead_id,company_id,deal_id INTO person_contact,person_lead,company,deal FROM public.linkedin_conversations WHERE id=p_source AND workspace_id=w FOR UPDATE;
 ELSE
  SELECT contact_id,lead_id,NULL::uuid,NULL::uuid INTO person_contact,person_lead,company,deal FROM public.live_chat_sessions WHERE id=p_source AND workspace_id=w FOR UPDATE;
 END IF;
 IF person_contact IS NULL AND person_lead IS NULL THEN RAISE EXCEPTION 'Associe uma pessoa antes de confirmar a identidade.';END IF;
 FOR ref IN SELECT * FROM (VALUES('contacts',person_contact),('leads',person_lead),('companies',company),('deals',deal)) t(tab,id) WHERE id IS NOT NULL LOOP
  IF NOT public.sales_record_access(ref.tab,ref.id,'view') THEN RAISE EXCEPTION 'Contexto indisponível.' USING ERRCODE='42501';END IF;
 END LOOP;
 UPDATE public.sdr_enrollments SET contact_id=person_contact,lead_id=person_lead,company_id=company,deal_id=deal,
 qualification_id=CASE WHEN contact_id IS DISTINCT FROM person_contact OR lead_id IS DISTINCT FROM person_lead THEN NULL ELSE qualification_id END
 WHERE id=s.enrollment_id AND workspace_id=w;
 UPDATE public.service_agent_sessions SET identity_verified=true,context_approved=true,ai_version=ai_version+1 WHERE id=s.id;
END $$;
CREATE OR REPLACE FUNCTION public.service_agent_invalidate_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.service_agent_sessions;
BEGIN
 IF (to_jsonb(NEW)->'contact_id',to_jsonb(NEW)->'lead_id',to_jsonb(NEW)->'company_id',to_jsonb(NEW)->'deal_id') IS NOT DISTINCT FROM (to_jsonb(OLD)->'contact_id',to_jsonb(OLD)->'lead_id',to_jsonb(OLD)->'company_id',to_jsonb(OLD)->'deal_id') THEN RETURN NEW;END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE source_id=NEW.id AND workspace_id=NEW.workspace_id
 AND channel=CASE TG_TABLE_NAME WHEN 'email_threads' THEN 'email' WHEN 'linkedin_conversations' THEN 'linkedin' ELSE 'chat' END FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW;END IF;
 UPDATE public.sdr_enrollments SET contact_id=NULL,lead_id=NULL,company_id=NULL,deal_id=NULL,qualification_id=NULL WHERE id=s.enrollment_id AND workspace_id=s.workspace_id;
 UPDATE public.service_agent_sessions SET identity_verified=false,context_approved=false,ai_version=ai_version+1 WHERE id=s.id;
 RETURN NEW;
END $$;
CREATE TRIGGER service_agent_linkedin_identity AFTER UPDATE OF contact_id,lead_id,company_id,deal_id ON public.linkedin_conversations FOR EACH ROW EXECUTE FUNCTION public.service_agent_invalidate_identity();

ALTER POLICY service_agent_session_read ON public.service_agent_sessions USING(
 workspace_id=((SELECT public.work_access_context())->>'workspace')::uuid AND
 public.sales_record_access('sdr_enrollments',enrollment_id,'view') AND
 public.sales_record_access(CASE channel WHEN 'email' THEN 'email_threads' WHEN 'linkedin' THEN 'linkedin_conversations' ELSE 'live_chat_sessions' END,source_id,'view'));
