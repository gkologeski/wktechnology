-- Personal LinkedIn sequences use the same immutable versions, leases and receipt projection.
ALTER TABLE public.prospecting_sequence_effects DROP CONSTRAINT prospecting_sequence_effects_kind_check;
ALTER TABLE public.prospecting_sequence_effects ADD CONSTRAINT prospecting_sequence_effects_kind_check CHECK(kind IN('email','whatsapp','linkedin','call','task','agent','human'));


SET ROLE techerp_api_subject;

CREATE OR REPLACE FUNCTION techerp_api.sequence_audience_source(p_workspace uuid,p_actor uuid,p_candidates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;BEGIN
 IF current_setting('app.api_subject',true)='on' THEN RAISE EXCEPTION 'Nested audience context forbidden' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) VALUES(txid_current(),p_actor,p_workspace,gen_random_uuid(),current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('app.api_subject','on',true);
 SELECT coalesce(jsonb_object_agg(a.entity||':'||a.id,jsonb_build_object('email',a.email,'phones',jsonb_build_array(a.whatsapp_e164,a.mobile_phone,a.phone),'first_name',a.first_name,'last_name',a.last_name,'company_name',a.company_name,'linkedin_url',a.linkedin_url)),'{}') INTO result FROM(
  SELECT 'contact' entity,c.first_name,c.last_name,c.company_name,c.id,c.email,c.phone,c.mobile_phone,c.whatsapp_e164,c.linkedin_url FROM public.shared_fields_contacts c WHERE c.workspace_id=p_workspace AND c.deleted_at IS NULL AND c.id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_candidates) x WHERE x->>'entity'='contact')
  UNION ALL SELECT 'lead',l.first_name,l.last_name,l.company_name,l.id,l.email,l.phone,l.mobile_phone,l.whatsapp_e164,l.linkedin_url FROM public.shared_fields_leads l WHERE l.workspace_id=p_workspace AND l.deleted_at IS NULL AND l.id IN(SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_candidates) x WHERE x->>'entity'='lead')) a;
 PERFORM techerp_api.leave();RETURN result;
END $$;

RESET ROLE;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_draft_save(p_id uuid,p_workspace uuid,p_expected_revision integer,p_name text,p_definition jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.sales_access_context(); actor uuid:=nullif(c->>'actor','')::uuid; d public.prospecting_sequence_drafts; exists_row boolean; act text; x jsonb; g jsonb; f jsonb; col text;
BEGIN
 IF actor IS NULL OR c->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((c->>'read_only')::boolean,true) THEN RAISE EXCEPTION 'Workspace indisponível.' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 OR p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 120 OR p_definition IS NULL OR jsonb_typeof(p_definition)<>'object' OR octet_length(p_definition::text)>65536 THEN RAISE EXCEPTION 'Rascunho inválido.' USING ERRCODE='22023';END IF;
 IF p_definition->>'schemaVersion' IS DISTINCT FROM '1' OR p_definition#>>'{audience,base}' IS NULL OR p_definition#>>'{audience,base}' NOT IN('leads','contacts') OR jsonb_typeof(p_definition#>'{audience,groups}') IS DISTINCT FROM 'array' OR jsonb_typeof(p_definition->'steps') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Definição inválida.' USING ERRCODE='22023';END IF;
 IF jsonb_array_length(p_definition->'steps') NOT BETWEEN 1 AND 50 OR jsonb_array_length(p_definition#>'{audience,groups}')>10 THEN RAISE EXCEPTION 'Limite de etapas ou grupos excedido.' USING ERRCODE='22023';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_definition->'steps') LOOP
  IF x->>'type' IS NULL OR x->>'type' NOT IN('email','whatsapp','linkedin','wait','call','condition','task','agent','end') OR nullif(x->>'id','') IS NULL OR length(coalesce(x->>'title','')) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Etapa inválida.' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR g IN SELECT value FROM jsonb_array_elements(p_definition#>'{audience,groups}') LOOP
  IF jsonb_typeof(g->'filters') IS DISTINCT FROM 'array' OR jsonb_array_length(g->'filters')>20 THEN RAISE EXCEPTION 'Grupo inválido.' USING ERRCODE='22023';END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(g->'filters') LOOP
   col:=coalesce(f->>'column','');
   IF f->>'entity' IS NULL OR f->>'entity' NOT IN('leads','contacts','companies','deals') OR col='' OR col~*'(token|secret|password|hash)' OR col~'^(id|owner_id|workspace_id|deleted_at|portal_token|hs_raw|external_ids|custom_fields|import_batch_id|sync_state_id)$' OR col~'(_digits$|^(hs_|hubspot_))' THEN RAISE EXCEPTION 'Campo não permitido.' USING ERRCODE='22023'; END IF;
  END LOOP;
 END LOOP;
 -- Serialize same-id create/retry and updates without trusting a caller-supplied owner.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,292));
 SELECT * INTO d FROM public.prospecting_sequence_drafts WHERE id=p_id FOR UPDATE;exists_row:=FOUND;
 IF exists_row AND d.workspace_id<>p_workspace THEN RAISE EXCEPTION 'Rascunho indisponível.' USING ERRCODE='42501'; END IF;
 act:=CASE WHEN exists_row THEN 'update' ELSE 'create' END;
 IF NOT public.sales_context_access(c,p_workspace,'system.automation.sequences','view',ARRAY[CASE WHEN exists_row THEN d.owner_id ELSE actor END]) OR NOT public.sales_context_access(c,p_workspace,'system.automation.sequences',act,ARRAY[CASE WHEN exists_row THEN d.owner_id ELSE actor END]) THEN RAISE EXCEPTION 'Sem permissão para salvar rascunhos.' USING ERRCODE='42501';END IF;
 IF exists_row THEN
  IF d.revision<>p_expected_revision THEN RAISE EXCEPTION 'Rascunho alterado em outra sessão. Recarregue antes de salvar.' USING ERRCODE='40001'; END IF;
  UPDATE public.prospecting_sequence_drafts SET name=btrim(p_name),definition=p_definition,revision=revision+1,updated_at=now(),updated_by=actor WHERE id=p_id RETURNING * INTO d;
 ELSE
  IF p_expected_revision<>0 THEN RAISE EXCEPTION 'Rascunho indisponível.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.prospecting_sequence_drafts(id,workspace_id,owner_id,name,revision,definition,updated_by) VALUES(p_id,p_workspace,actor,btrim(p_name),1,p_definition,actor) RETURNING * INTO d;
 END IF;
 INSERT INTO public.prospecting_sequence_draft_revisions(draft_id,workspace_id,revision,name,definition,author_id) VALUES(d.id,d.workspace_id,d.revision,d.name,d.definition,actor);
 RETURN to_jsonb(d)||jsonb_build_object('can_edit',public.sales_context_access(c,d.workspace_id,'system.automation.sequences','update',ARRAY[d.owner_id]));
END $$;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_context(p_run uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;v public.prospecting_sequence_versions;
 sources jsonb;s jsonb;signals jsonb;email_reply boolean;wa_reply boolean;last_kind text;call_result text;previous_contact uuid;reply_info jsonb;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND state='active' AND lease_token=p_lease AND lease_until>now();
 IF r.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,r.owner_id,'assign') THEN RAISE EXCEPTION 'Execução sem autorização atual.' USING ERRCODE='42501';END IF;
 IF (SELECT definition->'steps'->r.cursor->>'type' FROM public.prospecting_sequence_versions WHERE id=r.version_id) IN('email','whatsapp','linkedin') THEN
  IF NOT public.sales_context_access(public.work_subject_context(r.workspace_id,r.owner_id),r.workspace_id,'techsales.inbox.'||(SELECT definition->'steps'->r.cursor->>'type' FROM public.prospecting_sequence_versions WHERE id=r.version_id),'create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Envio sem autorização atual.' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO p FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id AND workspace_id=r.workspace_id;
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=r.version_id AND workspace_id=r.workspace_id;
 IF p.id IS NULL OR v.id IS NULL OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'manage') OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'assign') THEN RAISE EXCEPTION 'Origem indisponível.' USING ERRCODE='42501';END IF;
 sources:=techerp_api.sequence_audience_source(r.workspace_id,r.owner_id,jsonb_build_array(jsonb_build_object('entity',p.entity,'id',p.source_id)));
 s:=sources->(p.entity||':'||p.source_id::text);
 IF s IS NULL THEN RAISE EXCEPTION 'Destinatário sem acesso atual.' USING ERRCODE='42501';END IF;
 SELECT a.outcome INTO call_result FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id WHERE e.run_id=r.id AND e.kind='call' AND e.status='succeeded' AND a.workspace_id=r.workspace_id AND a.completed ORDER BY e.created_at DESC,e.id DESC LIMIT 1;
 SELECT (x.value->>'id')::uuid INTO previous_contact FROM jsonb_array_elements(v.definition->'steps') WITH ORDINALITY x WHERE x.ordinality<=r.cursor AND x.value->>'type' IN('email','whatsapp','linkedin','call') ORDER BY x.ordinality DESC LIMIT 1;
 reply_info:=public.prospecting_sequence_reply_signals(r.id,previous_contact);
 signals:=jsonb_build_object('previousContactExists',EXISTS(SELECT 1 FROM public.prospecting_sequence_effects WHERE run_id=r.id AND step_id=previous_contact AND status='succeeded'),'replied',(reply_info->>'replied')::boolean,'previousReplied',(reply_info->>'previousReplied')::boolean,'responseEffectId',reply_info->'responseEffectId','responseAgentId',reply_info->'responseAgentId',
 'commercialBlock',public.prospecting_sequence_commercial_block(r.id,s),
 'meetingBooked',EXISTS(SELECT 1 FROM public.meetings m WHERE m.workspace_id=r.workspace_id AND m.created_at>=r.created_at AND m.status NOT IN('cancelled','canceled') AND CASE p.entity WHEN 'contact' THEN m.related_contact_id=p.source_id ELSE m.related_lead_id=p.source_id END),
 'callAnswered',coalesce(call_result='answered',false),'callResultKnown',coalesce(call_result IN('answered','no_answer'),false),
 'optedOut',EXISTS(SELECT 1 FROM public.email_unsubscribes u WHERE u.workspace_id=r.workspace_id AND u.reason IS DISTINCT FROM '__token__' AND lower(btrim(u.email))=lower(btrim(s->>'email')))
 OR EXISTS(SELECT 1 FROM public.sdr_enrollments e WHERE e.workspace_id=r.workspace_id AND e.opted_out_at IS NOT NULL AND (to_jsonb(e)->>'contact_id'=p.source_id::text OR to_jsonb(e)->>'lead_id'=p.source_id::text OR regexp_replace(e.contact_phone,'\D','','g') IN(SELECT regexp_replace(phone,'\D','','g') FROM jsonb_array_elements_text(s->'phones') phone))));
 RETURN jsonb_build_object('run',to_jsonb(r),'person',jsonb_build_object('entity',p.entity,'id',p.source_id),'definition',v.definition,'source',s,'signals',signals);
END $$;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_effect_begin(p_run uuid,p_lease uuid,p_step uuid,p_prepared jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;step jsonb;ctx jsonb;account public.service_channel_accounts;kind text;last_at timestamptz;oldest_at timestamptz;used integer;min_seconds integer;max_daily integer;BEGIN
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run FOR UPDATE;
 IF r.state<>'active' OR r.lease_token IS DISTINCT FROM p_lease OR r.lease_until<=now() THEN RAISE EXCEPTION 'Lease inválido.' USING ERRCODE='40001';END IF;
 step:=c->'definition'->'steps'->r.cursor;kind:=step->>'type';
 IF nullif(c#>>'{signals,commercialBlock}','') IS NOT NULL THEN RETURN jsonb_build_object('blockReason',c#>>'{signals,commercialBlock}');END IF;
 IF step->>'id' IS DISTINCT FROM p_step::text OR kind NOT IN('email','whatsapp','linkedin','call','task') OR (c->'signals'->>'optedOut')::boolean THEN RAISE EXCEPTION 'Etapa bloqueada.' USING ERRCODE='42501';END IF;
 IF coalesce((c->'definition'->'settings'->>'stopOnReply')::boolean,true) AND (c->'signals'->>'replied')::boolean OR coalesce((c->'definition'->'settings'->>'stopOnMeeting')::boolean,true) AND (c->'signals'->>'meetingBooked')::boolean THEN RAISE EXCEPTION 'Contato já respondeu ou agendou.' USING ERRCODE='42501';END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);
 IF kind IN('email','whatsapp','linkedin') THEN
  IF NOT (ctx->'keys' ? 'system.channels.view.workspace') OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'view',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Canal sem acesso atual.' USING ERRCODE='42501';END IF;
  IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Sem permissão de envio.' USING ERRCODE='42501';END IF;
  SELECT * INTO account FROM public.service_channel_accounts WHERE id=(step->>'accountId')::uuid AND workspace_id=r.workspace_id AND channel=kind AND enabled;
  IF account.id IS NULL THEN RAISE EXCEPTION 'Conta desativada.' USING ERRCODE='42501';END IF;
  IF kind='email' AND NOT EXISTS(SELECT 1 FROM public.email_accounts a WHERE a.id::text=account.source_key AND a.workspace_id=r.workspace_id AND a.owner_id=r.owner_id AND a.status='connected' AND a.provider='gmail') THEN RAISE EXCEPTION 'Conta de e-mail indisponível.' USING ERRCODE='42501';END IF;
  IF kind='linkedin' AND NOT EXISTS(SELECT 1 FROM public.unipile_accounts ua WHERE ua.id::text=account.source_key AND ua.workspace_id=r.workspace_id AND ua.owner_id=r.owner_id AND ua.status='connected' AND public.linkedin_inbox_access(ctx,r.workspace_id,r.owner_id,'create')) THEN RAISE EXCEPTION 'Conta LinkedIn indisponível.' USING ERRCODE='42501';END IF;
 IF kind='whatsapp' AND EXISTS(SELECT 1 FROM public.whatsapp_conversations cv WHERE cv.workspace_id=r.workspace_id AND cv.wa_phone_number_id=account.source_key AND cv.contact_phone IN(SELECT ph FROM jsonb_array_elements_text(c->'source'->'phones') ph) AND NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','view',ARRAY[coalesce(cv.assigned_to,cv.owner_id)])) THEN RAISE EXCEPTION 'Conversa sem acesso atual.' USING ERRCODE='42501';END IF;
 ELSIF kind='call' AND step->>'mode'='automatic' THEN
  account.source_key:=public.prospecting_sequence_voice_access(r.id,p_lease)->>'sourceKey';account.id:=account.source_key::uuid;
 ELSE
  IF NOT public.sales_context_access(ctx,r.workspace_id,CASE WHEN kind='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END,'create',ARRAY[r.owner_id]) OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=r.workspace_id AND user_id=(step->>'assigneeId')::uuid AND status='active') THEN RAISE EXCEPTION 'Tarefa sem autorização atual.' USING ERRCODE='42501';END IF;
 END IF;
 IF (kind='task' OR kind='call' AND step->>'mode'='human') AND (step->>'assigneeId')::uuid IS DISTINCT FROM r.owner_id AND NOT public.sales_context_access(ctx,r.workspace_id,CASE WHEN kind='task' THEN 'techsales.tasks' ELSE 'techsales.activities' END,'assign',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Sem permissão para atribuir a outra pessoa.' USING ERRCODE='42501';END IF;
 IF kind IN('email','whatsapp','linkedin') OR kind='call' AND step->>'mode'='automatic' THEN
  IF cardinality(public.prospecting_sequence_unknown_keys(r.workspace_id,(SELECT identity_keys FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id)))>0 THEN RETURN jsonb_build_object('blockReason','delivery_uncertain');END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(r.workspace_id::text||':'||account.id::text,297));
  min_seconds:=greatest(1,least(coalesce((c->'definition'->'settings'->>'minimumIntervalSeconds')::integer,60),3600));
  max_daily:=greatest(1,least(coalesce((c->'definition'->'settings'->>'dailyLimit')::integer,100),1000));
  SELECT max(b.created_at),min(b.created_at),count(*) INTO last_at,oldest_at,used FROM public.prospecting_sequence_effects b WHERE b.workspace_id=r.workspace_id AND b.account_id=account.id AND b.kind IN('email','whatsapp','linkedin','call') AND b.created_at>now()-interval '24 hours' AND b.status IN('sending','succeeded','uncertain');
  IF used>=max_daily THEN RETURN jsonb_build_object('deferUntil',oldest_at+interval '24 hours','reason','daily_account_limit');END IF;
  IF last_at IS NOT NULL AND last_at+make_interval(secs=>min_seconds)>now() THEN RETURN jsonb_build_object('deferUntil',last_at+make_interval(secs=>min_seconds),'reason','account_pacing');END IF;
 END IF;
 INSERT INTO public.prospecting_sequence_effects(workspace_id,run_id,step_id,kind,status,target,account_id,sender) VALUES(r.workspace_id,r.id,p_step,kind,'sending',(c->'source')||CASE WHEN p_prepared->'source' IS NOT DISTINCT FROM c->'source' THEN jsonb_build_object('canonical_email',p_prepared->'email','canonical_phones',p_prepared->'phones','canonical_whatsapp',p_prepared->'whatsapp') ELSE '{}'::jsonb END,account.id,jsonb_build_object('sourceKey',account.source_key)) ON CONFLICT(run_id,step_id) DO UPDATE SET status='sending',token=gen_random_uuid(),target=excluded.target,account_id=excluded.account_id,sender=excluded.sender,created_at=now(),finished_at=NULL,error_code=NULL WHERE prospecting_sequence_effects.status='failed' AND prospecting_sequence_effects.provider_id IS NULL AND prospecting_sequence_effects.provider_receipt IS NULL RETURNING * INTO e;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Efeito já reservado; concilie o resultado antes de tentar novamente.' USING ERRCODE='40001';END IF;
 RETURN jsonb_build_object('id',e.id,'token',e.token,'sourceKey',account.source_key,'source',c->'source');
END $$;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_delivery_access(p_run uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;ctx jsonb;step jsonb;a public.service_channel_accounts;r public.prospecting_sequence_runs;kind text;BEGIN
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run;
 step:=c->'definition'->'steps'->r.cursor;kind:=step->>'type';
 IF kind NOT IN('email','whatsapp','linkedin') THEN RAISE EXCEPTION 'Etapa sem canal de mensagem.';END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);
 IF NOT (ctx->'keys' ? 'system.channels.view.workspace') OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'view',ARRAY[r.owner_id]) OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.'||kind,'create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Canal sem acesso atual.' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM public.service_channel_accounts WHERE id=(step->>'accountId')::uuid AND workspace_id=r.workspace_id AND channel=kind AND enabled;
 IF a.id IS NULL OR kind='email' AND NOT EXISTS(SELECT 1 FROM public.email_accounts ea WHERE ea.id::text=a.source_key AND ea.workspace_id=r.workspace_id AND ea.owner_id=r.owner_id AND ea.provider='gmail' AND ea.status='connected') THEN RAISE EXCEPTION 'Conta indisponível.' USING ERRCODE='42501';END IF;
 IF kind='linkedin' AND NOT EXISTS(SELECT 1 FROM public.unipile_accounts ua WHERE ua.id::text=a.source_key AND ua.workspace_id=r.workspace_id AND ua.owner_id=r.owner_id AND ua.status='connected' AND public.linkedin_inbox_access(ctx,r.workspace_id,r.owner_id,'create')) THEN RAISE EXCEPTION 'Conta LinkedIn indisponível.' USING ERRCODE='42501';END IF;
 IF kind='whatsapp' AND NOT public.prospecting_sequence_whatsapp_identity(r.id,a.source_key,c#>'{source,phones}') THEN RAISE EXCEPTION 'Conversa vinculada a outro cadastro. Revise as associações antes de enviar.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('id',a.id,'sourceKey',a.source_key,'displayName',a.display_name,'channel',a.channel);
END $$;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_receipt_store(p_effect uuid,p_token uuid,p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;provider text;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND kind IN('email','whatsapp','linkedin','call') FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.prospecting_sequence_unknown_keys(p_workspace uuid,p_keys text[])
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH RECURSIVE unresolved AS(
  SELECT p.id,p.cohort_id,p.identity_keys||ARRAY(
   SELECT encode(sha256(convert_to(k,'UTF8')),'hex') FROM(
    SELECT 'email:'||lower(nullif(btrim(e.target->>'canonical_email'),'')) k
    UNION ALL SELECT 'email:'||lower(e.target->>'email') WHERE NOT(e.target?'canonical_email') AND e.target->>'email'~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    UNION ALL SELECT 'phone:'||nullif(e.target->>'canonical_whatsapp','')
    UNION ALL SELECT 'phone:'||ph FROM jsonb_array_elements_text(coalesce(e.target->'canonical_phones',e.target->'phones','[]')) ph WHERE ph~'^\+[1-9][0-9]{7,14}$') h WHERE k IS NOT NULL) AS identity_keys
  FROM public.prospecting_sequence_cohort_people p JOIN public.prospecting_sequence_runs r ON r.cohort_person_id=p.id AND r.workspace_id=p.workspace_id
  JOIN public.prospecting_sequence_effects e ON e.run_id=r.id AND e.workspace_id=p_workspace AND e.kind IN('email','whatsapp','linkedin')
  WHERE p.workspace_id=p_workspace AND(e.projection_state='pending' OR e.provider_id IS NULL AND(e.status='uncertain' OR e.status='sending' AND(r.state<>'active' OR r.lease_until IS NULL OR r.lease_until<=now())))
  UNION
  SELECT p.id,p.cohort_id,p.identity_keys FROM public.prospecting_sequence_cohort_people p JOIN unresolved u ON u.cohort_id=p.cohort_id AND p.identity_keys&&u.identity_keys WHERE p.workspace_id=p_workspace AND p.block_reason='duplicate')
 SELECT coalesce(array_agg(DISTINCT k),'{}'::text[]) FROM unresolved u CROSS JOIN LATERAL unnest(u.identity_keys) k WHERE k=ANY(p_keys);
$$;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_cohort_prepare(p_workspace uuid, p_actor uuid, p_version uuid, p_request uuid, p_consent text, p_candidates jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE visible_sources jsonb;unknown_keys text[];visible_row jsonb;ctx jsonb;v public.prospecting_sequence_versions;r public.prospecting_sequence_cohorts;x jsonb;j jsonb;
 query_keys text[];ids uuid[];contacts_ids uuid[];companies_ids uuid[];leads_ids uuid[];canonical uuid;canonical_company uuid;reason text;keys text[];seen jsonb:='{}';others jsonb:='{}';suppressed_records jsonb;suppressed_emails jsonb; suppressed_phones jsonb;flags jsonb;identity_flags jsonb;
 cand_emails text[];cand_phones text[];active_sdr_phones jsonb;f integer;nheld integer;nblocked integer;out_reasons jsonb;is_customer boolean;is_open boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Somente o servidor pode preparar inscrições.' USING ERRCODE='42501';END IF;
 ctx:=public.work_subject_context(p_workspace,p_actor);
 SELECT * INTO v FROM public.prospecting_sequence_versions WHERE id=p_version AND workspace_id=p_workspace;
 IF NOT FOUND OR NOT public.sales_context_access(ctx,p_workspace,'system.automation.sequences','view',ARRAY[v.owner_id]) OR NOT public.sales_context_access(ctx,p_workspace,'system.automation.sequences','assign',ARRAY[v.owner_id]) THEN RAISE EXCEPTION 'Sem permissão para inscrever nesta versão.' USING ERRCODE='42501';END IF;
 IF p_request IS NULL OR p_consent IS NULL OR length(btrim(p_consent)) NOT BETWEEN 10 AND 2000 OR jsonb_typeof(p_candidates) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Inscrição inválida.' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_candidates)>5000 OR octet_length(p_candidates::text)>4000000 THEN RAISE EXCEPTION 'Público excede o limite técnico.' USING ERRCODE='22023';END IF;
 -- One transaction owns the workspace audience reservation, including retries/concurrent versions.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text,294));
 SELECT * INTO r FROM public.prospecting_sequence_cohorts WHERE workspace_id=p_workspace AND request_id=p_request;
 IF FOUND THEN
  IF r.created_by<>p_actor OR r.version_id<>p_version OR r.consent_evidence<>btrim(p_consent) THEN RAISE EXCEPTION 'Chave de inscrição já utilizada para outra solicitação.' USING ERRCODE='40001';END IF;
 ELSE
  INSERT INTO public.prospecting_sequence_cohorts(workspace_id,version_id,owner_id,created_by,request_id,consent_evidence,requested)
  VALUES(p_workspace,v.id,v.owner_id,p_actor,p_request,btrim(p_consent),jsonb_array_length(p_candidates)) RETURNING * INTO r;
  visible_sources:=techerp_api.sequence_audience_source(p_workspace,p_actor,p_candidates);
  SELECT array_agg((a->>'id')::uuid) INTO ids FROM jsonb_array_elements(p_candidates) a;
  -- Candidate identities computed once; matches use workspace expression indexes (no full-table regex scan).
  SELECT array_agg(DISTINCT e) INTO cand_emails FROM jsonb_array_elements(p_candidates) candidate CROSS JOIN LATERAL jsonb_array_elements_text(candidate->'email_aliases') e;
  SELECT array_agg(DISTINCT d) INTO cand_phones FROM (SELECT regexp_replace(n,'\D','','g') d FROM jsonb_array_elements(p_candidates) candidate CROSS JOIN LATERAL jsonb_array_elements_text(candidate->'phones') n) z WHERE d<>'';
  SELECT array_agg(DISTINCT id) INTO leads_ids FROM (
    SELECT id FROM public.leads WHERE workspace_id=p_workspace AND deleted_at IS NULL AND id=ANY(ids)
    UNION SELECT id FROM public.leads WHERE workspace_id=p_workspace AND deleted_at IS NULL AND lower(btrim(email))=ANY(cand_emails)
    UNION SELECT id FROM public.leads WHERE workspace_id=p_workspace AND deleted_at IS NULL AND regexp_replace(whatsapp_e164,'\D','','g')=ANY(cand_phones)
    UNION SELECT id FROM public.leads WHERE workspace_id=p_workspace AND deleted_at IS NULL AND regexp_replace(mobile_phone,'\D','','g')=ANY(cand_phones)
    UNION SELECT id FROM public.leads WHERE workspace_id=p_workspace AND deleted_at IS NULL AND regexp_replace(phone,'\D','','g')=ANY(cand_phones)
  ) a;
  SELECT array_agg(DISTINCT id) INTO contacts_ids FROM (
    SELECT id FROM public.contacts WHERE workspace_id=p_workspace AND deleted_at IS NULL AND id=ANY(ids)
    UNION SELECT c.id FROM public.contacts c JOIN public.leads l ON l.converted_contact_id=c.id WHERE c.workspace_id=p_workspace AND c.deleted_at IS NULL AND l.workspace_id=p_workspace AND l.id=ANY(leads_ids)
    UNION SELECT id FROM public.contacts WHERE workspace_id=p_workspace AND deleted_at IS NULL AND lower(btrim(email))=ANY(cand_emails)
    UNION SELECT id FROM public.contacts WHERE workspace_id=p_workspace AND deleted_at IS NULL AND regexp_replace(whatsapp_e164,'\D','','g')=ANY(cand_phones)
    UNION SELECT id FROM public.contacts WHERE workspace_id=p_workspace AND deleted_at IS NULL AND regexp_replace(mobile_phone,'\D','','g')=ANY(cand_phones)
    UNION SELECT id FROM public.contacts WHERE workspace_id=p_workspace AND deleted_at IS NULL AND regexp_replace(phone,'\D','','g')=ANY(cand_phones)
  ) a;
  SELECT coalesce(jsonb_object_agg(d,true),'{}') INTO active_sdr_phones FROM (SELECT DISTINCT regexp_replace(contact_phone,'\D','','g') d FROM public.sdr_enrollments WHERE workspace_id=p_workspace AND status='active' AND opted_out_at IS NULL AND contact_phone IS NOT NULL) z;
  SELECT array_agg(company_id) INTO companies_ids FROM (SELECT company_id FROM public.contacts WHERE workspace_id=p_workspace AND id=ANY(contacts_ids) UNION SELECT company_id FROM public.leads WHERE workspace_id=p_workspace AND id=ANY(leads_ids)) a;
  -- Failures remain failures; never substitute zero for inaccessible or missing exclusion sources.
  SELECT coalesce(jsonb_object_agg(lower(btrim(email)),true),'{}') INTO suppressed_emails FROM public.email_unsubscribes unsub WHERE workspace_id=p_workspace AND unsub.reason IS DISTINCT FROM '__token__';
  SELECT coalesce(jsonb_object_agg(regexp_replace(contact_phone,'\D','','g'),true),'{}') INTO suppressed_phones FROM public.sdr_enrollments WHERE workspace_id=p_workspace AND opted_out_at IS NOT NULL AND contact_phone IS NOT NULL;
  SELECT coalesce(jsonb_object_agg(k,true),'{}') INTO suppressed_records FROM public.sdr_enrollments e CROSS JOIN LATERAL (VALUES(to_jsonb(e)->>'lead_id'),(to_jsonb(e)->>'contact_id')) a(k) WHERE e.workspace_id=p_workspace AND e.opted_out_at IS NOT NULL AND k IS NOT NULL;
  WITH d AS(SELECT id,company_id,primary_contact_id,lead_id,CASE WHEN lower(coalesce(stage::text,'')) IN('won','closedwon','ganho') THEN 1 WHEN lower(coalesce(stage::text,'')) IN('lost','closedlost','perdido') THEN 0 ELSE 2 END flag FROM public.deals WHERE workspace_id=p_workspace AND deleted_at IS NULL),
  all_flags AS(
   SELECT 'company:'||company_id k,flag FROM d WHERE company_id=ANY(companies_ids)
   UNION ALL SELECT 'contact:'||primary_contact_id,flag FROM d WHERE primary_contact_id=ANY(contacts_ids)
   UNION ALL SELECT 'lead:'||lead_id,flag FROM d WHERE lead_id=ANY(leads_ids)
   UNION ALL SELECT 'contact:'||dc.contact_id,d.flag FROM public.deal_contacts dc JOIN d ON d.id=dc.deal_id WHERE dc.contact_id=ANY(contacts_ids)
   UNION ALL SELECT 'company:'||counterparty_company_id,1 FROM public.contracts WHERE workspace_id=p_workspace AND status='active' AND counterparty_company_id=ANY(companies_ids))
  SELECT coalesce(jsonb_object_agg(k,flag),'{}') INTO flags FROM(SELECT k,bit_or(flag) flag FROM all_flags GROUP BY k) a;
  WITH related AS(
   SELECT to_jsonb(c) j,'contact' entity FROM public.contacts c WHERE c.workspace_id=p_workspace AND c.id=ANY(contacts_ids)
   UNION ALL SELECT to_jsonb(l),'lead' FROM public.leads l WHERE l.workspace_id=p_workspace AND l.id=ANY(leads_ids)),
  related_flags AS(SELECT rr.j,rr.entity,coalesce((flags->>('company:'||(rr.j->>'company_id')))::integer,0) | coalesce((flags->>(rr.entity||':'||(rr.j->>'id')))::integer,0) | coalesce((flags->>('contact:'||(rr.j->>'converted_contact_id')))::integer,0) f FROM related rr),
  identity_rows AS(SELECT encode(sha256(convert_to(a.k,'UTF8')),'hex') k,rf.f FROM related_flags rf CROSS JOIN LATERAL(
   SELECT 'record:'||(rf.j->>'id') k UNION ALL SELECT 'contact:'||(rf.j->>'id') WHERE rf.entity='contact'
   UNION ALL SELECT 'contact:'||(rf.j->>'converted_contact_id') WHERE rf.entity='lead' AND rf.j->>'converted_contact_id' IS NOT NULL
   UNION ALL SELECT 'email:'||lower(btrim(rf.j->>'email')) WHERE nullif(btrim(rf.j->>'email'),'') IS NOT NULL
   UNION ALL SELECT 'phone:+'||regexp_replace(p,'\D','','g') FROM unnest(ARRAY[rf.j->>'whatsapp_e164',rf.j->>'mobile_phone',rf.j->>'phone']) p WHERE nullif(p,'') IS NOT NULL) a)
  SELECT coalesce(jsonb_object_agg(a.k,a.f),'{}') INTO identity_flags FROM(SELECT ir.k,bit_or(ir.f) f FROM identity_rows ir GROUP BY ir.k) a;
  SELECT array_agg(DISTINCT encode(sha256(convert_to(k,'UTF8')),'hex')) INTO query_keys FROM (
   SELECT 'record:'||(a->>'id') k FROM jsonb_array_elements(p_candidates) a
   UNION ALL SELECT 'contact:'||id FROM unnest(contacts_ids) id
   UNION ALL SELECT 'email:'||e FROM jsonb_array_elements(p_candidates) a CROSS JOIN LATERAL jsonb_array_elements_text(a->'email_aliases') e
   UNION ALL SELECT 'linkedin:'||lower(a->>'linkedin_identifier') FROM jsonb_array_elements(p_candidates) a WHERE nullif(a->>'linkedin_identifier','') IS NOT NULL
   UNION ALL SELECT 'phone:'||p FROM jsonb_array_elements(p_candidates) a CROSS JOIN LATERAL jsonb_array_elements_text(a->'phones') p) hashes;
  unknown_keys:=public.prospecting_sequence_unknown_keys(p_workspace,query_keys);
  SELECT coalesce(jsonb_object_agg(k,true) FILTER(WHERE q.version_id=p_version),'{}'),coalesce(jsonb_object_agg(k,true) FILTER(WHERE q.version_id<>p_version AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_identity_releases rel WHERE rel.person_id=p.id)),'{}') INTO seen,others
  FROM public.prospecting_sequence_cohort_people p JOIN public.prospecting_sequence_cohorts q ON q.id=p.cohort_id CROSS JOIN LATERAL unnest(p.identity_keys) k WHERE q.workspace_id=p_workspace AND (p.block_reason IS NULL OR p.block_reason='duplicate') AND p.identity_keys && query_keys;
  FOR x IN SELECT value FROM jsonb_array_elements(p_candidates) LOOP
   IF x->>'entity' NOT IN('lead','contact') OR x->>'entity' IS NULL THEN RAISE EXCEPTION 'Destinatário inválido.' USING ERRCODE='22023';END IF;
   IF x->>'entity'='lead' THEN SELECT to_jsonb(l) INTO j FROM public.leads l WHERE id=(x->>'id')::uuid AND workspace_id=p_workspace AND deleted_at IS NULL;
   ELSE SELECT to_jsonb(c) INTO j FROM public.contacts c WHERE id=(x->>'id')::uuid AND workspace_id=p_workspace AND deleted_at IS NULL;END IF;
   IF j IS NULL OR NOT public.sales_context_access(ctx,p_workspace,CASE WHEN x->>'entity'='lead' THEN 'techsales.leads' ELSE 'techsales.contacts' END,'view',ARRAY[coalesce(nullif(j->>'assigned_to',''),j->>'owner_id')::uuid]) THEN RAISE EXCEPTION 'O acesso ao público mudou. Recalcule a inscrição.' USING ERRCODE='42501';END IF;
   visible_row:=visible_sources->((x->>'entity')||':'||(x->>'id'));
   IF visible_row IS NULL THEN RAISE EXCEPTION 'O acesso ao público mudou. Recalcule a inscrição.' USING ERRCODE='42501';END IF;
   IF coalesce(visible_row->>'email','') IS DISTINCT FROM coalesce(x->>'raw_email','') OR visible_row->'phones' IS DISTINCT FROM x->'raw_phones' OR coalesce(visible_row->>'linkedin_url','') IS DISTINCT FROM coalesce(x->>'raw_linkedin_url','') THEN RAISE EXCEPTION 'Dados do público alterados. Recalcule a inscrição.' USING ERRCODE='40001';END IF;
   canonical:=CASE WHEN x->>'entity'='contact' THEN (x->>'id')::uuid ELSE nullif(j->>'converted_contact_id','')::uuid END;
   IF canonical IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contacts WHERE id=canonical AND workspace_id=p_workspace AND deleted_at IS NULL) THEN canonical:=NULL;END IF;
   SELECT company_id INTO canonical_company FROM public.contacts WHERE id=canonical AND workspace_id=p_workspace AND deleted_at IS NULL;
   SELECT array_agg(DISTINCT encode(sha256(convert_to(k,'UTF8')),'hex')) INTO keys FROM (
    SELECT 'record:'||(x->>'id') k UNION ALL SELECT 'contact:'||canonical WHERE canonical IS NOT NULL
    UNION ALL SELECT 'email:'||e FROM jsonb_array_elements_text(x->'email_aliases') e
    UNION ALL SELECT 'linkedin:'||lower(x->>'linkedin_identifier') WHERE nullif(x->>'linkedin_identifier','') IS NOT NULL
    UNION ALL SELECT 'phone:'||p FROM jsonb_array_elements_text(x->'phones') p) a;
   f:=coalesce((flags->>('company:'||canonical_company))::integer,0) | coalesce((flags->>('company:'||(j->>'company_id')))::integer,0) | coalesce((flags->>((x->>'entity')||':'||(x->>'id')))::integer,0) | coalesce((flags->>('contact:'||canonical))::integer,0);
   SELECT f | coalesce(bit_or((identity_flags->>k)::integer),0) INTO f FROM unnest(keys) k;
   is_customer:=(f & 1)=1;is_open:=(f & 2)=2;
   reason:=NULL;
   IF suppressed_records ? (x->>'id') OR suppressed_records ? coalesce(canonical::text,'') OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(x->'email_aliases') e WHERE suppressed_emails ? e) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(x->'phones') p WHERE suppressed_phones ? regexp_replace(p,'\D','','g')) THEN reason:='opt_out';
   ELSIF coalesce((v.definition#>>'{audience,excludeCustomers}')::boolean,true) AND is_customer THEN reason:='customer';
   ELSIF coalesce((v.definition#>>'{audience,excludeOpenDeals}')::boolean,true) AND is_open THEN reason:='open_deal';
   ELSIF NOT coalesce((x#>>'{channels,email}')::boolean,false) AND NOT coalesce((x#>>'{channels,whatsapp}')::boolean,false) AND NOT coalesce((x#>>'{channels,call}')::boolean,false) AND NOT coalesce((x#>>'{channels,linkedin}')::boolean,false) THEN reason:='missing_channel';
   ELSIF keys && unknown_keys THEN reason:='delivery_uncertain';
   ELSIF seen ?| keys THEN reason:='duplicate';
   ELSIF coalesce((v.definition#>>'{audience,excludeOtherSequences}')::boolean,true) AND (others ?| keys OR EXISTS(SELECT 1 FROM public.sequence_enrollments e WHERE e.workspace_id=p_workspace AND e.status='active' AND e.entity_id=ANY(ARRAY[(x->>'id')::uuid,canonical])) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(x->'phones') p WHERE active_sdr_phones ? regexp_replace(p,'\D','','g'))) THEN reason:='other_sequence';END IF;
   INSERT INTO public.prospecting_sequence_cohort_people(cohort_id,workspace_id,entity,source_id,channels,identity_keys,block_reason) VALUES(r.id,p_workspace,x->>'entity',(x->>'id')::uuid,x->'channels',keys,reason);
   IF reason IS NULL OR reason='duplicate' THEN SELECT seen||coalesce(jsonb_object_agg(k,true),'{}') INTO seen FROM unnest(keys) k;END IF;
  END LOOP;
 END IF;
 SELECT count(*) FILTER(WHERE block_reason IS NULL),count(*) FILTER(WHERE block_reason IS NOT NULL) INTO nheld,nblocked FROM public.prospecting_sequence_cohort_people WHERE cohort_id=r.id;
 SELECT coalesce(jsonb_object_agg(block_reason,n),'{}') INTO out_reasons FROM(SELECT block_reason,count(*) n FROM public.prospecting_sequence_cohort_people WHERE cohort_id=r.id AND block_reason IS NOT NULL GROUP BY block_reason) a;
 RETURN jsonb_build_object('id',r.id,'version_id',r.version_id,'created_at',r.created_at,'requested',r.requested,'held',nheld,'blocked',nblocked,'reasons',out_reasons);
END $function$;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_message_commit_0302(p_effect uuid,p_token uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;
 step jsonb;a public.service_channel_accounts;account uuid;thread uuid;message uuid;v_provider text;old_workspace uuid;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 IF pg_column_size(p_payload)>64000 THEN RAISE EXCEPTION 'Recibo excede limite.';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND kind IN('email','whatsapp','linkedin') FOR UPDATE;
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
 IF e.kind='linkedin' THEN
  account:=a.source_key::uuid;
  IF nullif(p_payload->>'chatId','') IS NULL OR nullif(p_payload->>'targetId','') IS NULL THEN RAISE EXCEPTION 'Recibo LinkedIn incompleto; preservar para conciliação.';END IF;
  IF EXISTS(SELECT 1 FROM public.linkedin_conversations cv WHERE cv.account_id=account AND cv.provider_chat_id=p_payload->>'chatId' AND (cv.workspace_id<>r.workspace_id OR cv.owner_id<>r.owner_id OR cv.sender_id IS DISTINCT FROM p_payload->>'targetId' OR (cv.contact_id IS NOT NULL OR cv.lead_id IS NOT NULL) AND NOT public.prospecting_sequence_person_matches(r.id,cv.contact_id,cv.lead_id))) THEN RAISE EXCEPTION 'Conversa LinkedIn vinculada a outro cadastro.' USING ERRCODE='42501';END IF;
  INSERT INTO public.linkedin_conversations(workspace_id,owner_id,assigned_to,account_id,provider_chat_id,sender_id,title,snippet,last_message_at,contact_id,lead_id,identity_status)
  VALUES(r.workspace_id,r.owner_id,r.owner_id,account,p_payload->>'chatId',p_payload->>'targetId',coalesce(nullif(concat_ws(' ',e.target->>'first_name',e.target->>'last_name'),''),p_payload->>'targetId'),left(p_payload->>'body',240),e.finished_at,CASE WHEN p.entity='contact' THEN p.source_id END,CASE WHEN p.entity='lead' THEN p.source_id END,'matched')
  ON CONFLICT(account_id,provider_chat_id) DO UPDATE SET snippet=excluded.snippet,last_message_at=greatest(linkedin_conversations.last_message_at,excluded.last_message_at),contact_id=coalesce(linkedin_conversations.contact_id,excluded.contact_id),lead_id=CASE WHEN linkedin_conversations.contact_id IS NULL THEN coalesce(linkedin_conversations.lead_id,excluded.lead_id) END,identity_status=CASE WHEN linkedin_conversations.identity_status='manual' THEN 'manual' ELSE 'matched' END RETURNING id INTO thread;
  INSERT INTO public.linkedin_messages(id,workspace_id,conversation_id,account_id,provider_message_id,direction,body,created_at)
  VALUES(e.id,r.workspace_id,thread,account,v_provider,'outbound',p_payload->>'body',e.finished_at) ON CONFLICT(account_id,provider_message_id) DO NOTHING RETURNING id INTO message;
  IF message IS NULL THEN SELECT id INTO message FROM public.linkedin_messages WHERE workspace_id=r.workspace_id AND account_id=account AND provider_message_id=v_provider;END IF;
 ELSIF e.kind='email' THEN
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

CREATE OR REPLACE FUNCTION public.prospecting_sequence_reply_signals(p_run uuid,p_previous uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;pick_previous boolean;definition jsonb;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT v.definition,(v.definition->'steps'->r.cursor->>'type'='wait' AND v.definition->'steps'->r.cursor->>'source'='previous' AND NOT coalesce((v.definition#>>'{settings,stopOnReply}')::boolean,true)) INTO definition,pick_previous FROM public.prospecting_sequence_runs r JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE r.id=p_run;
 WITH replies AS (
  SELECT e.step_id,e.id effect_id,coalesce(inbound.received_at,inbound.created_at) received_at FROM public.prospecting_sequence_effects e JOIN public.prospecting_sequence_runs r ON r.id=e.run_id
  JOIN public.email_messages sent ON sent.id=e.id AND sent.workspace_id=r.workspace_id
  JOIN public.email_messages inbound ON inbound.thread_id=sent.thread_id AND inbound.account_id=sent.account_id AND inbound.workspace_id=sent.workspace_id AND inbound.direction='inbound'
  JOIN public.email_accounts ac ON ac.id=sent.account_id AND ac.workspace_id=sent.workspace_id
  WHERE r.id=p_run AND e.kind='email' AND e.status='succeeded' AND coalesce(inbound.received_at,inbound.created_at)>=e.finished_at
  AND inbound.in_reply_to=sent.message_id_header AND nullif(inbound.in_reply_to,'') IS NOT NULL AND lower(inbound.from_email)=ANY(SELECT lower(x) FROM unnest(sent.to_emails) x)
  AND NOT public.service_agent_email_is_automatic(inbound.headers,inbound.from_email,ac.email)
  UNION ALL
  SELECT e.step_id,e.id effect_id,inbound.created_at received_at FROM public.prospecting_sequence_effects e JOIN public.prospecting_sequence_runs r ON r.id=e.run_id
  JOIN public.whatsapp_messages sent ON sent.id=e.id AND sent.workspace_id=r.workspace_id
  JOIN public.whatsapp_messages inbound ON inbound.conversation_id=sent.conversation_id AND inbound.workspace_id=sent.workspace_id AND inbound.direction='inbound'
  WHERE r.id=p_run AND e.kind='whatsapp' AND e.status='succeeded' AND inbound.created_at>=e.finished_at
  AND regexp_replace(inbound.from_number,'\D','','g')=regexp_replace(sent.to_number,'\D','','g')
  UNION ALL
  SELECT e.step_id,e.id,inbound.created_at FROM public.prospecting_sequence_effects e JOIN public.prospecting_sequence_runs r ON r.id=e.run_id
  JOIN public.linkedin_messages sent ON sent.id=e.id AND sent.workspace_id=r.workspace_id
  JOIN public.linkedin_messages inbound ON inbound.conversation_id=sent.conversation_id AND inbound.account_id=sent.account_id AND inbound.workspace_id=sent.workspace_id AND inbound.direction='inbound'
  WHERE r.id=p_run AND e.kind='linkedin' AND e.status='succeeded' AND inbound.created_at>=e.finished_at
 ),chosen AS(SELECT * FROM replies WHERE NOT coalesce(pick_previous,false) OR step_id=p_previous ORDER BY received_at DESC,effect_id DESC LIMIT 1)
 SELECT jsonb_build_object('replied',EXISTS(SELECT 1 FROM replies),'previousReplied',EXISTS(SELECT 1 FROM replies WHERE step_id=p_previous),'responseEffectId',(SELECT effect_id FROM chosen),'responseAgentId',(SELECT coalesce(nullif(step->>'agentId',''),nullif(definition#>>'{settings,agentId}','')) FROM jsonb_array_elements(definition->'steps') step WHERE step->>'id'=(SELECT step_id::text FROM chosen))) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_agent_route_allowed(p_workspace uuid,p_channel text,p_source uuid,p_agent uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT NOT EXISTS(
  SELECT 1 FROM public.prospecting_sequence_runs r JOIN public.prospecting_sequence_versions v ON v.id=r.version_id AND v.workspace_id=r.workspace_id
  JOIN LATERAL(SELECT e.* FROM public.prospecting_sequence_effects e WHERE e.run_id=r.id AND e.kind=p_channel AND e.status='succeeded' AND
   CASE p_channel WHEN 'email' THEN EXISTS(SELECT 1 FROM public.email_messages m WHERE m.id=e.id AND m.workspace_id=r.workspace_id AND m.thread_id=p_source)
   WHEN 'linkedin' THEN EXISTS(SELECT 1 FROM public.linkedin_messages m WHERE m.id=e.id AND m.workspace_id=r.workspace_id AND m.conversation_id=p_source)
   WHEN 'whatsapp' THEN EXISTS(SELECT 1 FROM public.whatsapp_messages m WHERE m.id=e.id AND m.workspace_id=r.workspace_id AND m.conversation_id=p_source) ELSE false END ORDER BY e.finished_at DESC,e.id DESC LIMIT 1) effect ON true
  JOIN LATERAL(SELECT s FROM jsonb_array_elements(v.definition->'steps') s WHERE s->>'id'=effect.step_id::text) step ON true
  WHERE r.workspace_id=p_workspace AND (r.state IN('active','waiting_task','agent') OR r.state='human' AND EXISTS(SELECT 1 FROM public.activities human_task WHERE human_task.id=r.id AND human_task.workspace_id=r.workspace_id AND NOT human_task.completed)) AND (
   r.state='human' OR
   NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'manage')
   OR NOT public.prospecting_sequence_runtime_allowed(r.workspace_id,r.owner_id,v.owner_id,'assign')
   OR (v.definition->'steps'->r.cursor->>'type'='wait' AND v.definition->'steps'->r.cursor->>'onReply'='human')
   OR coalesce(nullif(step.s->>'agentId',''),nullif(v.definition#>>'{settings,agentId}','')) IS DISTINCT FROM p_agent::text
  )
 ) INTO allowed;
 RETURN allowed;
END $$;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_handoff(p_run uuid,p_lease uuid,p_mode text,p_agent uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;cv public.whatsapp_conversations;source uuid;channel_kind text;account public.service_channel_accounts;ctx jsonb;session uuid;enrollment uuid;person uuid;entity_kind text;actual text:=p_mode;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_mode NOT IN('human','agent') THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND lease_token=p_lease AND lease_until>now() AND state='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Execução indisponível.' USING ERRCODE='40001';END IF;
 ctx:=public.work_subject_context(r.workspace_id,r.owner_id);person:=(c#>>'{person,id}')::uuid;entity_kind:=c#>>'{person,entity}';
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE run_id=r.id AND kind IN('email','whatsapp','linkedin') AND status='succeeded' AND projection_state='complete' AND (nullif(c#>>'{signals,responseEffectId}','') IS NULL OR id=(c#>>'{signals,responseEffectId}')::uuid) ORDER BY finished_at DESC,id DESC LIMIT 1;
 IF e.id IS NOT NULL THEN
  SELECT * INTO account FROM public.service_channel_accounts WHERE id=e.account_id AND workspace_id=r.workspace_id FOR SHARE;
  IF e.kind='whatsapp' THEN SELECT conversation_id INTO source FROM public.whatsapp_messages WHERE id=e.id AND workspace_id=r.workspace_id;
  ELSIF e.kind='linkedin' THEN SELECT conversation_id INTO source FROM public.linkedin_messages WHERE id=e.id AND workspace_id=r.workspace_id;
  ELSE SELECT thread_id INTO source FROM public.email_messages WHERE id=e.id AND workspace_id=r.workspace_id;END IF;
  channel_kind:=e.kind;
 END IF;
 IF p_mode='agent' THEN
  IF p_agent::text IS DISTINCT FROM coalesce(nullif(c#>>'{signals,responseAgentId}',''),CASE WHEN c->'definition'->'steps'->r.cursor->>'type'='agent' THEN nullif(c->'definition'->'steps'->r.cursor->>'agentId','') END,nullif(c#>>'{definition,settings,agentId}','')) THEN RAISE EXCEPTION 'Agente diferente da configuração da sequência.' USING ERRCODE='42501';END IF;
  IF source IS NULL OR p_agent IS NULL OR NOT account.enabled OR NOT account.routing_configured OR NOT EXISTS(SELECT 1 FROM public.service_channel_bindings b JOIN public.sdr_playbooks pb ON pb.id=b.agent_id AND pb.workspace_id=b.workspace_id WHERE b.account_id=account.id AND b.workspace_id=r.workspace_id AND b.agent_id=p_agent AND b.enabled AND b.inbound AND b.campaigns AND pb.enabled AND public.is_workspace_member(r.workspace_id,pb.owner_id) AND EXISTS(SELECT 1 FROM public.sdr_agent_versions av WHERE av.playbook_id=pb.id AND av.workspace_id=r.workspace_id AND av.status='published')) THEN RAISE EXCEPTION 'Agente/canal indisponível.' USING ERRCODE='42501';END IF;
  IF channel_kind='whatsapp' THEN
   SELECT * INTO cv FROM public.whatsapp_conversations WHERE id=source AND workspace_id=r.workspace_id FOR UPDATE;
   IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','view',ARRAY[coalesce(cv.assigned_to,cv.owner_id)]) OR NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','update',ARRAY[coalesce(cv.assigned_to,cv.owner_id)]) THEN RAISE EXCEPTION 'Conversa sem autorização atual.' USING ERRCODE='42501';END IF;
   IF cv.ai_owner IN('human','paused') THEN actual:='human';ELSE
    -- Existing router owns the enrollment and future inbound processing. Never send an unsolicited AI message here.
    enrollment:=public.sdr_bind_inbound_channel(r.workspace_id,source,account.source_key);
    IF enrollment IS NULL OR NOT EXISTS(SELECT 1 FROM public.sdr_enrollments WHERE id=enrollment AND workspace_id=r.workspace_id AND playbook_id=p_agent AND opted_out_at IS NULL) THEN RAISE EXCEPTION 'Agente não vinculado à conversa.' USING ERRCODE='42501';END IF;
   END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.service_agent_sessions ss JOIN public.sdr_enrollments se ON se.id=ss.enrollment_id AND se.workspace_id=ss.workspace_id WHERE ss.workspace_id=r.workspace_id AND ss.channel=channel_kind AND ss.source_id=source AND se.playbook_id IS DISTINCT FROM p_agent) THEN RAISE EXCEPTION 'Conversa vinculada a outro agente.' USING ERRCODE='42501';END IF;
   IF EXISTS(SELECT 1 FROM public.service_agent_sessions s WHERE s.workspace_id=r.workspace_id AND s.channel=channel_kind AND s.source_id=source AND s.ai_owner IN('human','paused')) THEN actual:='human';END IF;
   -- The existing verified inbound trigger enqueues email. Configuration is checked above; no fabricated inbound job.
  END IF;
 END IF;
 IF actual='human' THEN
  IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.tasks','create',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Atendimento sem autorização atual.' USING ERRCODE='42501';END IF;
  IF channel_kind='whatsapp' AND source IS NOT NULL THEN
   SELECT * INTO cv FROM public.whatsapp_conversations WHERE id=source AND workspace_id=r.workspace_id FOR UPDATE;
   IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.whatsapp','update',ARRAY[coalesce(cv.assigned_to,cv.owner_id)]) THEN RAISE EXCEPTION 'Conversa sem autorização atual.' USING ERRCODE='42501';END IF;
   UPDATE public.whatsapp_conversations SET ai_owner='human',ai_version=ai_version+1 WHERE id=source AND workspace_id=r.workspace_id AND ai_owner IS DISTINCT FROM 'human' AND ai_owner IS DISTINCT FROM 'paused';
  ELSIF channel_kind='linkedin' AND source IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.linkedin_conversations cv WHERE cv.id=source AND cv.workspace_id=r.workspace_id AND cv.owner_id=r.owner_id AND public.linkedin_inbox_access(ctx,cv.workspace_id,cv.owner_id,'manage')) THEN RAISE EXCEPTION 'Conversa LinkedIn sem autorização.' USING ERRCODE='42501';END IF;
   UPDATE public.service_agent_sessions SET ai_owner='human',ai_version=ai_version+1 WHERE workspace_id=r.workspace_id AND channel='linkedin' AND source_id=source AND ai_owner='ai';
  ELSIF channel_kind='email' AND source IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.email_threads t WHERE t.id=source AND t.workspace_id=r.workspace_id AND public.sales_context_access(ctx,r.workspace_id,'techsales.inbox.email','update',ARRAY[coalesce(t.assigned_to,t.owner_id)])) THEN RAISE EXCEPTION 'Conversa sem autorização atual.' USING ERRCODE='42501';END IF;
   UPDATE public.service_agent_sessions SET ai_owner='human',ai_version=ai_version+1 WHERE workspace_id=r.workspace_id AND channel='email' AND source_id=source AND ai_owner='ai';
  END IF;
  INSERT INTO public.activities(id,workspace_id,owner_id,assigned_to,type,subject,body,due_date,related_contact_id,related_lead_id,external_ids)
  VALUES(r.id,r.workspace_id,r.owner_id,r.owner_id,'task','Atender contato da sequência','A cadência foi interrompida para atendimento humano. Confira a conversa na Inbox antes de entrar em contato.',now(),CASE WHEN entity_kind='contact' THEN person END,CASE WHEN entity_kind='lead' THEN person END,jsonb_build_object('prospecting_sequence_run_id',r.id,'sequence_handoff',true)) ON CONFLICT(id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM public.activities a WHERE a.id=r.id AND a.workspace_id=r.workspace_id AND a.owner_id=r.owner_id AND a.external_ids->>'prospecting_sequence_run_id'=r.id::text AND CASE entity_kind WHEN 'contact' THEN a.related_contact_id=person ELSE a.related_lead_id=person END) THEN RAISE EXCEPTION 'Conflito na atividade de atendimento.' USING ERRCODE='23505';END IF;
  INSERT INTO public.notifications(id,workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
  VALUES(r.id,r.workspace_id,r.owner_id,r.owner_id,'sequence_handoff','Contato aguardando atendimento','A sequência foi interrompida. Consulte a atividade vinculada e a Inbox.','/prospecting/sequences','activities',r.id,'sequence-handoff:'||r.id::text) ON CONFLICT(id) DO NOTHING;
 END IF;
 UPDATE public.prospecting_sequence_runs SET handoff_effect_id=e.id WHERE id=r.id;
 RETURN actual;
END $$;

CREATE FUNCTION public.linkedin_sequence_reply_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.direction<>'inbound' THEN RETURN NEW;END IF;
 INSERT INTO public.prospecting_sequence_reply_wakes(run_id,workspace_id,occurred_at)
 SELECT DISTINCT r.id,r.workspace_id,NEW.created_at FROM public.prospecting_sequence_runs r JOIN public.prospecting_sequence_effects e ON e.run_id=r.id JOIN public.linkedin_messages sent ON sent.id=e.id AND sent.workspace_id=r.workspace_id
 WHERE r.workspace_id=NEW.workspace_id AND r.state IN('active','waiting_task') AND e.kind='linkedin' AND e.status='succeeded' AND sent.conversation_id=NEW.conversation_id AND sent.account_id=NEW.account_id AND NEW.created_at>=e.finished_at
 ON CONFLICT(run_id) DO UPDATE SET occurred_at=greatest(prospecting_sequence_reply_wakes.occurred_at,excluded.occurred_at);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.linkedin_sequence_reply_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sequence_reply_wake AFTER INSERT ON public.linkedin_messages FOR EACH ROW EXECUTE FUNCTION public.linkedin_sequence_reply_event();
CREATE FUNCTION public.prospecting_sequence_defer_delivery(p_run uuid,p_lease uuid,p_effect uuid,p_token uuid,p_due timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_due IS NULL OR p_due<=now() THEN RAISE EXCEPTION 'Invalid defer' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND state='active' AND lease_token=p_lease AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lease unavailable' USING ERRCODE='40001';END IF;
 IF p_effect IS NOT NULL THEN
  SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND run_id=r.id AND token=p_token AND kind='linkedin' AND status='sending' AND provider_id IS NULL AND provider_receipt IS NULL FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM public.unipile_delivery_receipts d WHERE d.account_id=(e.sender->>'sourceKey')::uuid AND d.status IN('started','uncertain')) THEN RAISE EXCEPTION 'Delivery may have started' USING ERRCODE='40001';END IF;
  UPDATE public.prospecting_sequence_effects SET status='failed',error_code='provider_backpressure' WHERE id=e.id;
 END IF;
 UPDATE public.prospecting_sequence_runs SET next_run_at=p_due,lease_token=NULL,lease_until=NULL,reason='provider_backpressure',updated_at=now() WHERE id=r.id;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_defer_delivery(uuid,uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_defer_delivery(uuid,uuid,uuid,uuid,timestamptz) TO service_role;


CREATE INDEX sequence_effects_linkedin_account_budget ON public.prospecting_sequence_effects(workspace_id,account_id,created_at DESC) WHERE kind='linkedin' AND status IN('sending','succeeded','uncertain');
CREATE FUNCTION public.prospecting_sequence_linkedin_identity(p_run uuid,p_lease uuid,p_account uuid,p_target text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;account jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service required' USING ERRCODE='42501';END IF;
 account:=public.prospecting_sequence_delivery_access(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run;
 IF account->>'sourceKey' IS DISTINCT FROM p_account::text OR nullif(p_target,'') IS NULL THEN RETURN false;END IF;
 RETURN NOT EXISTS(SELECT 1 FROM public.linkedin_conversations cv WHERE cv.account_id=p_account AND cv.workspace_id=r.workspace_id AND cv.sender_id=p_target AND (cv.owner_id<>r.owner_id OR (cv.contact_id IS NOT NULL OR cv.lead_id IS NOT NULL) AND NOT public.prospecting_sequence_person_matches(r.id,cv.contact_id,cv.lead_id)));
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_linkedin_identity(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_linkedin_identity(uuid,uuid,uuid,text) TO service_role;

-- A new nonce must not bypass an unresolved delivery from the same personal account.
CREATE OR REPLACE FUNCTION public.unipile_delivery_begin(p_account uuid,p_key text,p_endpoint text,p_daily integer,p_interval integer,p_noted boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.unipile_accounts;r public.unipile_delivery_receipts;b jsonb;
BEGIN
 SELECT * INTO a FROM public.unipile_accounts WHERE id=p_account FOR UPDATE;
 IF NOT FOUND OR a.status<>'connected' OR NOT public.unipile_personal_access(public.work_subject_context(a.workspace_id,a.owner_id),a.workspace_id,a.owner_id,'manage') THEN RAISE EXCEPTION 'Account unauthorized' USING ERRCODE='42501';END IF;
 IF p_endpoint NOT IN('message.send','invite.send') OR length(p_key)<>64 THEN RAISE EXCEPTION 'Invalid outbound operation';END IF;
 SELECT * INTO r FROM public.unipile_delivery_receipts WHERE account_id=p_account AND request_key=p_key FOR UPDATE;
 IF FOUND AND r.status='sent' THEN RETURN jsonb_build_object('ok',true,'cached',true,'response',r.response);END IF;
 IF FOUND AND r.status IN('started','uncertain') THEN RETURN jsonb_build_object('ok',false,'reason','delivery_uncertain');END IF;
 IF EXISTS(SELECT 1 FROM public.unipile_delivery_receipts pending WHERE pending.account_id=p_account AND pending.status IN('started','uncertain')) THEN RETURN jsonb_build_object('ok',false,'reason','delivery_uncertain');END IF;
 b:=public.unipile_request_reserve(p_account,p_endpoint,p_daily,p_interval,p_noted);
 IF NOT coalesce((b->>'ok')::boolean,false) THEN RETURN b;END IF;
 INSERT INTO public.unipile_delivery_receipts(account_id,request_key,status) VALUES(p_account,p_key,'started')
 ON CONFLICT(account_id,request_key) DO UPDATE SET status='started',lease_token=gen_random_uuid(),updated_at=now()
 RETURNING * INTO r;
 RETURN jsonb_build_object('ok',true,'cached',false,'id',r.id,'token',r.lease_token);
END $$;
