-- NOTIFICA-CENTRAL P6. Collective Slack notices reuse the fenced delivery ledger.
-- No existing integration, route, policy or end-user permission is activated.
ALTER TABLE public.slack_integrations ADD COLUMN notification_endpoint_revision integer NOT NULL DEFAULT 1 CHECK(notification_endpoint_revision>0);
CREATE FUNCTION techerp_api.notification_slack_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF TG_OP='INSERT' THEN NEW.notification_endpoint_revision:=1;
 ELSIF ROW(NEW.access_token,NEW.workspace_id,NEW.owner_id,NEW.team_id,NEW.default_channel_id,NEW.team_name,NEW.default_channel_name,NEW.scope)
  IS DISTINCT FROM ROW(OLD.access_token,OLD.workspace_id,OLD.owner_id,OLD.team_id,OLD.default_channel_id,OLD.team_name,OLD.default_channel_name,OLD.scope)
 THEN NEW.notification_endpoint_revision:=OLD.notification_endpoint_revision+1;
 ELSE NEW.notification_endpoint_revision:=OLD.notification_endpoint_revision;END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_slack_revision() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_slack_revision BEFORE INSERT OR UPDATE ON public.slack_integrations FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_slack_revision();
GRANT SELECT(notification_endpoint_revision) ON public.slack_integrations TO authenticated;

CREATE TABLE public.notification_slack_policies(
 workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,daily_limit integer NOT NULL DEFAULT 0 CHECK(daily_limit BETWEEN 0 AND 10000),
 integration_id uuid,template_version text NOT NULL DEFAULT 'neutral-v1' CHECK(template_version='neutral-v1'),
 revision integer NOT NULL CHECK(revision>0),updated_by uuid,updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT enabled OR(integration_id IS NOT NULL AND daily_limit>0))
);
CREATE TABLE public.notification_slack_intents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 workflow_id uuid NOT NULL,run_id uuid NOT NULL,workflow_version integer NOT NULL CHECK(workflow_version>0),step_path text NOT NULL,
 source_table text NOT NULL,source_id uuid NOT NULL,integration_id uuid NOT NULL,
 endpoint_revision integer NOT NULL,endpoint_hash text NOT NULL,policy_revision integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,run_id,workflow_version,step_path,integration_id)
);
-- One in-flight POST per endpoint. Finish releases it only after a one-second
-- gap; a 429 supplies a shared cooldown. Repeated preflight never consumes a slot.
CREATE TABLE public.notification_slack_endpoint_state(
 endpoint_hash text PRIMARY KEY,
 busy_delivery_id uuid,busy_until timestamptz,next_allowed_at timestamptz NOT NULL DEFAULT '-infinity'
);
ALTER TABLE public.notification_slack_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_slack_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_slack_endpoint_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_slack_policies,public.notification_slack_intents,public.notification_slack_endpoint_state FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.workflow_deliveries ADD COLUMN notification_slack_intent_id uuid REFERENCES public.notification_slack_intents(id),
 ADD COLUMN notification_endpoint_revision integer;
ALTER TABLE public.workflow_deliveries DROP CONSTRAINT workflow_deliveries_channel_check;
ALTER TABLE public.workflow_deliveries ADD CONSTRAINT workflow_deliveries_channel_check CHECK(channel IN('email','whatsapp','slack'));
ALTER TABLE public.workflow_deliveries ADD CONSTRAINT notification_delivery_exclusive_subtype CHECK(
 (notification_intent_id IS NULL OR notification_slack_intent_id IS NULL)
 AND((channel='slack')=(notification_slack_intent_id IS NOT NULL)));
CREATE UNIQUE INDEX notification_slack_occurrence_channel ON public.workflow_deliveries(notification_slack_intent_id,channel) WHERE notification_slack_intent_id IS NOT NULL;
CREATE INDEX notification_slack_pending ON public.workflow_deliveries(next_attempt_at,created_at,id) WHERE notification_slack_intent_id IS NOT NULL AND status IN('queued','retry_scheduled','in_flight');

-- This bridge is owned by the existing non-BYPASSRLS subject. It checks every
-- current restrictive integration SELECT policy, plus the equivalent manage key.
CREATE FUNCTION techerp_api.notification_slack_integration_access(p_ws uuid,p_user uuid,p_id uuid,p_manage boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean;c jsonb;BEGIN
 IF p_ws IS NULL OR p_user IS NULL OR p_id IS NULL OR current_setting('app.api_subject',true)='on'
  OR NOT public.is_workspace_member(p_ws,p_user) THEN RETURN false;END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims)
 VALUES(txid_current(),p_user,p_ws,p_id,current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_user::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('app.api_subject','on',true);c:=public.work_access_context();
 SELECT EXISTS(SELECT 1 FROM public.slack_integrations s WHERE s.id=p_id AND s.workspace_id=p_ws
  AND public.sales_context_access(c,s.workspace_id,'system.integrations','view',ARRAY[s.owner_id])
  AND(NOT p_manage OR public.sales_context_access(c,s.workspace_id,'system.integrations','manage',ARRAY[s.owner_id]))) INTO allowed;
 PERFORM techerp_api.leave();RETURN coalesce(allowed,false);
END $$;
ALTER FUNCTION techerp_api.notification_slack_integration_access(uuid,uuid,uuid,boolean) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.notification_slack_integration_access(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.notification_slack_integration_access(uuid,uuid,uuid,boolean) TO postgres;

CREATE FUNCTION public.notification_slack_settings(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_delivery_permission(p_workspace);c jsonb:=public.work_access_context();p public.notification_slack_policies;items jsonb;BEGIN
 IF NOT public.sales_context_access(c,p_workspace,'system.integrations','view',ARRAY[u]) THEN
  RAISE EXCEPTION 'Sem permissão para consultar o canal Slack.' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.notification_slack_policies WHERE workspace_id=p_workspace;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'team_name',s.team_name,'default_channel_name',s.default_channel_name,
 'endpoint_revision',s.notification_endpoint_revision) ORDER BY s.id),'[]'::jsonb) INTO items FROM(SELECT * FROM public.slack_integrations candidate WHERE candidate.workspace_id=p_workspace
 AND techerp_api.notification_slack_integration_access(p_workspace,u,candidate.id) ORDER BY candidate.id LIMIT 100)s;
 RETURN jsonb_build_object('revision',coalesce(p.revision,0),'policy',jsonb_build_object('enabled',coalesce(p.enabled,false),
 'daily_limit',coalesce(p.daily_limit,0),'integration_id',p.integration_id,'template_version',coalesce(p.template_version,'neutral-v1')),'integrations',items);
END $$;
CREATE FUNCTION public.notification_slack_settings_save(p_workspace uuid,p_policy jsonb,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_delivery_permission(p_workspace,true);c jsonb:=public.work_access_context();p public.notification_slack_policies;
 selected uuid;enabled boolean;cap integer;BEGIN
 IF NOT public.sales_context_access(c,p_workspace,'system.integrations','view',ARRAY[u]) OR
 NOT public.sales_context_access(c,p_workspace,'system.integrations','manage',ARRAY[u]) THEN
 RAISE EXCEPTION 'Sem permissão para configurar o canal Slack.' USING ERRCODE='42501';END IF;
 IF p_revision IS NULL OR p_revision<0 OR jsonb_typeof(p_policy) IS DISTINCT FROM 'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_policy)k WHERE k NOT IN('enabled','daily_limit','integration_id','template_version'))
 OR jsonb_typeof(p_policy->'enabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_policy->'daily_limit') IS DISTINCT FROM 'number'
 OR (p_policy->>'daily_limit') !~ '^[0-9]{1,5}$' OR p_policy->>'template_version' IS DISTINCT FROM 'neutral-v1' THEN
 RAISE EXCEPTION 'Política Slack inválida.' USING ERRCODE='22023';END IF;
 BEGIN selected:=nullif(p_policy->>'integration_id','')::uuid;enabled:=(p_policy->>'enabled')::boolean;cap:=(p_policy->>'daily_limit')::integer;
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Política Slack inválida.' USING ERRCODE='22023';END;
 IF cap NOT BETWEEN 0 AND 10000 OR(enabled AND(selected IS NULL OR cap=0)) THEN RAISE EXCEPTION 'Política Slack inválida.' USING ERRCODE='22023';END IF;
 IF selected IS NOT NULL AND NOT techerp_api.notification_slack_integration_access(p_workspace,u,selected,true) THEN
  RAISE EXCEPTION 'Integração Slack indisponível.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('notification-slack-policy:'||p_workspace));
 SELECT * INTO p FROM public.notification_slack_policies WHERE workspace_id=p_workspace FOR UPDATE;
 IF coalesce(p.revision,0)<>p_revision THEN RAISE EXCEPTION 'Configuração alterada. Recarregue antes de salvar.' USING ERRCODE='40001';END IF;
 INSERT INTO public.notification_slack_policies(workspace_id,enabled,daily_limit,integration_id,revision,updated_by)
 VALUES(p_workspace,enabled,cap,selected,p_revision+1,u) ON CONFLICT(workspace_id) DO UPDATE SET enabled=excluded.enabled,
 daily_limit=excluded.daily_limit,integration_id=excluded.integration_id,revision=excluded.revision,updated_by=u,updated_at=now();
 UPDATE public.notification_slack_endpoint_state SET next_allowed_at='-infinity' WHERE next_allowed_at='infinity'
 AND endpoint_hash=(SELECT encode(sha256(convert_to(access_token,'UTF8')),'hex') FROM public.slack_integrations WHERE id=selected AND workspace_id=p_workspace);
 UPDATE public.workflow_deliveries d SET next_attempt_at=now(),updated_at=now() WHERE d.channel='slack'
 AND d.next_attempt_at='infinity' AND d.endpoint_hash=(SELECT encode(sha256(convert_to(access_token,'UTF8')),'hex')
 FROM public.slack_integrations WHERE id=selected AND workspace_id=p_workspace);
 RETURN public.notification_slack_settings(p_workspace);
END $$;

-- Flatten the same 1-based paths used by the existing Workflow engine. Case and
-- branch indexes intentionally share its path convention. The service-only
-- engine selects the branch; SQL proves that a safe Slack action exists at that
-- path in the exact published version. No legacy path/resumption is rewritten.
CREATE FUNCTION techerp_api.notification_slack_actions(p_actions jsonb,p_prefix text DEFAULT '',p_depth integer DEFAULT 0)
RETURNS TABLE(step_path text,action jsonb) LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE node jsonb;part jsonb;idx integer:=0;branch_idx integer;path text;key text;BEGIN
 IF p_depth>24 OR jsonb_typeof(p_actions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_actions)>1000 THEN RETURN;END IF;
 FOR node IN SELECT value FROM jsonb_array_elements(p_actions) LOOP
 idx:=idx+1;path:=CASE WHEN p_prefix='' THEN idx::text ELSE p_prefix||'.'||idx END;
 step_path:=path;action:=node;RETURN NEXT;
 IF jsonb_typeof(node)<>'object' THEN CONTINUE;END IF;
 FOREACH key IN ARRAY ARRAY['then','else','default'] LOOP
 RETURN QUERY SELECT * FROM techerp_api.notification_slack_actions(node->key,path||'.'||key,p_depth+1);END LOOP;
 IF jsonb_typeof(node->'cases')='array' THEN FOR part IN SELECT value FROM jsonb_array_elements(node->'cases') LOOP
 RETURN QUERY SELECT * FROM techerp_api.notification_slack_actions(part->'actions',path||'.case',p_depth+1);END LOOP;END IF;
 IF jsonb_typeof(node->'branches')='array' THEN branch_idx:=0;
 FOR part IN SELECT value FROM jsonb_array_elements(node->'branches') LOOP branch_idx:=branch_idx+1;
 RETURN QUERY SELECT * FROM techerp_api.notification_slack_actions(part->'actions',path||CASE WHEN node->>'type'='parallel' THEN '.p'||branch_idx ELSE '.branch' END,p_depth+1);
 END LOOP;END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_slack_actions(jsonb,text,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_slack_context(p_intent uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_slack_intents;wf public.workflows;r public.workflow_runs;ev public.workflow_events;
 p public.notification_slack_policies;s public.slack_integrations;executor uuid;matches integer;BEGIN
 SELECT * INTO i FROM public.notification_slack_intents WHERE id=p_intent;
 IF i.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=i.workflow_id AND workspace_id=i.workspace_id AND enabled AND status='published'
 AND published_version=i.workflow_version AND entity=i.source_table;
 IF wf.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 SELECT * INTO r FROM public.workflow_runs WHERE id=i.run_id AND workflow_id=wf.id AND workspace_id=i.workspace_id
 AND entity=i.source_table AND entity_id=i.source_id AND owner_id=wf.owner_id AND NOT is_test AND status NOT IN('failed','cancelled','canceled','error');
 SELECT * INTO ev FROM public.workflow_events WHERE id=r.event_id AND workspace_id=i.workspace_id AND entity=i.source_table AND entity_id=i.source_id
 AND(workflow_version IS NULL OR workflow_version=i.workflow_version);
 executor:=coalesce(wf.execution_user_id,wf.owner_id);
 IF r.id IS NULL OR ev.id IS NULL OR NOT public.is_workspace_member(i.workspace_id,executor)
 OR NOT techerp_api.notification_source_visible(i.workspace_id,executor,i.source_table,i.source_id)
 OR NOT public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',i.workflow_version),
 CASE WHEN i.source_table IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities') THEN jsonb_build_object('table',i.source_table,'id',i.source_id,'action','view')
 ELSE jsonb_build_object('record_table',i.source_table,'id',i.source_id) END)) THEN
 RETURN jsonb_build_object('allowed',false,'reason','executor_unavailable');END IF;
 SELECT count(*) INTO matches FROM techerp_api.notification_slack_actions(wf.actions) a WHERE a.step_path=i.step_path
 AND a.action->>'type'='send_slack' AND nullif(btrim(a.action->>'channel'),'') IS NULL;
 IF matches=0 THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 SELECT * INTO p FROM public.notification_slack_policies WHERE workspace_id=i.workspace_id;
 IF p.workspace_id IS NULL OR NOT p.enabled OR p.integration_id IS DISTINCT FROM i.integration_id THEN
 RETURN jsonb_build_object('allowed',false,'reason','policy_disabled');END IF;
 SELECT * INTO s FROM public.slack_integrations WHERE id=i.integration_id AND workspace_id=i.workspace_id;
 IF p.revision IS DISTINCT FROM i.policy_revision OR s.notification_endpoint_revision IS DISTINCT FROM i.endpoint_revision
 OR encode(sha256(convert_to(s.access_token,'UTF8')),'hex') IS DISTINCT FROM i.endpoint_hash THEN
 RETURN jsonb_build_object('allowed',false,'reason','endpoint_changed');END IF;
 IF s.id IS NULL OR nullif(btrim(s.access_token),'') IS NULL OR NOT techerp_api.notification_slack_integration_access(i.workspace_id,executor,s.id,true) THEN
 RETURN jsonb_build_object('allowed',false,'reason','executor_transport_forbidden');END IF;
 RETURN jsonb_build_object('allowed',true,'workspaceId',i.workspace_id,'workflowId',i.workflow_id,'runId',i.run_id,
 'integrationId',s.id,'endpointRevision',s.notification_endpoint_revision,
 'endpointHash',encode(sha256(convert_to(s.access_token,'UTF8')),'hex'),'policyRevision',p.revision,'templateVersion',p.template_version);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_slack_context(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.notification_workflow_slack_dispatch(p_workspace uuid,p_workflow uuid,p_run uuid,p_step_path text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;r public.workflow_runs;p public.notification_slack_policies;s public.slack_integrations;i uuid;created uuid;c jsonb;BEGIN
 PERFORM techerp_api.notification_service();
 IF p_version IS NULL OR p_version<1 OR p_step_path IS NULL OR length(p_step_path) NOT BETWEEN 1 AND 300 OR btrim(p_step_path)='' THEN
 RAISE EXCEPTION 'Etapa Slack inválida.' USING ERRCODE='22023';END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=p_workflow AND workspace_id=p_workspace AND status='published' AND enabled AND published_version=p_version FOR SHARE;
 SELECT * INTO r FROM public.workflow_runs WHERE id=p_run AND workflow_id=p_workflow AND workspace_id=p_workspace
 AND entity=wf.entity AND owner_id=wf.owner_id AND status='running' AND NOT is_test FOR UPDATE;
 IF wf.id IS NULL OR r.id IS NULL THEN RAISE EXCEPTION 'Execução Slack indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.notification_slack_policies WHERE workspace_id=p_workspace;
 IF p.workspace_id IS NULL OR NOT p.enabled OR p.integration_id IS NULL THEN RETURN jsonb_build_object('result','suppressed','reason','policy_disabled');END IF;
 SELECT * INTO s FROM public.slack_integrations WHERE id=p.integration_id AND workspace_id=p_workspace;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Integração Slack indisponível.' USING ERRCODE='42501';END IF;
 INSERT INTO public.notification_slack_intents(workspace_id,workflow_id,run_id,workflow_version,step_path,source_table,source_id,integration_id,endpoint_revision,endpoint_hash,policy_revision)
 VALUES(p_workspace,wf.id,r.id,wf.published_version,p_step_path,r.entity,r.entity_id,p.integration_id,s.notification_endpoint_revision,encode(sha256(convert_to(s.access_token,'UTF8')),'hex'),p.revision)
 ON CONFLICT(workspace_id,run_id,workflow_version,step_path,integration_id) DO NOTHING RETURNING id INTO i;
 IF i IS NULL THEN SELECT id INTO i FROM public.notification_slack_intents WHERE workspace_id=p_workspace AND run_id=r.id
 AND workflow_version=wf.published_version AND step_path=p_step_path AND integration_id=p.integration_id;END IF;
 c:=techerp_api.notification_slack_context(i);
 IF NOT coalesce((c->>'allowed')::boolean,false) THEN RAISE EXCEPTION 'Canal ou origem Slack indisponível: %.',c->>'reason' USING ERRCODE='42501';END IF;
 INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,status,attempts,notification_slack_intent_id)
 VALUES(p_workspace,wf.id,'notification-slack:'||p_workspace||':'||r.id||':'||wf.published_version||':'||p_step_path||':'||p.integration_id,p_step_path,'slack','queued',0,i)
 ON CONFLICT(notification_slack_intent_id,channel) WHERE notification_slack_intent_id IS NOT NULL DO NOTHING RETURNING id INTO created;
 RETURN jsonb_build_object('result',CASE WHEN created IS NULL THEN 'duplicate' ELSE 'queued' END,'deliveryId',coalesce(created,(SELECT id FROM public.workflow_deliveries WHERE notification_slack_intent_id=i AND channel='slack')));
END $$;

-- Existing worker entry points keep their exact public signatures. Their P4
-- implementations are private compatibility functions, not alternate RPCs.
ALTER FUNCTION public.notification_worker_list(integer) RENAME TO notification_worker_list_personal_v1;
ALTER FUNCTION public.notification_delivery_claim(uuid) RENAME TO notification_delivery_claim_personal_v1;
ALTER FUNCTION public.notification_delivery_preflight(uuid,uuid) RENAME TO notification_delivery_preflight_personal_v1;
ALTER FUNCTION public.notification_delivery_finish(uuid,uuid,text,text,text,text,integer) RENAME TO notification_delivery_finish_personal_v1;
REVOKE ALL ON FUNCTION public.notification_worker_list_personal_v1(integer),public.notification_delivery_claim_personal_v1(uuid),
 public.notification_delivery_preflight_personal_v1(uuid,uuid),public.notification_delivery_finish_personal_v1(uuid,uuid,text,text,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.notification_worker_list(p_limit integer DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM techerp_api.notification_service();
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Limite de processamento inválido.' USING ERRCODE='22023';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'channel',channel) ORDER BY created_at,id)
 FROM(SELECT id,channel,created_at FROM public.workflow_deliveries WHERE(notification_intent_id IS NOT NULL OR notification_slack_intent_id IS NOT NULL)
 AND((status IN('queued','retry_scheduled') AND coalesce(next_attempt_at,created_at)<=now()) OR(status='in_flight' AND lease_until<=now()))
 ORDER BY created_at,id LIMIT p_limit)s),'[]'::jsonb);
END $$;
CREATE FUNCTION techerp_api.notification_slack_release(p_delivery uuid,p_delay integer DEFAULT 1) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 UPDATE public.notification_slack_endpoint_state SET busy_delivery_id=NULL,busy_until=NULL,
 next_allowed_at=greatest(next_allowed_at,now()+make_interval(secs=>greatest(1,p_delay))) WHERE busy_delivery_id=p_delivery
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_slack_release(uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.notification_delivery_claim(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;i public.notification_slack_intents;p public.notification_slack_policies;
 s public.notification_slack_endpoint_state;c jsonb;token uuid;used integer;next_at timestamptz;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 IF d.notification_slack_intent_id IS NULL THEN RETURN public.notification_delivery_claim_personal_v1(p_id);END IF;
 IF d.status='in_flight' THEN
  IF d.lease_until>now() THEN RETURN jsonb_build_object('result','in_flight');END IF;
  UPDATE public.workflow_deliveries SET status='uncertain',lease_token=NULL,lease_until=NULL,reason_code='lease_expired',last_error='lease_expired',updated_at=now() WHERE id=d.id;
  PERFORM techerp_api.notification_slack_release(d.id);RETURN jsonb_build_object('result','uncertain','reason','lease_expired');END IF;
 IF d.status NOT IN('queued','retry_scheduled') THEN RETURN jsonb_build_object('result','already_done','reason',d.reason_code);END IF;
 IF d.next_attempt_at>now() THEN RETURN jsonb_build_object('result','deferred','reason',d.reason_code,'nextAttemptAt',d.next_attempt_at);END IF;
 IF d.attempts>=4 THEN UPDATE public.workflow_deliveries SET status='failed',reason_code='attempts_exhausted',updated_at=now() WHERE id=d.id;
 RETURN jsonb_build_object('result','already_done','reason','attempts_exhausted');END IF;
 c:=techerp_api.notification_slack_context(d.notification_slack_intent_id);
 IF NOT coalesce((c->>'allowed')::boolean,false) THEN
 UPDATE public.workflow_deliveries SET status='suppressed',reason_code=c->>'reason',last_error=c->>'reason',updated_at=now() WHERE id=d.id;
 RETURN jsonb_build_object('result','suppressed','reason',c->>'reason');END IF;
 IF d.policy_revision IS NOT NULL AND(d.policy_revision IS DISTINCT FROM(c->>'policyRevision')::integer
 OR d.endpoint_hash IS DISTINCT FROM c->>'endpointHash' OR d.notification_endpoint_revision IS DISTINCT FROM(c->>'endpointRevision')::integer) THEN
 UPDATE public.workflow_deliveries SET status='suppressed',reason_code='endpoint_changed',last_error='endpoint_changed',updated_at=now() WHERE id=d.id;
 RETURN jsonb_build_object('result','suppressed','reason','endpoint_changed');END IF;
 SELECT * INTO i FROM public.notification_slack_intents WHERE id=d.notification_slack_intent_id;
 PERFORM pg_advisory_xact_lock(hashtext('wfq:'||i.workspace_id||':slack'));
 SELECT * INTO p FROM public.notification_slack_policies WHERE workspace_id=i.workspace_id FOR SHARE;
 INSERT INTO public.notification_slack_endpoint_state(endpoint_hash) VALUES(c->>'endpointHash') ON CONFLICT DO NOTHING;
 SELECT * INTO s FROM public.notification_slack_endpoint_state WHERE endpoint_hash=c->>'endpointHash' FOR UPDATE;
 IF s.next_allowed_at>now() OR(s.busy_delivery_id IS NOT NULL AND s.busy_delivery_id<>d.id AND s.busy_until>now()) THEN
 next_at:=greatest(s.next_allowed_at,now()+interval '1 second');
 UPDATE public.workflow_deliveries SET next_attempt_at=next_at,reason_code='provider_rate_limited',updated_at=now() WHERE id=d.id;
 RETURN jsonb_build_object('result','deferred','reason','provider_rate_limited','nextAttemptAt',next_at);END IF;
 SELECT count(*) INTO used FROM public.workflow_deliveries WHERE workspace_id=i.workspace_id AND channel='slack' AND id<>d.id
 AND coalesce(notification_reserved_at,created_at)>now()-interval '24 hours'
 AND status IN('sent','in_flight','uncertain','retry_scheduled','accepted','delivered','read');
 IF used>=p.daily_limit THEN
 UPDATE public.workflow_deliveries SET next_attempt_at=now()+interval '1 hour',reason_code='quota_exceeded',updated_at=now() WHERE id=d.id;
 RETURN jsonb_build_object('result','deferred','reason','quota_exceeded','nextAttemptAt',now()+interval '1 hour');END IF;
 token:=gen_random_uuid();
 UPDATE public.workflow_deliveries SET status='in_flight',attempts=attempts+1,lease_token=token,notification_attempt_token=token,
 lease_until=now()+interval '120 seconds',notification_reserved_at=now(),policy_revision=(c->>'policyRevision')::integer,
 endpoint_hash=c->>'endpointHash',notification_endpoint_revision=(c->>'endpointRevision')::integer,notification_template_name='neutral-v1',
 next_attempt_at=NULL,reason_code=NULL,last_error=NULL,updated_at=now() WHERE id=d.id;
 UPDATE public.notification_slack_endpoint_state SET busy_delivery_id=d.id,busy_until=now()+interval '120 seconds'
 WHERE endpoint_hash=c->>'endpointHash';
 RETURN(c-ARRAY['allowed','policyRevision','templateVersion'])||jsonb_build_object('result','claimed','id',d.id,'token',token,'channel','slack','idempotencyKey',d.idempotency_key);
END $$;
CREATE FUNCTION techerp_api.notification_slack_attempt(p_id uuid,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;c jsonb;s public.notification_slack_endpoint_state;i public.notification_slack_intents;BEGIN
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id AND notification_slack_intent_id IS NOT NULL;
 IF d.id IS NULL OR p_token IS NULL OR d.lease_token IS DISTINCT FROM p_token OR d.status<>'in_flight' OR d.lease_until<=now() THEN
 RETURN jsonb_build_object('allowed',false,'result','uncertain','reason','lease_unavailable');END IF;
 c:=techerp_api.notification_slack_context(d.notification_slack_intent_id);
 IF NOT coalesce((c->>'allowed')::boolean,false) THEN RETURN c;END IF;
 IF d.endpoint_hash IS DISTINCT FROM c->>'endpointHash' OR d.policy_revision IS DISTINCT FROM(c->>'policyRevision')::integer
 OR d.notification_endpoint_revision IS DISTINCT FROM(c->>'endpointRevision')::integer THEN
 RETURN jsonb_build_object('allowed',false,'reason','endpoint_changed');END IF;
 SELECT * INTO i FROM public.notification_slack_intents WHERE id=d.notification_slack_intent_id;
 SELECT * INTO s FROM public.notification_slack_endpoint_state WHERE endpoint_hash=c->>'endpointHash';
 IF s.busy_delivery_id IS DISTINCT FROM d.id OR s.busy_until<=now() THEN RETURN jsonb_build_object('allowed',false,'result','uncertain','reason','lease_unavailable');END IF;
 IF s.next_allowed_at>now() THEN RETURN jsonb_build_object('allowed',false,'reason','provider_rate_limited','nextAttemptAt',s.next_allowed_at);END IF;
 RETURN(c-ARRAY['policyRevision','templateVersion'])||jsonb_build_object('id',d.id,'token',p_token,'channel','slack','idempotencyKey',d.idempotency_key);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_slack_attempt(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.notification_delivery_preflight(p_id uuid,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;c jsonb;reason text;BEGIN
 PERFORM techerp_api.notification_service();SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 IF d.notification_slack_intent_id IS NULL THEN RETURN public.notification_delivery_preflight_personal_v1(p_id,p_token);END IF;
 c:=techerp_api.notification_slack_attempt(p_id,p_token);
 IF coalesce((c->>'allowed')::boolean,false) THEN RETURN c;END IF;
 IF d.lease_token IS DISTINCT FROM p_token OR d.status<>'in_flight' OR p_token IS NULL THEN RETURN c;END IF;
 reason:=c->>'reason';
 IF reason='provider_rate_limited' THEN
 UPDATE public.workflow_deliveries SET status='retry_scheduled',next_attempt_at=(c->>'nextAttemptAt')::timestamptz,reason_code=reason,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
 ELSE UPDATE public.workflow_deliveries SET status=CASE WHEN reason='lease_unavailable' THEN 'uncertain' ELSE 'suppressed' END,
 reason_code=reason,last_error=reason,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;END IF;
 PERFORM techerp_api.notification_slack_release(d.id);
 RETURN c||jsonb_build_object('result',CASE WHEN reason='provider_rate_limited' THEN 'deferred' WHEN reason='lease_unavailable' THEN 'uncertain' ELSE 'suppressed' END);
END $$;
CREATE FUNCTION public.notification_slack_endpoint(p_id uuid,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;secret text;BEGIN
 PERFORM techerp_api.notification_service();c:=techerp_api.notification_slack_attempt(p_id,p_token);
 IF NOT coalesce((c->>'allowed')::boolean,false) THEN RAISE EXCEPTION 'Endpoint Slack indisponível.' USING ERRCODE='42501';END IF;
 SELECT access_token INTO secret FROM public.slack_integrations WHERE id=(c->>'integrationId')::uuid AND workspace_id=(c->>'workspaceId')::uuid
 AND notification_endpoint_revision=(c->>'endpointRevision')::integer AND encode(sha256(convert_to(access_token,'UTF8')),'hex')=c->>'endpointHash';
 IF secret IS NULL THEN RAISE EXCEPTION 'Endpoint Slack indisponível.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('webhookUrl',secret);
END $$;
CREATE FUNCTION public.notification_delivery_finish(p_id uuid,p_token uuid,p_status text,p_provider text,
 p_provider_id text DEFAULT NULL,p_reason text DEFAULT NULL,p_retry_after_seconds integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;delay_seconds integer;original jsonb;BEGIN
 PERFORM techerp_api.notification_service();SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 IF d.notification_slack_intent_id IS NULL THEN
  IF p_status='retry_scheduled' AND p_retry_after_seconds>86400 THEN p_status:='failed';END IF;
  original:=public.notification_delivery_finish_personal_v1(p_id,p_token,p_status,p_provider,p_provider_id,p_reason,p_retry_after_seconds);
  IF original->>'updated'='true' AND p_status='retry_scheduled' AND p_reason='provider_rate_limited'
   AND p_retry_after_seconds BETWEEN 3601 AND 86400 AND d.attempts<4 THEN
   UPDATE public.workflow_deliveries SET next_attempt_at=greatest(next_attempt_at,now()+make_interval(secs=>p_retry_after_seconds)) WHERE id=p_id AND status='retry_scheduled';END IF;
  RETURN original;END IF;
 IF p_provider IS DISTINCT FROM 'slack_webhook' OR p_status IS NULL OR p_status NOT IN('accepted','suppressed','retry_scheduled','failed','uncertain')
 OR p_provider_id IS NOT NULL OR(p_reason IS NOT NULL AND p_reason NOT IN('invalid_recipient','invalid_configuration','invalid_template','sender_unavailable',
 'provider_rejected','provider_rate_limited','provider_preflight_unavailable','transport_unknown','recipient_suppressed'))
 OR(p_status='accepted' AND p_reason IS NOT NULL) OR(p_status='retry_scheduled' AND coalesce(p_reason,'') NOT IN('provider_rate_limited','provider_preflight_unavailable'))
 OR(p_reason='transport_unknown' AND p_status<>'uncertain') OR p_retry_after_seconds<0 THEN
 RAISE EXCEPTION 'Resultado Slack incompatível com a tentativa.' USING ERRCODE='22023';END IF;
 IF d.status='accepted' AND p_status='accepted' AND d.lease_token=p_token AND p_token IS NOT NULL THEN RETURN jsonb_build_object('updated',true);END IF;
 IF p_token IS NULL OR d.lease_token IS DISTINCT FROM p_token OR d.status<>'in_flight' OR d.lease_until<=now() THEN RETURN jsonb_build_object('updated',false);END IF;
 delay_seconds:=1;
 IF p_reason='provider_rate_limited' THEN delay_seconds:=greatest(1,coalesce(p_retry_after_seconds,60));END IF;
 IF p_status='retry_scheduled' THEN
  IF d.attempts>=4 OR p_retry_after_seconds>86400 THEN p_status:='failed';
  ELSE delay_seconds:=greatest(delay_seconds,least(3600,120*power(2,greatest(0,d.attempts-1))::integer));END IF;
 END IF;
 UPDATE public.workflow_deliveries SET status=p_status,provider=p_provider,provider_id=NULL,reason_code=p_reason,last_error=p_reason,
 next_attempt_at=CASE WHEN p_status='retry_scheduled' THEN now()+make_interval(secs=>delay_seconds) END,
 lease_token=CASE WHEN p_status='accepted' THEN p_token END,lease_until=NULL,updated_at=now() WHERE id=d.id;
 PERFORM techerp_api.notification_slack_release(d.id,delay_seconds);
 IF p_status='failed' AND p_reason='provider_rate_limited' AND p_retry_after_seconds IS NULL THEN
 UPDATE public.notification_slack_endpoint_state SET next_allowed_at='infinity' WHERE endpoint_hash=d.endpoint_hash;END IF;
 RETURN jsonb_build_object('updated',true);
END $$;

ALTER FUNCTION public.notification_delivery_visible(uuid) RENAME TO notification_delivery_visible_personal_v1;
REVOKE ALL ON FUNCTION public.notification_delivery_visible_personal_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.notification_delivery_visible(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid();c jsonb;i public.notification_slack_intents;BEGIN
 SELECT s.* INTO i FROM public.workflow_deliveries d JOIN public.notification_slack_intents s ON s.id=d.notification_slack_intent_id WHERE d.id=p_id;
 IF i.id IS NULL THEN RETURN public.notification_delivery_visible_personal_v1(p_id);END IF;
 IF u IS NULL OR coalesce(auth.role(),'')<>'authenticated' OR current_setting('app.api_subject',true)='on' THEN RETURN false;END IF;
 c:=public.work_access_context();
 RETURN coalesce(i.workspace_id::text=c->>'workspace' AND public.is_workspace_member(i.workspace_id,u)
 AND c->'keys'?'system.notification_deliveries.view.workspace'
 AND techerp_api.notification_slack_integration_access(i.workspace_id,u,i.integration_id)
 AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id),false);
END $$;
-- Rename keeps the old policy's function OID; recreate the policy so every path
-- uses the new wrapper, including the earlier permissive administrator policy.
DROP POLICY notification_delivery_own ON public.workflow_deliveries;
DROP POLICY notification_delivery_boundary ON public.workflow_deliveries;
CREATE POLICY notification_delivery_own ON public.workflow_deliveries FOR SELECT TO authenticated
 USING((notification_intent_id IS NOT NULL OR notification_slack_intent_id IS NOT NULL) AND public.notification_delivery_visible(id));
CREATE POLICY notification_delivery_boundary ON public.workflow_deliveries AS RESTRICTIVE FOR SELECT TO authenticated
 USING((notification_intent_id IS NULL AND notification_slack_intent_id IS NULL) OR public.notification_delivery_visible(id));

ALTER FUNCTION public.notification_delivery_history(uuid,jsonb,text,text,text) RENAME TO notification_delivery_history_personal_v1;
REVOKE ALL ON FUNCTION public.notification_delivery_history_personal_v1(uuid,jsonb,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.notification_delivery_history(p_workspace uuid,p_cursor jsonb DEFAULT NULL,p_status text DEFAULT NULL,
 p_channel text DEFAULT NULL,p_scope text DEFAULT 'own') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);original jsonb;result jsonb;at timestamptz;item uuid;BEGIN
 -- The original function remains authoritative for scope, status and cursor validation.
 original:=public.notification_delivery_history_personal_v1(p_workspace,p_cursor,p_status,CASE WHEN p_channel='slack' THEN NULL ELSE p_channel END,p_scope);
 IF p_scope='own' THEN
 IF p_channel='slack' THEN RETURN jsonb_build_object('items','[]'::jsonb,'nextCursor',NULL);END IF;RETURN original;END IF;
 IF p_channel IS NOT NULL AND p_channel<>'slack' THEN RETURN original;END IF;
 IF p_cursor IS NOT NULL AND p_cursor<>'null'::jsonb THEN at:=(p_cursor->>'createdAt')::timestamptz;item:=(p_cursor->>'id')::uuid;END IF;
 WITH slack_items AS MATERIALIZED(
 SELECT jsonb_build_object('id',d.id,'channel','slack','status',d.status,'reason_code',d.reason_code,'attempts',d.attempts,
 'created_at',d.created_at,'updated_at',d.updated_at,'workflow_id',i.workflow_id,'provider_id',NULL,
 'recipient_user_id',NULL,'recipient_name','Canal Slack do workspace') payload,d.created_at,d.id
 FROM public.workflow_deliveries d JOIN public.notification_slack_intents i ON i.id=d.notification_slack_intent_id
 WHERE i.workspace_id=p_workspace AND public.notification_delivery_visible(d.id)
 AND(p_status IS NULL OR d.status=p_status) AND(at IS NULL OR(d.created_at,d.id)<(at,item))
 ORDER BY d.created_at DESC,d.id DESC LIMIT 51
 ),matched AS(
 SELECT payload,created_at,id FROM slack_items
 UNION ALL SELECT x,(x->>'created_at')::timestamptz,(x->>'id')::uuid
 FROM jsonb_array_elements(original->'items')x WHERE p_channel IS NULL
 ),page AS MATERIALIZED(SELECT * FROM matched ORDER BY created_at DESC,id DESC LIMIT 51),items AS(
 SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 50)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(payload ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
 'nextCursor',CASE WHEN(SELECT count(*)>50 FROM page) OR(p_channel IS NULL AND original->'nextCursor'<>'null'::jsonb)
 THEN(SELECT jsonb_build_object('createdAt',created_at,'id',id) FROM items ORDER BY created_at,id LIMIT 1) ELSE NULL END) INTO result;
 RETURN result;
END $$;

ALTER FUNCTION public.workflow_delivery_claim(uuid,uuid,text,text,text,text,integer,integer) RENAME TO workflow_delivery_claim_before_slack;
ALTER FUNCTION public.workflow_delivery_finish(text,text,text,text,text,timestamptz) RENAME TO workflow_delivery_finish_before_slack;
REVOKE ALL ON FUNCTION public.workflow_delivery_claim_before_slack(uuid,uuid,text,text,text,text,integer,integer),
 public.workflow_delivery_finish_before_slack(text,text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.workflow_delivery_claim(p_workspace uuid,p_workflow uuid,p_key text,p_channel text,p_step_path text,
 p_recipient text,p_lease_seconds integer DEFAULT 120,p_max_attempts integer DEFAULT 4) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM techerp_api.notification_service();
 IF p_channel='slack' OR EXISTS(SELECT 1 FROM public.workflow_deliveries WHERE idempotency_key=p_key AND notification_slack_intent_id IS NOT NULL) THEN
 RETURN jsonb_build_object('result','forbidden');END IF;
 RETURN public.workflow_delivery_claim_before_slack(p_workspace,p_workflow,p_key,p_channel,p_step_path,p_recipient,p_lease_seconds,p_max_attempts);
END $$;
CREATE FUNCTION public.workflow_delivery_finish(p_key text,p_status text,p_provider text,p_provider_id text,p_error text,p_next_attempt timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM techerp_api.notification_service();
 IF EXISTS(SELECT 1 FROM public.workflow_deliveries WHERE idempotency_key=p_key AND notification_slack_intent_id IS NOT NULL) THEN RETURN;END IF;
 PERFORM public.workflow_delivery_finish_before_slack(p_key,p_status,p_provider,p_provider_id,p_error,p_next_attempt);
END $$;

CREATE OR REPLACE FUNCTION public.notification_delivery_capabilities(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);c jsonb:=public.work_access_context();BEGIN
 RETURN jsonb_build_object('settingsView',c->'keys'?'system.notification_settings.view.workspace',
 'settingsManage',NOT public.is_read_only_view() AND c->'keys'?'system.notification_settings.view.workspace' AND c->'keys'?'system.notification_settings.manage.workspace',
 'whatsappConfigure',NOT public.is_read_only_view() AND c->'keys'?'system.notification_settings.view.workspace' AND c->'keys'?'system.notification_settings.manage.workspace' AND c->'keys'?'system.channels.view.workspace' AND c->'keys'?'system.whatsapp.manage.workspace',
 'slackView',c->'keys'?'system.notification_settings.view.workspace' AND public.sales_context_access(c,p_workspace,'system.integrations','view',ARRAY[u]),
 'slackConfigure',NOT public.is_read_only_view() AND c->'keys'?'system.notification_settings.view.workspace' AND c->'keys'?'system.notification_settings.manage.workspace'
 AND public.sales_context_access(c,p_workspace,'system.integrations','view',ARRAY[u]) AND public.sales_context_access(c,p_workspace,'system.integrations','manage',ARRAY[u]),
 'deliveriesView',true,'deliveriesWorkspaceView',c->'keys'?'system.notification_deliveries.view.workspace');
END $$;

REVOKE ALL ON FUNCTION public.notification_slack_settings(uuid),public.notification_slack_settings_save(uuid,jsonb,integer),
 public.notification_delivery_visible(uuid),public.notification_delivery_history(uuid,jsonb,text,text,text),public.notification_delivery_capabilities(uuid)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_slack_settings(uuid),public.notification_slack_settings_save(uuid,jsonb,integer),
 public.notification_delivery_visible(uuid),public.notification_delivery_history(uuid,jsonb,text,text,text),public.notification_delivery_capabilities(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.notification_workflow_slack_dispatch(uuid,uuid,uuid,text,integer),public.notification_worker_list(integer),
 public.notification_delivery_claim(uuid),public.notification_delivery_preflight(uuid,uuid),public.notification_delivery_finish(uuid,uuid,text,text,text,text,integer),
 public.notification_slack_endpoint(uuid,uuid),public.workflow_delivery_claim(uuid,uuid,text,text,text,text,integer,integer),public.workflow_delivery_finish(text,text,text,text,text,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_workflow_slack_dispatch(uuid,uuid,uuid,text,integer),public.notification_worker_list(integer),
 public.notification_delivery_claim(uuid),public.notification_delivery_preflight(uuid,uuid),public.notification_delivery_finish(uuid,uuid,text,text,text,text,integer),
 public.notification_slack_endpoint(uuid,uuid),public.workflow_delivery_claim(uuid,uuid,text,text,text,text,integer,integer),public.workflow_delivery_finish(text,text,text,text,text,timestamptz) TO service_role;

-- One catalogue of rules: the existing Workflow editor remains authoritative.
CREATE OR REPLACE FUNCTION public.notification_delivery_rules(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);result jsonb;BEGIN
 WITH rules AS MATERIALIZED(SELECT w.* FROM public.workflows w WHERE w.workspace_id=p_workspace
 AND public.sales_record_access('workflows',w.id,'view') AND
 (jsonb_path_exists(w.actions,'$.** ? (@.type == "send_notification" || @.type == "send_slack")') OR jsonb_path_exists(coalesce(w.draft_actions,'[]'::jsonb),'$.** ? (@.type == "send_notification" || @.type == "send_slack")'))
 ORDER BY w.updated_at DESC,w.id DESC LIMIT 101)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(x.payload ORDER BY x.updated_at DESC,x.id DESC)
 FROM(SELECT id,updated_at,jsonb_build_object('id',id,'name',name,'entity',entity,'enabled',enabled,'status',status,
 'published_version',published_version,'trigger',trigger,'actions',actions,'draft_trigger',draft_trigger,'draft_actions',draft_actions,
 'goal_filters',goal_filters,'draft_goal_filters',draft_goal_filters,'updated_at',updated_at)payload FROM rules ORDER BY updated_at DESC,id DESC LIMIT 100)x),'[]'::jsonb),
 'truncated',(SELECT count(*)>100 FROM rules)) INTO result;RETURN result;
END $$;
