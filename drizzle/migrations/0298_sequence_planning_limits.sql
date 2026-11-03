CREATE OR REPLACE FUNCTION public.prospecting_sequence_effect_begin(p_run uuid,p_lease uuid,p_step uuid,p_prepared jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;step jsonb;ctx jsonb;account public.service_channel_accounts;kind text;last_at timestamptz;oldest_at timestamptz;used integer;min_seconds integer;max_daily integer;pl jsonb;cap integer;idx integer;gap integer;BEGIN
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
  pl:=c->'definition'->'planning';
  IF pl IS NOT NULL AND kind='whatsapp' AND coalesce((pl#>>'{recent,skipWhatsappDays}')::integer,0)>0 AND EXISTS(
   SELECT 1 FROM public.whatsapp_messages m JOIN public.whatsapp_conversations cv ON cv.id=m.conversation_id
   WHERE m.workspace_id=r.workspace_id AND cv.workspace_id=r.workspace_id AND m.direction='outbound'
     AND m.created_at>now()-make_interval(days=>(pl#>>'{recent,skipWhatsappDays}')::integer)
     AND cv.contact_phone IN(SELECT ph FROM jsonb_array_elements_text(c->'source'->'phones') ph)
     AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_effects x WHERE x.run_id=r.id AND x.provider_id=m.wa_message_id)) THEN
   RETURN jsonb_build_object('skipTo',r.cursor+1,'reason','recent_whatsapp_skip');
  END IF;
  IF pl IS NOT NULL AND kind IN('email','whatsapp') THEN
   IF NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_effects x WHERE x.run_id=r.id) THEN
    SELECT min(f.first_at),count(*) INTO oldest_at,used FROM (SELECT min(x.created_at) first_at FROM public.prospecting_sequence_effects x JOIN public.prospecting_sequence_runs y ON y.id=x.run_id WHERE y.version_id=r.version_id AND x.workspace_id=r.workspace_id GROUP BY x.run_id HAVING min(x.created_at)>now()-interval '24 hours') f;
    IF used>=greatest(1,coalesce((pl#>>'{intake,dailyIntake}')::integer,1000)) THEN RETURN jsonb_build_object('deferUntil',oldest_at+interval '24 hours','reason','daily_intake_limit');END IF;
   END IF;
   IF kind='email' THEN
    cap:=greatest(1,floor((pl#>>'{email,hourlyLimit}')::integer*(100-(pl#>>'{email,safeguardPct}')::integer)/100.0)::integer);
    SELECT min(b.created_at),count(*) INTO oldest_at,used FROM public.prospecting_sequence_effects b WHERE b.workspace_id=r.workspace_id AND b.account_id=account.id AND b.kind='email' AND b.created_at>now()-interval '1 hour' AND b.status IN('sending','succeeded','uncertain');
    IF used>=cap THEN RETURN jsonb_build_object('deferUntil',oldest_at+interval '1 hour','reason','hourly_email_limit');END IF;
    IF pl#>>'{email,onLimit}'='prioritize_followups' AND used>=greatest(1,floor(cap*0.7)) AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_effects x WHERE x.run_id=r.id) THEN
     RETURN jsonb_build_object('deferUntil',oldest_at+interval '1 hour','reason','intake_paused_for_followups');
    END IF;
   ELSE
    cap:=greatest(1,floor((pl#>>'{whatsapp,dailyLimit}')::integer*(100-(pl#>>'{whatsapp,safeguardPct}')::integer)/100.0)::integer);
    SELECT max(b.created_at),min(b.created_at),count(*) INTO last_at,oldest_at,used FROM public.prospecting_sequence_effects b WHERE b.workspace_id=r.workspace_id AND b.account_id=account.id AND b.kind='whatsapp' AND b.created_at>now()-interval '24 hours' AND b.status IN('sending','succeeded','uncertain');
    IF used>=cap THEN
     IF pl#>>'{whatsapp,onLimit}'='overflow_to_call' THEN
      SELECT min(o.i-1) INTO idx FROM jsonb_array_elements(c->'definition'->'steps') WITH ORDINALITY o(s,i) WHERE o.i-1>r.cursor AND o.s->>'type'='call';
      RETURN jsonb_build_object('skipTo',coalesce(idx,r.cursor+1),'reason',CASE WHEN idx IS NULL THEN 'whatsapp_limit_skip' ELSE 'whatsapp_limit_overflow_call' END);
     ELSIF pl#>>'{whatsapp,onLimit}'='skip_step' THEN
      RETURN jsonb_build_object('skipTo',r.cursor+1,'reason','whatsapp_limit_skip');
     END IF;
     RETURN jsonb_build_object('deferUntil',oldest_at+interval '24 hours','reason','daily_whatsapp_limit');
    END IF;
    gap:=(pl#>>'{whatsapp,minIntervalSeconds}')::integer+abs(hashtext(r.id::text||p_step::text))%greatest(1,(pl#>>'{whatsapp,maxIntervalSeconds}')::integer-(pl#>>'{whatsapp,minIntervalSeconds}')::integer+1);
    IF last_at IS NOT NULL AND last_at+make_interval(secs=>gap)>now() THEN RETURN jsonb_build_object('deferUntil',last_at+make_interval(secs=>gap),'reason','whatsapp_random_pacing');END IF;
   END IF;
  ELSE
   min_seconds:=greatest(1,least(coalesce((c->'definition'->'settings'->>'minimumIntervalSeconds')::integer,60),3600));
   max_daily:=greatest(1,least(coalesce((c->'definition'->'settings'->>'dailyLimit')::integer,100),1000));
   SELECT max(b.created_at),min(b.created_at),count(*) INTO last_at,oldest_at,used FROM public.prospecting_sequence_effects b WHERE b.workspace_id=r.workspace_id AND b.account_id=account.id AND b.kind IN('email','whatsapp','call') AND b.created_at>now()-interval '24 hours' AND b.status IN('sending','succeeded','uncertain');
   IF used>=max_daily THEN RETURN jsonb_build_object('deferUntil',oldest_at+interval '24 hours','reason','daily_account_limit');END IF;
   IF last_at IS NOT NULL AND last_at+make_interval(secs=>min_seconds)>now() THEN RETURN jsonb_build_object('deferUntil',last_at+make_interval(secs=>min_seconds),'reason','account_pacing');END IF;
  END IF;
 END IF;
 INSERT INTO public.prospecting_sequence_effects(workspace_id,run_id,step_id,kind,status,target,account_id,sender) VALUES(r.workspace_id,r.id,p_step,kind,'sending',(c->'source')||CASE WHEN p_prepared->'source' IS NOT DISTINCT FROM c->'source' THEN jsonb_build_object('canonical_email',p_prepared->'email','canonical_phones',p_prepared->'phones','canonical_whatsapp',p_prepared->'whatsapp') ELSE '{}'::jsonb END,account.id,jsonb_build_object('sourceKey',account.source_key)) ON CONFLICT(run_id,step_id) DO UPDATE SET status='sending',token=gen_random_uuid(),target=excluded.target,account_id=excluded.account_id,sender=excluded.sender,created_at=now(),finished_at=NULL,error_code=NULL WHERE prospecting_sequence_effects.status='failed' AND prospecting_sequence_effects.provider_id IS NULL AND prospecting_sequence_effects.provider_receipt IS NULL RETURNING * INTO e;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Efeito já reservado; concilie o resultado antes de tentar novamente.' USING ERRCODE='40001';END IF;
 RETURN jsonb_build_object('id',e.id,'token',e.token,'sourceKey',account.source_key,'source',c->'source');
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_recent_whatsapp_phones(p_workspace uuid,p_phones text[],p_days integer)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(array_agg(DISTINCT cv.contact_phone),'{}') FROM public.whatsapp_messages m JOIN public.whatsapp_conversations cv ON cv.id=m.conversation_id
 WHERE auth.role()='service_role' AND m.workspace_id=p_workspace AND cv.workspace_id=p_workspace AND m.direction='outbound'
   AND m.created_at>now()-make_interval(days=>greatest(0,least(coalesce(p_days,0),90))) AND cv.contact_phone=ANY(p_phones)
$$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_recent_whatsapp_phones(uuid,text[],integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_recent_whatsapp_phones(uuid,text[],integer) TO service_role;