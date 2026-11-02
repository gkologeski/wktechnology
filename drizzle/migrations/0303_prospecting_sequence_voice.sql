-- Automatic calls reuse the existing Vapi workspace configuration. No default grants.
CREATE TABLE public.prospecting_sequence_voice_events (
 effect_id uuid PRIMARY KEY REFERENCES public.prospecting_sequence_effects(id) ON DELETE CASCADE,
 workspace_id uuid NOT NULL,call_id text NOT NULL UNIQUE,terminal boolean NOT NULL DEFAULT false,
 terminal_at timestamptz,
 outcome text CHECK(outcome IN ('answered','no_answer','failed')),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prospecting_sequence_voice_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prospecting_sequence_voice_events FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.prospecting_sequence_voice_events TO service_role;

CREATE FUNCTION public.prospecting_sequence_voice_access(p_run uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;step jsonb;ctx jsonb;s public.prospecting_scripts;cfg public.voice_agent_settings;BEGIN
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run;
 step:=c->'definition'->'steps'->r.cursor;ctx:=public.work_subject_context(r.workspace_id,r.owner_id);
 IF coalesce((c#>>'{signals,optedOut}')::boolean,false) OR nullif(c#>>'{signals,commercialBlock}','') IS NOT NULL OR coalesce((c#>>'{definition,settings,stopOnReply}')::boolean,true) AND coalesce((c#>>'{signals,replied}')::boolean,false) OR coalesce((c#>>'{definition,settings,stopOnMeeting}')::boolean,true) AND coalesce((c#>>'{signals,meetingBooked}')::boolean,false) THEN RAISE EXCEPTION 'Contato bloqueado para chamada.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.prospecting_scripts WHERE id=(step->>'scriptId')::uuid AND workspace_id=r.workspace_id AND archived_at IS NULL;
 SELECT * INTO cfg FROM public.voice_agent_settings WHERE workspace_id=r.workspace_id;
 IF step->>'type'<>'call' OR step->>'mode'<>'automatic' OR coalesce((step->>'attempts')::integer,0)<>1 OR s.id IS NULL OR cfg.vapi_phone_number_id IS NULL
 OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.prospecting_voice','create',ARRAY[r.owner_id])
 OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.prospecting_voice','view',ARRAY[cfg.owner_id])
 OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.prospecting_scripts','view',ARRAY[coalesce(s.assigned_to,s.owner_id)])
 OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.activities','create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Telefonia sem configuração ou autorização atual.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('sourceKey',cfg.vapi_phone_number_id,'script',jsonb_build_object('id',s.id,'name',s.name,'firstMessage',s.first_message,'prompt',s.system_prompt,'voiceId',coalesce(s.voice_id,cfg.default_voice_id),'voiceProvider',coalesce(s.voice_provider,cfg.default_voice_provider)),
 'model',cfg.llm_model,'maxDurationSeconds',cfg.max_duration_seconds,'language',cfg.language);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_voice_access(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_voice_access(uuid,uuid) TO service_role;

CREATE FUNCTION public.prospecting_sequence_voice_project(p_effect uuid,p_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;step jsonb;ctx jsonb;ev public.prospecting_sequence_voice_events;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token FOR UPDATE;
 SELECT value INTO step FROM public.prospecting_sequence_versions v CROSS JOIN LATERAL jsonb_array_elements(v.definition->'steps') WHERE v.id=r.version_id AND value->>'id'=e.step_id::text;
 IF e.kind<>'call' OR step->>'mode'<>'automatic' OR e.status<>'succeeded' OR e.provider_receipt->>'provider' IS DISTINCT FROM 'vapi' OR nullif(e.provider_id,'') IS NULL THEN RAISE EXCEPTION 'Recibo de chamada indisponível.' USING ERRCODE='42501';END IF;
 IF e.projection_state='complete' THEN RETURN e.id;END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);
 IF NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'manage') OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.activities','create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Atividade sem autorização atual.' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id AND workspace_id=r.workspace_id;
 IF NOT(techerp_api.sequence_audience_source(r.workspace_id,r.owner_id,jsonb_build_array(jsonb_build_object('entity',p.entity,'id',p.source_id))) ? (p.entity||':'||p.source_id::text)) THEN RAISE EXCEPTION 'Destinatário indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO ev FROM public.prospecting_sequence_voice_events WHERE effect_id=e.id AND workspace_id=r.workspace_id AND call_id=e.provider_id;
 INSERT INTO public.activities(id,workspace_id,owner_id,assigned_to,type,subject,body,related_contact_id,related_lead_id,completed,outcome,outcome_set_at,external_ids)
 VALUES(e.id,r.workspace_id,r.owner_id,r.owner_id,'call',left(step->>'title',255),coalesce(step->>'notes',''),CASE WHEN p.entity='contact' THEN p.source_id END,CASE WHEN p.entity='lead' THEN p.source_id END,coalesce(ev.terminal,false),ev.outcome,ev.terminal_at,jsonb_build_object('prospecting_sequence_effect',e.id,'vapi_call_id',e.provider_id)) ON CONFLICT(id) DO NOTHING;
 UPDATE public.prospecting_sequence_effects SET projection_state='complete' WHERE id=e.id;
 UPDATE public.prospecting_sequence_runs SET state='waiting_task',reason='waiting_for_call',task_completed_at=CASE WHEN ev.terminal THEN now() END,updated_at=now() WHERE id=r.id AND state='paused' AND reason='receipt_projection_pending';
 -- A late verified receipt may resolve an uncertain call, but never a manual pause/cancel.
 UPDATE public.prospecting_sequence_runs SET state='waiting_task',reason='waiting_for_call',cursor=cursor+1,step_entered_at=now(),task_completed_at=CASE WHEN ev.terminal THEN now() END,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=r.id AND state='uncertain' AND (SELECT definition->'steps'->r.cursor->>'id' FROM public.prospecting_sequence_versions WHERE id=r.version_id)=e.step_id::text;
 RETURN e.id;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_voice_project(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_voice_project(uuid,uuid) TO service_role;

CREATE FUNCTION public.prospecting_sequence_voice_event(p_effect uuid,p_call text,p_phone_id text,p_number text,p_terminal boolean,p_outcome text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;r public.prospecting_sequence_runs;step jsonb;ev public.prospecting_sequence_voice_events;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect;
 IF e.id IS NULL THEN RETURN false;END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect FOR UPDATE;
 SELECT value INTO step FROM public.prospecting_sequence_versions v CROSS JOIN LATERAL jsonb_array_elements(v.definition->'steps') WHERE v.id=r.version_id AND value->>'id'=e.step_id::text;
 IF e.kind<>'call' OR step->>'mode'<>'automatic' OR e.status NOT IN('sending','uncertain','succeeded') OR p_phone_id IS DISTINCT FROM e.sender->>'sourceKey' OR p_number IS DISTINCT FROM e.target->'canonical_phones'->>0 OR nullif(p_call,'') IS NULL OR length(p_call)>512 OR (e.provider_id IS NOT NULL AND e.provider_id<>p_call) OR (p_terminal AND (p_outcome IS NULL OR p_outcome NOT IN('answered','no_answer','failed'))) THEN RAISE EXCEPTION 'Retorno de chamada incompatível.' USING ERRCODE='42501';END IF;
 INSERT INTO public.prospecting_sequence_voice_events(effect_id,workspace_id,call_id,terminal,outcome,terminal_at) VALUES(e.id,r.workspace_id,p_call,p_terminal,CASE WHEN p_terminal THEN p_outcome END,CASE WHEN p_terminal THEN now() END)
 ON CONFLICT(effect_id) DO UPDATE SET terminal_at=coalesce(prospecting_sequence_voice_events.terminal_at,excluded.terminal_at),terminal=prospecting_sequence_voice_events.terminal OR excluded.terminal,outcome=CASE WHEN prospecting_sequence_voice_events.terminal THEN prospecting_sequence_voice_events.outcome ELSE excluded.outcome END,updated_at=now() WHERE prospecting_sequence_voice_events.call_id=excluded.call_id;
 IF e.provider_receipt IS NULL THEN PERFORM public.prospecting_sequence_receipt_store(e.id,e.token,jsonb_build_object('provider','vapi','messageId',p_call,'to',p_number,'from',p_phone_id));END IF;
 -- Receipt/event facts are durable even when current permission prevents projection.
 BEGIN PERFORM public.prospecting_sequence_voice_project(e.id,e.token);EXCEPTION WHEN OTHERS THEN NULL;END;
 SELECT * INTO ev FROM public.prospecting_sequence_voice_events WHERE effect_id=e.id;
 IF ev.terminal THEN
  UPDATE public.activities SET completed=true,outcome=ev.outcome,outcome_set_at=ev.terminal_at,updated_at=now() WHERE id=e.id AND workspace_id=r.workspace_id AND external_ids->>'prospecting_sequence_effect'=e.id::text;
  UPDATE public.prospecting_sequence_runs SET task_completed_at=ev.terminal_at WHERE id=r.id AND state IN('waiting_task','paused') AND (SELECT definition->'steps'->(cursor-1)->>'id' FROM public.prospecting_sequence_versions WHERE id=r.version_id)=e.step_id::text;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_voice_event(uuid,text,text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_voice_event(uuid,text,text,text,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_effect_begin(p_run uuid,p_lease uuid,p_step uuid,p_prepared jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;step jsonb;ctx jsonb;account public.service_channel_accounts;kind text;last_at timestamptz;oldest_at timestamptz;used integer;min_seconds integer;max_daily integer;BEGIN
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run FOR UPDATE;
 IF r.state<>'active' OR r.lease_token IS DISTINCT FROM p_lease OR r.lease_until<=now() THEN RAISE EXCEPTION 'Lease inválido.' USING ERRCODE='40001';END IF;
 step:=c->'definition'->'steps'->r.cursor;kind:=step->>'type';
 IF nullif(c#>>'{signals,commercialBlock}','') IS NOT NULL THEN RETURN jsonb_build_object('blockReason',c#>>'{signals,commercialBlock}');END IF;
 IF step->>'id' IS DISTINCT FROM p_step::text OR kind NOT IN('email','whatsapp','call','task') OR (c->'signals'->>'optedOut')::boolean THEN RAISE EXCEPTION 'Etapa bloqueada.' USING ERRCODE='42501';END IF;
 IF coalesce((c->'definition'->'settings'->>'stopOnReply')::boolean,true) AND (c->'signals'->>'replied')::boolean OR coalesce((c->'definition'->'settings'->>'stopOnMeeting')::boolean,true) AND (c->'signals'->>'meetingBooked')::boolean THEN RAISE EXCEPTION 'Contato já respondeu ou agendou.' USING ERRCODE='42501';END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);
 IF kind IN('email','whatsapp') THEN
  IF NOT (ctx->'keys' ? 'system.channels.view.workspace') OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'view',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Canal sem acesso atual.' USING ERRCODE='42501';END IF;
  IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Sem permissão de envio.' USING ERRCODE='42501';END IF;
  SELECT * INTO account FROM public.service_channel_accounts WHERE id=(step->>'accountId')::uuid AND workspace_id=r.workspace_id AND channel=kind AND enabled;
  IF account.id IS NULL THEN RAISE EXCEPTION 'Conta desativada.' USING ERRCODE='42501';END IF;
  IF kind='email' AND NOT EXISTS(SELECT 1 FROM public.email_accounts a WHERE a.id::text=account.source_key AND a.workspace_id=r.workspace_id AND a.owner_id=r.owner_id AND a.status='connected' AND a.provider='gmail') THEN RAISE EXCEPTION 'Conta de e-mail indisponível.' USING ERRCODE='42501';END IF;
  IF kind='whatsapp' AND EXISTS(SELECT 1 FROM public.whatsapp_conversations cv WHERE cv.workspace_id=r.workspace_id AND cv.wa_phone_number_id=account.source_key AND cv.contact_phone IN(SELECT ph FROM jsonb_array_elements_text(c->'source'->'phones') ph) AND NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','view',ARRAY[coalesce(cv.assigned_to,cv.owner_id)])) THEN RAISE EXCEPTION 'Conversa sem acesso atual.' USING ERRCODE='42501';END IF;
 ELSIF kind='call' AND step->>'mode'='automatic' THEN
  account.source_key:=public.prospecting_sequence_voice_access(r.id,p_lease)->>'sourceKey';account.id:=account.source_key::uuid;
 ELSE
  IF NOT public.sales_context_access(ctx,r.workspace_id,CASE WHEN kind='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END,'create',ARRAY[r.owner_id]) OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=r.workspace_id AND user_id=(step->>'assigneeId')::uuid AND status='active') THEN RAISE EXCEPTION 'Tarefa sem autorização atual.' USING ERRCODE='42501';END IF;
 END IF;
 IF (kind='task' OR kind='call' AND step->>'mode'='human') AND (step->>'assigneeId')::uuid IS DISTINCT FROM r.owner_id AND NOT public.sales_context_access(ctx,r.workspace_id,CASE WHEN kind='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END,'assign',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Sem permissão para atribuir a outra pessoa.' USING ERRCODE='42501';END IF;
 IF kind IN('email','whatsapp') OR kind='call' AND step->>'mode'='automatic' THEN
  IF cardinality(public.prospecting_sequence_unknown_keys(r.workspace_id,(SELECT identity_keys FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id)))>0 THEN RETURN jsonb_build_object('blockReason','delivery_uncertain');END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(r.workspace_id::text||':'||account.id::text,297));
  min_seconds:=greatest(1,least(coalesce((c->'definition'->'settings'->>'minimumIntervalSeconds')::integer,60),3600));
  max_daily:=greatest(1,least(coalesce((c->'definition'->'settings'->>'dailyLimit')::integer,100),1000));
  SELECT max(b.created_at),min(b.created_at),count(*) INTO last_at,oldest_at,used FROM public.prospecting_sequence_effects b WHERE b.workspace_id=r.workspace_id AND b.account_id=account.id AND b.kind IN('email','whatsapp','call') AND b.created_at>now()-interval '24 hours' AND b.status IN('sending','succeeded','uncertain');
  IF used>=max_daily THEN RETURN jsonb_build_object('deferUntil',oldest_at+interval '24 hours','reason','daily_account_limit');END IF;
  IF last_at IS NOT NULL AND last_at+make_interval(secs=>min_seconds)>now() THEN RETURN jsonb_build_object('deferUntil',last_at+make_interval(secs=>min_seconds),'reason','account_pacing');END IF;
 END IF;
 INSERT INTO public.prospecting_sequence_effects(workspace_id,run_id,step_id,kind,status,target,account_id,sender) VALUES(r.workspace_id,r.id,p_step,kind,'sending',(c->'source')||CASE WHEN p_prepared->'source' IS NOT DISTINCT FROM c->'source' THEN jsonb_build_object('canonical_email',p_prepared->'email','canonical_phones',p_prepared->'phones','canonical_whatsapp',p_prepared->'whatsapp') ELSE '{}'::jsonb END,account.id,jsonb_build_object('sourceKey',account.source_key)) ON CONFLICT(run_id,step_id) DO UPDATE SET status='sending',token=gen_random_uuid(),target=excluded.target,account_id=excluded.account_id,sender=excluded.sender,created_at=now(),finished_at=NULL,error_code=NULL WHERE prospecting_sequence_effects.status='failed' AND prospecting_sequence_effects.provider_id IS NULL AND prospecting_sequence_effects.provider_receipt IS NULL RETURNING * INTO e;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Efeito já reservado; concilie o resultado antes de tentar novamente.' USING ERRCODE='40001';END IF;
 RETURN jsonb_build_object('id',e.id,'token',e.token,'sourceKey',account.source_key,'source',c->'source');
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_receipt_store(p_effect uuid,p_token uuid,p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;provider text;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND kind IN('email','whatsapp','call') FOR UPDATE;
 provider:=nullif(p_payload->>'messageId','');
 IF e.id IS NULL OR provider IS NULL OR length(provider)>512 OR pg_column_size(p_payload)>64000 THEN RAISE EXCEPTION 'Recibo inválido.' USING ERRCODE='42501';END IF;
 IF e.provider_receipt IS NOT NULL THEN
  IF e.provider_receipt IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Recibo já registrado com outro conteúdo.' USING ERRCODE='40001';END IF;
  RETURN true;
 END IF;
 IF e.status NOT IN('sending','uncertain') THEN RAISE EXCEPTION 'Reserva sem envio pendente.' USING ERRCODE='42501';END IF;
 UPDATE public.prospecting_sequence_effects SET provider_receipt=p_payload,projection_state='pending' WHERE id=e.id;
 IF NOT public.prospecting_sequence_effect_finish(e.id,e.token,provider,NULL) THEN RAISE EXCEPTION 'Recibo não registrado.';END IF;
 UPDATE public.prospecting_sequence_runs SET state='paused',reason='receipt_projection_pending',updated_at=now() WHERE id=e.run_id AND state='active';
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_receipt_store(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_receipt_store(uuid,uuid,jsonb) TO service_role;

ALTER FUNCTION public.prospecting_sequence_delivery_commit(uuid,uuid,jsonb) RENAME TO prospecting_sequence_message_commit_0302;
CREATE FUNCTION public.prospecting_sequence_delivery_commit(p_effect uuid,p_token uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND kind='call') THEN RETURN public.prospecting_sequence_voice_project(p_effect,p_token);END IF;
 RETURN public.prospecting_sequence_message_commit_0302(p_effect,p_token,p_payload);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_delivery_commit(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_delivery_commit(uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_complete_call(p_workspace uuid,p_run uuid,p_outcome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;a public.activities;ctx jsonb;BEGIN
 ctx:=public.sales_access_context();
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND workspace_id=p_workspace;
 IF r.id IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((ctx->>'read_only')::boolean,false) OR p_outcome IS NULL OR p_outcome NOT IN('answered','no_answer')
 OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),r.owner_id,'manage') THEN RAISE EXCEPTION 'Resultado sem autorização atual.' USING ERRCODE='42501';END IF;
 SELECT ee.* INTO e FROM public.prospecting_sequence_effects ee JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE ee.run_id=r.id AND ee.kind='call' AND ee.status='succeeded' AND ee.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id';
 SELECT * INTO a FROM public.activities WHERE id=e.id AND workspace_id=p_workspace AND deleted_at IS NULL FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.prospecting_sequence_versions v CROSS JOIN LATERAL jsonb_array_elements(v.definition->'steps') st WHERE v.id=r.version_id AND st->>'id'=e.step_id::text AND st->>'mode'='automatic') THEN RAISE EXCEPTION 'Aguarde o retorno da telefonia.' USING ERRCODE='42501';END IF;
 IF a.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_cohort_people p WHERE p.id=r.cohort_person_id AND CASE p.entity WHEN 'contact' THEN a.related_contact_id=p.source_id ELSE a.related_lead_id=p.source_id END) OR NOT public.sales_context_access(ctx,p_workspace,'techsales.activities','view',ARRAY[coalesce(a.assigned_to,a.owner_id)]) OR NOT public.sales_context_access(ctx,p_workspace,'techsales.activities','update',ARRAY[coalesce(a.assigned_to,a.owner_id)]) THEN RAISE EXCEPTION 'Atividade sem autorização atual.' USING ERRCODE='42501';END IF;
 UPDATE public.activities SET completed=true,outcome=p_outcome,outcome_set_at=now() WHERE id=a.id;
 RETURN a.id;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_complete_call(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_complete_call(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_claim(p_limit integer DEFAULT 20)
RETURNS SETOF public.prospecting_sequence_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 FOR r IN SELECT * FROM public.prospecting_sequence_runs WHERE state='active' AND next_run_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_run_at,id FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,20),100)) LOOP
  -- A process may have died after the provider accepted. Never retry that effect blindly.
  IF EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e WHERE e.run_id=r.id AND e.status IN('sending','uncertain')) THEN
   UPDATE public.prospecting_sequence_runs SET state='uncertain',reason='provider_result_unknown',updated_at=now() WHERE id=r.id;
   -- Keep effect rows unlocked: a late receipt must be able to commit without a run/effect lock inversion.
   CONTINUE;
  END IF;
  -- A receipt can arrive while paused. Resume advances the confirmed step without resending it.
  IF EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.status='succeeded' AND e.step_id::text=v.definition->'steps'->r.cursor->>'id') THEN
   UPDATE public.prospecting_sequence_runs SET cursor=cursor+1,step_entered_at=(SELECT max(finished_at) FROM public.prospecting_sequence_effects WHERE run_id=r.id AND status='succeeded'),previous_at=(SELECT max(finished_at) FROM public.prospecting_sequence_effects WHERE run_id=r.id AND status='succeeded'),updated_at=now() WHERE id=r.id RETURNING * INTO r;
  END IF;
  IF NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'assign') THEN
   UPDATE public.prospecting_sequence_runs SET state='blocked',reason='permission_revoked',updated_at=now() WHERE id=r.id;CONTINUE;
  END IF;
  IF EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.kind IN('call','task') AND e.status='succeeded' AND e.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id' AND (NOT a.completed OR e.provider_receipt->>'provider'='vapi' AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_voice_events ve WHERE ve.effect_id=e.id AND ve.terminal AND ve.call_id=e.provider_id))) THEN
   UPDATE public.prospecting_sequence_runs SET state='waiting_task',reason='waiting_for_activity',updated_at=now() WHERE id=r.id;CONTINUE;
  END IF;
  UPDATE public.prospecting_sequence_runs SET lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=r.id RETURNING * INTO r;
  RETURN NEXT r;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_claim(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_claim(integer) TO service_role;

-- Read-only reconciliation of already-accepted calls; never queues another call.
CREATE FUNCTION public.prospecting_sequence_voice_pending()
RETURNS TABLE(effect_id uuid,call_id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item record;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 FOR item IN SELECT e.id,e.workspace_id,e.provider_id FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id AND a.workspace_id=e.workspace_id LEFT JOIN public.prospecting_sequence_voice_events v ON v.effect_id=e.id
 WHERE e.kind='call' AND e.status='succeeded' AND e.provider_receipt->>'provider'='vapi' AND e.projection_state='complete' AND NOT a.completed AND e.finished_at<now()-interval '2 minutes' AND (v.updated_at IS NULL OR v.updated_at<now()-interval '2 minutes') ORDER BY coalesce(v.updated_at,e.finished_at),e.id LIMIT 2 FOR UPDATE OF e SKIP LOCKED LOOP
  INSERT INTO public.prospecting_sequence_voice_events(effect_id,workspace_id,call_id) VALUES(item.id,item.workspace_id,item.provider_id) ON CONFLICT ON CONSTRAINT prospecting_sequence_voice_events_pkey DO UPDATE SET updated_at=now();
  effect_id:=item.id;call_id:=item.provider_id;RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_voice_pending() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_voice_pending() TO service_role;

-- Explicit operator transitions revoke the previous lease; late receipts retain effect nonces.
CREATE OR REPLACE FUNCTION public.prospecting_sequence_control(p_workspace uuid,p_run uuid,p_action text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;ctx jsonb;new_state text;BEGIN
 ctx:=public.sales_access_context();
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND workspace_id=p_workspace FOR UPDATE;
 IF r.id IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((ctx->>'read_only')::boolean,false) OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),r.owner_id,'manage') THEN RAISE EXCEPTION 'Execução indisponível.' USING ERRCODE='42501';END IF;
 IF p_action IN('resume','retry','reconcile') AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_versions v WHERE v.id=r.version_id AND public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),v.owner_id,'manage') AND public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),v.owner_id,'assign')) THEN RAISE EXCEPTION 'Versão sem autorização atual.' USING ERRCODE='42501';END IF;
 IF p_action='pause' AND r.state IN('active','waiting_task') THEN new_state:='paused';
 ELSIF p_action='resume' AND r.state='paused' AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_effects WHERE run_id=r.id AND projection_state='pending') THEN
  IF EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.kind IN('call','task') AND e.status='succeeded' AND e.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id' AND NOT a.completed) THEN new_state:='waiting_task';ELSE new_state:='active';END IF;
 ELSIF p_action='retry' AND r.state='blocked' AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e WHERE e.run_id=r.id AND (e.status IN('sending','uncertain') OR e.projection_state='pending')) THEN new_state:='active';
 ELSIF p_action='reconcile' AND r.state='uncertain' AND EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.step_id::text=v.definition->'steps'->r.cursor->>'id' AND e.status='succeeded' AND e.projection_state IN('none','complete')) THEN new_state:='paused';
 ELSIF p_action='cancel' AND r.state IN('active','waiting_task','paused','blocked','human','agent','uncertain') THEN new_state:='cancelled';
 ELSE RAISE EXCEPTION 'Transição de execução não permitida.' USING ERRCODE='22023';END IF;
 UPDATE public.prospecting_sequence_runs SET lease_token=NULL,lease_until=NULL,state=new_state,reason='manual_'||p_action,step_entered_at=CASE WHEN p_action='resume' THEN coalesce((SELECT coalesce(a.outcome_set_at,a.updated_at,now()) FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.kind IN('call','task') AND e.status='succeeded' AND a.completed AND e.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id'),step_entered_at) ELSE step_entered_at END,previous_at=CASE WHEN p_action='resume' THEN coalesce((SELECT coalesce(a.outcome_set_at,a.updated_at,now()) FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.kind IN('call','task') AND e.status='succeeded' AND a.completed AND e.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id'),previous_at) ELSE previous_at END,updated_at=now() WHERE id=r.id;
 INSERT INTO public.prospecting_sequence_run_events(workspace_id,run_id,kind,reason) VALUES(p_workspace,r.id,new_state,'manual_'||p_action);
 RETURN new_state;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_control(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_control(uuid,uuid,text) TO authenticated;

-- Editing a timeline task cannot forge a terminal provider fact.
CREATE OR REPLACE FUNCTION public.prospecting_sequence_wake_tasks(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;n integer:=0;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 FOR r IN SELECT rr.* FROM public.prospecting_sequence_runs rr WHERE rr.state='waiting_task' AND rr.task_completed_at IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id AND a.workspace_id=rr.workspace_id
  WHERE e.run_id=rr.id AND e.kind IN('call','task') AND e.status='succeeded' AND a.completed AND (e.provider_receipt->>'provider' IS DISTINCT FROM 'vapi' OR EXISTS(SELECT 1 FROM public.prospecting_sequence_voice_events ve WHERE ve.effect_id=e.id AND ve.call_id=e.provider_id AND ve.terminal))
  AND e.step_id::text=(SELECT definition->'steps'->(rr.cursor-1)->>'id' FROM public.prospecting_sequence_versions WHERE id=rr.version_id))
  ORDER BY rr.task_completed_at,rr.id FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,100),500)) LOOP
  IF NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'assign') THEN
   UPDATE public.prospecting_sequence_runs SET state='blocked',reason='permission_revoked',updated_at=now() WHERE id=r.id;
  ELSE
   UPDATE public.prospecting_sequence_runs SET state='active',reason='task_completed',next_run_at=now(),step_entered_at=r.task_completed_at,previous_at=(SELECT coalesce(a.outcome_set_at,a.updated_at,now()) FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.status='succeeded' AND e.kind IN('call','task') AND e.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id'),updated_at=now() WHERE id=r.id;
   INSERT INTO public.prospecting_sequence_run_events(workspace_id,run_id,kind,reason) VALUES(r.workspace_id,r.id,'active','task_completed');n:=n+1;
  END IF;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_wake_tasks(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_wake_tasks(integer) TO service_role;
