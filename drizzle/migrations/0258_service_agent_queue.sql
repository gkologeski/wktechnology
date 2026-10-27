-- E-mail/chat reuse canonical SDR enrollments, never synthetic WhatsApp conversations.
CREATE UNIQUE INDEX IF NOT EXISTS sdr_enrollments_identity_workspace ON public.sdr_enrollments(id,workspace_id);
CREATE TABLE public.service_agent_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 account_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN('email','chat')),
 source_id uuid NOT NULL,
 enrollment_id uuid NOT NULL UNIQUE,
 ai_owner text NOT NULL DEFAULT 'ai' CHECK(ai_owner IN('ai','human','paused')),
 ai_version integer NOT NULL DEFAULT 0,
 origin text NOT NULL DEFAULT 'inbound' CHECK(origin IN('inbound','campaign')),
 identity_verified boolean NOT NULL DEFAULT false,context_approved boolean NOT NULL DEFAULT false,last_inbound_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,channel,source_id),UNIQUE(id,workspace_id),
 FOREIGN KEY(account_id,workspace_id) REFERENCES public.service_channel_accounts(id,workspace_id),
 FOREIGN KEY(enrollment_id,workspace_id) REFERENCES public.sdr_enrollments(id,workspace_id)
);
CREATE TABLE public.service_agent_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 session_id uuid NOT NULL,
 inbound_message_id uuid NOT NULL,
 conversation_version integer NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','running','drafted','ready','sent','skipped','failed','uncertain')),
 lease_token uuid,lease_until timestamptz,available_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,agent_version_id uuid REFERENCES public.sdr_agent_versions(id),
 draft_text text,draft_payload jsonb,error text,
 outbound_message_id uuid NOT NULL DEFAULT gen_random_uuid(),
 provider_message_id text,send_started_at timestamptz,sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(session_id,workspace_id) REFERENCES public.service_agent_sessions(id,workspace_id) ON DELETE CASCADE
);
CREATE INDEX service_agent_jobs_due ON public.service_agent_jobs(available_at) WHERE status='queued';
CREATE UNIQUE INDEX service_agent_jobs_running ON public.service_agent_jobs(session_id) WHERE status='running';
CREATE UNIQUE INDEX service_agent_jobs_queued ON public.service_agent_jobs(session_id) WHERE status='queued';
CREATE TABLE public.service_agent_inbound_events (
 channel text NOT NULL CHECK(channel IN('email','chat')),message_id uuid NOT NULL,
 session_id uuid NOT NULL REFERENCES public.service_agent_sessions(id) ON DELETE CASCADE,
 PRIMARY KEY(channel,message_id)
);
CREATE TABLE public.service_agent_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 session_id uuid NOT NULL,enrollment_id uuid NOT NULL REFERENCES public.sdr_enrollments(id),
 field text NOT NULL,question_id uuid,value text NOT NULL,source_message_id uuid NOT NULL,excerpt text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(session_id,field,source_message_id),
 FOREIGN KEY(session_id,workspace_id) REFERENCES public.service_agent_sessions(id,workspace_id) ON DELETE CASCADE
);
ALTER TABLE public.service_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_agent_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_agent_inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_agent_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_agent_sessions,public.service_agent_jobs,public.service_agent_inbound_events,public.service_agent_evidence FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.service_agent_sessions,public.service_agent_jobs,public.service_agent_evidence TO authenticated;
GRANT ALL ON public.service_agent_sessions,public.service_agent_jobs,public.service_agent_inbound_events,public.service_agent_evidence TO service_role;
CREATE POLICY service_agent_session_read ON public.service_agent_sessions FOR SELECT TO authenticated USING(
 workspace_id=((SELECT public.work_access_context())->>'workspace')::uuid AND
 public.sales_record_access('sdr_enrollments',enrollment_id,'view') AND
 public.sales_record_access(CASE channel WHEN 'email' THEN 'email_threads' ELSE 'live_chat_sessions' END,source_id,'view'));
CREATE POLICY service_agent_job_read ON public.service_agent_jobs FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.service_agent_sessions s WHERE s.id=session_id AND s.workspace_id=service_agent_jobs.workspace_id));
CREATE POLICY service_agent_evidence_read ON public.service_agent_evidence FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.service_agent_sessions s WHERE s.id=session_id AND s.workspace_id=service_agent_evidence.workspace_id));

-- One trusted persisted source for worker and CRM authorization in all channels.
CREATE FUNCTION public.service_agent_source_context(p_enrollment uuid)
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
 ELSE
  SELECT u,true INTO source_owner,source_ok FROM public.live_chat_sessions c WHERE c.id=s.source_id AND c.workspace_id=s.workspace_id AND c.status<>'closed' AND a.source_key=s.workspace_id::text;
  refs:=jsonb_build_array(jsonb_build_object('table','live_chat_sessions','id',s.source_id,'action','update'));
 END IF;
 IF NOT coalesce(source_ok,false) THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('workspace',s.workspace_id,'actor',u,'session',s.id,'refs',refs||jsonb_build_array(
  jsonb_build_object('resource','techsales.inbox.'||s.channel,'action','create','subject_id',source_owner)));
END $$;
REVOKE ALL ON FUNCTION public.service_agent_source_context(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_source_context(uuid) TO service_role;

CREATE FUNCTION public.service_agent_email_is_automatic(p_headers jsonb,p_from text,p_mailbox text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(lower(p_from)=lower(p_mailbox),false) OR EXISTS(SELECT 1 FROM jsonb_each_text(coalesce(p_headers,'{}')) h
 WHERE (lower(h.key)='auto-submitted' AND lower(trim(h.value)) NOT IN('','no'))
 OR (lower(h.key)='precedence' AND lower(trim(h.value)) IN('bulk','list','junk'))
 OR (lower(h.key) IN('list-id','x-auto-response-suppress') AND trim(h.value)<>''));
$$;
REVOKE ALL ON FUNCTION public.service_agent_email_is_automatic(jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_email_is_automatic(jsonb,text,text) TO service_role;

CREATE FUNCTION public.service_agent_enqueue(p_channel text,p_message uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;source uuid;v_source_key text;contact uuid;lead uuid;company uuid;deal uuid;occurred timestamptz;cfg public.sdr_playbooks;
 a public.service_channel_accounts;b public.service_channel_bindings;s public.service_agent_sessions;e uuid;j uuid;wait_seconds int;event_id uuid;verified boolean:=false;
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
 ELSE RETURN NULL;END IF;
 IF w IS NULL OR source IS NULL THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sdr_workspace_settings WHERE workspace_id=w AND enabled) THEN RETURN NULL;END IF;
 SELECT * INTO a FROM public.service_channel_accounts WHERE workspace_id=w AND channel=p_channel AND source_key=v_source_key AND enabled AND routing_configured;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO b FROM public.service_channel_bindings WHERE account_id=a.id AND workspace_id=w AND enabled AND inbound;
 IF NOT FOUND OR occurred<b.updated_at THEN RETURN NULL;END IF;
 SELECT * INTO cfg FROM public.sdr_playbooks WHERE id=b.agent_id AND workspace_id=w AND enabled;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.sdr_agent_versions WHERE playbook_id=cfg.id AND workspace_id=w AND status='published') THEN RETURN NULL;END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE workspace_id=w AND channel=p_channel AND source_id=source FOR UPDATE;
 IF FOUND THEN
  IF s.ai_owner<>'ai' OR occurred<s.last_inbound_at THEN RETURN NULL;END IF;
  UPDATE public.sdr_enrollments SET status='active',cancel_reason=NULL,follow_up_at=NULL WHERE id=s.enrollment_id AND status='paused' AND opted_out_at IS NULL
   AND cancel_reason IN('out_of_icp','left_company','not_this_person','post_close','no_demand','declined','not_target','private_number','referral_received','referral_declined','other');
  IF NOT EXISTS(SELECT 1 FROM public.sdr_enrollments WHERE id=s.enrollment_id AND playbook_id=cfg.id AND status='active' AND opted_out_at IS NULL) THEN RETURN NULL;END IF;
  IF NOT s.context_approved AND s.channel='email' THEN
   UPDATE public.sdr_enrollments SET contact_id=CASE WHEN verified THEN contact ELSE NULL END,lead_id=CASE WHEN verified THEN lead ELSE NULL END,company_id=NULL,deal_id=NULL,
    qualification_id=CASE WHEN contact_id IS DISTINCT FROM CASE WHEN verified THEN contact ELSE NULL END OR lead_id IS DISTINCT FROM CASE WHEN verified THEN lead ELSE NULL END THEN NULL ELSE qualification_id END
    WHERE id=s.enrollment_id;
  END IF;

 ELSE
  IF (contact IS NOT NULL OR lead IS NOT NULL) AND EXISTS(SELECT 1 FROM public.sdr_enrollments WHERE workspace_id=w AND opted_out_at IS NOT NULL AND
   ((contact IS NOT NULL AND contact_id=contact) OR (lead IS NOT NULL AND lead_id=lead))) THEN RETURN NULL;END IF;
  INSERT INTO public.sdr_enrollments(workspace_id,owner_id,playbook_id,contact_id,lead_id,status,commercial_stage)
   VALUES(w,cfg.owner_id,cfg.id,CASE WHEN verified THEN contact ELSE NULL END,CASE WHEN verified THEN lead ELSE NULL END,'active','awaiting_reply') RETURNING id INTO e;
  INSERT INTO public.service_agent_sessions(workspace_id,account_id,channel,source_id,enrollment_id,identity_verified,last_inbound_at) VALUES(w,a.id,p_channel,source,e,verified,occurred) RETURNING * INTO s;
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
REVOKE ALL ON FUNCTION public.service_agent_enqueue(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_enqueue(text,uuid) TO service_role;

CREATE TABLE public.service_agent_ingest_errors (
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id),channel text NOT NULL,message_id uuid NOT NULL,
 error text NOT NULL,attempts integer NOT NULL DEFAULT 0,resolved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(channel,message_id)
);
ALTER TABLE public.service_agent_ingest_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_agent_ingest_errors FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.service_agent_ingest_errors TO service_role;

CREATE FUNCTION public.service_agent_message_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ch text:=CASE TG_TABLE_NAME WHEN 'email_messages' THEN 'email' ELSE 'chat' END;src uuid;
BEGIN
 src:=CASE ch WHEN 'email' THEN (to_jsonb(NEW)->>'thread_id')::uuid ELSE (to_jsonb(NEW)->>'session_id')::uuid END;
 IF NEW.direction='inbound' AND coalesce(auth.role(),'')='service_role' THEN
  BEGIN PERFORM public.service_agent_enqueue(ch,NEW.id);
  EXCEPTION WHEN OTHERS THEN
   INSERT INTO public.service_agent_ingest_errors(workspace_id,channel,message_id,error)
   VALUES(NEW.workspace_id,ch,NEW.id,left(SQLSTATE||': '||SQLERRM,500)) ON CONFLICT(channel,message_id) DO UPDATE SET error=excluded.error;
  END;
 ELSIF NEW.direction='outbound' AND NOT EXISTS(SELECT 1 FROM public.service_agent_jobs j JOIN public.service_agent_sessions s ON s.id=j.session_id
  WHERE j.outbound_message_id=NEW.id AND j.workspace_id=NEW.workspace_id AND s.channel=ch AND s.source_id=src AND j.send_started_at IS NOT NULL
  AND coalesce(auth.role(),'')='service_role') THEN
  UPDATE public.service_agent_sessions SET ai_owner='human',ai_version=ai_version+1 WHERE workspace_id=NEW.workspace_id AND channel=ch AND source_id=src AND ai_owner='ai' AND coalesce(nullif(to_jsonb(NEW)->>'sent_at','')::timestamptz,NEW.created_at)>=coalesce(last_inbound_at,created_at);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_message_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER service_agent_message_event AFTER INSERT ON public.email_messages FOR EACH ROW EXECUTE FUNCTION public.service_agent_message_event();
CREATE TRIGGER service_agent_message_event AFTER INSERT ON public.live_chat_messages FOR EACH ROW EXECUTE FUNCTION public.service_agent_message_event();

CREATE FUNCTION public.service_agent_claim(p_limit int DEFAULT 10)
RETURNS SETOF public.service_agent_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE j public.service_agent_jobs;
BEGIN
 -- An expired provider send is uncertain, never automatically re-sent.
 UPDATE public.service_agent_jobs SET status=CASE WHEN send_started_at IS NULL THEN 'failed' ELSE 'uncertain' END,
 error='lease_expired',lease_token=NULL WHERE status='running' AND lease_until<now();
 FOR j IN SELECT * FROM public.service_agent_jobs q WHERE (q.status='queued' OR (q.status='failed' AND q.send_started_at IS NULL AND q.attempts<3 AND NOT EXISTS(SELECT 1 FROM public.service_agent_jobs n WHERE n.session_id=q.session_id AND n.status='queued'))) AND q.available_at<=now()
  AND NOT EXISTS(SELECT 1 FROM public.service_agent_jobs r WHERE r.session_id=q.session_id AND r.status='running')
  ORDER BY q.available_at FOR UPDATE SKIP LOCKED LIMIT least(20,greatest(1,p_limit)) LOOP
  BEGIN
   UPDATE public.service_agent_jobs SET status='running',lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',attempts=attempts+1 WHERE id=j.id RETURNING * INTO j;
   RETURN NEXT j;
  EXCEPTION WHEN unique_violation THEN NULL;END;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_claim(int) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.service_agent_claim(int) TO service_role;

CREATE OR REPLACE FUNCTION public.sales_worker_authorize(p_source text,p_id uuid,p_refs jsonb DEFAULT '[]')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;u uuid;sc jsonb;BEGIN
 IF p_source='sdr_enrollments' AND EXISTS(SELECT 1 FROM public.service_agent_sessions WHERE enrollment_id=p_id) THEN
  sc:=public.service_agent_source_context(p_id);
  IF sc IS NULL THEN RETURN false; END IF;
  RETURN techerp_api.sales_worker_check(p_source,p_id,(sc->>'actor')::uuid,(sc->>'workspace')::uuid,p_refs||(sc->'refs'));
 END IF;
 IF p_source NOT IN('whatsapp_campaigns','email_broadcasts','sequence_enrollments','prospecting_enrollments','sdr_enrollments','enrichment_jobs','workflows','prospecting_campaigns','workflow_subscriptions','report_schedules','scoring_rules') THEN RETURN false;END IF;
 IF p_source='workflows' AND NOT EXISTS(SELECT 1 FROM workflows WHERE id=p_id AND enabled AND status='published') THEN RETURN false;END IF;
 IF p_source='sdr_enrollments' AND NOT EXISTS(SELECT 1 FROM sdr_enrollments e JOIN sdr_playbooks p ON p.id=e.playbook_id AND p.workspace_id=e.workspace_id JOIN whatsapp_conversations c ON c.id=e.conversation_id AND c.workspace_id=e.workspace_id WHERE e.id=p_id AND p.enabled AND c.ai_owner='ai' AND e.opted_out_at IS NULL) THEN RETURN false;END IF;
 IF p_source='scoring_rules' THEN SELECT workspace_id,coalesce(assigned_to,owner_id) INTO w,u FROM scoring_rules WHERE id=p_id AND enabled FOR SHARE;
 ELSIF p_source='report_schedules' THEN SELECT workspace_id,coalesce(execution_user_id,owner_id) INTO w,u FROM report_schedules WHERE id=p_id AND enabled FOR SHARE;
 ELSIF p_source='workflow_subscriptions' THEN SELECT workspace_id,execution_user_id INTO w,u FROM workflow_subscriptions WHERE id=p_id AND enabled FOR SHARE;
 ELSIF p_source='workflows' THEN SELECT workspace_id,coalesce(execution_user_id,owner_id) INTO w,u FROM workflows WHERE id=p_id AND enabled AND status='published' FOR SHARE;
 ELSIF p_source='sdr_enrollments' THEN SELECT e.workspace_id,v.published_by INTO w,u FROM sdr_enrollments e JOIN sdr_agent_versions v ON v.playbook_id=e.playbook_id AND v.workspace_id=e.workspace_id AND v.status='published' WHERE e.id=p_id FOR SHARE OF e,v;
 ELSIF p_source='prospecting_campaigns' THEN
  SELECT workspace_id,execution_user_id INTO w,u FROM prospecting_campaigns WHERE id=p_id AND status='running' FOR SHARE;
 ELSE EXECUTE format('SELECT workspace_id,owner_id FROM public.%I WHERE id=$1',p_source) INTO w,u USING p_id;END IF;
 IF w IS NULL OR u IS NULL THEN RETURN false;END IF;
 RETURN techerp_api.sales_worker_check(p_source,p_id,u,w,p_refs);
END $$;

CREATE OR REPLACE FUNCTION public.sales_source_query(p_source text,p_id uuid,p_table text,p_query jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;u uuid;enabled boolean;r jsonb;piece jsonb;rows jsonb:='[]';n bigint:=0;sc jsonb;BEGIN
 IF p_source='enrichment_jobs' THEN SELECT workspace_id,owner_id,provider='hubspot' AND kind='import' AND status IN('queued','running') INTO w,u,enabled FROM enrichment_jobs WHERE id=p_id FOR SHARE;
 ELSIF p_source='integrations' THEN SELECT workspace_id,owner_id,provider='hubspot' AND status='connected' AND coalesce((config->>'auto_push_enabled')::boolean,false) INTO w,u,enabled FROM integrations WHERE id=p_id FOR SHARE;
 ELSIF p_source='report_schedules' THEN SELECT rs.workspace_id,coalesce(rs.execution_user_id,rs.owner_id),rs.enabled INTO w,u,enabled FROM report_schedules rs WHERE rs.id=p_id FOR SHARE;
 ELSIF p_source='workflow_subscriptions' THEN SELECT sub.workspace_id,sub.execution_user_id,sub.enabled INTO w,u,enabled FROM workflow_subscriptions sub WHERE sub.id=p_id FOR SHARE;
 ELSIF p_source='sdr_enrollments' AND EXISTS(SELECT 1 FROM public.service_agent_sessions WHERE enrollment_id=p_id) THEN
  sc:=public.service_agent_source_context(p_id);
  IF sc IS NULL OR NOT public.sales_worker_authorize(p_source,p_id,'[]') THEN RAISE EXCEPTION 'Atendimento sem autorização atual.' USING ERRCODE='42501'; END IF;
  w:=(sc->>'workspace')::uuid;u:=(sc->>'actor')::uuid;enabled:=true;
 ELSIF p_source='sdr_enrollments' THEN
  SELECT e.workspace_id,v.published_by,p.enabled AND c.ai_owner='ai' AND e.opted_out_at IS NULL INTO w,u,enabled FROM sdr_enrollments e JOIN sdr_playbooks p ON p.id=e.playbook_id AND p.workspace_id=e.workspace_id JOIN whatsapp_conversations c ON c.id=e.conversation_id AND c.workspace_id=e.workspace_id JOIN sdr_agent_versions v ON v.playbook_id=p.id AND v.workspace_id=p.workspace_id AND v.status='published' WHERE e.id=p_id FOR SHARE OF e,p,c,v;
 ELSE RAISE EXCEPTION 'Origem não permitida.' USING ERRCODE='42501';END IF;
 IF w IS NULL OR u IS NULL OR NOT coalesce(enabled,false) THEN RAISE EXCEPTION 'Origem indisponível.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_query->'payload')='array' AND p_query->>'operation'='insert' THEN
  IF jsonb_array_length(p_query->'payload')>500 THEN RAISE EXCEPTION 'Lote grande demais.';END IF;
  FOR piece IN SELECT * FROM jsonb_array_elements(p_query->'payload') LOOP
   r:=techerp_api.sales_source_query(p_source,p_id,u,w,p_table,p_query||jsonb_build_object('payload',piece));rows:=rows||coalesce(r->'data','[]');n:=n+coalesce((r->>'count')::bigint,0);
  END LOOP;RETURN jsonb_build_object('data',rows,'count',n);
 END IF;
 RETURN techerp_api.sales_source_query(p_source,p_id,u,w,p_table,p_query);
END$$;
