SET ROLE techerp_api_subject;
CREATE OR REPLACE FUNCTION techerp_api.sequence_audience_source(p_workspace uuid,p_actor uuid,p_candidates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;BEGIN
 IF current_setting('app.api_subject',true)='on' THEN RAISE EXCEPTION 'Nested audience context forbidden' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) VALUES(txid_current(),p_actor,p_workspace,gen_random_uuid(),current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('app.api_subject','on',true);
 SELECT coalesce(jsonb_object_agg(a.entity||':'||a.id,jsonb_build_object('email',a.email,'phones',jsonb_build_array(a.whatsapp_e164,a.mobile_phone,a.phone),'first_name',a.first_name,'last_name',a.last_name,'company_name',a.company_name)),'{}') INTO result FROM(
  SELECT 'contact' entity,c.first_name,c.last_name,c.company_name,c.id,c.email,c.phone,c.mobile_phone,c.whatsapp_e164 FROM public.shared_fields_contacts c WHERE c.workspace_id=p_workspace AND c.deleted_at IS NULL AND c.id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_candidates) x WHERE x->>'entity'='contact')
  UNION ALL SELECT 'lead',l.first_name,l.last_name,l.company_name,l.id,l.email,l.phone,l.mobile_phone,l.whatsapp_e164 FROM public.shared_fields_leads l WHERE l.workspace_id=p_workspace AND l.deleted_at IS NULL AND l.id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_candidates) x WHERE x->>'entity'='lead')) a;
 PERFORM techerp_api.leave();RETURN result;
END $$;
REVOKE ALL ON FUNCTION techerp_api.sequence_audience_source(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.sequence_audience_source(uuid,uuid,jsonb) TO postgres;
RESET ROLE;

-- Durable execution is separate from immutable audience evidence. No automatic activation.
CREATE TABLE public.prospecting_sequence_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 cohort_person_id uuid NOT NULL UNIQUE REFERENCES public.prospecting_sequence_cohort_people(id),
 version_id uuid NOT NULL REFERENCES public.prospecting_sequence_versions(id),
 owner_id uuid NOT NULL REFERENCES auth.users(id), state text NOT NULL DEFAULT 'active'
 CHECK(state IN('active','paused','cancelled','completed','human','agent','blocked','uncertain')),
 cursor integer NOT NULL DEFAULT 0 CHECK(cursor BETWEEN 0 AND 50),
 next_run_at timestamptz NOT NULL DEFAULT now(), previous_at timestamptz,
 lease_token uuid, lease_until timestamptz, reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sequence_runs_due ON public.prospecting_sequence_runs(next_run_at) WHERE state='active';
CREATE TABLE public.prospecting_sequence_effects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 run_id uuid NOT NULL REFERENCES public.prospecting_sequence_runs(id), step_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('email','whatsapp','call','task','agent','human')),
 status text NOT NULL CHECK(status IN('reserved','sending','succeeded','failed','uncertain')),
 token uuid NOT NULL DEFAULT gen_random_uuid(),provider_id text,error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,UNIQUE(run_id,step_id)
);
CREATE TABLE public.prospecting_sequence_run_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
 run_id uuid NOT NULL REFERENCES public.prospecting_sequence_runs(id),kind text NOT NULL,reason text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sequence_run_events_run ON public.prospecting_sequence_run_events(run_id,id DESC);
ALTER TABLE public.prospecting_sequence_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_sequence_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospecting_sequence_run_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospecting_sequence_runs,public.prospecting_sequence_effects,public.prospecting_sequence_run_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.prospecting_sequence_runs,public.prospecting_sequence_run_events TO authenticated;
GRANT SELECT(id,workspace_id,run_id,step_id,kind,status,provider_id,error_code,created_at,finished_at) ON public.prospecting_sequence_effects TO authenticated;
GRANT SELECT,DELETE ON public.prospecting_sequence_runs,public.prospecting_sequence_effects,public.prospecting_sequence_run_events TO service_role;
CREATE POLICY sequence_runs_read ON public.prospecting_sequence_runs FOR SELECT TO authenticated USING(
 public.sales_context_access((SELECT public.sales_access_context()),workspace_id,'system.automation.sequences','view',ARRAY[owner_id])
 AND EXISTS(SELECT 1 FROM public.prospecting_sequence_cohort_people p WHERE p.id=cohort_person_id));
CREATE POLICY sequence_effects_read ON public.prospecting_sequence_effects FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.prospecting_sequence_runs r WHERE r.id=run_id));
CREATE POLICY sequence_run_events_read ON public.prospecting_sequence_run_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.prospecting_sequence_runs r WHERE r.id=run_id));

CREATE FUNCTION public.prospecting_sequence_runtime_allowed(p_workspace uuid,p_actor uuid,p_owner uuid,p_action text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p_action IN('view','manage','assign')
 AND public.sales_context_access(public.work_subject_context(p_workspace,p_actor),p_workspace,'system.automation.sequences','view',ARRAY[p_owner])
 AND public.sales_context_access(public.work_subject_context(p_workspace,p_actor),p_workspace,'system.automation.sequences',p_action,ARRAY[p_owner]);
$$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_runtime_allowed(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.prospecting_sequence_start(p_workspace uuid,p_cohort uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.prospecting_sequence_cohorts;ctx jsonb;n integer;source_rows jsonb;visible jsonb;BEGIN
 ctx:=public.sales_access_context();
 SELECT * INTO c FROM public.prospecting_sequence_cohorts WHERE id=p_cohort AND workspace_id=p_workspace FOR SHARE;
 IF c.id IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((ctx->>'read_only')::boolean,false) OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),c.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),c.owner_id,'assign') THEN RAISE EXCEPTION 'Inscrição sem autorização atual.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_cohort::text,295));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',source_id,'entity',entity)),'[]') INTO source_rows FROM public.prospecting_sequence_cohort_people WHERE cohort_id=c.id AND block_reason IS NULL;
 visible:=techerp_api.sequence_audience_source(p_workspace,auth.uid(),source_rows);
 IF (SELECT count(*) FROM jsonb_object_keys(visible))<>jsonb_array_length(source_rows) THEN RAISE EXCEPTION 'Acesso ao público alterado; não foi iniciada execução parcial.' USING ERRCODE='42501';END IF;
 INSERT INTO public.prospecting_sequence_runs(workspace_id,cohort_person_id,version_id,owner_id)
 SELECT p_workspace,p.id,c.version_id,auth.uid() FROM public.prospecting_sequence_cohort_people p WHERE p.cohort_id=c.id AND p.block_reason IS NULL ON CONFLICT(cohort_person_id) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_start(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_start(uuid,uuid) TO authenticated;

CREATE FUNCTION public.prospecting_sequence_control(p_workspace uuid,p_run uuid,p_action text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;ctx jsonb;new_state text;BEGIN
 ctx:=public.sales_access_context();
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND workspace_id=p_workspace FOR UPDATE;
 IF r.id IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((ctx->>'read_only')::boolean,false) OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),r.owner_id,'manage') THEN RAISE EXCEPTION 'Execução indisponível.' USING ERRCODE='42501';END IF;
 IF p_action='pause' AND r.state='active' THEN new_state:='paused';
 ELSIF p_action='resume' AND r.state='paused' THEN new_state:='active';
 ELSIF p_action='cancel' AND r.state IN('active','paused','blocked','human','agent') THEN new_state:='cancelled';
 ELSE RAISE EXCEPTION 'Transição de execução não permitida.' USING ERRCODE='22023';END IF;
 UPDATE public.prospecting_sequence_runs SET state=new_state,reason='manual_'||p_action,updated_at=now() WHERE id=r.id;
 INSERT INTO public.prospecting_sequence_run_events(workspace_id,run_id,kind,reason) VALUES(p_workspace,r.id,new_state,'manual_'||p_action);
 RETURN new_state;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_control(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_control(uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.prospecting_sequence_claim(p_limit integer DEFAULT 20)
RETURNS SETOF public.prospecting_sequence_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 FOR r IN SELECT * FROM public.prospecting_sequence_runs WHERE state='active' AND next_run_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_run_at,id FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,20),100)) LOOP
  -- A process may have died after the provider accepted. Never retry that effect blindly.
  IF EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e WHERE e.run_id=r.id AND e.status IN('sending','uncertain')) THEN
   UPDATE public.prospecting_sequence_runs SET state='uncertain',reason='provider_result_unknown',updated_at=now() WHERE id=r.id;
   UPDATE public.prospecting_sequence_effects SET status='uncertain' WHERE run_id=r.id AND status='sending';
   CONTINUE;
  END IF;
  -- A receipt can arrive while paused. Resume advances the confirmed step without resending it.
  IF EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.status='succeeded' AND e.step_id::text=v.definition->'steps'->r.cursor->>'id') THEN
   UPDATE public.prospecting_sequence_runs SET cursor=cursor+1,previous_at=(SELECT max(finished_at) FROM public.prospecting_sequence_effects WHERE run_id=r.id AND status='succeeded'),updated_at=now() WHERE id=r.id RETURNING * INTO r;
  END IF;
  IF NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'assign') THEN
   UPDATE public.prospecting_sequence_runs SET state='blocked',reason='permission_revoked',updated_at=now() WHERE id=r.id;CONTINUE;
  END IF;
  UPDATE public.prospecting_sequence_runs SET lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=r.id RETURNING * INTO r;
  RETURN NEXT r;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_claim(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_claim(integer) TO service_role;

CREATE FUNCTION public.prospecting_sequence_transition(p_run uuid,p_lease uuid,p_state text,p_cursor integer,p_due timestamptz,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND state='active' AND lease_token=p_lease AND lease_until>now() FOR UPDATE;
 IF r.id IS NULL THEN RETURN false;END IF;
 IF p_state NOT IN('active','completed','human','agent','blocked','uncertain') OR p_cursor<r.cursor OR p_cursor>r.cursor+1 OR p_due IS NULL OR length(p_reason)>200 THEN RAISE EXCEPTION 'Transição inválida.' USING ERRCODE='22023';END IF;
 UPDATE public.prospecting_sequence_runs SET state=p_state,cursor=p_cursor,next_run_at=p_due,reason=p_reason,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=r.id;
 INSERT INTO public.prospecting_sequence_run_events(workspace_id,run_id,kind,reason) VALUES(r.workspace_id,r.id,p_state,p_reason);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_transition(uuid,uuid,text,integer,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_transition(uuid,uuid,text,integer,timestamptz,text) TO service_role;

CREATE FUNCTION public.prospecting_sequence_context(p_run uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;v public.prospecting_sequence_versions;
 sources jsonb;s jsonb;signals jsonb;email_reply boolean;wa_reply boolean;last_kind text;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND state='active' AND lease_token=p_lease AND lease_until>now();
 IF r.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'assign') THEN RAISE EXCEPTION 'Execução sem autorização atual.' USING ERRCODE='42501';END IF;
 IF (SELECT definition->'steps'->r.cursor->>'type' FROM public.prospecting_sequence_versions WHERE id=r.version_id) IN('email','whatsapp') THEN
  IF NOT public.sales_context_access(public.work_subject_context(r.workspace_id,r.owner_id),r.workspace_id,'techsales.inbox.'||(SELECT definition->'steps'->r.cursor->>'type' FROM public.prospecting_sequence_versions WHERE id=r.version_id),'create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Envio sem autorização atual.' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO p FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id AND workspace_id=r.workspace_id;
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=r.version_id AND workspace_id=r.workspace_id;
 IF p.id IS NULL OR v.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'assign') THEN RAISE EXCEPTION 'Origem indisponível.' USING ERRCODE='42501';END IF;
 sources:=techerp_api.sequence_audience_source(r.workspace_id,r.owner_id,jsonb_build_array(jsonb_build_object('entity',p.entity,'id',p.source_id)));
 s:=sources->(p.entity||':'||p.source_id::text);
 IF s IS NULL THEN RAISE EXCEPTION 'Destinatário sem acesso atual.' USING ERRCODE='42501';END IF;
 SELECT EXISTS(SELECT 1 FROM public.email_messages m JOIN public.email_threads t ON t.id=m.thread_id AND t.workspace_id=m.workspace_id
 JOIN public.service_channel_accounts a ON a.source_key=t.account_id::text AND a.workspace_id=r.workspace_id AND a.channel='email'
 WHERE t.workspace_id=r.workspace_id AND m.direction='inbound' AND coalesce(m.received_at,m.created_at)>=r.created_at
 AND CASE p.entity WHEN 'contact' THEN t.contact_id=p.source_id ELSE t.lead_id=p.source_id END
 AND a.id::text IN(SELECT x->>'accountId' FROM jsonb_array_elements(v.definition->'steps') x WHERE x->>'type'='email')) INTO email_reply;
 SELECT EXISTS(SELECT 1 FROM public.whatsapp_messages m JOIN public.whatsapp_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id
 JOIN public.service_channel_accounts a ON a.source_key=c.wa_phone_number_id AND a.workspace_id=r.workspace_id AND a.channel='whatsapp'
 WHERE c.workspace_id=r.workspace_id AND m.direction='inbound' AND m.created_at>=r.created_at
 AND CASE p.entity WHEN 'contact' THEN c.contact_id=p.source_id ELSE c.lead_id=p.source_id END
 AND a.id::text IN(SELECT x->>'accountId' FROM jsonb_array_elements(v.definition->'steps') x WHERE x->>'type'='whatsapp')) INTO wa_reply;
 SELECT e.kind INTO last_kind FROM public.prospecting_sequence_effects e WHERE e.run_id=r.id AND e.status='succeeded' ORDER BY e.finished_at DESC LIMIT 1;
 signals:=jsonb_build_object('replied',email_reply OR wa_reply,'previousReplied',CASE last_kind WHEN 'email' THEN email_reply WHEN 'whatsapp' THEN wa_reply ELSE false END,
 'meetingBooked',EXISTS(SELECT 1 FROM public.meetings m WHERE m.workspace_id=r.workspace_id AND m.created_at>=r.created_at AND m.status NOT IN('cancelled','canceled') AND CASE p.entity WHEN 'contact' THEN m.related_contact_id=p.source_id ELSE m.related_lead_id=p.source_id END),
 'callAnswered',EXISTS(SELECT 1 FROM public.activities a WHERE a.workspace_id=r.workspace_id AND a.created_at>=r.created_at AND a.deleted_at IS NULL AND a.type='call' AND a.outcome IN('answered','connected') AND CASE p.entity WHEN 'contact' THEN a.related_contact_id=p.source_id ELSE a.related_lead_id=p.source_id END),
 'optedOut',EXISTS(SELECT 1 FROM public.email_unsubscribes u WHERE u.workspace_id=r.workspace_id AND lower(btrim(u.email))=lower(btrim(s->>'email')))
 OR EXISTS(SELECT 1 FROM public.sdr_enrollments e WHERE e.workspace_id=r.workspace_id AND e.opted_out_at IS NOT NULL AND (to_jsonb(e)->>'contact_id'=p.source_id::text OR to_jsonb(e)->>'lead_id'=p.source_id::text OR regexp_replace(e.contact_phone,'\D','','g') IN(SELECT regexp_replace(phone,'\D','','g') FROM jsonb_array_elements_text(s->'phones') phone))));
 RETURN jsonb_build_object('run',to_jsonb(r),'person',jsonb_build_object('entity',p.entity,'id',p.source_id),'definition',v.definition,'source',s,'signals',signals);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_context(uuid,uuid) TO service_role;

CREATE FUNCTION public.prospecting_sequence_effect_begin(p_run uuid,p_lease uuid,p_step uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;step jsonb;ctx jsonb;account public.service_channel_accounts;kind text;BEGIN
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run FOR UPDATE;
 IF r.state<>'active' OR r.lease_token IS DISTINCT FROM p_lease OR r.lease_until<=now() THEN RAISE EXCEPTION 'Lease inválido.' USING ERRCODE='40001';END IF;
 step:=c->'definition'->'steps'->r.cursor;kind:=step->>'type';
 IF step->>'id' IS DISTINCT FROM p_step::text OR kind NOT IN('email','whatsapp','call','task') OR (c->'signals'->>'optedOut')::boolean THEN RAISE EXCEPTION 'Etapa bloqueada.' USING ERRCODE='42501';END IF;
 IF coalesce((c->'definition'->'settings'->>'stopOnReply')::boolean,true) AND (c->'signals'->>'replied')::boolean OR coalesce((c->'definition'->'settings'->>'stopOnMeeting')::boolean,true) AND (c->'signals'->>'meetingBooked')::boolean THEN RAISE EXCEPTION 'Contato já respondeu ou agendou.' USING ERRCODE='42501';END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);
 IF kind IN('email','whatsapp') THEN
  IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Sem permissão de envio.' USING ERRCODE='42501';END IF;
  SELECT * INTO account FROM public.service_channel_accounts WHERE id=(step->>'accountId')::uuid AND workspace_id=r.workspace_id AND channel=kind AND enabled;
  IF account.id IS NULL THEN RAISE EXCEPTION 'Conta desativada.' USING ERRCODE='42501';END IF;
  IF kind='email' AND NOT EXISTS(SELECT 1 FROM public.email_accounts a WHERE a.id::text=account.source_key AND a.workspace_id=r.workspace_id AND a.owner_id=r.owner_id AND a.status='connected' AND a.provider='gmail') THEN RAISE EXCEPTION 'Conta de e-mail indisponível.' USING ERRCODE='42501';END IF;
 ELSE
  IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.activities','create',ARRAY[r.owner_id]) OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=r.workspace_id AND user_id=(step->>'assigneeId')::uuid AND status='active') THEN RAISE EXCEPTION 'Tarefa sem autorização atual.' USING ERRCODE='42501';END IF;
 END IF;
 INSERT INTO public.prospecting_sequence_effects(workspace_id,run_id,step_id,kind,status) VALUES(r.workspace_id,r.id,p_step,kind,'sending') ON CONFLICT(run_id,step_id) DO NOTHING RETURNING * INTO e;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Efeito já reservado; concilie o resultado antes de tentar novamente.' USING ERRCODE='40001';END IF;
 RETURN jsonb_build_object('id',e.id,'token',e.token,'sourceKey',account.source_key);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.prospecting_sequence_effect_finish(p_effect uuid,p_token uuid,p_provider text,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND status IN('sending','uncertain') FOR UPDATE;
 IF e.id IS NULL THEN RETURN false;END IF;
 IF p_provider IS NULL AND p_error IS NULL THEN RAISE EXCEPTION 'Resultado ausente.';END IF;
 UPDATE public.prospecting_sequence_effects SET status=CASE WHEN p_provider IS NOT NULL THEN 'succeeded' ELSE 'uncertain' END,provider_id=left(p_provider,512),error_code=left(p_error,100),finished_at=now() WHERE id=e.id;
 -- A manual pause/cancel stops the cursor, but must not discard a provider receipt.
 UPDATE public.prospecting_sequence_runs SET cursor=cursor+CASE WHEN p_provider IS NOT NULL THEN 1 ELSE 0 END,
 state=CASE WHEN p_provider IS NULL THEN 'uncertain' ELSE state END,reason=CASE WHEN p_provider IS NULL THEN 'provider_result_unknown' ELSE 'effect_succeeded' END,
 previous_at=CASE WHEN p_provider IS NOT NULL THEN now() ELSE previous_at END,next_run_at=now(),lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE id=e.run_id AND state='active' AND cursor=(SELECT ordinality-1 FROM public.prospecting_sequence_versions v CROSS JOIN LATERAL jsonb_array_elements(v.definition->'steps') WITH ORDINALITY s WHERE v.id=prospecting_sequence_runs.version_id AND s.value->>'id'=e.step_id::text);
 INSERT INTO public.prospecting_sequence_run_events(workspace_id,run_id,kind,reason) VALUES(e.workspace_id,e.run_id,CASE WHEN p_provider IS NULL THEN 'uncertain' ELSE 'effect_succeeded' END,e.kind);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_effect_finish(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_effect_finish(uuid,uuid,text,text) TO service_role;

CREATE FUNCTION public.prospecting_sequence_task_effect(p_effect uuid,p_token uuid,p_lease uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;c jsonb;r public.prospecting_sequence_runs;step jsonb;target uuid;activity uuid;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND status='sending' AND kind IN('call','task') FOR UPDATE;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 c:=public.prospecting_sequence_context(e.run_id,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 step:=c->'definition'->'steps'->r.cursor;target:=(step->>'assigneeId')::uuid;
 IF step->>'id' IS DISTINCT FROM e.step_id::text OR (step->>'type'='call' AND step->>'mode'<>'human') OR NOT public.sales_context_access(public.work_subject_context(r.workspace_id,r.owner_id),r.workspace_id,'techsales.activities','create',ARRAY[r.owner_id])
 OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=r.workspace_id AND user_id=target AND status='active') THEN RAISE EXCEPTION 'Tarefa sem autorização atual.' USING ERRCODE='42501';END IF;
 IF target<>r.owner_id AND NOT public.sales_context_access(public.work_subject_context(r.workspace_id,r.owner_id),r.workspace_id,'techsales.activities','assign',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Sem permissão para atribuir a outra pessoa.' USING ERRCODE='42501';END IF;
 INSERT INTO public.activities(id,workspace_id,owner_id,assigned_to,type,subject,body,due_date,related_contact_id,related_lead_id,external_ids)
 VALUES(e.id,r.workspace_id,r.owner_id,target,CASE WHEN e.kind='call' THEN 'call'::public.activity_type ELSE 'task'::public.activity_type END,left(step->>'title',255),step->>'notes',now()+make_interval(days=>coalesce((step->>'dueDays')::integer,0)),
 CASE WHEN c->'person'->>'entity'='contact' THEN (c->'person'->>'id')::uuid END,CASE WHEN c->'person'->>'entity'='lead' THEN (c->'person'->>'id')::uuid END,jsonb_build_object('prospecting_sequence_effect',e.id)) RETURNING id INTO activity;
 IF NOT public.prospecting_sequence_effect_finish(e.id,e.token,activity::text,NULL) THEN RAISE EXCEPTION 'Resultado da tarefa não gravado.';END IF;
 RETURN activity;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_task_effect(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_task_effect(uuid,uuid,uuid) TO service_role;
