ALTER TABLE public.prospecting_sequence_cohort_people DROP CONSTRAINT prospecting_sequence_cohort_people_block_reason_check;
ALTER TABLE public.prospecting_sequence_cohort_people ADD CONSTRAINT prospecting_sequence_cohort_people_block_reason_check CHECK(block_reason IN('opt_out','customer','open_deal','duplicate','other_sequence','missing_channel','delivery_uncertain'));
CREATE FUNCTION public.prospecting_sequence_unknown_keys(p_workspace uuid,p_keys text[])
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH RECURSIVE unresolved AS(
  SELECT p.id,p.cohort_id,p.identity_keys||ARRAY(
   SELECT encode(sha256(convert_to(k,'UTF8')),'hex') FROM(
    SELECT 'email:'||lower(nullif(btrim(e.target->>'canonical_email'),'')) k
    UNION ALL SELECT 'email:'||lower(e.target->>'email') WHERE NOT(e.target?'canonical_email') AND e.target->>'email'~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    UNION ALL SELECT 'phone:'||nullif(e.target->>'canonical_whatsapp','')
    UNION ALL SELECT 'phone:'||ph FROM jsonb_array_elements_text(coalesce(e.target->'canonical_phones',e.target->'phones','[]')) ph WHERE ph~'^\+[1-9][0-9]{7,14}$') h WHERE k IS NOT NULL) AS identity_keys
  FROM public.prospecting_sequence_cohort_people p JOIN public.prospecting_sequence_runs r ON r.cohort_person_id=p.id AND r.workspace_id=p.workspace_id
  JOIN public.prospecting_sequence_effects e ON e.run_id=r.id AND e.workspace_id=p_workspace AND e.kind IN('email','whatsapp')
  WHERE p.workspace_id=p_workspace AND(e.projection_state='pending' OR e.provider_id IS NULL AND(e.status='uncertain' OR e.status='sending' AND(r.state<>'active' OR r.lease_until IS NULL OR r.lease_until<=now())))
  UNION
  SELECT p.id,p.cohort_id,p.identity_keys FROM public.prospecting_sequence_cohort_people p JOIN unresolved u ON u.cohort_id=p.cohort_id AND p.identity_keys&&u.identity_keys WHERE p.workspace_id=p_workspace AND p.block_reason='duplicate')
 SELECT coalesce(array_agg(DISTINCT k),'{}'::text[]) FROM unresolved u CROSS JOIN LATERAL unnest(u.identity_keys) k WHERE k=ANY(p_keys);
$$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_unknown_keys(uuid,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_unknown_keys(uuid,text[]) TO service_role;

-- Manual activities block the cadence until completed; sending is never inferred from task creation.
ALTER TABLE public.prospecting_sequence_runs DROP CONSTRAINT prospecting_sequence_runs_state_check;
ALTER TABLE public.prospecting_sequence_runs ADD CONSTRAINT prospecting_sequence_runs_state_check CHECK(state IN('active','waiting_task','paused','cancelled','completed','human','agent','blocked','uncertain'));
CREATE INDEX sequence_runs_waiting_task ON public.prospecting_sequence_runs(updated_at) WHERE state='waiting_task';
CREATE INDEX sequence_effects_account_budget ON public.prospecting_sequence_effects(workspace_id,account_id,created_at DESC) WHERE kind IN('email','whatsapp') AND status IN('sending','succeeded','uncertain');
CREATE INDEX sequence_effects_projection_pending ON public.prospecting_sequence_effects(created_at) WHERE projection_state='pending';

ALTER TABLE public.prospecting_sequence_runs ADD COLUMN task_completed_at timestamptz;
CREATE INDEX sequence_runs_task_ready ON public.prospecting_sequence_runs(task_completed_at,id) WHERE state='waiting_task' AND task_completed_at IS NOT NULL;
CREATE FUNCTION public.prospecting_sequence_activity_signal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.completed IS NOT DISTINCT FROM OLD.completed THEN RETURN NEW;END IF;
 UPDATE public.prospecting_sequence_runs r SET task_completed_at=CASE WHEN NEW.completed THEN coalesce(NEW.outcome_set_at,NEW.updated_at,now()) ELSE NULL END
 WHERE r.workspace_id=NEW.workspace_id AND r.state IN('waiting_task','paused') AND EXISTS(
  SELECT 1 FROM public.prospecting_sequence_effects e JOIN public.prospecting_sequence_cohort_people p ON p.id=r.cohort_person_id JOIN public.prospecting_sequence_versions v ON v.id=r.version_id
  WHERE e.run_id=r.id AND e.id=NEW.id AND e.kind IN('call','task') AND e.status='succeeded' AND e.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id'
  AND CASE p.entity WHEN 'contact' THEN NEW.related_contact_id=p.source_id ELSE NEW.related_lead_id=p.source_id END);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_activity_signal() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sequence_activity_signal AFTER UPDATE OF completed ON public.activities FOR EACH ROW EXECUTE FUNCTION public.prospecting_sequence_activity_signal();
UPDATE public.prospecting_sequence_runs r SET task_completed_at=(SELECT coalesce(a.outcome_set_at,a.updated_at,now()) FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.kind IN('call','task') AND e.status='succeeded' AND a.completed AND e.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id') WHERE r.state IN('waiting_task','paused');

ALTER TABLE public.prospecting_sequence_runs ADD COLUMN step_entered_at timestamptz NOT NULL DEFAULT now();
UPDATE public.prospecting_sequence_runs SET step_entered_at=coalesce(previous_at,created_at);

CREATE FUNCTION public.prospecting_sequence_wake_tasks(p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;n integer:=0;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 FOR r IN SELECT rr.* FROM public.prospecting_sequence_runs rr WHERE rr.state='waiting_task' AND rr.task_completed_at IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id AND a.workspace_id=rr.workspace_id
  WHERE e.run_id=rr.id AND e.kind IN('call','task') AND e.status='succeeded' AND a.completed
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

CREATE FUNCTION public.prospecting_sequence_complete_call(p_workspace uuid,p_run uuid,p_outcome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;a public.activities;ctx jsonb;BEGIN
 ctx:=public.sales_access_context();
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND workspace_id=p_workspace;
 IF r.id IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR coalesce((ctx->>'read_only')::boolean,false) OR p_outcome IS NULL OR p_outcome NOT IN('answered','no_answer')
 OR NOT public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),r.owner_id,'manage') THEN RAISE EXCEPTION 'Resultado sem autorização atual.' USING ERRCODE='42501';END IF;
 SELECT ee.* INTO e FROM public.prospecting_sequence_effects ee JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE ee.run_id=r.id AND ee.kind='call' AND ee.status='succeeded' AND ee.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id';
 SELECT * INTO a FROM public.activities WHERE id=e.id AND workspace_id=p_workspace AND deleted_at IS NULL FOR UPDATE;
 IF a.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_cohort_people p WHERE p.id=r.cohort_person_id AND CASE p.entity WHEN 'contact' THEN a.related_contact_id=p.source_id ELSE a.related_lead_id=p.source_id END) OR NOT public.sales_context_access(ctx,p_workspace,'techsales.activities','view',ARRAY[coalesce(a.assigned_to,a.owner_id)]) OR NOT public.sales_context_access(ctx,p_workspace,'techsales.activities','update',ARRAY[coalesce(a.assigned_to,a.owner_id)]) THEN RAISE EXCEPTION 'Atividade sem autorização atual.' USING ERRCODE='42501';END IF;
 UPDATE public.activities SET completed=true,outcome=p_outcome,outcome_set_at=now() WHERE id=a.id;
 RETURN a.id;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_complete_call(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_complete_call(uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.prospecting_sequence_release_claims(p_claims jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_claims)<>'array' OR jsonb_array_length(p_claims)>100 THEN RAISE EXCEPTION 'Lote inválido.';END IF;
 UPDATE public.prospecting_sequence_runs r SET lease_token=NULL,lease_until=NULL WHERE r.state='active'
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_claims) c WHERE c->>'id'=r.id::text AND c->>'token'=r.lease_token::text)
 AND NOT EXISTS(SELECT 1 FROM public.prospecting_sequence_effects e WHERE e.run_id=r.id AND e.status IN('sending','uncertain'));
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_release_claims(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_release_claims(jsonb) TO service_role;

CREATE FUNCTION public.prospecting_sequence_projection_repair(p_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;fixed integer:=0;failed integer:=0;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 FOR e IN SELECT * FROM public.prospecting_sequence_effects WHERE projection_state='pending' AND provider_receipt IS NOT NULL ORDER BY created_at LIMIT greatest(1,least(coalesce(p_limit,10),50)) LOOP
  PERFORM 1 FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN CONTINUE;END IF;
  SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=e.id AND projection_state='pending';
  IF NOT FOUND THEN CONTINUE;END IF;
  BEGIN
   PERFORM public.prospecting_sequence_delivery_commit(e.id,e.token,e.provider_receipt);fixed:=fixed+1;
  EXCEPTION WHEN OTHERS THEN failed:=failed+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('fixed',fixed,'failed',failed);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_projection_repair(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_projection_repair(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.prospecting_sequence_task_effect(p_effect uuid,p_token uuid,p_lease uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;c jsonb;r public.prospecting_sequence_runs;step jsonb;target uuid;activity uuid;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND status='sending' AND kind IN('call','task') FOR UPDATE;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 c:=public.prospecting_sequence_context(e.run_id,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 step:=c->'definition'->'steps'->r.cursor;target:=(step->>'assigneeId')::uuid;
 IF step->>'id' IS DISTINCT FROM e.step_id::text OR (step->>'type'='call' AND step->>'mode'<>'human') OR NOT public.sales_context_access(public.work_subject_context(r.workspace_id,r.owner_id),r.workspace_id,'techsales.activities','create',ARRAY[r.owner_id])
 OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=r.workspace_id AND user_id=target AND status='active') THEN RAISE EXCEPTION 'Tarefa sem autorização atual.' USING ERRCODE='42501';END IF;
 IF target<>r.owner_id AND NOT public.sales_context_access(public.work_subject_context(r.workspace_id,r.owner_id),r.workspace_id,'techsales.activities','assign',ARRAY[r.owner_id]) THEN RAISE EXCEPTION 'Sem permissão para atribuir a outra pessoa.' USING ERRCODE='42501';END IF;
 INSERT INTO public.activities(id,workspace_id,owner_id,assigned_to,type,subject,body,due_date,related_contact_id,related_lead_id,external_ids)
 VALUES(e.id,r.workspace_id,r.owner_id,target,CASE WHEN e.kind='call' THEN 'call'::public.activity_type ELSE 'task'::public.activity_type END,left(step->>'title',255),coalesce(step->>'notes','')||CASE WHEN e.kind='call' THEN E'\nTentativas planejadas: '||coalesce(step->>'attempts','1')||'. Conclua a tarefa após registrar o resultado.' ELSE '' END,((now() AT TIME ZONE (c->'definition'->'settings'->>'timezone'))+make_interval(days=>coalesce((step->>'dueDays')::integer,0))) AT TIME ZONE (c->'definition'->'settings'->>'timezone'),
 CASE WHEN c->'person'->>'entity'='contact' THEN (c->'person'->>'id')::uuid END,CASE WHEN c->'person'->>'entity'='lead' THEN (c->'person'->>'id')::uuid END,jsonb_build_object('prospecting_sequence_effect',e.id)) RETURNING id INTO activity;
 IF NOT public.prospecting_sequence_effect_finish(e.id,e.token,activity::text,NULL) THEN RAISE EXCEPTION 'Resultado da tarefa não gravado.';END IF;
 UPDATE public.prospecting_sequence_runs SET state='waiting_task',reason='waiting_for_activity',task_completed_at=NULL,updated_at=now() WHERE id=r.id AND state='active';
 RETURN activity;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_task_effect(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_task_effect(uuid,uuid,uuid) TO service_role;

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
 UPDATE public.prospecting_sequence_runs SET state=new_state,reason='manual_'||p_action,step_entered_at=CASE WHEN p_action='resume' THEN coalesce((SELECT coalesce(a.outcome_set_at,a.updated_at,now()) FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.kind IN('call','task') AND e.status='succeeded' AND a.completed AND e.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id'),step_entered_at) ELSE step_entered_at END,previous_at=CASE WHEN p_action='resume' THEN coalesce((SELECT coalesce(a.outcome_set_at,a.updated_at,now()) FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id JOIN public.prospecting_sequence_versions v ON v.id=r.version_id WHERE e.run_id=r.id AND e.kind IN('call','task') AND e.status='succeeded' AND a.completed AND e.step_id::text=v.definition->'steps'->(r.cursor-1)->>'id'),previous_at) ELSE previous_at END,updated_at=now() WHERE id=r.id;
 INSERT INTO public.prospecting_sequence_run_events(workspace_id,run_id,kind,reason) VALUES(p_workspace,r.id,new_state,'manual_'||p_action);
 RETURN new_state;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_control(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_control(uuid,uuid,text) TO authenticated;



DROP FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid);
CREATE FUNCTION public.prospecting_sequence_effect_begin(p_run uuid,p_lease uuid,p_step uuid,p_prepared jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.prospecting_sequence_runs;e public.prospecting_sequence_effects;step jsonb;ctx jsonb;account public.service_channel_accounts;kind text;last_at timestamptz;oldest_at timestamptz;used integer;min_seconds integer;max_daily integer;BEGIN
 c:=public.prospecting_sequence_context(p_run,p_lease);
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run FOR UPDATE;
 IF r.state<>'active' OR r.lease_token IS DISTINCT FROM p_lease OR r.lease_until<=now() THEN RAISE EXCEPTION 'Lease inválido.' USING ERRCODE='40001';END IF;
 step:=c->'definition'->'steps'->r.cursor;kind:=step->>'type';
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
 ELSE
  IF NOT public.sales_context_access(ctx,r.workspace_id,'techsales.activities','create',ARRAY[r.owner_id]) OR NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=r.workspace_id AND user_id=(step->>'assigneeId')::uuid AND status='active') THEN RAISE EXCEPTION 'Tarefa sem autorização atual.' USING ERRCODE='42501';END IF;
 END IF;
 IF kind IN('email','whatsapp') THEN
  IF cardinality(public.prospecting_sequence_unknown_keys(r.workspace_id,(SELECT identity_keys FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id)))>0 THEN RETURN jsonb_build_object('blockReason','delivery_uncertain');END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(r.workspace_id::text||':'||account.id::text,297));
  min_seconds:=greatest(1,least(coalesce((c->'definition'->'settings'->>'minimumIntervalSeconds')::integer,60),3600));
  max_daily:=greatest(1,least(coalesce((c->'definition'->'settings'->>'dailyLimit')::integer,100),1000));
  SELECT max(b.created_at),min(b.created_at),count(*) INTO last_at,oldest_at,used FROM public.prospecting_sequence_effects b WHERE b.workspace_id=r.workspace_id AND b.account_id=account.id AND b.kind IN('email','whatsapp') AND b.created_at>now()-interval '24 hours' AND b.status IN('sending','succeeded','uncertain');
  IF used>=max_daily THEN RETURN jsonb_build_object('deferUntil',oldest_at+interval '24 hours','reason','daily_account_limit');END IF;
  IF last_at IS NOT NULL AND last_at+make_interval(secs=>min_seconds)>now() THEN RETURN jsonb_build_object('deferUntil',last_at+make_interval(secs=>min_seconds),'reason','account_pacing');END IF;
 END IF;
 INSERT INTO public.prospecting_sequence_effects(workspace_id,run_id,step_id,kind,status,target,account_id,sender) VALUES(r.workspace_id,r.id,p_step,kind,'sending',(c->'source')||CASE WHEN p_prepared->'source' IS NOT DISTINCT FROM c->'source' THEN jsonb_build_object('canonical_email',p_prepared->'email','canonical_phones',p_prepared->'phones','canonical_whatsapp',p_prepared->'whatsapp') ELSE '{}'::jsonb END,account.id,jsonb_build_object('sourceKey',account.source_key)) ON CONFLICT(run_id,step_id) DO UPDATE SET status='sending',token=gen_random_uuid(),target=excluded.target,account_id=excluded.account_id,sender=excluded.sender,created_at=now(),finished_at=NULL,error_code=NULL WHERE prospecting_sequence_effects.status='failed' AND prospecting_sequence_effects.provider_id IS NULL AND prospecting_sequence_effects.provider_receipt IS NULL RETURNING * INTO e;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Efeito já reservado; concilie o resultado antes de tentar novamente.' USING ERRCODE='40001';END IF;
 RETURN jsonb_build_object('id',e.id,'token',e.token,'sourceKey',account.source_key,'source',c->'source');
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_effect_begin(uuid,uuid,uuid,jsonb) TO service_role;



CREATE OR REPLACE FUNCTION public.prospecting_sequence_context(p_run uuid,p_lease uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;v public.prospecting_sequence_versions;
 sources jsonb;s jsonb;signals jsonb;email_reply boolean;wa_reply boolean;last_kind text;call_result text;previous_contact uuid;BEGIN
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
 SELECT a.outcome INTO call_result FROM public.prospecting_sequence_effects e JOIN public.activities a ON a.id=e.id WHERE e.run_id=r.id AND e.kind='call' AND e.status='succeeded' AND a.workspace_id=r.workspace_id AND a.completed ORDER BY e.created_at DESC,e.id DESC LIMIT 1;
 SELECT (x.value->>'id')::uuid INTO previous_contact FROM jsonb_array_elements(v.definition->'steps') WITH ORDINALITY x WHERE x.ordinality<=r.cursor AND x.value->>'type' IN('email','whatsapp','call') ORDER BY x.ordinality DESC LIMIT 1;
 signals:=jsonb_build_object('previousContactExists',EXISTS(SELECT 1 FROM public.prospecting_sequence_effects WHERE run_id=r.id AND step_id=previous_contact AND status='succeeded'),'replied',email_reply OR wa_reply,'previousReplied',CASE last_kind WHEN 'email' THEN email_reply WHEN 'whatsapp' THEN wa_reply ELSE false END,
 'meetingBooked',EXISTS(SELECT 1 FROM public.meetings m WHERE m.workspace_id=r.workspace_id AND m.created_at>=r.created_at AND m.status NOT IN('cancelled','canceled') AND CASE p.entity WHEN 'contact' THEN m.related_contact_id=p.source_id ELSE m.related_lead_id=p.source_id END),
 'callAnswered',coalesce(call_result='answered',false),'callResultKnown',coalesce(call_result IN('answered','no_answer'),false),
 'optedOut',EXISTS(SELECT 1 FROM public.email_unsubscribes u WHERE u.workspace_id=r.workspace_id AND u.reason IS DISTINCT FROM '__token__' AND lower(btrim(u.email))=lower(btrim(s->>'email')))
 OR EXISTS(SELECT 1 FROM public.sdr_enrollments e WHERE e.workspace_id=r.workspace_id AND e.opted_out_at IS NOT NULL AND (to_jsonb(e)->>'contact_id'=p.source_id::text OR to_jsonb(e)->>'lead_id'=p.source_id::text OR regexp_replace(e.contact_phone,'\D','','g') IN(SELECT regexp_replace(phone,'\D','','g') FROM jsonb_array_elements_text(s->'phones') phone))));
 RETURN jsonb_build_object('run',to_jsonb(r),'person',jsonb_build_object('entity',p.entity,'id',p.source_id),'definition',v.definition,'source',s,'signals',signals);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_context(uuid,uuid) TO service_role;



CREATE OR REPLACE FUNCTION public.prospecting_sequence_effect_finish(p_effect uuid,p_token uuid,p_provider text,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token;
 IF e.id IS NULL THEN RETURN false;END IF;
 PERFORM 1 FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND status IN('sending','uncertain') FOR UPDATE;
 IF e.id IS NULL THEN RETURN false;END IF;
 IF p_provider IS NULL AND p_error IS NULL THEN RAISE EXCEPTION 'Resultado ausente.';END IF;
 UPDATE public.prospecting_sequence_effects SET status=CASE WHEN p_provider IS NOT NULL THEN 'succeeded' ELSE 'uncertain' END,provider_id=left(p_provider,512),error_code=left(p_error,100),finished_at=now() WHERE id=e.id;
 -- A manual pause/cancel stops the cursor, but must not discard a provider receipt.
 UPDATE public.prospecting_sequence_runs SET cursor=cursor+CASE WHEN p_provider IS NOT NULL THEN 1 ELSE 0 END,step_entered_at=CASE WHEN p_provider IS NOT NULL THEN now() ELSE step_entered_at END,
 state=CASE WHEN p_provider IS NULL THEN 'uncertain' ELSE state END,reason=CASE WHEN p_provider IS NULL THEN 'provider_result_unknown' ELSE 'effect_succeeded' END,
 previous_at=CASE WHEN p_provider IS NOT NULL THEN now() ELSE previous_at END,next_run_at=now(),lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE id=e.run_id AND state='active' AND cursor=(SELECT ordinality-1 FROM public.prospecting_sequence_versions v CROSS JOIN LATERAL jsonb_array_elements(v.definition->'steps') WITH ORDINALITY s WHERE v.id=prospecting_sequence_runs.version_id AND s.value->>'id'=e.step_id::text);
 INSERT INTO public.prospecting_sequence_run_events(workspace_id,run_id,kind,reason) VALUES(e.workspace_id,e.run_id,CASE WHEN p_provider IS NULL THEN 'uncertain' ELSE 'effect_succeeded' END,e.kind);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_effect_finish(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_effect_finish(uuid,uuid,text,text) TO service_role;


CREATE OR REPLACE FUNCTION public.prospecting_sequence_receipt_store(p_effect uuid,p_token uuid,p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;provider text;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token;
 IF e.id IS NULL THEN RAISE EXCEPTION 'Reserva indisponível.' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND kind IN('email','whatsapp') FOR UPDATE;
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


CREATE OR REPLACE FUNCTION public.prospecting_sequence_delivery_commit(p_effect uuid,p_token uuid,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;r public.prospecting_sequence_runs;p public.prospecting_sequence_cohort_people;
 step jsonb;a public.service_channel_accounts;account uuid;thread uuid;message uuid;provider text;old_workspace uuid;BEGIN
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
 provider:=nullif(p_payload->>'messageId','');
 IF provider IS NULL OR length(provider)>512 THEN RAISE EXCEPTION 'Identificador de envio ausente.';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=e.run_id;
 SELECT * INTO p FROM public.prospecting_sequence_cohort_people WHERE id=r.cohort_person_id AND workspace_id=r.workspace_id;
 SELECT s INTO step FROM public.prospecting_sequence_versions v CROSS JOIN LATERAL jsonb_array_elements(v.definition->'steps') s WHERE v.id=r.version_id AND s->>'id'=e.step_id::text;
 a.id:=e.account_id;a.source_key:=e.sender->>'sourceKey';a.channel:=e.kind;
 IF a.id IS NULL OR a.source_key IS NULL OR step IS NULL OR p.id IS NULL THEN RAISE EXCEPTION 'Origem do recibo indisponível.';END IF;
 IF e.kind='email' THEN
  account:=a.source_key::uuid;
  IF nullif(p_payload->>'threadId','') IS NULL OR nullif(p_payload->>'to','') IS NULL THEN RAISE EXCEPTION 'Recibo de e-mail incompleto.';END IF;
  INSERT INTO public.email_threads(workspace_id,owner_id,assigned_to,account_id,provider_thread_id,subject,snippet,last_message_at,contact_id,lead_id,identity_status)
  VALUES(r.workspace_id,r.owner_id,r.owner_id,account,p_payload->>'threadId',p_payload->>'subject',left(p_payload->>'body',200),e.finished_at,CASE WHEN p.entity='contact' THEN p.source_id END,CASE WHEN p.entity='lead' THEN p.source_id END,'matched')
  ON CONFLICT(account_id,provider_thread_id) DO UPDATE SET last_message_at=greatest(email_threads.last_message_at,excluded.last_message_at) WHERE email_threads.workspace_id=r.workspace_id RETURNING id INTO thread;
  IF thread IS NULL THEN RAISE EXCEPTION 'Thread fora do workspace.' USING ERRCODE='42501';END IF;
  INSERT INTO public.email_messages(id,workspace_id,owner_id,account_id,thread_id,provider_message_id,direction,from_email,to_emails,subject,body_text,message_id_header,in_reply_to,sent_at)
  VALUES(e.id,r.workspace_id,r.owner_id,account,thread,provider,'outbound',p_payload->>'from',ARRAY[p_payload->>'to'],p_payload->>'subject',p_payload->>'body',p_payload->>'messageIdHeader',p_payload->>'inReplyTo',e.finished_at)
  ON CONFLICT(account_id,provider_message_id) DO NOTHING RETURNING id INTO message;
  IF message IS NULL THEN SELECT id INTO message FROM public.email_messages WHERE workspace_id=r.workspace_id AND account_id=account AND provider_message_id=provider;END IF;
 ELSE
  IF nullif(p_payload->>'from','') IS NULL OR nullif(p_payload->>'to','') IS NULL THEN RAISE EXCEPTION 'Recibo de WhatsApp incompleto.';END IF;
  SELECT id,workspace_id INTO thread,old_workspace FROM public.whatsapp_conversations WHERE contact_phone=p_payload->>'to' AND twilio_number=p_payload->>'from' FOR UPDATE;
  IF thread IS NOT NULL AND old_workspace<>r.workspace_id THEN RAISE EXCEPTION 'Conversa fora do workspace.' USING ERRCODE='42501';END IF;
  IF thread IS NULL THEN
   INSERT INTO public.whatsapp_conversations(workspace_id,owner_id,assigned_to,contact_id,lead_id,contact_phone,twilio_number,provider,wa_phone_number_id,conversation_origin,last_message_at,last_message_preview,origin_template_name,origin_wa_message_id,identity_status)
   VALUES(r.workspace_id,r.owner_id,r.owner_id,CASE WHEN p.entity='contact' THEN p.source_id END,CASE WHEN p.entity='lead' THEN p.source_id END,p_payload->>'to',p_payload->>'from','meta',a.source_key,'campaign',e.finished_at,left(p_payload->>'body',200),step->>'templateName',provider,'matched') RETURNING id INTO thread;
  ELSE
   UPDATE public.whatsapp_conversations SET last_message_at=greatest(last_message_at,e.finished_at),last_message_preview=CASE WHEN last_message_at IS NULL OR last_message_at<=e.finished_at THEN left(p_payload->>'body',200) ELSE last_message_preview END,conversation_origin=CASE WHEN last_message_at IS NULL OR last_message_at<=e.finished_at THEN 'campaign' ELSE conversation_origin END,origin_template_name=CASE WHEN last_message_at IS NULL OR last_message_at<=e.finished_at THEN step->>'templateName' ELSE origin_template_name END,origin_wa_message_id=CASE WHEN last_message_at IS NULL OR last_message_at<=e.finished_at THEN provider ELSE origin_wa_message_id END WHERE id=thread AND workspace_id=r.workspace_id;
  END IF;
  INSERT INTO public.whatsapp_messages(id,workspace_id,owner_id,conversation_id,direction,body,from_number,to_number,provider,wa_message_id,status,is_template,template_name,sent_by,sent_at)
  VALUES(e.id,r.workspace_id,r.owner_id,thread,'outbound',p_payload->>'body',p_payload->>'from',p_payload->>'to','meta',provider,'sent',true,step->>'templateName',r.owner_id,e.finished_at)
  ON CONFLICT(wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING RETURNING id INTO message;
  IF message IS NULL THEN SELECT id INTO message FROM public.whatsapp_messages WHERE workspace_id=r.workspace_id AND wa_message_id=provider;END IF;
 END IF;
 IF message IS NULL THEN RAISE EXCEPTION 'Mensagem não registrada no workspace.';END IF;
 UPDATE public.prospecting_sequence_effects SET projection_state='complete' WHERE id=e.id;
 UPDATE public.prospecting_sequence_runs SET state='active',reason='inbox_projection_complete',updated_at=now() WHERE id=r.id AND state='paused' AND reason='receipt_projection_pending';
 RETURN message;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_delivery_commit(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_delivery_commit(uuid,uuid,jsonb) TO service_role;


CREATE OR REPLACE FUNCTION public.prospecting_sequence_transition(p_run uuid,p_lease uuid,p_state text,p_cursor integer,p_due timestamptz,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.prospecting_sequence_runs;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.prospecting_sequence_runs WHERE id=p_run AND state='active' AND lease_token=p_lease AND lease_until>now() FOR UPDATE;
 IF r.id IS NULL THEN RETURN false;END IF;
 IF p_state NOT IN('active','completed','human','agent','blocked','uncertain') OR p_cursor<r.cursor OR p_cursor>r.cursor+1 OR p_due IS NULL OR length(p_reason)>200 THEN RAISE EXCEPTION 'Transição inválida.' USING ERRCODE='22023';END IF;
 UPDATE public.prospecting_sequence_runs SET state=p_state,cursor=p_cursor,next_run_at=p_due,step_entered_at=CASE WHEN p_cursor>r.cursor THEN greatest(now(),p_due) ELSE step_entered_at END,reason=p_reason,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=r.id;
 INSERT INTO public.prospecting_sequence_run_events(workspace_id,run_id,kind,reason) VALUES(r.workspace_id,r.id,p_state,p_reason);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_transition(uuid,uuid,text,integer,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_transition(uuid,uuid,text,integer,timestamptz,text) TO service_role;


CREATE OR REPLACE FUNCTION public.prospecting_sequence_runtime_allowed(p_workspace uuid,p_actor uuid,p_owner uuid,p_action text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p_action IN('view','manage','assign') AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=p_workspace AND m.user_id=p_actor AND m.is_test_user)
 AND public.sales_context_access(public.work_subject_context(p_workspace,p_actor),p_workspace,'system.automation.sequences','view',ARRAY[p_owner])
 AND public.sales_context_access(public.work_subject_context(p_workspace,p_actor),p_workspace,'system.automation.sequences',p_action,ARRAY[p_owner]);
$$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_runtime_allowed(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.prospecting_sequence_cohort_prepare(p_workspace uuid,p_actor uuid,p_version uuid,p_request uuid,p_consent text,p_candidates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE visible_sources jsonb;unknown_keys text[];visible_row jsonb;ctx jsonb;v public.prospecting_sequence_versions;r public.prospecting_sequence_cohorts;x jsonb;j jsonb;
 query_keys text[];ids uuid[];contacts_ids uuid[];companies_ids uuid[];leads_ids uuid[];canonical uuid;canonical_company uuid;reason text;keys text[];seen jsonb:='{}';others jsonb:='{}';suppressed_records jsonb;suppressed_emails jsonb; suppressed_phones jsonb;flags jsonb;identity_flags jsonb;
 f integer;nheld integer;nblocked integer;out_reasons jsonb;is_customer boolean;is_open boolean;
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
  SELECT array_agg(id) INTO leads_ids FROM public.leads WHERE workspace_id=p_workspace AND deleted_at IS NULL AND (id=ANY(ids)
   OR lower(btrim(email)) IN(SELECT e FROM jsonb_array_elements(p_candidates) candidate CROSS JOIN LATERAL jsonb_array_elements_text(candidate->'email_aliases') e)
   OR EXISTS(SELECT 1 FROM unnest(ARRAY[whatsapp_e164,mobile_phone,phone]) p WHERE regexp_replace(p,'\D','','g') IN(SELECT regexp_replace(n,'\D','','g') FROM jsonb_array_elements(p_candidates) candidate CROSS JOIN LATERAL jsonb_array_elements_text(candidate->'phones') n)));
  SELECT array_agg(id) INTO contacts_ids FROM public.contacts WHERE workspace_id=p_workspace AND deleted_at IS NULL AND (id=ANY(ids) OR id IN(SELECT converted_contact_id FROM public.leads WHERE workspace_id=p_workspace AND id=ANY(leads_ids))
   OR lower(btrim(email)) IN(SELECT e FROM jsonb_array_elements(p_candidates) candidate CROSS JOIN LATERAL jsonb_array_elements_text(candidate->'email_aliases') e)
   OR EXISTS(SELECT 1 FROM unnest(ARRAY[whatsapp_e164,mobile_phone,phone]) p WHERE regexp_replace(p,'\D','','g') IN(SELECT regexp_replace(n,'\D','','g') FROM jsonb_array_elements(p_candidates) candidate CROSS JOIN LATERAL jsonb_array_elements_text(candidate->'phones') n)));
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
   UNION ALL SELECT 'phone:'||p FROM jsonb_array_elements(p_candidates) a CROSS JOIN LATERAL jsonb_array_elements_text(a->'phones') p) hashes;
  unknown_keys:=public.prospecting_sequence_unknown_keys(p_workspace,query_keys);
  SELECT coalesce(jsonb_object_agg(k,true) FILTER(WHERE q.version_id=p_version),'{}'),coalesce(jsonb_object_agg(k,true) FILTER(WHERE q.version_id<>p_version),'{}') INTO seen,others
  FROM public.prospecting_sequence_cohort_people p JOIN public.prospecting_sequence_cohorts q ON q.id=p.cohort_id CROSS JOIN LATERAL unnest(p.identity_keys) k WHERE q.workspace_id=p_workspace AND (p.block_reason IS NULL OR p.block_reason='duplicate') AND p.identity_keys && query_keys;
  FOR x IN SELECT value FROM jsonb_array_elements(p_candidates) LOOP
   IF x->>'entity' NOT IN('lead','contact') OR x->>'entity' IS NULL THEN RAISE EXCEPTION 'Destinatário inválido.' USING ERRCODE='22023';END IF;
   IF x->>'entity'='lead' THEN SELECT to_jsonb(l) INTO j FROM public.leads l WHERE id=(x->>'id')::uuid AND workspace_id=p_workspace AND deleted_at IS NULL;
   ELSE SELECT to_jsonb(c) INTO j FROM public.contacts c WHERE id=(x->>'id')::uuid AND workspace_id=p_workspace AND deleted_at IS NULL;END IF;
   IF j IS NULL OR NOT public.sales_context_access(ctx,p_workspace,CASE WHEN x->>'entity'='lead' THEN 'techsales.leads' ELSE 'techsales.contacts' END,'view',ARRAY[coalesce(nullif(j->>'assigned_to',''),j->>'owner_id')::uuid]) THEN RAISE EXCEPTION 'O acesso ao público mudou. Recalcule a inscrição.' USING ERRCODE='42501';END IF;
   visible_row:=visible_sources->((x->>'entity')||':'||(x->>'id'));
   IF visible_row IS NULL THEN RAISE EXCEPTION 'O acesso ao público mudou. Recalcule a inscrição.' USING ERRCODE='42501';END IF;
   IF coalesce(visible_row->>'email','') IS DISTINCT FROM coalesce(x->>'raw_email','') OR visible_row->'phones' IS DISTINCT FROM x->'raw_phones' THEN RAISE EXCEPTION 'Dados do público alterados. Recalcule a inscrição.' USING ERRCODE='40001';END IF;
   canonical:=CASE WHEN x->>'entity'='contact' THEN (x->>'id')::uuid ELSE nullif(j->>'converted_contact_id','')::uuid END;
   IF canonical IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contacts WHERE id=canonical AND workspace_id=p_workspace AND deleted_at IS NULL) THEN canonical:=NULL;END IF;
   SELECT company_id INTO canonical_company FROM public.contacts WHERE id=canonical AND workspace_id=p_workspace AND deleted_at IS NULL;
   SELECT array_agg(DISTINCT encode(sha256(convert_to(k,'UTF8')),'hex')) INTO keys FROM (
    SELECT 'record:'||(x->>'id') k UNION ALL SELECT 'contact:'||canonical WHERE canonical IS NOT NULL
    UNION ALL SELECT 'email:'||e FROM jsonb_array_elements_text(x->'email_aliases') e
    UNION ALL SELECT 'phone:'||p FROM jsonb_array_elements_text(x->'phones') p) a;
   f:=coalesce((flags->>('company:'||canonical_company))::integer,0) | coalesce((flags->>('company:'||(j->>'company_id')))::integer,0) | coalesce((flags->>((x->>'entity')||':'||(x->>'id')))::integer,0) | coalesce((flags->>('contact:'||canonical))::integer,0);
   SELECT f | coalesce(bit_or((identity_flags->>k)::integer),0) INTO f FROM unnest(keys) k;
   is_customer:=(f & 1)=1;is_open:=(f & 2)=2;
   reason:=NULL;
   IF suppressed_records ? (x->>'id') OR suppressed_records ? coalesce(canonical::text,'') OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(x->'email_aliases') e WHERE suppressed_emails ? e) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(x->'phones') p WHERE suppressed_phones ? regexp_replace(p,'\D','','g')) THEN reason:='opt_out';
   ELSIF coalesce((v.definition#>>'{audience,excludeCustomers}')::boolean,true) AND is_customer THEN reason:='customer';
   ELSIF coalesce((v.definition#>>'{audience,excludeOpenDeals}')::boolean,true) AND is_open THEN reason:='open_deal';
   ELSIF NOT coalesce((x#>>'{channels,email}')::boolean,false) AND NOT coalesce((x#>>'{channels,whatsapp}')::boolean,false) AND NOT coalesce((x#>>'{channels,call}')::boolean,false) THEN reason:='missing_channel';
   ELSIF keys && unknown_keys THEN reason:='delivery_uncertain';
   ELSIF seen ?| keys THEN reason:='duplicate';
   ELSIF coalesce((v.definition#>>'{audience,excludeOtherSequences}')::boolean,true) AND (others ?| keys OR EXISTS(SELECT 1 FROM public.sequence_enrollments e WHERE e.workspace_id=p_workspace AND e.status='active' AND e.entity_id=ANY(ARRAY[(x->>'id')::uuid,canonical])) OR EXISTS(SELECT 1 FROM public.sdr_enrollments e WHERE e.workspace_id=p_workspace AND e.status='active' AND e.opted_out_at IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(x->'phones') p WHERE regexp_replace(e.contact_phone,'\D','','g')=regexp_replace(p,'\D','','g')))) THEN reason:='other_sequence';END IF;
   INSERT INTO public.prospecting_sequence_cohort_people(cohort_id,workspace_id,entity,source_id,channels,identity_keys,block_reason) VALUES(r.id,p_workspace,x->>'entity',(x->>'id')::uuid,x->'channels',keys,reason);
   
   IF reason IS NULL OR reason='duplicate' THEN SELECT seen||coalesce(jsonb_object_agg(k,true),'{}') INTO seen FROM unnest(keys) k;END IF;
  END LOOP;
 END IF;
 SELECT count(*) FILTER(WHERE block_reason IS NULL),count(*) FILTER(WHERE block_reason IS NOT NULL) INTO nheld,nblocked FROM public.prospecting_sequence_cohort_people WHERE cohort_id=r.id;
 SELECT coalesce(jsonb_object_agg(block_reason,n),'{}') INTO out_reasons FROM(SELECT block_reason,count(*) n FROM public.prospecting_sequence_cohort_people WHERE cohort_id=r.id AND block_reason IS NOT NULL GROUP BY block_reason) a;
 RETURN jsonb_build_object('id',r.id,'version_id',r.version_id,'created_at',r.created_at,'requested',r.requested,'held',nheld,'blocked',nblocked,'reasons',out_reasons);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_cohort_prepare(uuid,uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_cohort_prepare(uuid,uuid,uuid,uuid,text,jsonb) TO service_role;


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
  UPDATE public.prospecting_sequence_runs SET lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now() WHERE id=r.id RETURNING * INTO r;
  RETURN NEXT r;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_claim(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_claim(integer) TO service_role;


CREATE FUNCTION public.prospecting_sequence_effect_not_started(p_effect uuid,p_token uuid,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.prospecting_sequence_effects;BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Serviço requerido.' USING ERRCODE='42501';END IF;
 IF p_reason IS NULL OR p_reason NOT IN('source_changed_before_send','sender_changed_before_send') THEN RAISE EXCEPTION 'Motivo inválido.';END IF;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token;
 IF e.id IS NULL THEN RETURN false;END IF;
 PERFORM 1 FROM public.prospecting_sequence_runs WHERE id=e.run_id FOR UPDATE;
 SELECT * INTO e FROM public.prospecting_sequence_effects WHERE id=p_effect AND token=p_token AND status='sending' AND provider_id IS NULL AND provider_receipt IS NULL FOR UPDATE;
 IF e.id IS NULL THEN RETURN false;END IF;
 UPDATE public.prospecting_sequence_effects SET status='failed',error_code=p_reason,finished_at=now() WHERE id=e.id;
 UPDATE public.prospecting_sequence_runs SET state='blocked',reason=p_reason,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=e.run_id AND state='active';
 INSERT INTO public.prospecting_sequence_run_events(workspace_id,run_id,kind,reason) VALUES(e.workspace_id,e.run_id,'not_started',p_reason);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_effect_not_started(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_effect_not_started(uuid,uuid,text) TO service_role;
