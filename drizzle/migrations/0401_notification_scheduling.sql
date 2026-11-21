-- NOTIFICA-CENTRAL P12. Only explicit new settings and published steps participate.
-- The Workflow engine owns time; workflow_deliveries remains the only send ledger.
ALTER TABLE public.notification_delivery_policies
 ADD COLUMN digest_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN followups_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN followup_daily_limit integer NOT NULL DEFAULT 0 CHECK(followup_daily_limit BETWEEN 0 AND 10000);

CREATE TABLE public.notification_digest_settings(
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0),settings jsonb NOT NULL CHECK(jsonb_typeof(settings)='object'),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE public.notification_digest_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 recipient_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK(channel IN('email','whatsapp')),settings_revision integer NOT NULL,
 slot_key text NOT NULL CHECK(length(slot_key) BETWEEN 1 AND 200),slot_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(workspace_id,recipient_user_id,channel,slot_key),UNIQUE(id,workspace_id,recipient_user_id,channel)
);
-- These rows are also durable member receipts. Source UUIDs deliberately have
-- no event/run/intent FK: purging the transient queue must not permit regrouping.
CREATE TABLE public.notification_digest_candidates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 source_intent_id uuid NOT NULL,workflow_id uuid NOT NULL,run_id uuid NOT NULL,workflow_version integer NOT NULL,
 step_path text NOT NULL,recipient_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 channel text NOT NULL CHECK(channel IN('email','whatsapp')),settings_revision integer NOT NULL,
 step_config jsonb NOT NULL,source_table text NOT NULL,source_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'waiting' CHECK(state IN('waiting','batched','consumed','cancelled')),
 next_at timestamptz NOT NULL,batch_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(workspace_id,run_id,step_path,recipient_user_id,channel),
 FOREIGN KEY(batch_id,workspace_id,recipient_user_id,channel)
  REFERENCES public.notification_digest_batches(id,workspace_id,recipient_user_id,channel)
);
CREATE INDEX notification_digest_due ON public.notification_digest_candidates(next_at,id) WHERE state='waiting';
CREATE INDEX notification_digest_members ON public.notification_digest_candidates(batch_id,id) WHERE batch_id IS NOT NULL;
CREATE INDEX notification_digest_source_intent ON public.notification_digest_candidates(source_intent_id);

CREATE TABLE public.notification_followup_schedules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 parent_intent_id uuid NOT NULL,workflow_id uuid NOT NULL,run_id uuid NOT NULL,workflow_version integer NOT NULL,
 step_path text NOT NULL,recipient_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 step_config jsonb NOT NULL,source_table text NOT NULL,source_id uuid NOT NULL,event_key text NOT NULL,
 notification_id uuid NOT NULL,base_at timestamptz NOT NULL,
 next_reminder integer NOT NULL DEFAULT 1,next_reminder_at timestamptz,next_escalation_at timestamptz,
 next_check_at timestamptz NOT NULL DEFAULT '-infinity',
 stopped_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(workspace_id,run_id,step_path,recipient_user_id),UNIQUE(parent_intent_id)
);
CREATE INDEX notification_followup_due ON public.notification_followup_schedules
 (next_check_at,(least(next_reminder_at,next_escalation_at)),id) WHERE stopped_at IS NULL;
CREATE TABLE public.notification_followup_occurrences(
 schedule_id uuid NOT NULL REFERENCES public.notification_followup_schedules(id),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('reminder','escalation')),ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 3),
 child_intent_id uuid,recipient_count integer NOT NULL DEFAULT 0 CHECK(recipient_count BETWEEN 0 AND 200),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(schedule_id,kind,ordinal)
);
CREATE INDEX notification_followup_quota ON public.notification_followup_occurrences(workspace_id,created_at);
CREATE INDEX notification_followup_child ON public.notification_followup_occurrences(child_intent_id) WHERE child_intent_id IS NOT NULL;
ALTER TABLE public.notification_delivery_intents
 ADD COLUMN occurrence_kind text NOT NULL DEFAULT 'initial' CHECK(occurrence_kind IN('initial','reminder','escalation')),
 ADD COLUMN parent_intent_id uuid;
ALTER TABLE public.notification_delivery_intents ADD CONSTRAINT notification_intent_parent_kind
 CHECK((occurrence_kind='initial')=(parent_intent_id IS NULL));
CREATE INDEX notification_intent_parent ON public.notification_delivery_intents(parent_intent_id) WHERE parent_intent_id IS NOT NULL;
ALTER TABLE public.workflow_deliveries ADD COLUMN notification_digest_id uuid REFERENCES public.notification_digest_batches(id);
ALTER TABLE public.workflow_deliveries DROP CONSTRAINT notification_delivery_exclusive_subtype;
ALTER TABLE public.workflow_deliveries ADD CONSTRAINT notification_delivery_exclusive_subtype CHECK(
 num_nonnulls(notification_intent_id,notification_slack_intent_id,notification_digest_id)<=1
 AND((channel='slack')=(notification_slack_intent_id IS NOT NULL))
 AND(notification_digest_id IS NULL OR(workflow_id IS NULL AND channel IN('email','whatsapp'))));
CREATE UNIQUE INDEX notification_digest_delivery ON public.workflow_deliveries(notification_digest_id,channel) WHERE notification_digest_id IS NOT NULL;
CREATE INDEX notification_digest_pending ON public.workflow_deliveries(next_attempt_at,created_at,id)
 WHERE notification_digest_id IS NOT NULL AND status IN('queued','retry_scheduled','in_flight');
ALTER TABLE public.notification_digest_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_digest_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_digest_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_followup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_followup_occurrences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_digest_settings,public.notification_digest_candidates,public.notification_digest_batches,
 public.notification_followup_schedules,public.notification_followup_occurrences FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_digest_defaults() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT
 '{"enabled":false,"frequency":"daily","at":"08:30","timezone":"America/Sao_Paulo","weekday":1,"channels":[]}'::jsonb $$;
CREATE FUNCTION techerp_api.notification_digest_settings_valid(p_settings jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$ BEGIN
 RETURN coalesce(jsonb_typeof(p_settings)='object'
 AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(p_settings) k WHERE k NOT IN('enabled','frequency','at','timezone','weekday','channels'))
 AND p_settings?'enabled' AND jsonb_typeof(p_settings->'enabled')='boolean'
 AND p_settings->>'frequency' IN('daily','weekly')
 AND coalesce(p_settings->>'at','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
 AND jsonb_typeof(p_settings->'timezone')='string' AND length(p_settings->>'timezone')<=80
 AND(p_settings->>'timezone'='UTC' OR strpos(p_settings->>'timezone','/')>0)
 AND EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_settings->>'timezone')
 AND jsonb_typeof(p_settings->'weekday')='number' AND p_settings->>'weekday' ~ '^[1-7]$'
 AND jsonb_typeof(p_settings->'channels')='array' AND jsonb_array_length(p_settings->'channels')<=2
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_settings->'channels') x WHERE jsonb_typeof(x)<>'string' OR x#>>'{}' NOT IN('email','whatsapp'))
 AND(SELECT count(*)=count(DISTINCT x) FROM jsonb_array_elements(p_settings->'channels') x)
 AND(p_settings->>'enabled'='false' OR jsonb_array_length(p_settings->'channels')>0),false);
 EXCEPTION WHEN invalid_parameter_value THEN RETURN false;
END $$;
CREATE FUNCTION public.get_notification_digest_settings(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=techerp_api.notification_center_actor(p_workspace);s public.notification_digest_settings;BEGIN
 SELECT * INTO s FROM public.notification_digest_settings WHERE workspace_id=p_workspace AND user_id=actor;
 RETURN jsonb_build_object('settings',coalesce(s.settings,techerp_api.notification_digest_defaults()),'revision',coalesce(s.revision,0));
END $$;
CREATE FUNCTION public.save_notification_digest_settings(p_workspace uuid,p_settings jsonb,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=techerp_api.notification_center_actor(p_workspace,true);expected integer;BEGIN
 IF p_revision IS NULL OR p_revision<0 OR NOT techerp_api.notification_digest_settings_valid(p_settings) THEN
  RAISE EXCEPTION 'Configuração de resumo inválida.' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-digest-settings:'||p_workspace||':'||actor,0));
 SELECT revision INTO expected FROM public.notification_digest_settings WHERE workspace_id=p_workspace AND user_id=actor FOR UPDATE;
 IF coalesce(expected,0)<>p_revision THEN RAISE EXCEPTION 'As preferências mudaram. Recarregue.' USING ERRCODE='PT409';END IF;
 INSERT INTO public.notification_digest_settings(workspace_id,user_id,revision,settings)
 VALUES(p_workspace,actor,p_revision+1,p_settings) ON CONFLICT(workspace_id,user_id)
 DO UPDATE SET revision=excluded.revision,settings=excluded.settings,updated_at=clock_timestamp();
 RETURN public.get_notification_digest_settings(p_workspace);
END $$;

-- Clock parameters are private test seams, never public RPC parameters or GUCs.
-- PostgreSQL's IANA conversion picks one deterministic real instant for a civil
-- slot, including DST folds/gaps; its civil key prevents a repeated-hour replay.
CREATE FUNCTION techerp_api.notification_digest_slot(p_settings jsonb,p_at timestamptz,p_future boolean)
RETURNS TABLE(slot_key text,slot_at timestamptz) LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE d date;candidate timestamptz;k integer;BEGIN
 IF NOT techerp_api.notification_digest_settings_valid(p_settings) OR p_at IS NULL OR p_future IS NULL THEN RETURN;END IF;
 d:=(p_at AT TIME ZONE(p_settings->>'timezone'))::date;
 FOR k IN 0..8 LOOP
  IF p_settings->>'frequency'='daily' OR extract(isodow FROM d)::integer=(p_settings->>'weekday')::integer THEN
   candidate:=(d+(p_settings->>'at')::time) AT TIME ZONE(p_settings->>'timezone');
   IF(p_future AND candidate>p_at) OR(NOT p_future AND candidate<=p_at) THEN
    slot_key:=(p_settings->>'frequency')||':'||(p_settings->>'timezone')||':'||d||':'||(p_settings->>'at');
    slot_at:=candidate;RETURN NEXT;RETURN;
   END IF;
  END IF;
  d:=d+CASE WHEN p_future THEN 1 ELSE -1 END;
 END LOOP;
END $$;

CREATE FUNCTION techerp_api.notification_followup_event(p_key text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT coalesce(p_key IN(
 'contracts.contract.expiring','contracts.contract.renewal_due','projects.project.overdue','projects.task.overdue','projects.milestone.due',
 'people.document.expiring','people.approval.pending','finance.payable.due','finance.receivable.due',
 'finance.payable.overdue','finance.receivable.overdue','finance.invoice.received'),false) $$;
CREATE FUNCTION techerp_api.notification_schedule_delivery_valid(p_config jsonb,p_event text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
#variable_conflict use_column
DECLARE f jsonb;r jsonb;e jsonb;selector jsonb;k text;BEGIN
 IF jsonb_typeof(p_config) IS DISTINCT FROM 'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_config) k WHERE k NOT IN('channels','fallback','priority','followup'))
 OR jsonb_typeof(p_config->'channels') IS DISTINCT FROM 'array' OR jsonb_array_length(p_config->'channels') NOT BETWEEN 1 AND 3
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_config->'channels') x WHERE jsonb_typeof(x)<>'string' OR x#>>'{}' NOT IN('inapp','email','whatsapp'))
 OR(SELECT count(*)<>count(DISTINCT x) FROM jsonb_array_elements(p_config->'channels') x)
 OR coalesce(p_config->>'fallback','none') NOT IN('none','email')
 OR(p_config->>'fallback'='email' AND(NOT p_config->'channels'?'whatsapp' OR p_config->'channels'?'email'))
 OR(p_config?'priority' AND(jsonb_typeof(p_config->'priority')<>'string' OR p_config->>'priority' NOT IN('low','normal','high'))) THEN RETURN false;END IF;
 f:=p_config->'followup';IF f IS NULL OR f='null'::jsonb THEN RETURN true;END IF;
 IF NOT p_config->'channels'?'inapp' OR jsonb_typeof(f)<>'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(f) k WHERE k NOT IN('reminder','escalation'))
 OR NOT(f?'reminder' OR f?'escalation')
 OR(p_event IS NULL OR NOT techerp_api.notification_followup_event(p_event)) THEN RETURN false;END IF;
 IF f?'reminder' THEN
  r:=f->'reminder';IF jsonb_typeof(r)<>'object' OR NOT(r?'interval_hours' AND r?'max_occurrences')
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(r) k WHERE k NOT IN('interval_hours','max_occurrences'))
   OR jsonb_typeof(r->'interval_hours')<>'number' OR coalesce(r->>'interval_hours','') !~ '^[0-9]{1,3}$'
   OR(r->>'interval_hours')::integer NOT BETWEEN 1 AND 168
   OR jsonb_typeof(r->'max_occurrences')<>'number' OR coalesce(r->>'max_occurrences','') !~ '^[1-3]$'
   OR(r->>'interval_hours')::integer*(r->>'max_occurrences')::integer>168 THEN RETURN false;END IF;
 END IF;
 IF f?'escalation' THEN
  e:=f->'escalation';IF p_event='people.approval.pending' OR jsonb_typeof(e)<>'object'
   OR NOT(e?'after_hours' AND e?'recipient') OR EXISTS(SELECT 1 FROM jsonb_object_keys(e) k WHERE k NOT IN('after_hours','recipient'))
   OR jsonb_typeof(e->'after_hours')<>'number' OR coalesce(e->>'after_hours','') !~ '^[0-9]{1,3}$'
   OR(e->>'after_hours')::integer NOT BETWEEN 1 AND 168 THEN RETURN false;END IF;
  selector:=e->'recipient';k:=selector->>'kind';
  IF jsonb_typeof(selector)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(selector) n WHERE n NOT IN('kind','id'))
   OR k IS NULL OR k NOT IN('workflow_owner','user','source_responsible','source_creator','area_manager','pending_approvers','project_members','team','job_role')
   OR(k IN('user','team','job_role') AND(coalesce(selector->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR(SELECT count(*) FROM jsonb_object_keys(selector))<>2))
   OR(k NOT IN('user','team','job_role') AND selector?'id') THEN RETURN false;END IF;
 END IF;
 RETURN true;
 EXCEPTION WHEN invalid_parameter_value OR invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
CREATE FUNCTION techerp_api.notification_schedule_step(p_workflow uuid,p_version integer,p_path text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN count(*)=1 THEN (jsonb_agg(a.action)->0) END FROM public.workflows w
 CROSS JOIN LATERAL techerp_api.notification_slack_actions(w.actions) a
 WHERE w.id=p_workflow AND w.enabled AND w.status='published' AND w.published_version=p_version
 AND a.step_path=p_path AND a.action->>'type'='send_notification'
$$;
CREATE FUNCTION techerp_api.notification_schedule_config(p_config jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_strip_nulls(jsonb_build_object('channels',(SELECT jsonb_agg(x ORDER BY x#>>'{}')
  FROM jsonb_array_elements(p_config->'channels') x),'fallback',coalesce(p_config->>'fallback','none'))
  ||(p_config-ARRAY['channels','fallback']))
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_schedule_config(jsonb) FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION techerp_api.notification_digest_defaults(),techerp_api.notification_digest_settings_valid(jsonb),
 techerp_api.notification_digest_slot(jsonb,timestamptz,boolean),techerp_api.notification_followup_event(text),
 techerp_api.notification_schedule_delivery_valid(jsonb,text),techerp_api.notification_schedule_step(uuid,integer,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_notification_digest_settings(uuid),public.save_notification_digest_settings(uuid,jsonb,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_notification_digest_settings(uuid),public.save_notification_digest_settings(uuid,jsonb,integer) TO authenticated;

-- Checks the actual original run/proof and published step, never a synthetic run
-- or a client-supplied snapshot. Outbound preferences are checked per channel.
CREATE FUNCTION techerp_api.notification_schedule_source_current(p_intent uuid,p_mode text,p_recipient uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;wf public.workflows;r public.workflow_runs;step jsonb;target uuid;executor uuid;BEGIN
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_intent AND occurrence_kind='initial' AND parent_intent_id IS NULL;
 IF i.id IS NULL OR p_mode IS NULL OR p_mode NOT IN('digest','followup') OR i.event_key='legacy.workflow'
  OR techerp_api.notification_business_category(i.event_key) IS NULL THEN RETURN false;END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=i.workflow_id AND workspace_id=i.workspace_id
  AND entity=i.source_table AND enabled AND status='published' AND published_version=i.workflow_version;
 SELECT * INTO r FROM public.workflow_runs WHERE id=i.run_id AND workflow_id=wf.id AND workspace_id=i.workspace_id
  AND owner_id=wf.owner_id AND entity=i.source_table AND entity_id=i.source_id AND NOT is_test
  AND status NOT IN('failed','cancelled','canceled','error');
 step:=techerp_api.notification_schedule_step(i.workflow_id,i.workflow_version,i.step_path);
 IF wf.id IS NULL OR r.id IS NULL OR step IS NULL
  OR NOT techerp_api.notification_schedule_delivery_valid(step->'delivery',i.event_key)
  OR techerp_api.notification_schedule_config(step->'delivery') IS DISTINCT FROM jsonb_strip_nulls(i.delivery_config)
  OR techerp_api.notification_business_run_key(i.workflow_id,i.run_id,i.workflow_version) IS DISTINCT FROM i.event_key THEN RETURN false;END IF;
 IF p_mode='digest' AND(i.event_key='people.approval.pending' OR step#>>'{delivery,priority}' IS DISTINCT FROM 'low') THEN RETURN false;END IF;
 IF p_mode='followup' THEN
  IF NOT techerp_api.notification_followup_event(i.event_key) OR NOT i.delivery_config->'channels'?'inapp'
   OR NOT EXISTS(SELECT 1 FROM public.notifications n WHERE n.id=i.notification_id AND n.workspace_id=i.workspace_id
    AND n.user_id=i.recipient_user_id AND n.entity_id=i.source_id AND n.read_at IS NULL)
   OR(i.event_key='finance.invoice.received' AND NOT EXISTS(SELECT 1 FROM public.hiring_fiscal_documents f
    WHERE f.workspace_id=i.workspace_id AND f.id=i.source_id AND f.status='registered')) THEN RETURN false;END IF;
 END IF;
 target:=coalesce(p_recipient,i.recipient_user_id);executor:=coalesce(wf.execution_user_id,wf.owner_id);
 RETURN public.is_workspace_member(i.workspace_id,executor) AND public.is_workspace_member(i.workspace_id,target)
  AND techerp_api.notification_source_visible(i.workspace_id,executor,i.source_table,i.source_id)
  AND techerp_api.notification_source_visible(i.workspace_id,target,i.source_table,i.source_id)
  AND techerp_api.notification_people_recipient(r.event_id,target)
  AND public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',i.workflow_version),
   CASE WHEN i.source_table IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities')
   THEN jsonb_build_object('table',i.source_table,'id',i.source_id,'action','view')
   ELSE jsonb_build_object('record_table',i.source_table,'id',i.source_id) END));
END $$;

CREATE FUNCTION techerp_api.notification_schedule_capture(p_intent uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;p public.notification_delivery_policies;s public.notification_digest_settings;
 step jsonb;slot record;current_channel text;candidate_id uuid;existing public.notification_digest_candidates;at timestamptz:=clock_timestamp();BEGIN
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_intent AND occurrence_kind='initial';
 IF i.id IS NULL OR public.is_read_only_view() OR i.event_key='legacy.workflow' THEN RETURN;END IF;
 step:=techerp_api.notification_schedule_step(i.workflow_id,i.workflow_version,i.step_path);
 IF step IS NULL OR NOT techerp_api.notification_schedule_delivery_valid(step->'delivery',i.event_key) THEN RETURN;END IF;
 SELECT * INTO p FROM public.notification_delivery_policies WHERE workspace_id=i.workspace_id;
 IF p.followups_enabled AND p.followup_daily_limit>0 AND jsonb_typeof(step#>'{delivery,followup}')='object'
  AND techerp_api.notification_schedule_source_current(i.id,'followup') THEN
  INSERT INTO public.notification_followup_schedules(workspace_id,parent_intent_id,workflow_id,run_id,workflow_version,
   step_path,recipient_user_id,step_config,source_table,source_id,event_key,notification_id,base_at,next_reminder_at,next_escalation_at)
  VALUES(i.workspace_id,i.id,i.workflow_id,i.run_id,i.workflow_version,i.step_path,i.recipient_user_id,step,i.source_table,i.source_id,
   i.event_key,i.notification_id,at,
   CASE WHEN step#>'{delivery,followup,reminder}' IS NOT NULL THEN at+make_interval(hours=>(step#>>'{delivery,followup,reminder,interval_hours}')::integer) END,
   CASE WHEN step#>'{delivery,followup,escalation}' IS NOT NULL THEN at+make_interval(hours=>(step#>>'{delivery,followup,escalation,after_hours}')::integer) END)
  ON CONFLICT DO NOTHING;
 END IF;
 IF NOT coalesce(p.digest_enabled,false) OR i.event_key='people.approval.pending' OR step#>>'{delivery,priority}' IS DISTINCT FROM 'low'
  OR NOT techerp_api.notification_schedule_source_current(i.id,'digest') THEN RETURN;END IF;
 SELECT * INTO s FROM public.notification_digest_settings WHERE workspace_id=i.workspace_id AND user_id=i.recipient_user_id;
 IF s.user_id IS NULL OR NOT techerp_api.notification_digest_settings_valid(s.settings) OR s.settings->>'enabled'<>'true' THEN RETURN;END IF;
 SELECT * INTO slot FROM techerp_api.notification_digest_slot(s.settings,at,true);
 IF slot.slot_at IS NULL THEN RETURN;END IF;
 FOR current_channel IN SELECT value#>>'{}' FROM jsonb_array_elements(s.settings->'channels') LOOP
  IF NOT i.delivery_config->'channels'?current_channel OR NOT EXISTS(SELECT 1 FROM public.workflow_deliveries d
   WHERE d.notification_intent_id=i.id AND d.channel=current_channel AND d.status='queued' AND d.attempts=0) THEN CONTINUE;END IF;
  candidate_id:=NULL;
  INSERT INTO public.notification_digest_candidates(workspace_id,source_intent_id,workflow_id,run_id,workflow_version,step_path,
   recipient_user_id,channel,settings_revision,step_config,source_table,source_id,next_at)
  VALUES(i.workspace_id,i.id,i.workflow_id,i.run_id,i.workflow_version,i.step_path,i.recipient_user_id,current_channel,s.revision,step,i.source_table,i.source_id,slot.slot_at)
  ON CONFLICT(workspace_id,run_id,step_path,recipient_user_id,channel) DO NOTHING RETURNING id INTO candidate_id;
  IF candidate_id IS NULL THEN
   SELECT * INTO existing FROM public.notification_digest_candidates WHERE workspace_id=i.workspace_id AND run_id=i.run_id
    AND step_path=i.step_path AND recipient_user_id=i.recipient_user_id AND notification_digest_candidates.channel=current_channel;
   IF existing.source_intent_id IS DISTINCT FROM i.id OR existing.state<>'waiting' THEN
    UPDATE public.workflow_deliveries SET status='deduped',reason_code='digest_duplicate',last_error='digest_duplicate',updated_at=at
     WHERE notification_intent_id=i.id AND workflow_deliveries.channel=current_channel AND status='queued' AND attempts=0;
    CONTINUE;
   END IF;
  END IF;
  UPDATE public.workflow_deliveries SET next_attempt_at='infinity',reason_code='digest_waiting',updated_at=at
   WHERE notification_intent_id=i.id AND workflow_deliveries.channel=current_channel AND status='queued' AND attempts=0;
 END LOOP;
END $$;

REVOKE ALL ON FUNCTION techerp_api.notification_schedule_source_current(uuid,text,uuid),
 techerp_api.notification_schedule_capture(uuid) FROM PUBLIC,anon,authenticated,service_role;


CREATE OR REPLACE FUNCTION techerp_api.notification_policy_json(p_workspace uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce((SELECT to_jsonb(p)-ARRAY['workspace_id','revision','updated_by','updated_at']
 FROM public.notification_delivery_policies p WHERE workspace_id=p_workspace),jsonb_build_object(
 'digest_enabled',false,'followups_enabled',false,'followup_daily_limit',0,'email_enabled',false,'whatsapp_enabled',false,'email_daily_limit',0,'whatsapp_daily_limit',0,
 'wa_sender_id',NULL,'wa_template_name',NULL,'wa_template_language',NULL,
 'wa_estimated_unit_micros',0,'wa_daily_budget_micros',0,'currency','BRL'))
$$;

ALTER FUNCTION public.notification_delivery_settings_save(uuid,jsonb,integer) RENAME TO notification_delivery_settings_save_before_scheduling;
REVOKE ALL ON FUNCTION public.notification_delivery_settings_save_before_scheduling(uuid,jsonb,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.notification_delivery_settings_save(p_workspace uuid,p_policy jsonb,p_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=techerp_api.notification_delivery_permission(p_workspace,true);original jsonb;k text;BEGIN
 IF jsonb_typeof(p_policy) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Configuração de canais inválida.' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['digest_enabled','followups_enabled'] LOOP
  IF p_policy?k AND jsonb_typeof(p_policy->k) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Configuração temporal inválida.' USING ERRCODE='22023';END IF;
 END LOOP;
 IF p_policy?'followup_daily_limit' AND(jsonb_typeof(p_policy->'followup_daily_limit') IS DISTINCT FROM 'number'
  OR coalesce(p_policy->>'followup_daily_limit','') !~ '^[0-9]{1,5}$' OR(p_policy->>'followup_daily_limit')::integer NOT BETWEEN 0 AND 10000) THEN
  RAISE EXCEPTION 'Limite de lembretes inválido.' USING ERRCODE='22023';END IF;
 original:=public.notification_delivery_settings_save_before_scheduling(p_workspace,p_policy-ARRAY['digest_enabled','followups_enabled','followup_daily_limit'],p_revision);
 UPDATE public.notification_delivery_policies SET
  digest_enabled=CASE WHEN p_policy?'digest_enabled' THEN(p_policy->>'digest_enabled')::boolean ELSE digest_enabled END,
  followups_enabled=CASE WHEN p_policy?'followups_enabled' THEN(p_policy->>'followups_enabled')::boolean ELSE followups_enabled END,
  followup_daily_limit=CASE WHEN p_policy?'followup_daily_limit' THEN(p_policy->>'followup_daily_limit')::integer ELSE followup_daily_limit END
 WHERE workspace_id=p_workspace;
 IF EXISTS(SELECT 1 FROM public.notification_delivery_policies WHERE workspace_id=p_workspace AND followups_enabled AND followup_daily_limit<=0) THEN
  RAISE EXCEPTION 'Informe uma cota positiva antes de habilitar lembretes.' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('policy',techerp_api.notification_policy_json(p_workspace),'revision',original->'revision');
END $$;
REVOKE ALL ON FUNCTION public.notification_delivery_settings_save(uuid,jsonb,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_delivery_settings_save(uuid,jsonb,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.notification_workflow_dispatch_v2(
  p_workflow uuid,p_run uuid,p_version integer,p_entity text,p_record uuid,
  p_rules jsonb,p_title text,p_body text,p_step text,p_delivery jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE wf public.workflows;run public.workflow_runs;ev public.workflow_events;
  w uuid;executor uuid;source jsonb;rule jsonb;kind text;rule_id uuid;
  recipients uuid[]:='{}';selected uuid[];recipient uuid;source_project uuid;
  manager uuid;leader jsonb;policy public.hiring_area_policies;
  issues text[]:='{}';candidate_count integer:=0;sent_count integer:=0;
  excluded_count integer:=0;duplicate_count integer:=0;created uuid;
  prefs jsonb;inapp boolean;title text;body text;href text;dedupe text;
  config jsonb;channels jsonb;fallback text;intent_id uuid;intent_existed boolean;job_id uuid;
  queued_count integer:=0;requested_channel text;
 resolved_event text;saved_step jsonb;
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Execução reservada ao motor de Workflows.' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_delivery) IS DISTINCT FROM 'object' OR
   EXISTS(SELECT 1 FROM jsonb_object_keys(p_delivery) k WHERE k NOT IN('channels','fallback','priority','followup'))
   OR jsonb_typeof(p_delivery->'channels') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Canais de notificação inválidos.' USING ERRCODE='22023';END IF;
  channels:=p_delivery->'channels';fallback:=coalesce(p_delivery->>'fallback','none');
  IF jsonb_array_length(channels) NOT BETWEEN 1 AND 3 OR fallback NOT IN('none','email')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(channels)c WHERE jsonb_typeof(c)<>'string' OR c#>>'{}' NOT IN('inapp','email','whatsapp'))
   OR(SELECT count(DISTINCT c) FROM jsonb_array_elements(channels)c)<>jsonb_array_length(channels)
   OR(fallback='email' AND(NOT channels?'whatsapp' OR channels?'email')) THEN
   RAISE EXCEPTION 'Canais ou fallback inválidos.' USING ERRCODE='22023';END IF;
  SELECT jsonb_agg(c ORDER BY c) INTO channels FROM jsonb_array_elements(channels)c;
  config:=jsonb_build_object('channels',channels,'fallback',fallback)||(p_delivery-ARRAY['channels','fallback']);
  -- Check the ORIGINAL request before any private subject context drops session_id.
  IF public.is_read_only_view() THEN
    RAISE EXCEPTION 'Execução de teste não pode emitir notificações.' USING ERRCODE='42501';
  END IF;
  IF p_workflow IS NULL OR p_run IS NULL OR p_version IS NULL OR p_version<1
    OR p_record IS NULL OR p_entity IS NULL OR p_step IS NULL
    OR length(p_step) NOT BETWEEN 1 AND 300 OR btrim(p_step)=''
    OR p_title IS NULL OR btrim(p_title)='' OR length(p_title)>200
    OR length(coalesce(p_body,''))>2000 OR jsonb_typeof(p_rules) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Configuração de notificação inválida.' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_rules) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Informe de um a dez seletores de destinatários.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO wf FROM public.workflows
    WHERE id=p_workflow AND enabled AND status='published' AND published_version=p_version
      AND entity=p_entity FOR SHARE;
  IF wf.id IS NULL THEN
    RAISE EXCEPTION 'Workflow indisponível ou versão desatualizada.' USING ERRCODE='42501';
  END IF;
  w:=wf.workspace_id;executor:=coalesce(wf.execution_user_id,wf.owner_id);
  SELECT * INTO run FROM public.workflow_runs
    WHERE id=p_run AND workflow_id=p_workflow AND workspace_id=w
      AND entity=p_entity AND entity_id=p_record AND status='running' AND NOT is_test
      AND owner_id=wf.owner_id FOR UPDATE;
  IF run.id IS NULL OR NOT public.is_workspace_member(w,executor) THEN
    RAISE EXCEPTION 'Execução de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO ev FROM public.workflow_events
    WHERE id=run.event_id AND workspace_id=w AND entity=p_entity AND entity_id=p_record;
  IF ev.id IS NULL OR (ev.workflow_version IS NOT NULL AND ev.workflow_version<>p_version)
    OR NOT public.sales_worker_authorize('workflows',p_workflow,
      jsonb_build_array(jsonb_build_object('workflow_version',p_version),
        CASE WHEN p_entity IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities')
          THEN jsonb_build_object('table',p_entity,'id',p_record,'action','view')
          ELSE jsonb_build_object('record_table',p_entity,'id',p_record) END))
    OR NOT techerp_api.notification_source_visible(w,executor,p_entity,p_record) THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;
  IF(channels?'email' OR fallback='email') AND NOT techerp_api.notification_transport_allowed(w,executor,'email')
   OR channels?'whatsapp' AND NOT techerp_api.notification_transport_allowed(w,executor,'whatsapp') THEN
   RAISE EXCEPTION 'Executor sem permissão atual para o canal externo.' USING ERRCODE='42501';END IF;
  resolved_event:=techerp_api.notification_business_run_key(p_workflow,p_run,p_version);
  IF resolved_event IS NULL THEN RAISE EXCEPTION 'Ocorrência de notificação sem prova válida.' USING ERRCODE='42501';END IF;
  IF NOT techerp_api.notification_schedule_delivery_valid(config,resolved_event) THEN
   RAISE EXCEPTION 'Configuração temporal de notificação inválida.' USING ERRCODE='22023';END IF;
  IF p_delivery?'priority' OR p_delivery?'followup' THEN
   saved_step:=techerp_api.notification_schedule_step(p_workflow,p_version,p_step);
   IF saved_step IS NULL OR techerp_api.notification_schedule_config(saved_step->'delivery') IS DISTINCT FROM jsonb_strip_nulls(config)
    OR saved_step->'recipients' IS DISTINCT FROM p_rules THEN
    RAISE EXCEPTION 'O passo publicado não corresponde à configuração temporal.' USING ERRCODE='42501';END IF;
  END IF;

  IF resolved_event='people.approval.pending' AND p_rules IS DISTINCT FROM '[{"kind":"pending_approvers"}]'::jsonb THEN
   RAISE EXCEPTION 'A aprovação exige seu aprovador vigente.' USING ERRCODE='42501';END IF;
  -- p_entity has passed the exact table allowlist in the private source bridge.
  EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 AND workspace_id=$2',p_entity)
    INTO source USING p_record,w;
  IF source IS NULL THEN
    RAISE EXCEPTION 'Origem de notificação indisponível.' USING ERRCODE='42501';
  END IF;

  FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    IF jsonb_typeof(rule) IS DISTINCT FROM 'object'
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(rule) k WHERE k NOT IN('kind','id')) THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    kind:=rule->>'kind';rule_id:=NULL;selected:='{}';
    IF kind IS NULL OR kind NOT IN('workflow_owner','user','source_responsible','source_creator',
      'area_manager','pending_approvers','project_members','team','job_role','followers') THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    IF kind IN('user','team','job_role') THEN
      IF coalesce(rule->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Identificador de destinatário inválido.' USING ERRCODE='22023';
      END IF;
      rule_id:=(rule->>'id')::uuid;
    ELSIF rule?'id' THEN
      RAISE EXCEPTION 'Seletor não aceita identificador manual.' USING ERRCODE='22023';
    END IF;
    CASE kind
      WHEN 'workflow_owner' THEN selected:=ARRAY[executor];
      WHEN 'user' THEN selected:=ARRAY[rule_id];
      WHEN 'source_creator' THEN
        -- owner_id is not universally a creator; never infer it when provenance is absent.
        selected:=ARRAY[CASE WHEN p_entity='hiring_fiscal_documents' THEN nullif(source->>'uploaded_by','')::uuid ELSE nullif(source->>'created_by','')::uuid END];
      WHEN 'source_responsible' THEN
        CASE p_entity
          WHEN 'hiring_fiscal_documents' THEN selected:=ARRAY[techerp_api.notification_finance_fiscal_responsible(w,p_record)];
          WHEN 'tickets' THEN selected:=ARRAY[coalesce(nullif(source->>'assignee_id','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_jobs' THEN selected:=ARRAY[coalesce(nullif(source->>'recruiter_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_interviews' THEN selected:=ARRAY[coalesce(nullif(source->>'interviewer_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'project_tasks' THEN
            SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM (
              SELECT DISTINCT x FROM (
              SELECT nullif(source->>'assignee_id','')::uuid x
              UNION SELECT value::uuid FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(source->'assignee_ids')='array' THEN source->'assignee_ids' ELSE '[]'::jsonb END)
              ) ids WHERE x IS NOT NULL ORDER BY x LIMIT 201
            ) s;
          ELSE selected:=ARRAY[coalesce(nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
        END CASE;
      WHEN 'area_manager' THEN
        manager:=NULL;
        IF p_entity='people' THEN
          SELECT profile_id INTO manager FROM public.people m
            WHERE m.id=nullif(source->>'manager_id','')::uuid AND m.workspace_id=w
              AND NOT coalesce((to_jsonb(m)->>'archived')::boolean,false);
        ELSIF p_entity='deals' THEN
          leader:=techerp_api.notification_deal_leader(w,executor,p_record);
          IF leader->>'status'='ok' THEN manager:=nullif(leader->>'leader_id','')::uuid;
          ELSIF leader->>'status'='ambiguous' THEN issues:=array_append(issues,'recipient_source_ambiguous');
          END IF;
        ELSIF p_entity='ats_jobs' THEN
          SELECT * INTO policy FROM public.hiring_area_policies
            WHERE workspace_id=w AND area_id=nullif(source->>'hiring_area_id','')::uuid;
          IF EXISTS(SELECT 1 FROM public.hiring_demand_requests r
            WHERE r.workspace_id=w AND r.job_id=p_record AND r.revision=nullif(source->>'hiring_revision','')::integer) THEN
            -- Only the canonical request records who asked and which substitute was
            -- selected. The job creator is not necessarily that requester.
            SELECT s.approver_id INTO manager FROM public.hiring_demand_requests r
              JOIN public.hiring_demand_steps s ON s.request_id=r.id AND s.workspace_id=r.workspace_id
              WHERE r.workspace_id=w AND r.job_id=p_record
                AND r.revision=nullif(source->>'hiring_revision','')::integer
                AND r.policy_revision=policy.revision AND r.status IN('pending','approved')
                AND s.stage='manager' AND s.status IN('pending','approved');
          ELSE manager:=policy.manager_id;END IF;
        END IF;
        selected:=ARRAY[manager];
      WHEN 'pending_approvers' THEN
        IF resolved_event='people.approval.pending' THEN selected:=techerp_api.notification_hr_pending_approvers(ev.id);
        ELSIF p_entity='contracts' THEN
          SELECT coalesce(array_agg(DISTINCT approver_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_id FROM public.contract_approvals a WHERE a.workspace_id=w AND a.contract_id=p_record
              AND source->>'status'='in_review'
              AND a.status='pending' AND a.superseded_at IS NULL AND a.approver_id IS NOT NULL
              AND techerp_api.notification_contract_approver(w,a.approver_id,a.id)
              AND a.sort_order=(SELECT min(b.sort_order) FROM public.contract_approvals b
                WHERE b.workspace_id=w AND b.contract_id=p_record AND b.status='pending' AND b.superseded_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM public.contract_approvals prior
                WHERE prior.workspace_id=w AND prior.contract_id=p_record AND prior.superseded_at IS NULL
                  AND prior.sort_order<a.sort_order AND prior.status<>'approved')
            ORDER BY a.approver_id LIMIT 201
          ) pending;
        ELSE
          SELECT coalesce(array_agg(DISTINCT approver_user_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_user_id FROM public.workflow_approvals a
              JOIN public.workflow_runs pending_run ON pending_run.id=a.run_id
                AND pending_run.workflow_id=a.workflow_id AND pending_run.workspace_id=a.workspace_id
                AND pending_run.entity=a.entity AND pending_run.entity_id=a.entity_id
                AND pending_run.status='waiting_approval' AND NOT pending_run.is_test
              WHERE a.workspace_id=w AND a.workflow_id=p_workflow
              AND a.workflow_version=p_version AND a.entity=p_entity AND a.entity_id=p_record
              AND a.status='pending' AND a.approver_user_id IS NOT NULL
              AND public.sales_workflow_approval_recipient(p_workflow,a.approver_user_id,p_entity,p_record,p_version)
            ORDER BY a.approver_user_id LIMIT 201
          ) pending;
        END IF;
      WHEN 'project_members' THEN
        source_project:=CASE WHEN p_entity='projects' THEN p_record
          WHEN p_entity IN('project_tasks','project_milestones') THEN nullif(source->>'project_id','')::uuid END;
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.project_members m JOIN public.projects p
            ON p.id=m.project_id AND p.workspace_id=m.workspace_id
            WHERE m.workspace_id=w AND p.id=source_project AND p.workspace_id=w
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'team' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_group_members m JOIN public.user_groups g ON g.id=m.group_id
            WHERE g.id=rule_id AND g.workspace_id=w ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'job_role' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_job_roles m JOIN public.job_roles r ON r.id=m.role_id
            WHERE r.id=rule_id AND m.workspace_id=w AND (r.workspace_id IS NULL OR r.workspace_id=w)
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'followers' THEN issues:=array_append(issues,'followers_unavailable');
    END CASE;
    SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM unnest(selected) x WHERE x IS NOT NULL;
    IF cardinality(selected)=0 AND kind<>'followers' THEN
      issues:=array_append(issues,'recipient_source_unavailable');
    END IF;
    recipients:=recipients||selected;
  END LOOP;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO recipients FROM unnest(recipients) x WHERE x IS NOT NULL;
  candidate_count:=cardinality(recipients);
  IF candidate_count>200 THEN
    RETURN jsonb_build_object('sent',0,'candidates',candidate_count,'excluded',candidate_count,
      'issues',jsonb_build_array('recipient_limit_exceeded'),'duplicate',0);
  END IF;

  -- Never render the executor's snapshot into a different user's notification.
  IF strpos(p_title,'{{')>0 OR strpos(coalesce(p_body,''),'{{')>0 THEN
    title:='Atualização no TechERP';body:='Acesse o registro para consultar os detalhes.';
  ELSE title:=p_title;body:=p_body;
  END IF;
  href:=CASE p_entity
    WHEN 'leads' THEN '/leads/'||p_record WHEN 'contacts' THEN '/contacts/'||p_record
    WHEN 'companies' THEN '/companies/'||p_record WHEN 'deals' THEN '/deals/'||p_record
    WHEN 'tickets' THEN '/tickets/'||p_record WHEN 'ats_jobs' THEN '/ats/jobs/'||p_record
    WHEN 'ats_candidates' THEN '/candidates/'||p_record
    WHEN 'ats_applications' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'ats_interviews' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'ats_offers' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'people_documents' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'hiring_fiscal_documents' THEN techerp_api.notification_finance_fiscal_href(w,p_record)
    WHEN 'hiring_preparation_requests' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'people' THEN techerp_api.notification_hr_href(w,p_entity,p_record)
    WHEN 'projects' THEN '/projects/'||p_record
    WHEN 'project_tasks' THEN '/projects/tasks?taskId='||p_record
    WHEN 'project_milestones' THEN techerp_api.notification_project_milestone_href(w,p_record)
    WHEN 'contracts' THEN '/contracts/'||p_record
    WHEN 'financial_entries' THEN '/finance/entries/'||p_record WHEN 'services' THEN '/services/'||p_record
    WHEN 'proposals' THEN '/proposals/'||p_record ELSE NULL END;
  FOREACH recipient IN ARRAY recipients LOOP
    IF NOT public.is_workspace_member(w,recipient)
      OR NOT techerp_api.notification_source_visible(w,recipient,p_entity,p_record)
      OR NOT techerp_api.notification_people_recipient(ev.id,recipient) THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    SELECT notification_preferences INTO prefs FROM public.profiles WHERE id=recipient;
    IF NOT FOUND THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    intent_id:=NULL;
    INSERT INTO public.notification_delivery_intents(workspace_id,workflow_id,run_id,workflow_version,step_path,
     source_table,source_id,recipient_user_id,event_key,delivery_config,payload_content_neutral)
    VALUES(w,p_workflow,p_run,p_version,p_step,p_entity,p_record,recipient,resolved_event,config,
     jsonb_build_object('title','Atualização no TechERP','body','Consulte a central de notificações do TechERP.','href',href))
    ON CONFLICT(workspace_id,run_id,step_path,recipient_user_id) DO NOTHING RETURNING id INTO intent_id;
    intent_existed:=intent_id IS NULL;
    IF intent_existed THEN
     SELECT id INTO intent_id FROM public.notification_delivery_intents WHERE workspace_id=w AND run_id=p_run AND step_path=p_step
      AND recipient_user_id=recipient AND workflow_id=p_workflow AND workflow_version=p_version AND source_table=p_entity AND source_id=p_record
      AND delivery_config=config AND event_key=resolved_event;
     IF intent_id IS NULL THEN RAISE EXCEPTION 'A ocorrência já possui outra configuração.' USING ERRCODE='22023';END IF;
    END IF;
    IF resolved_event='people.approval.pending' THEN
     created:=techerp_api.notification_people_existing_inapp(ev.id,recipient);
     IF created IS NULL THEN RAISE EXCEPTION 'A aprovação mudou antes da entrega.' USING ERRCODE='42501';END IF;
     UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;
    END IF;
    FOR requested_channel IN SELECT value#>>'{}' FROM jsonb_array_elements(channels) LOOP
     IF requested_channel='inapp' THEN CONTINUE;END IF;
     job_id:=NULL;
     INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,
      next_attempt_at,notification_intent_id)
     VALUES(w,p_workflow,'nfd:'||intent_id||':'||requested_channel,p_step,requested_channel,'user:'||recipient,'queued',0,now(),intent_id)
     ON CONFLICT(notification_intent_id,channel) WHERE notification_intent_id IS NOT NULL DO NOTHING RETURNING id INTO job_id;
     IF job_id IS NOT NULL THEN queued_count:=queued_count+1;END IF;
    END LOOP;
    inapp:=channels?'inapp' AND public.notification_event_inapp(w,recipient,resolved_event);
    IF inapp THEN
     IF resolved_event='people.approval.pending' THEN
      created:=techerp_api.notification_people_existing_inapp(ev.id,recipient);
      IF created IS NOT NULL THEN duplicate_count:=duplicate_count+1;
       UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;
      ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');END IF;
     ELSE
     dedupe:='workflow-notification:'||p_run||':'||p_step||':'||recipient;created:=NULL;
     INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
      VALUES(w,executor,recipient,'workflow',title,body,href,p_entity,p_record,dedupe)
      ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id INTO created;
     IF created IS NOT NULL THEN UPDATE public.notification_workspace_context SET event_key=resolved_event WHERE notification_id=created AND workspace_id=w;sent_count:=sent_count+1;
     ELSE SELECT id INTO created FROM public.notifications WHERE dedupe_key=dedupe;
      IF created IS NOT NULL THEN duplicate_count:=duplicate_count+1;
      ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'notification_not_created');END IF;
     END IF;
     IF created IS NOT NULL THEN UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;END IF;
     END IF;
    ELSE
     IF channels?'inapp' THEN excluded_count:=excluded_count+1;issues:=array_append(issues,'preferences_disabled');END IF;
     IF intent_existed THEN duplicate_count:=duplicate_count+1;END IF;
    END IF;
    PERFORM techerp_api.notification_schedule_capture(intent_id);
  END LOOP;
  IF sent_count=0 AND duplicate_count=0 AND queued_count=0 AND cardinality(issues)=0 THEN
    issues:=ARRAY['no_eligible_recipients'];
  END IF;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO issues FROM unnest(issues) x;
  RETURN jsonb_build_object('sent',sent_count,'candidates',candidate_count,'excluded',excluded_count,
    'issues',to_jsonb(issues),'duplicate',duplicate_count,'queued',queued_count,'suppressed',0);
END $$;

CREATE FUNCTION techerp_api.notification_schedule_recipients(p_parent uuid,p_rule jsonb) RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;wf public.workflows;ev public.workflow_events;
 p_workflow uuid;p_version integer;p_entity text;p_record uuid;p_rules jsonb;w uuid;executor uuid;source jsonb;
 rule jsonb;kind text;rule_id uuid;recipients uuid[]:='{}';selected uuid[];source_project uuid;
 manager uuid;leader jsonb;policy public.hiring_area_policies;issues text[]:='{}';resolved_event text;
BEGIN
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_parent AND occurrence_kind='initial';
 IF i.id IS NULL THEN RETURN '{}'::uuid[];END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=i.workflow_id AND workspace_id=i.workspace_id AND enabled AND status='published' AND published_version=i.workflow_version;
 IF wf.id IS NULL THEN RETURN '{}'::uuid[];END IF;
 SELECT e.* INTO ev FROM public.workflow_runs r JOIN public.workflow_events e ON e.id=r.event_id WHERE r.id=i.run_id;
 p_workflow:=i.workflow_id;p_version:=i.workflow_version;p_entity:=i.source_table;p_record:=i.source_id;
 p_rules:=jsonb_build_array(p_rule);w:=i.workspace_id;executor:=coalesce(wf.execution_user_id,wf.owner_id);resolved_event:=i.event_key;
 EXECUTE format('SELECT to_jsonb(s) FROM public.%I s WHERE id=$1 AND workspace_id=$2',p_entity) INTO source USING p_record,w;
 IF source IS NULL THEN RETURN '{}'::uuid[];END IF;
  FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    IF jsonb_typeof(rule) IS DISTINCT FROM 'object'
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(rule) k WHERE k NOT IN('kind','id')) THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    kind:=rule->>'kind';rule_id:=NULL;selected:='{}';
    IF kind IS NULL OR kind NOT IN('workflow_owner','user','source_responsible','source_creator',
      'area_manager','pending_approvers','project_members','team','job_role','followers') THEN
      RAISE EXCEPTION 'Seletor de destinatário inválido.' USING ERRCODE='22023';
    END IF;
    IF kind IN('user','team','job_role') THEN
      IF coalesce(rule->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Identificador de destinatário inválido.' USING ERRCODE='22023';
      END IF;
      rule_id:=(rule->>'id')::uuid;
    ELSIF rule?'id' THEN
      RAISE EXCEPTION 'Seletor não aceita identificador manual.' USING ERRCODE='22023';
    END IF;
    CASE kind
      WHEN 'workflow_owner' THEN selected:=ARRAY[executor];
      WHEN 'user' THEN selected:=ARRAY[rule_id];
      WHEN 'source_creator' THEN
        -- owner_id is not universally a creator; never infer it when provenance is absent.
        selected:=ARRAY[CASE WHEN p_entity='hiring_fiscal_documents' THEN nullif(source->>'uploaded_by','')::uuid ELSE nullif(source->>'created_by','')::uuid END];
      WHEN 'source_responsible' THEN
        CASE p_entity
          WHEN 'hiring_fiscal_documents' THEN selected:=ARRAY[techerp_api.notification_finance_fiscal_responsible(w,p_record)];
          WHEN 'tickets' THEN selected:=ARRAY[coalesce(nullif(source->>'assignee_id','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_jobs' THEN selected:=ARRAY[coalesce(nullif(source->>'recruiter_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'ats_interviews' THEN selected:=ARRAY[coalesce(nullif(source->>'interviewer_id','')::uuid,nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
          WHEN 'project_tasks' THEN
            SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM (
              SELECT DISTINCT x FROM (
              SELECT nullif(source->>'assignee_id','')::uuid x
              UNION SELECT value::uuid FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(source->'assignee_ids')='array' THEN source->'assignee_ids' ELSE '[]'::jsonb END)
              ) ids WHERE x IS NOT NULL ORDER BY x LIMIT 201
            ) s;
          ELSE selected:=ARRAY[coalesce(nullif(source->>'assigned_to','')::uuid,nullif(source->>'owner_id','')::uuid)];
        END CASE;
      WHEN 'area_manager' THEN
        manager:=NULL;
        IF p_entity='people' THEN
          SELECT profile_id INTO manager FROM public.people m
            WHERE m.id=nullif(source->>'manager_id','')::uuid AND m.workspace_id=w
              AND NOT coalesce((to_jsonb(m)->>'archived')::boolean,false);
        ELSIF p_entity='deals' THEN
          leader:=techerp_api.notification_deal_leader(w,executor,p_record);
          IF leader->>'status'='ok' THEN manager:=nullif(leader->>'leader_id','')::uuid;
          ELSIF leader->>'status'='ambiguous' THEN issues:=array_append(issues,'recipient_source_ambiguous');
          END IF;
        ELSIF p_entity='ats_jobs' THEN
          SELECT * INTO policy FROM public.hiring_area_policies
            WHERE workspace_id=w AND area_id=nullif(source->>'hiring_area_id','')::uuid;
          IF EXISTS(SELECT 1 FROM public.hiring_demand_requests r
            WHERE r.workspace_id=w AND r.job_id=p_record AND r.revision=nullif(source->>'hiring_revision','')::integer) THEN
            -- Only the canonical request records who asked and which substitute was
            -- selected. The job creator is not necessarily that requester.
            SELECT s.approver_id INTO manager FROM public.hiring_demand_requests r
              JOIN public.hiring_demand_steps s ON s.request_id=r.id AND s.workspace_id=r.workspace_id
              WHERE r.workspace_id=w AND r.job_id=p_record
                AND r.revision=nullif(source->>'hiring_revision','')::integer
                AND r.policy_revision=policy.revision AND r.status IN('pending','approved')
                AND s.stage='manager' AND s.status IN('pending','approved');
          ELSE manager:=policy.manager_id;END IF;
        END IF;
        selected:=ARRAY[manager];
      WHEN 'pending_approvers' THEN
        IF resolved_event='people.approval.pending' THEN selected:=techerp_api.notification_hr_pending_approvers(ev.id);
        ELSIF p_entity='contracts' THEN
          SELECT coalesce(array_agg(DISTINCT approver_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_id FROM public.contract_approvals a WHERE a.workspace_id=w AND a.contract_id=p_record
              AND source->>'status'='in_review'
              AND a.status='pending' AND a.superseded_at IS NULL AND a.approver_id IS NOT NULL
              AND techerp_api.notification_contract_approver(w,a.approver_id,a.id)
              AND a.sort_order=(SELECT min(b.sort_order) FROM public.contract_approvals b
                WHERE b.workspace_id=w AND b.contract_id=p_record AND b.status='pending' AND b.superseded_at IS NULL)
              AND NOT EXISTS(SELECT 1 FROM public.contract_approvals prior
                WHERE prior.workspace_id=w AND prior.contract_id=p_record AND prior.superseded_at IS NULL
                  AND prior.sort_order<a.sort_order AND prior.status<>'approved')
            ORDER BY a.approver_id LIMIT 201
          ) pending;
        ELSE
          SELECT coalesce(array_agg(DISTINCT approver_user_id),'{}') INTO selected FROM (
            SELECT DISTINCT a.approver_user_id FROM public.workflow_approvals a
              JOIN public.workflow_runs pending_run ON pending_run.id=a.run_id
                AND pending_run.workflow_id=a.workflow_id AND pending_run.workspace_id=a.workspace_id
                AND pending_run.entity=a.entity AND pending_run.entity_id=a.entity_id
                AND pending_run.status='waiting_approval' AND NOT pending_run.is_test
              WHERE a.workspace_id=w AND a.workflow_id=p_workflow
              AND a.workflow_version=p_version AND a.entity=p_entity AND a.entity_id=p_record
              AND a.status='pending' AND a.approver_user_id IS NOT NULL
              AND public.sales_workflow_approval_recipient(p_workflow,a.approver_user_id,p_entity,p_record,p_version)
            ORDER BY a.approver_user_id LIMIT 201
          ) pending;
        END IF;
      WHEN 'project_members' THEN
        source_project:=CASE WHEN p_entity='projects' THEN p_record
          WHEN p_entity IN('project_tasks','project_milestones') THEN nullif(source->>'project_id','')::uuid END;
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.project_members m JOIN public.projects p
            ON p.id=m.project_id AND p.workspace_id=m.workspace_id
            WHERE m.workspace_id=w AND p.id=source_project AND p.workspace_id=w
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'team' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_group_members m JOIN public.user_groups g ON g.id=m.group_id
            WHERE g.id=rule_id AND g.workspace_id=w ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'job_role' THEN
        SELECT coalesce(array_agg(user_id),'{}') INTO selected FROM (
          SELECT DISTINCT m.user_id FROM public.user_job_roles m JOIN public.job_roles r ON r.id=m.role_id
            WHERE r.id=rule_id AND m.workspace_id=w AND (r.workspace_id IS NULL OR r.workspace_id=w)
            ORDER BY m.user_id LIMIT 201
        ) s;
      WHEN 'followers' THEN issues:=array_append(issues,'followers_unavailable');
    END CASE;
    SELECT coalesce(array_agg(DISTINCT x),'{}') INTO selected FROM unnest(selected) x WHERE x IS NOT NULL;
    IF cardinality(selected)=0 AND kind<>'followers' THEN
      issues:=array_append(issues,'recipient_source_unavailable');
    END IF;
    recipients:=recipients||selected;
  END LOOP;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO recipients FROM unnest(recipients) x WHERE x IS NOT NULL;

 IF cardinality(recipients)>200 THEN RETURN '{}'::uuid[];END IF;
 RETURN recipients;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_schedule_recipients(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_followup_child_current(p_child uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;p public.notification_delivery_intents;s public.notification_followup_schedules;
 o public.notification_followup_occurrences;targets uuid[];BEGIN
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_child AND occurrence_kind IN('reminder','escalation');
 SELECT * INTO s FROM public.notification_followup_schedules WHERE parent_intent_id=i.parent_intent_id;
 SELECT * INTO p FROM public.notification_delivery_intents WHERE id=s.parent_intent_id AND occurrence_kind='initial';
 SELECT * INTO o FROM public.notification_followup_occurrences WHERE schedule_id=s.id AND kind=i.occurrence_kind
  AND i.step_path='p12:'||s.id||':'||kind||':'||ordinal;
 IF i.id IS NULL OR p.id IS NULL OR s.id IS NULL OR o.schedule_id IS NULL
  OR ROW(i.workspace_id,i.workflow_id,i.run_id,i.workflow_version,i.source_table,i.source_id,i.event_key,i.delivery_config)
   IS DISTINCT FROM ROW(p.workspace_id,p.workflow_id,p.run_id,p.workflow_version,p.source_table,p.source_id,p.event_key,p.delivery_config)
  OR s.step_config IS DISTINCT FROM techerp_api.notification_schedule_step(s.workflow_id,s.workflow_version,s.step_path)
  OR clock_timestamp()>s.base_at+interval '168 hours'
  OR NOT EXISTS(SELECT 1 FROM public.notification_delivery_policies policy WHERE policy.workspace_id=i.workspace_id
   AND policy.followups_enabled AND policy.followup_daily_limit>0)
  OR NOT techerp_api.notification_schedule_source_current(p.id,'followup',i.recipient_user_id) THEN RETURN false;END IF;
 IF i.occurrence_kind='reminder' THEN RETURN i.recipient_user_id=s.recipient_user_id;END IF;
 IF p.event_key='people.approval.pending' THEN RETURN false;END IF;
 targets:=techerp_api.notification_schedule_recipients(p.id,s.step_config#>'{delivery,followup,escalation,recipient}');
 RETURN i.recipient_user_id=ANY(targets);
END $$;

-- A new bounded communication is derived from one published notification step.
-- No other Workflow action is evaluated, no original run status is changed.
CREATE FUNCTION techerp_api.notification_followup_emit(p_schedule uuid,p_kind text,p_ordinal integer,p_now timestamptz) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.notification_followup_schedules;p public.notification_delivery_intents;policy public.notification_delivery_policies;
 targets uuid[];eligible uuid[]:='{}';target uuid;child uuid;first_child uuid;notice uuid;ch text;path text;executor uuid;used integer;BEGIN
 SELECT * INTO s FROM public.notification_followup_schedules WHERE id=p_schedule FOR UPDATE;
 SELECT * INTO p FROM public.notification_delivery_intents WHERE id=s.parent_intent_id AND occurrence_kind='initial';
 IF s.id IS NULL OR p.id IS NULL OR p_kind IS NULL OR p_ordinal IS NULL OR p_now IS NULL
  OR p_kind NOT IN('reminder','escalation') OR p_ordinal NOT BETWEEN 1 AND 3
  OR(p_kind='escalation' AND(p_ordinal<>1 OR p.event_key='people.approval.pending'))
  OR p_now>s.base_at+interval '168 hours' OR NOT techerp_api.notification_schedule_source_current(p.id,'followup')
  OR s.step_config IS DISTINCT FROM techerp_api.notification_schedule_step(s.workflow_id,s.workflow_version,s.step_path)
  OR EXISTS(SELECT 1 FROM public.notification_followup_occurrences WHERE schedule_id=s.id AND kind=p_kind AND ordinal=p_ordinal) THEN RETURN 0;END IF;
 IF EXISTS(SELECT 1 FROM public.workflow_deliveries d JOIN public.notification_delivery_intents i ON i.id=d.notification_intent_id
  WHERE(i.id=p.id OR i.parent_intent_id=p.id) AND d.status='uncertain')
  OR EXISTS(SELECT 1 FROM public.notification_digest_candidates c JOIN public.workflow_deliveries d ON d.notification_digest_id=c.batch_id
   WHERE c.source_intent_id=p.id AND d.status='uncertain') THEN RETURN -2;END IF;
 IF EXISTS(SELECT 1 FROM public.workflow_deliveries d JOIN public.notification_delivery_intents i ON i.id=d.notification_intent_id
  WHERE(i.id=p.id OR i.parent_intent_id=p.id) AND d.status IN('queued','retry_scheduled','in_flight'))
  OR EXISTS(SELECT 1 FROM public.notification_digest_candidates c JOIN public.workflow_deliveries d ON d.notification_digest_id=c.batch_id
   WHERE c.source_intent_id=p.id AND d.status IN('queued','retry_scheduled','in_flight')) THEN RETURN -1;END IF;
 targets:=CASE WHEN p_kind='reminder' THEN ARRAY[p.recipient_user_id]
  ELSE techerp_api.notification_schedule_recipients(p.id,s.step_config#>'{delivery,followup,escalation,recipient}') END;
 FOREACH target IN ARRAY targets LOOP
  IF techerp_api.notification_schedule_source_current(p.id,'followup',target) THEN eligible:=array_append(eligible,target);END IF;
 END LOOP;
 SELECT coalesce(array_agg(DISTINCT x),'{}') INTO eligible FROM unnest(eligible) x;
 IF cardinality(eligible)=0 THEN
  INSERT INTO public.notification_followup_occurrences(schedule_id,workspace_id,kind,ordinal,created_at)
   VALUES(s.id,s.workspace_id,p_kind,p_ordinal,p_now) ON CONFLICT DO NOTHING;RETURN 0;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-followup-quota:'||s.workspace_id,0));
 SELECT * INTO policy FROM public.notification_delivery_policies WHERE workspace_id=s.workspace_id FOR SHARE;
 IF NOT coalesce(policy.followups_enabled,false) OR policy.followup_daily_limit<=0 THEN RETURN -1;END IF;
 SELECT coalesce(sum(recipient_count),0)::integer INTO used FROM public.notification_followup_occurrences
  WHERE workspace_id=s.workspace_id AND created_at>p_now-interval '24 hours';
 IF used+cardinality(eligible)>policy.followup_daily_limit THEN RETURN -1;END IF;
 INSERT INTO public.notification_followup_occurrences(schedule_id,workspace_id,kind,ordinal,recipient_count,created_at)
  VALUES(s.id,s.workspace_id,p_kind,p_ordinal,cardinality(eligible),p_now) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN 0;END IF;
 path:='p12:'||s.id||':'||p_kind||':'||p_ordinal;
 SELECT coalesce(execution_user_id,owner_id) INTO executor FROM public.workflows WHERE id=p.workflow_id;
 FOREACH target IN ARRAY eligible LOOP
  INSERT INTO public.notification_delivery_intents(workspace_id,workflow_id,run_id,workflow_version,step_path,
   source_table,source_id,recipient_user_id,event_key,delivery_config,payload_content_neutral,occurrence_kind,parent_intent_id)
  VALUES(p.workspace_id,p.workflow_id,p.run_id,p.workflow_version,path,p.source_table,p.source_id,target,p.event_key,p.delivery_config,
   p.payload_content_neutral,p_kind,p.id) RETURNING id INTO child;
  first_child:=coalesce(first_child,child);notice:=NULL;
  IF p.event_key='people.approval.pending' THEN notice:=p.notification_id;
  ELSIF public.notification_event_inapp(p.workspace_id,target,p.event_key) THEN
   INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
    VALUES(p.workspace_id,executor,target,'workflow',CASE WHEN p_kind='escalation' THEN 'Pendência encaminhada no TechERP' ELSE 'Lembrete no TechERP' END,
     'Consulte o registro autorizado na central de notificações.',p.payload_content_neutral->>'href',p.source_table,p.source_id,
     'notification-followup:'||s.id||':'||p_kind||':'||p_ordinal||':'||target)
    ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id INTO notice;
   IF notice IS NOT NULL THEN UPDATE public.notification_workspace_context SET event_key=p.event_key WHERE notification_id=notice AND workspace_id=p.workspace_id;END IF;
  END IF;
  IF notice IS NOT NULL THEN UPDATE public.notification_delivery_intents SET notification_id=notice WHERE id=child;END IF;
  FOR ch IN SELECT value#>>'{}' FROM jsonb_array_elements(p.delivery_config->'channels') LOOP
   IF ch='inapp' THEN CONTINUE;END IF;
   INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,next_attempt_at,notification_intent_id)
    VALUES(p.workspace_id,p.workflow_id,'nfd:'||child||':'||ch,path,ch,'user:'||target,'queued',0,p_now,child);
  END LOOP;
 END LOOP;
 UPDATE public.notification_followup_occurrences SET child_intent_id=first_child WHERE schedule_id=s.id AND kind=p_kind AND ordinal=p_ordinal;
 RETURN cardinality(eligible);
END $$;

REVOKE ALL ON FUNCTION techerp_api.notification_followup_child_current(uuid),
 techerp_api.notification_followup_emit(uuid,text,integer,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_digest_context(p_batch uuid,p_prune boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.notification_digest_batches;s public.notification_digest_settings;c public.notification_digest_candidates;
 i public.notification_delivery_intents;policy public.notification_delivery_policies;ctx jsonb;first_ctx jsonb;
 quiet_at timestamptz;kept integer:=0;why text;BEGIN
 SELECT * INTO b FROM public.notification_digest_batches WHERE id=p_batch;
 IF b.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 SELECT * INTO s FROM public.notification_digest_settings WHERE workspace_id=b.workspace_id AND user_id=b.recipient_user_id;
 SELECT * INTO policy FROM public.notification_delivery_policies WHERE workspace_id=b.workspace_id;
 IF NOT coalesce(policy.digest_enabled,false) THEN RETURN jsonb_build_object('allowed',false,'reason','policy_disabled');END IF;
 IF s.user_id IS NULL OR s.revision IS DISTINCT FROM b.settings_revision OR NOT techerp_api.notification_digest_settings_valid(s.settings)
  OR s.settings->>'enabled'<>'true' OR NOT s.settings->'channels'?b.channel THEN
  RETURN jsonb_build_object('allowed',false,'reason','preferences_disabled');END IF;
 IF NOT public.is_workspace_member(b.workspace_id,b.recipient_user_id) THEN
  RETURN jsonb_build_object('allowed',false,'reason','recipient_unavailable');END IF;
 FOR c IN SELECT * FROM public.notification_digest_candidates WHERE batch_id=b.id AND state IN('batched','consumed') ORDER BY id LIMIT 101 LOOP
  IF kept>=100 THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
  SELECT * INTO i FROM public.notification_delivery_intents WHERE id=c.source_intent_id;
  ctx:=NULL;
  IF i.id IS NOT NULL AND i.occurrence_kind='initial' AND i.parent_intent_id IS NULL
   AND i.event_key<>'legacy.workflow' AND i.event_key<>'people.approval.pending'
   AND techerp_api.notification_business_category(i.event_key) IS NOT NULL
   AND c.step_config#>>'{delivery,priority}'='low'
   AND c.settings_revision=b.settings_revision
   AND ROW(i.workspace_id,i.workflow_id,i.run_id,i.workflow_version,i.step_path,i.recipient_user_id,i.source_table,i.source_id)
    IS NOT DISTINCT FROM ROW(c.workspace_id,c.workflow_id,c.run_id,c.workflow_version,c.step_path,c.recipient_user_id,c.source_table,c.source_id)
   AND c.step_config IS NOT DISTINCT FROM techerp_api.notification_schedule_step(c.workflow_id,c.workflow_version,c.step_path)
   AND techerp_api.notification_schedule_delivery_valid(c.step_config->'delivery',i.event_key) THEN
   ctx:=techerp_api.notification_intent_context(i.id,b.channel);
  END IF;
  why:=coalesce(ctx->>'reason','workflow_changed');
  IF coalesce((ctx->>'allowed')::boolean,false) OR why='quiet_hours' THEN
   kept:=kept+1;
   IF why='quiet_hours' THEN quiet_at:=greatest(quiet_at,(ctx->>'nextAttemptAt')::timestamptz);
   ELSIF first_ctx IS NULL THEN first_ctx:=ctx;
   ELSIF ROW(first_ctx->>'endpointHash',first_ctx->>'policyRevision',first_ctx->>'consentRevision',first_ctx->>'senderPhoneNumberId',first_ctx->>'templateName',first_ctx->>'templateLanguage')
    IS DISTINCT FROM ROW(ctx->>'endpointHash',ctx->>'policyRevision',ctx->>'consentRevision',ctx->>'senderPhoneNumberId',ctx->>'templateName',ctx->>'templateLanguage') THEN
    RETURN jsonb_build_object('allowed',false,'reason','endpoint_changed');
   END IF;
  ELSIF why IN('workflow_changed','run_unavailable','recipient_unavailable','executor_transport_forbidden','preferences_disabled') THEN
   IF p_prune THEN UPDATE public.notification_digest_candidates SET state='cancelled' WHERE id=c.id;END IF;
  ELSE RETURN ctx||jsonb_build_object('allowed',false);END IF;
 END LOOP;
 IF kept=0 THEN RETURN jsonb_build_object('allowed',false,'reason','digest_empty');END IF;
 IF quiet_at IS NOT NULL THEN RETURN jsonb_build_object('allowed',false,'reason','quiet_hours','nextAttemptAt',quiet_at);END IF;
 IF first_ctx IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 RETURN jsonb_build_object('allowed',true,'kind','digest','batchId',b.id,'workspaceId',b.workspace_id,'recipientId',b.recipient_user_id,
  'email',first_ctx->'email','phone',first_ctx->'phone','senderPhoneNumberId',first_ctx->'senderPhoneNumberId',
  'templateName',first_ctx->'templateName','templateLanguage',first_ctx->'templateLanguage',
  'policyRevision',first_ctx->'policyRevision','consentRevision',first_ctx->'consentRevision','endpointHash',first_ctx->'endpointHash');
END $$;

CREATE FUNCTION techerp_api.notification_schedule_tick_at(p_limit integer,p_now timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.notification_followup_schedules;c public.notification_digest_candidates;settings public.notification_digest_settings;
 grp record;slot record;future_slot record;batch uuid;ctx jsonb;done integer;ordinal integer;max_ordinal integer;interval_hours integer;
 scanned integer:=0;members integer;digests integer:=0;followups integer:=0;suppressed integer:=0;BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_now IS NULL OR NOT isfinite(p_now) THEN
  RAISE EXCEPTION 'Limite temporal inválido.' USING ERRCODE='22023';END IF;
 -- The candidate budget, not just the emitted count, bounds all work.
 FOR s IN SELECT * FROM public.notification_followup_schedules WHERE stopped_at IS NULL AND next_check_at<=p_now
  AND least(next_reminder_at,next_escalation_at)<=p_now ORDER BY next_check_at,least(next_reminder_at,next_escalation_at),id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
  IF p_now>s.base_at+interval '168 hours' OR s.step_config IS DISTINCT FROM techerp_api.notification_schedule_step(s.workflow_id,s.workflow_version,s.step_path)
   OR NOT techerp_api.notification_schedule_source_current(s.parent_intent_id,'followup') THEN
   UPDATE public.notification_followup_schedules SET stopped_at=p_now WHERE id=s.id;suppressed:=suppressed+1;CONTINUE;END IF;
  IF NOT EXISTS(SELECT 1 FROM public.notification_delivery_policies WHERE workspace_id=s.workspace_id AND followups_enabled AND followup_daily_limit>0) THEN
   UPDATE public.notification_followup_schedules SET stopped_at=p_now WHERE id=s.id;suppressed:=suppressed+1;CONTINUE;END IF;
  IF s.next_reminder_at<=p_now THEN
   interval_hours:=(s.step_config#>>'{delivery,followup,reminder,interval_hours}')::integer;
   max_ordinal:=(s.step_config#>>'{delivery,followup,reminder,max_occurrences}')::integer;
   ordinal:=least(max_ordinal,greatest(s.next_reminder,floor(extract(epoch FROM(p_now-s.base_at))/(interval_hours*3600))::integer));
   done:=techerp_api.notification_followup_emit(s.id,'reminder',ordinal,p_now);
   IF done=-2 THEN
    UPDATE public.notification_followup_schedules SET stopped_at=p_now WHERE id=s.id;suppressed:=suppressed+1;CONTINUE;
   ELSIF done=-1 THEN
    UPDATE public.notification_followup_schedules SET next_check_at=p_now+interval '5 minutes' WHERE id=s.id;CONTINUE;
   ELSE
    UPDATE public.notification_followup_schedules SET next_reminder=ordinal+1,
     next_reminder_at=CASE WHEN ordinal<max_ordinal THEN base_at+make_interval(hours=>interval_hours*(ordinal+1)) END WHERE id=s.id;
    followups:=followups+done;IF done=0 THEN suppressed:=suppressed+1;END IF;
   END IF;
  END IF;
  IF s.next_escalation_at<=p_now THEN
   done:=techerp_api.notification_followup_emit(s.id,'escalation',1,p_now);
   IF done=-2 THEN
    UPDATE public.notification_followup_schedules SET stopped_at=p_now WHERE id=s.id;suppressed:=suppressed+1;CONTINUE;
   ELSIF done=-1 THEN
    UPDATE public.notification_followup_schedules SET next_check_at=p_now+interval '5 minutes' WHERE id=s.id;CONTINUE;
   ELSE UPDATE public.notification_followup_schedules SET next_escalation_at=NULL WHERE id=s.id;
    followups:=followups+done;IF done=0 THEN suppressed:=suppressed+1;END IF;END IF;
  END IF;
  UPDATE public.notification_followup_schedules SET stopped_at=p_now WHERE id=s.id AND next_reminder_at IS NULL AND next_escalation_at IS NULL;
 END LOOP;
 -- A missed cadence closes only its latest elapsed civil slot. Already-used
 -- slots and the 100-member ceiling move overflow to a future slot, not a burst.
 FOR grp IN SELECT workspace_id,recipient_user_id,channel FROM public.notification_digest_candidates
  WHERE state='waiting' AND next_at<=p_now GROUP BY workspace_id,recipient_user_id,channel
  ORDER BY min(next_at),workspace_id,recipient_user_id,channel LIMIT p_limit LOOP
  IF scanned>=p_limit THEN EXIT;END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('notification-digest-close:'||grp.workspace_id||':'||grp.recipient_user_id||':'||grp.channel,0));
  SELECT * INTO settings FROM public.notification_digest_settings WHERE workspace_id=grp.workspace_id AND user_id=grp.recipient_user_id FOR SHARE;
  SELECT * INTO slot FROM techerp_api.notification_digest_slot(settings.settings,p_now,false);
  SELECT * INTO future_slot FROM techerp_api.notification_digest_slot(settings.settings,p_now,true);
  batch:=NULL;members:=0;
  IF slot.slot_at IS NOT NULL AND settings.settings->>'enabled'='true'
   AND settings.settings->'channels'?grp.channel
   AND EXISTS(SELECT 1 FROM public.notification_delivery_policies WHERE workspace_id=grp.workspace_id AND digest_enabled) THEN
   SELECT id INTO batch FROM public.notification_digest_batches WHERE workspace_id=grp.workspace_id AND recipient_user_id=grp.recipient_user_id
    AND channel=grp.channel AND slot_key=slot.slot_key;
  END IF;
  IF batch IS NOT NULL THEN
   FOR c IN SELECT * FROM public.notification_digest_candidates WHERE workspace_id=grp.workspace_id AND recipient_user_id=grp.recipient_user_id
    AND channel=grp.channel AND state='waiting' AND next_at<=p_now ORDER BY next_at,id LIMIT least(100,p_limit-scanned) FOR UPDATE SKIP LOCKED LOOP
    scanned:=scanned+1;
    UPDATE public.notification_digest_candidates SET next_at=future_slot.slot_at WHERE id=c.id;
   END LOOP;CONTINUE;
  END IF;
  FOR c IN SELECT * FROM public.notification_digest_candidates WHERE workspace_id=grp.workspace_id AND recipient_user_id=grp.recipient_user_id
   AND channel=grp.channel AND state='waiting' AND next_at<=p_now ORDER BY next_at,id LIMIT least(100,p_limit-scanned) FOR UPDATE SKIP LOCKED LOOP
   scanned:=scanned+1;
   IF slot.slot_at IS NULL OR future_slot.slot_at IS NULL OR settings.user_id IS NULL OR settings.settings->>'enabled'<>'true'
    OR NOT settings.settings->'channels'?grp.channel OR c.settings_revision IS DISTINCT FROM settings.revision
    OR NOT EXISTS(SELECT 1 FROM public.notification_delivery_policies WHERE workspace_id=c.workspace_id AND digest_enabled)
    OR c.step_config IS DISTINCT FROM techerp_api.notification_schedule_step(c.workflow_id,c.workflow_version,c.step_path)
    OR NOT techerp_api.notification_schedule_source_current(c.source_intent_id,'digest') THEN
    UPDATE public.notification_digest_candidates SET state='cancelled' WHERE id=c.id;
    UPDATE public.workflow_deliveries SET status='suppressed',reason_code='workflow_changed',last_error='workflow_changed',updated_at=p_now
     WHERE notification_intent_id=c.source_intent_id AND channel=c.channel AND status='queued' AND attempts=0;
    suppressed:=suppressed+1;CONTINUE;
   END IF;
   IF batch IS NULL THEN
    INSERT INTO public.notification_digest_batches(workspace_id,recipient_user_id,channel,settings_revision,slot_key,slot_at)
     VALUES(c.workspace_id,c.recipient_user_id,c.channel,settings.revision,slot.slot_key,slot.slot_at) RETURNING id INTO batch;
   END IF;
   UPDATE public.notification_digest_candidates SET state='batched',batch_id=batch WHERE id=c.id;members:=members+1;
   UPDATE public.workflow_deliveries SET status='deduped',reason_code='digest_member',last_error='digest_member',updated_at=p_now
    WHERE notification_intent_id=c.source_intent_id AND channel=c.channel AND status='queued' AND attempts=0;
  END LOOP;
  IF batch IS NOT NULL AND members>0 THEN
   ctx:=techerp_api.notification_digest_context(batch);
   INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,next_attempt_at,notification_digest_id,reason_code)
    VALUES(grp.workspace_id,NULL,'nfdigest:'||batch||':'||grp.channel,NULL,grp.channel,'user:'||grp.recipient_user_id,
     CASE WHEN coalesce((ctx->>'allowed')::boolean,false) OR ctx->>'reason'='quiet_hours' THEN 'queued' ELSE 'suppressed' END,0,p_now,batch,
     CASE WHEN NOT coalesce((ctx->>'allowed')::boolean,false) THEN ctx->>'reason' END);
   IF coalesce((ctx->>'allowed')::boolean,false) OR ctx->>'reason'='quiet_hours' THEN digests:=digests+1;ELSE suppressed:=suppressed+1;END IF;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('digests_queued',digests,'followups_queued',followups,'suppressed',suppressed);
END $$;
CREATE FUNCTION public.notification_schedule_tick(p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM techerp_api.notification_service();RETURN techerp_api.notification_schedule_tick_at(p_limit,clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_digest_context(uuid,boolean),
 techerp_api.notification_schedule_tick_at(integer,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.notification_schedule_tick(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_schedule_tick(integer) TO service_role;


-- Fenced ledger routing. The existing personal/Slack OIDs stay authoritative.
CREATE OR REPLACE FUNCTION techerp_api.notification_intent_context(p_intent uuid,p_channel text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;wf public.workflows;r public.workflow_runs;executor uuid;
 p public.notification_delivery_policies;c public.notification_delivery_consents;email text;phone text;quiet timestamptz;
 href text; resolved_event text;
BEGIN
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_intent;
 IF i.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 IF i.occurrence_kind<>'initial' AND NOT techerp_api.notification_followup_child_current(i.id) THEN
  RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;

 SELECT * INTO wf FROM public.workflows WHERE id=i.workflow_id AND workspace_id=i.workspace_id
  AND status='published' AND enabled AND published_version=i.workflow_version AND entity=i.source_table;
 IF wf.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 SELECT * INTO r FROM public.workflow_runs WHERE id=i.run_id AND workflow_id=wf.id AND workspace_id=i.workspace_id
  AND entity=i.source_table AND entity_id=i.source_id AND owner_id=wf.owner_id AND NOT is_test
  AND status NOT IN('failed','cancelled','canceled','error');
 IF r.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','run_unavailable');END IF;
 resolved_event:=techerp_api.notification_business_run_key(i.workflow_id,i.run_id,i.workflow_version);
 IF resolved_event IS NULL OR i.event_key IS DISTINCT FROM resolved_event THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 IF NOT techerp_api.notification_people_recipient(r.event_id,i.recipient_user_id) THEN
  RETURN jsonb_build_object('allowed',false,'reason','recipient_unavailable');END IF;
 executor:=coalesce(wf.execution_user_id,wf.owner_id);
 IF NOT public.is_workspace_member(i.workspace_id,executor) OR NOT public.is_workspace_member(i.workspace_id,i.recipient_user_id)
 OR NOT techerp_api.notification_source_visible(i.workspace_id,executor,i.source_table,i.source_id)
 OR NOT techerp_api.notification_source_visible(i.workspace_id,i.recipient_user_id,i.source_table,i.source_id)
 OR NOT public.sales_worker_authorize('workflows',wf.id,jsonb_build_array(jsonb_build_object('workflow_version',i.workflow_version),
 CASE WHEN i.source_table IN('leads','contacts','companies','deals','tickets','quotes','proposals','activities')
 THEN jsonb_build_object('table',i.source_table,'id',i.source_id,'action','view')
 ELSE jsonb_build_object('record_table',i.source_table,'id',i.source_id)END)) THEN
  RETURN jsonb_build_object('allowed',false,'reason','recipient_unavailable');END IF;
 IF NOT techerp_api.notification_transport_allowed(i.workspace_id,executor,p_channel) THEN
  RETURN jsonb_build_object('allowed',false,'reason','executor_transport_forbidden');END IF;
 SELECT * INTO p FROM public.notification_delivery_policies WHERE workspace_id=i.workspace_id;
 IF p_channel='whatsapp' AND EXISTS(SELECT 1 FROM public.notification_whatsapp_health h WHERE h.workspace_id=i.workspace_id
  AND h.paused_until='infinity'::timestamptz AND(NOT coalesce(p.whatsapp_enabled,false) OR h.connection_id IN(
   SELECT n.connection_id FROM public.wa_cloud_numbers n WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id))) THEN
  RETURN jsonb_build_object('allowed',false,'reason','provider_rate_limited');END IF;
 IF p.workspace_id IS NULL OR(p_channel='email' AND NOT p.email_enabled) OR(p_channel='whatsapp' AND NOT p.whatsapp_enabled) THEN
  RETURN jsonb_build_object('allowed',false,'reason','policy_disabled');END IF;
 IF p_channel='email' THEN
  IF NOT techerp_api.notification_external_event_preference(i.workspace_id,i.recipient_user_id,'email',i.event_key) THEN
   RETURN jsonb_build_object('allowed',false,'reason','preferences_disabled');END IF;
  SELECT u.email INTO email FROM auth.users u WHERE u.id=i.recipient_user_id AND u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL AND length(u.email)<=320 AND strpos(u.email,'@')>1;
  IF email IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','email_unconfirmed');END IF;
 ELSIF p_channel='whatsapp' THEN
  SELECT p2.phone INTO phone FROM public.profiles p2 WHERE id=i.recipient_user_id;
  SELECT * INTO c FROM public.notification_delivery_consents WHERE workspace_id=i.workspace_id AND user_id=i.recipient_user_id;
  IF c.user_id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','consent_missing');END IF;
  IF c.revoked_at IS NOT NULL OR c.granted_at IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','consent_revoked');END IF;
  IF phone IS NULL OR phone !~ '^\+[1-9][0-9]{7,14}$' OR phone IS DISTINCT FROM c.phone THEN
   RETURN jsonb_build_object('allowed',false,'reason','endpoint_changed');END IF;
  IF p.wa_sender_id IS NULL OR p.wa_template_name IS NULL OR p.wa_template_language IS NULL
   OR p.wa_estimated_unit_micros<=0 OR p.wa_daily_budget_micros<p.wa_estimated_unit_micros THEN
   RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n JOIN public.wa_cloud_connections connection ON connection.id=n.connection_id AND connection.workspace_id=n.workspace_id
    WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id AND n.available AND n.status='CONNECTED'
     AND connection.enabled AND connection.webhook_verified_at IS NOT NULL) THEN
   RETURN jsonb_build_object('allowed',false,'reason','sender_unavailable');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id
    AND upper(coalesce(n.quality_rating,'')) IN('GREEN','HIGH')) THEN
   RETURN jsonb_build_object('allowed',false,'reason','provider_rate_limited');END IF;
  IF EXISTS(SELECT 1 FROM public.whatsapp_number_suppressions s WHERE s.workspace_id=i.workspace_id
   AND s.phone_key=public.wa_phone_key(phone) AND s.released_at IS NULL AND s.expires_at>now()) THEN
   RETURN jsonb_build_object('allowed',false,'reason','recipient_suppressed');END IF;
  IF NOT techerp_api.notification_whatsapp_event_preference(i.workspace_id,i.recipient_user_id,i.event_key) THEN
   RETURN jsonb_build_object('allowed',false,'reason','preferences_disabled');END IF;
 ELSE RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 quiet:=techerp_api.notification_quiet_until(i.workspace_id,i.recipient_user_id);
 IF quiet='infinity'::timestamptz THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_preferences');END IF;
 IF quiet IS NOT NULL THEN RETURN jsonb_build_object('allowed',false,'reason','quiet_hours','nextAttemptAt',quiet);END IF;
 href:=i.payload_content_neutral->>'href';
 RETURN jsonb_build_object('allowed',true,'workspaceId',i.workspace_id,'workflowId',i.workflow_id,'runId',i.run_id,
  'recipientId',i.recipient_user_id,'email',email,'phone',phone,'senderPhoneNumberId',CASE WHEN p_channel='whatsapp' THEN p.wa_sender_id END,
  'templateName',CASE WHEN p_channel='whatsapp' THEN p.wa_template_name END,'templateLanguage',CASE WHEN p_channel='whatsapp' THEN p.wa_template_language END,
  'policyRevision',p.revision,'consentRevision',CASE WHEN p_channel='whatsapp' THEN c.revision END,
  'endpointHash',encode(sha256(convert_to(p_channel||':'||coalesce(email,phone),'UTF8')),'hex'),
  'source',jsonb_build_object('table',i.source_table,'id',i.source_id,'href',href))
  ||CASE WHEN i.occurrence_kind='initial' THEN '{}'::jsonb ELSE jsonb_build_object('kind',i.occurrence_kind,'parentIntentId',i.parent_intent_id) END;
END $$;

CREATE OR REPLACE FUNCTION public.notification_delivery_claim_personal_p4(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;i public.notification_delivery_intents;p public.notification_delivery_policies;
 c jsonb;reason text;limit_count integer;used integer;cost bigint;token uuid;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id AND notification_intent_id IS NOT NULL FOR UPDATE;
 IF d.id IS NULL THEN RETURN jsonb_build_object('result','already_done','reason','not_found');END IF;
 IF d.status='in_flight' THEN
  IF d.lease_until>now() THEN RETURN jsonb_build_object('result','in_flight');END IF;
  UPDATE public.workflow_deliveries SET status='uncertain',reason_code='lease_expired',last_error='lease_expired',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','uncertain','reason','lease_expired');
 END IF;
 IF d.status NOT IN('queued','retry_scheduled') THEN RETURN jsonb_build_object('result','already_done','reason',d.reason_code);END IF;
 IF d.next_attempt_at>now() THEN RETURN jsonb_build_object('result','deferred','nextAttemptAt',d.next_attempt_at,'reason',d.reason_code);END IF;
 IF d.attempts>=4 THEN
  UPDATE public.workflow_deliveries SET status='failed',reason_code='attempts_exhausted',last_error='attempts_exhausted',updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','already_done','reason','attempts_exhausted');END IF;
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=d.notification_intent_id;
 c:=techerp_api.notification_intent_context(i.id,d.channel);
 IF NOT(c->>'allowed')::boolean THEN
  reason:=c->>'reason';
  IF reason='quiet_hours' THEN
   UPDATE public.workflow_deliveries SET next_attempt_at=(c->>'nextAttemptAt')::timestamptz,reason_code=reason,updated_at=now() WHERE id=d.id;
   RETURN jsonb_build_object('result','deferred','reason',reason,'nextAttemptAt',c->'nextAttemptAt');END IF;
  UPDATE public.workflow_deliveries SET status='suppressed',reason_code=reason,last_error=reason,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
  PERFORM techerp_api.notification_fallback(i.id,reason);
  RETURN jsonb_build_object('result','suppressed','reason',reason);
 END IF;
 -- A retry must keep its original policy, consent, sender and endpoint. A changed
 -- number or admin policy cannot turn a suspended job into another destination.
 IF d.policy_revision IS NOT NULL AND(d.policy_revision<>(c->>'policyRevision')::integer
  OR d.endpoint_hash IS DISTINCT FROM c->>'endpointHash'
  OR d.consent_revision IS DISTINCT FROM (c->>'consentRevision')::integer
  OR d.notification_sender_id IS DISTINCT FROM c->>'senderPhoneNumberId') THEN
  UPDATE public.workflow_deliveries SET status='suppressed',reason_code='endpoint_changed',last_error='endpoint_changed',updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','suppressed','reason','endpoint_changed');END IF;
 PERFORM pg_advisory_xact_lock(hashtext('wfq:'||i.workspace_id::text||':'||d.channel));
 SELECT * INTO p FROM public.notification_delivery_policies WHERE workspace_id=i.workspace_id FOR SHARE;
 limit_count:=CASE WHEN d.channel='email' THEN p.email_daily_limit ELSE p.whatsapp_daily_limit END;
 SELECT count(*) INTO used FROM public.workflow_deliveries WHERE workspace_id=i.workspace_id AND channel=d.channel AND id<>d.id
  AND coalesce(notification_reserved_at,created_at)>now()-interval '24 hours' AND status IN('sent','in_flight','uncertain','retry_scheduled','accepted','delivered','read');
 reason:=NULL;
 IF used>=limit_count THEN reason:='quota_exceeded';END IF;
 IF d.channel='whatsapp' THEN
  IF EXISTS(SELECT 1 FROM public.workflow_deliveries WHERE workspace_id=i.workspace_id AND channel='whatsapp' AND id<>d.id
   AND(notification_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL) AND notification_currency IS DISTINCT FROM p.currency AND coalesce(notification_reserved_at,created_at)>now()-interval '24 hours'
   AND status IN('sent','in_flight','uncertain','retry_scheduled','accepted','delivered','read')) THEN reason:='budget_currency_changed';END IF;
  SELECT coalesce(sum(notification_cost_micros),0) INTO cost FROM public.workflow_deliveries
   WHERE workspace_id=i.workspace_id AND(notification_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL) AND channel='whatsapp' AND id<>d.id
    AND notification_currency=p.currency AND coalesce(notification_reserved_at,created_at)>now()-interval '24 hours'
    AND status IN('sent','in_flight','uncertain','retry_scheduled','accepted','delivered','read');
  IF cost+p.wa_estimated_unit_micros>p.wa_daily_budget_micros THEN reason:='budget_exceeded';END IF;
 END IF;
 IF reason IS NOT NULL THEN
  IF i.delivery_config->>'fallback'='email' AND d.channel='whatsapp' THEN
   UPDATE public.workflow_deliveries SET status='suppressed',reason_code=reason,last_error=reason,updated_at=now() WHERE id=d.id;
   PERFORM techerp_api.notification_fallback(i.id,reason);RETURN jsonb_build_object('result','suppressed','reason',reason);
  END IF;
  UPDATE public.workflow_deliveries SET next_attempt_at=now()+interval '1 hour',reason_code=reason,updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','deferred','reason',reason,'nextAttemptAt',now()+interval '1 hour');
 END IF;
 token:=gen_random_uuid();
 UPDATE public.workflow_deliveries SET status='in_flight',attempts=attempts+1,lease_token=token,notification_attempt_token=token,lease_until=now()+interval '120 seconds',notification_reserved_at=now(),
  policy_revision=(c->>'policyRevision')::integer,consent_revision=(c->>'consentRevision')::integer,endpoint_hash=c->>'endpointHash',
  notification_sender_id=c->>'senderPhoneNumberId',notification_template_name=c->>'templateName',notification_template_language=c->>'templateLanguage',
  notification_cost_micros=CASE WHEN d.channel='whatsapp' THEN p.wa_estimated_unit_micros END,notification_currency=CASE WHEN d.channel='whatsapp' THEN p.currency END,
  reason_code=NULL,last_error=NULL,next_attempt_at=NULL,updated_at=now() WHERE id=d.id;
 RETURN(c-ARRAY['allowed','endpointHash','policyRevision','consentRevision'])||jsonb_build_object('result','claimed','id',d.id,'token',token,'channel',d.channel,'idempotencyKey',d.idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_digest_claim_core(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;i public.notification_digest_batches;p public.notification_delivery_policies;
 c jsonb;reason text;limit_count integer;used integer;cost bigint;token uuid;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id AND notification_digest_id IS NOT NULL FOR UPDATE;
 IF d.id IS NULL THEN RETURN jsonb_build_object('result','already_done','reason','not_found');END IF;
 IF d.status='in_flight' THEN
  IF d.lease_until>now() THEN RETURN jsonb_build_object('result','in_flight');END IF;
  UPDATE public.workflow_deliveries SET status='uncertain',reason_code='lease_expired',last_error='lease_expired',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','uncertain','reason','lease_expired');
 END IF;
 IF d.status NOT IN('queued','retry_scheduled') THEN RETURN jsonb_build_object('result','already_done','reason',d.reason_code);END IF;
 IF d.next_attempt_at>now() THEN RETURN jsonb_build_object('result','deferred','nextAttemptAt',d.next_attempt_at,'reason',d.reason_code);END IF;
 IF d.attempts>=4 THEN
  UPDATE public.workflow_deliveries SET status='failed',reason_code='attempts_exhausted',last_error='attempts_exhausted',updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','already_done','reason','attempts_exhausted');END IF;
 SELECT * INTO i FROM public.notification_digest_batches WHERE id=d.notification_digest_id;
 c:=techerp_api.notification_digest_context(i.id);
 IF NOT(c->>'allowed')::boolean THEN
  reason:=c->>'reason';
  IF reason='quiet_hours' THEN
   UPDATE public.workflow_deliveries SET next_attempt_at=(c->>'nextAttemptAt')::timestamptz,reason_code=reason,updated_at=now() WHERE id=d.id;
   RETURN jsonb_build_object('result','deferred','reason',reason,'nextAttemptAt',c->'nextAttemptAt');END IF;
  UPDATE public.workflow_deliveries SET status='suppressed',reason_code=reason,last_error=reason,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','suppressed','reason',reason);
 END IF;
 -- A retry must keep its original policy, consent, sender and endpoint. A changed
 -- number or admin policy cannot turn a suspended job into another destination.
 IF d.policy_revision IS NOT NULL AND(d.policy_revision<>(c->>'policyRevision')::integer
  OR d.endpoint_hash IS DISTINCT FROM c->>'endpointHash'
  OR d.consent_revision IS DISTINCT FROM (c->>'consentRevision')::integer
  OR d.notification_sender_id IS DISTINCT FROM c->>'senderPhoneNumberId') THEN
  UPDATE public.workflow_deliveries SET status='suppressed',reason_code='endpoint_changed',last_error='endpoint_changed',updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','suppressed','reason','endpoint_changed');END IF;
 PERFORM pg_advisory_xact_lock(hashtext('wfq:'||i.workspace_id::text||':'||d.channel));
 SELECT * INTO p FROM public.notification_delivery_policies WHERE workspace_id=i.workspace_id FOR SHARE;
 limit_count:=CASE WHEN d.channel='email' THEN p.email_daily_limit ELSE p.whatsapp_daily_limit END;
 SELECT count(*) INTO used FROM public.workflow_deliveries WHERE workspace_id=i.workspace_id AND channel=d.channel AND id<>d.id
  AND coalesce(notification_reserved_at,created_at)>now()-interval '24 hours' AND status IN('sent','in_flight','uncertain','retry_scheduled','accepted','delivered','read');
 reason:=NULL;
 IF used>=limit_count THEN reason:='quota_exceeded';END IF;
 IF d.channel='whatsapp' THEN
  IF EXISTS(SELECT 1 FROM public.workflow_deliveries WHERE workspace_id=i.workspace_id AND channel='whatsapp' AND id<>d.id
   AND(notification_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL) AND notification_currency IS DISTINCT FROM p.currency AND coalesce(notification_reserved_at,created_at)>now()-interval '24 hours'
   AND status IN('sent','in_flight','uncertain','retry_scheduled','accepted','delivered','read')) THEN reason:='budget_currency_changed';END IF;
  SELECT coalesce(sum(notification_cost_micros),0) INTO cost FROM public.workflow_deliveries
   WHERE workspace_id=i.workspace_id AND(notification_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL) AND channel='whatsapp' AND id<>d.id
    AND notification_currency=p.currency AND coalesce(notification_reserved_at,created_at)>now()-interval '24 hours'
    AND status IN('sent','in_flight','uncertain','retry_scheduled','accepted','delivered','read');
  IF cost+p.wa_estimated_unit_micros>p.wa_daily_budget_micros THEN reason:='budget_exceeded';END IF;
 END IF;
 IF reason IS NOT NULL THEN
  UPDATE public.workflow_deliveries SET next_attempt_at=now()+interval '1 hour',reason_code=reason,updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','deferred','reason',reason,'nextAttemptAt',now()+interval '1 hour');
 END IF;
 token:=gen_random_uuid();
 UPDATE public.workflow_deliveries SET status='in_flight',attempts=attempts+1,lease_token=token,notification_attempt_token=token,lease_until=now()+interval '120 seconds',notification_reserved_at=now(),
  policy_revision=(c->>'policyRevision')::integer,consent_revision=(c->>'consentRevision')::integer,endpoint_hash=c->>'endpointHash',
  notification_sender_id=c->>'senderPhoneNumberId',notification_template_name=c->>'templateName',notification_template_language=c->>'templateLanguage',
  notification_cost_micros=CASE WHEN d.channel='whatsapp' THEN p.wa_estimated_unit_micros END,notification_currency=CASE WHEN d.channel='whatsapp' THEN p.currency END,
  reason_code=NULL,last_error=NULL,next_attempt_at=NULL,updated_at=now() WHERE id=d.id;
 RETURN(c-ARRAY['allowed','endpointHash','policyRevision','consentRevision'])||jsonb_build_object('result','claimed','id',d.id,'token',token,'channel',d.channel,'idempotencyKey',d.idempotency_key);
END $$;

CREATE FUNCTION techerp_api.notification_digest_preflight_core(p_id uuid,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;c jsonb;reason text;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id AND notification_digest_id IS NOT NULL FOR UPDATE;
 IF d.id IS NULL OR p_token IS NULL OR d.lease_token IS DISTINCT FROM p_token OR d.status<>'in_flight' OR d.lease_until<=now() THEN
  IF d.id IS NOT NULL AND d.status='in_flight' AND d.lease_token=p_token AND d.lease_until<=now() THEN
   UPDATE public.workflow_deliveries SET status='uncertain',lease_token=NULL,lease_until=NULL,reason_code='lease_expired',last_error='lease_expired',updated_at=now() WHERE id=d.id;
  END IF;
  RETURN jsonb_build_object('allowed',false,'result','uncertain','reason','lease_unavailable');END IF;
 c:=techerp_api.notification_digest_context(d.notification_digest_id);
 IF(c->>'allowed')::boolean AND(d.endpoint_hash IS DISTINCT FROM c->>'endpointHash'
  OR d.policy_revision<>(c->>'policyRevision')::integer OR d.consent_revision IS DISTINCT FROM(c->>'consentRevision')::integer
  OR d.notification_sender_id IS DISTINCT FROM c->>'senderPhoneNumberId'
  OR d.notification_template_name IS DISTINCT FROM c->>'templateName'
  OR d.notification_template_language IS DISTINCT FROM c->>'templateLanguage') THEN
  c:=jsonb_build_object('allowed',false,'reason','endpoint_changed');END IF;
 IF NOT(c->>'allowed')::boolean THEN
  reason:=c->>'reason';
  IF reason='quiet_hours' THEN
   UPDATE public.workflow_deliveries SET status='retry_scheduled',next_attempt_at=(c->>'nextAttemptAt')::timestamptz,
    lease_token=NULL,lease_until=NULL,reason_code=reason,updated_at=now() WHERE id=d.id;
  ELSE
   UPDATE public.workflow_deliveries SET status='suppressed',lease_token=NULL,lease_until=NULL,reason_code=reason,last_error=reason,updated_at=now() WHERE id=d.id;
  END IF;
  RETURN c||jsonb_build_object('result',CASE WHEN reason='quiet_hours' THEN 'deferred' ELSE 'suppressed' END);
 END IF;
 RETURN(c-ARRAY['endpointHash','policyRevision','consentRevision'])||jsonb_build_object('id',d.id,'token',p_token,'channel',d.channel,'idempotencyKey',d.idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_digest_claim(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;r jsonb;connection uuid;initial_connection uuid;health public.notification_whatsapp_health;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 IF d.notification_digest_id IS NULL OR d.channel<>'whatsapp' THEN RETURN techerp_api.notification_digest_claim_core(p_id);END IF;
 IF d.status IN('queued','retry_scheduled') AND coalesce(d.next_attempt_at,now())<=now() AND d.attempts>0 THEN
  IF d.notification_connection_id IS NULL THEN
   UPDATE public.workflow_deliveries SET status='uncertain',reason_code='connection_unproven',last_error='connection_unproven',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
   RETURN jsonb_build_object('result','uncertain','reason','connection_unproven');END IF;
  SELECT n.connection_id INTO connection FROM public.wa_cloud_numbers n WHERE n.workspace_id=d.workspace_id AND n.phone_number_id=d.notification_sender_id FOR SHARE;
  IF connection IS DISTINCT FROM d.notification_connection_id THEN
   UPDATE public.workflow_deliveries SET status='suppressed',reason_code='endpoint_changed',last_error='endpoint_changed',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
   RETURN jsonb_build_object('result','suppressed','reason','endpoint_changed');END IF;
 END IF;
 IF d.status IN('queued','retry_scheduled') AND coalesce(d.next_attempt_at,now())<=now() THEN
  SELECT n.connection_id INTO initial_connection FROM public.wa_cloud_numbers n JOIN public.notification_delivery_policies p ON p.workspace_id=n.workspace_id
   WHERE n.workspace_id=d.workspace_id AND n.phone_number_id=coalesce(d.notification_sender_id,p.wa_sender_id) FOR SHARE OF n;
  IF initial_connection IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended('notification-whatsapp-health:'||initial_connection,0));
   SELECT * INTO health FROM public.notification_whatsapp_health WHERE connection_id=initial_connection AND workspace_id=d.workspace_id;
   IF health.paused_until>now() AND health.paused_until<>'infinity'::timestamptz THEN
    UPDATE public.workflow_deliveries SET next_attempt_at=health.paused_until,reason_code=health.reason_code,updated_at=now() WHERE id=d.id;
    RETURN jsonb_build_object('result','deferred','reason',health.reason_code,'nextAttemptAt',health.paused_until);END IF;
  END IF;
 END IF;
 r:=techerp_api.notification_digest_claim_core(p_id);
 IF r->>'result'<>'claimed' THEN RETURN r;END IF;
 SELECT n.connection_id INTO connection FROM public.wa_cloud_numbers n WHERE n.workspace_id=d.workspace_id AND n.phone_number_id=r->>'senderPhoneNumberId' FOR SHARE;
 IF connection IS NULL OR connection IS DISTINCT FROM initial_connection
 OR(d.notification_connection_id IS NOT NULL AND connection IS DISTINCT FROM d.notification_connection_id) THEN
  UPDATE public.workflow_deliveries SET status='uncertain',reason_code='connection_unproven',last_error='connection_unproven',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','uncertain','reason','connection_unproven');END IF;
 UPDATE public.workflow_deliveries SET notification_connection_id=connection WHERE id=d.id;
 RETURN r||jsonb_build_object('connectionId',connection);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_digest_preflight(p_id uuid,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;r jsonb;connection uuid;health public.notification_whatsapp_health;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 r:=techerp_api.notification_digest_preflight_core(p_id,p_token);
 IF d.notification_digest_id IS NULL OR d.channel<>'whatsapp' OR NOT coalesce((r->>'allowed')::boolean,false) THEN RETURN r;END IF;
 IF d.notification_connection_id IS NULL THEN
  UPDATE public.workflow_deliveries SET status='uncertain',reason_code='connection_unproven',last_error='connection_unproven',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('allowed',false,'result','uncertain','reason','connection_unproven');END IF;
 SELECT n.connection_id INTO connection FROM public.wa_cloud_numbers n WHERE n.workspace_id=d.workspace_id AND n.phone_number_id=d.notification_sender_id FOR SHARE;
 IF connection IS DISTINCT FROM d.notification_connection_id THEN
  UPDATE public.workflow_deliveries SET status='suppressed',reason_code='endpoint_changed',last_error='endpoint_changed',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('allowed',false,'result','suppressed','reason','endpoint_changed');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-whatsapp-health:'||d.notification_connection_id,0));
 SELECT * INTO health FROM public.notification_whatsapp_health WHERE connection_id=d.notification_connection_id AND workspace_id=d.workspace_id;
 IF health.paused_until>now() THEN
  IF health.paused_until='infinity'::timestamptz THEN
   UPDATE public.workflow_deliveries SET status='suppressed',reason_code='provider_rate_limited',last_error='provider_rate_limited',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
   RETURN jsonb_build_object('allowed',false,'result','suppressed','reason','provider_rate_limited');END IF;
  UPDATE public.workflow_deliveries SET status='retry_scheduled',next_attempt_at=health.paused_until,reason_code=health.reason_code,
   lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('allowed',false,'result','deferred','reason',health.reason_code,'nextAttemptAt',health.paused_until);
 END IF;
 RETURN r||jsonb_build_object('connectionId',d.notification_connection_id);
END $$;

CREATE FUNCTION techerp_api.notification_digest_finish_core(p_id uuid,p_token uuid,p_status text,p_provider text,
 p_provider_id text DEFAULT NULL,p_reason text DEFAULT NULL,p_retry_after_seconds integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;delay_seconds integer;BEGIN
 PERFORM techerp_api.notification_service();
 IF p_status IS NULL OR p_status NOT IN('accepted','suppressed','retry_scheduled','failed','uncertain')
  OR p_provider IS NULL OR p_provider NOT IN('meta_cloud','lovable_whatsapp','managed_email')
  OR coalesce(length(p_provider_id),0)>512
  OR(p_reason IS NOT NULL AND p_reason NOT IN('invalid_recipient','invalid_configuration','invalid_template','sender_unavailable',
   'provider_rejected','provider_rate_limited','provider_preflight_unavailable','transport_unknown','recipient_suppressed')) THEN
  RAISE EXCEPTION 'Resultado de entrega inválido.' USING ERRCODE='22023';END IF;
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id AND notification_digest_id IS NOT NULL FOR UPDATE;
 IF d.id IS NOT NULL AND((d.channel='whatsapp' AND p_provider IS DISTINCT FROM 'meta_cloud') OR(d.channel='email' AND p_provider IS DISTINCT FROM 'managed_email')) THEN RAISE EXCEPTION 'Provedor incompatível com o resumo.' USING ERRCODE='22023';END IF;
 IF d.id IS NOT NULL AND p_status='accepted' AND d.status IN('accepted','delivered','read') AND p_token IS NOT NULL
  AND d.lease_token=p_token AND d.provider_id IS NOT DISTINCT FROM p_provider_id
  AND coalesce(d.provider,p_provider)=p_provider THEN RETURN jsonb_build_object('updated',true);END IF;
 IF d.id IS NULL OR p_token IS NULL OR d.lease_token IS DISTINCT FROM p_token OR d.status<>'in_flight' OR d.lease_until<=now() THEN
  RETURN jsonb_build_object('updated',false);END IF;
 IF(d.channel='email' AND p_provider<>'managed_email') OR(d.channel='whatsapp' AND p_provider NOT IN('meta_cloud','lovable_whatsapp'))
  OR(p_status='accepted' AND d.channel='whatsapp' AND nullif(btrim(p_provider_id),'') IS NULL)
  OR(p_status='retry_scheduled' AND(p_reason IS NULL OR p_reason NOT IN('provider_rate_limited','provider_preflight_unavailable') OR p_provider_id IS NOT NULL))
  OR(p_reason='transport_unknown' AND p_status<>'uncertain') THEN
  RAISE EXCEPTION 'Resultado de entrega incompatível com a tentativa.' USING ERRCODE='22023';END IF;
 IF p_status='retry_scheduled' THEN
  IF d.attempts>=4 THEN p_status:='failed';p_reason:='provider_rejected';
  ELSE
   delay_seconds:=least(3600,greatest(120*power(2,greatest(0,d.attempts-1))::integer,coalesce(p_retry_after_seconds,0)));
  END IF;
 END IF;
 UPDATE public.workflow_deliveries SET status=p_status,provider=p_provider,provider_id=p_provider_id,reason_code=p_reason,last_error=p_reason,
  next_attempt_at=CASE WHEN p_status='retry_scheduled' THEN now()+make_interval(secs=>delay_seconds) END,
  lease_token=CASE WHEN p_status='accepted' THEN p_token END,lease_until=NULL,updated_at=now() WHERE id=d.id;

 RETURN jsonb_build_object('updated',true);
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_digest_finish(p_id uuid,p_token uuid,p_status text,p_provider text,
 p_provider_id text DEFAULT NULL,p_reason text DEFAULT NULL,p_retry_after_seconds integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;finished jsonb;delay_seconds integer;pause_until timestamptz;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 -- A quota/reputation refusal never becomes a generic provider rejection when
 -- attempts run out: doing so would incorrectly enqueue the email fallback.
 IF d.notification_digest_id IS NOT NULL AND d.channel='whatsapp' AND(
 (p_reason='provider_rate_limited' AND(p_status='failed' OR(p_status='retry_scheduled' AND d.attempts>=4)))
 OR(p_reason='provider_preflight_unavailable' AND p_status='retry_scheduled' AND d.attempts>=4)) THEN
  IF p_provider IS DISTINCT FROM 'meta_cloud' OR p_provider_id IS NOT NULL THEN
   RAISE EXCEPTION 'Resultado de entrega incompatível com a tentativa.' USING ERRCODE='22023';END IF;
  IF p_token IS NULL OR d.lease_token IS DISTINCT FROM p_token OR d.status<>'in_flight' OR d.lease_until<=now() THEN RETURN jsonb_build_object('updated',false);END IF;
  UPDATE public.workflow_deliveries SET status='failed',provider=p_provider,provider_id=NULL,reason_code=p_reason,last_error=p_reason,
   next_attempt_at=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
  delay_seconds:=greatest(least(3600,120*power(2,greatest(0,d.attempts-1))::integer),coalesce(p_retry_after_seconds,0));
  pause_until:=CASE WHEN p_reason='provider_preflight_unavailable' OR p_retry_after_seconds BETWEEN 1 AND 86400 THEN now()+make_interval(secs=>delay_seconds) ELSE 'infinity'::timestamptz END;
  PERFORM techerp_api.notification_whatsapp_cooldown(d.workspace_id,d.notification_connection_id,pause_until,p_reason,pause_until='infinity'::timestamptz);
  RETURN jsonb_build_object('updated',true);
 END IF;
 finished:=techerp_api.notification_digest_finish_core(p_id,p_token,p_status,p_provider,p_provider_id,p_reason,p_retry_after_seconds);
 -- A throttled read before POST is safe to retry, but its provider cooldown is
 -- just as binding as a throttled POST. Never shorten a two-hour Retry-After.
 IF finished->>'updated'='true' AND p_status='retry_scheduled'
 AND p_reason IN('provider_rate_limited','provider_preflight_unavailable')
 AND p_retry_after_seconds BETWEEN 3601 AND 86400 AND d.attempts<4 THEN
  UPDATE public.workflow_deliveries SET next_attempt_at=greatest(next_attempt_at,now()+make_interval(secs=>p_retry_after_seconds))
   WHERE id=p_id AND status='retry_scheduled';
 END IF;
 IF finished->>'updated'='true' AND d.channel='whatsapp' AND d.notification_digest_id IS NOT NULL
 AND p_status='retry_scheduled' AND p_reason IN('provider_rate_limited','provider_preflight_unavailable') THEN
  delay_seconds:=greatest(least(3600,120*power(2,greatest(0,d.attempts-1))::integer),greatest(0,least(86400,coalesce(p_retry_after_seconds,0))));
  PERFORM techerp_api.notification_whatsapp_cooldown(d.workspace_id,d.notification_connection_id,now()+make_interval(secs=>delay_seconds),p_reason);
 END IF;
 RETURN finished;
END $$;

CREATE OR REPLACE FUNCTION public.notification_delivery_claim(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;i public.notification_slack_intents;p public.notification_slack_policies;
 s public.notification_slack_endpoint_state;c jsonb;token uuid;used integer;next_at timestamptz;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 IF d.notification_digest_id IS NOT NULL THEN RETURN techerp_api.notification_digest_claim(p_id);END IF;
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

CREATE OR REPLACE FUNCTION public.notification_delivery_preflight(p_id uuid,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;c jsonb;reason text;BEGIN
 PERFORM techerp_api.notification_service();SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 IF d.notification_digest_id IS NOT NULL THEN RETURN techerp_api.notification_digest_preflight(p_id,p_token);END IF;
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

CREATE OR REPLACE FUNCTION public.notification_delivery_finish(p_id uuid,p_token uuid,p_status text,p_provider text,
 p_provider_id text DEFAULT NULL,p_reason text DEFAULT NULL,p_retry_after_seconds integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;delay_seconds integer;original jsonb;BEGIN
 PERFORM techerp_api.notification_service();SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;

 IF d.notification_digest_id IS NOT NULL THEN
  IF p_retry_after_seconds<0 THEN RAISE EXCEPTION 'Intervalo de tentativa inválido.' USING ERRCODE='22023';END IF;
  IF p_status='retry_scheduled' AND p_retry_after_seconds>86400 THEN p_status:='failed';END IF;
  original:=techerp_api.notification_digest_finish(p_id,p_token,p_status,p_provider,p_provider_id,p_reason,p_retry_after_seconds);
  IF original->>'updated'='true' AND EXISTS(SELECT 1 FROM public.workflow_deliveries WHERE id=p_id AND status IN('accepted','delivered','read','failed','suppressed','uncertain')) THEN
   UPDATE public.notification_digest_candidates SET state='consumed' WHERE batch_id=d.notification_digest_id AND state='batched';END IF;
  RETURN original;
 END IF;
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

CREATE OR REPLACE FUNCTION public.notification_worker_list(p_limit integer DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM techerp_api.notification_service();
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Limite de processamento inválido.' USING ERRCODE='22023';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'channel',channel) ORDER BY created_at,id)
 FROM(SELECT id,channel,created_at FROM public.workflow_deliveries WHERE(notification_intent_id IS NOT NULL OR notification_slack_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL)
 AND((status IN('queued','retry_scheduled') AND coalesce(next_attempt_at,created_at)<=now()) OR(status='in_flight' AND lease_until<=now()))
 ORDER BY created_at,id LIMIT p_limit)s),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.workflow_delivery_claim(p_workspace uuid,p_workflow uuid,p_key text,p_channel text,p_step_path text,
 p_recipient text,p_lease_seconds integer DEFAULT 120,p_max_attempts integer DEFAULT 4) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM techerp_api.notification_service();
 IF p_channel='slack' OR EXISTS(SELECT 1 FROM public.workflow_deliveries WHERE idempotency_key=p_key AND(notification_slack_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL)) THEN
 RETURN jsonb_build_object('result','forbidden');END IF;
 RETURN public.workflow_delivery_claim_before_slack(p_workspace,p_workflow,p_key,p_channel,p_step_path,p_recipient,p_lease_seconds,p_max_attempts);
END $$;

CREATE OR REPLACE FUNCTION public.workflow_delivery_finish(p_key text,p_status text,p_provider text,p_provider_id text,p_error text,p_next_attempt timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM techerp_api.notification_service();
 IF EXISTS(SELECT 1 FROM public.workflow_deliveries WHERE idempotency_key=p_key AND(notification_slack_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL)) THEN RETURN;END IF;
 PERFORM public.workflow_delivery_finish_before_slack(p_key,p_status,p_provider,p_provider_id,p_error,p_next_attempt);
END $$;

CREATE FUNCTION techerp_api.notification_schedule_actions_valid(p_actions jsonb,p_event text,p_depth integer DEFAULT 0) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE a jsonb;b jsonb;k text;BEGIN
 IF p_depth>24 OR jsonb_typeof(p_actions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_actions)>1000 THEN RETURN false;END IF;
 FOR a IN SELECT value FROM jsonb_array_elements(p_actions) LOOP
  IF a->>'type'='send_notification' AND(a->'delivery'?'priority' OR a->'delivery'?'followup')
   AND NOT techerp_api.notification_schedule_delivery_valid(a->'delivery',p_event) THEN RETURN false;END IF;
  FOREACH k IN ARRAY ARRAY['actions','then','else','default'] LOOP
   IF a?k AND NOT techerp_api.notification_schedule_actions_valid(a->k,p_event,p_depth+1) THEN RETURN false;END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['branches','cases'] LOOP
   IF jsonb_typeof(a->k)='array' THEN FOR b IN SELECT value FROM jsonb_array_elements(a->k) LOOP
    IF b?'actions' AND NOT techerp_api.notification_schedule_actions_valid(b->'actions',p_event,p_depth+1) THEN RETURN false;END IF;
   END LOOP;END IF;
  END LOOP;
 END LOOP;RETURN true;
END $$;
CREATE FUNCTION techerp_api.notification_schedule_has_config(p_value jsonb,p_depth integer DEFAULT 0) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE v jsonb;BEGIN
 IF p_depth>32 THEN RETURN true;END IF;
 IF jsonb_typeof(p_value)='object' THEN
  IF p_value->>'type'='send_notification' AND(p_value->'delivery'?'priority' OR p_value->'delivery'?'followup') THEN RETURN true;END IF;
  FOR v IN SELECT value FROM jsonb_each(p_value) LOOP
   IF techerp_api.notification_schedule_has_config(v,p_depth+1) THEN RETURN true;END IF;
  END LOOP;
 ELSIF jsonb_typeof(p_value)='array' THEN
  FOR v IN SELECT value FROM jsonb_array_elements(p_value) LOOP
   IF techerp_api.notification_schedule_has_config(v,p_depth+1) THEN RETURN true;END IF;
  END LOOP;
 END IF;RETURN false;
END $$;
CREATE FUNCTION techerp_api.notification_schedule_workflow_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF(techerp_api.notification_schedule_has_config(NEW.actions) AND NOT techerp_api.notification_schedule_actions_valid(NEW.actions,NEW.trigger#>>'{notification_event,key}'))
  OR(techerp_api.notification_schedule_has_config(NEW.draft_actions) AND NOT techerp_api.notification_schedule_actions_valid(NEW.draft_actions,
    coalesce(NEW.draft_trigger,NEW.trigger)#>>'{notification_event,key}')) THEN
  RAISE EXCEPTION 'Configuração temporal de notificação inválida.' USING ERRCODE='22023';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_schedule_workflow_guard BEFORE INSERT OR UPDATE OF actions,trigger,draft_actions,draft_trigger ON public.workflows
 FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_schedule_workflow_guard();

-- This path is read-only and uses the current reader's RLS for EVERY member.
-- It never impersonates a service actor or returns member source snapshots.
CREATE FUNCTION techerp_api.notification_digest_visible(p_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.notification_digest_batches;actor uuid:=auth.uid();ctx jsonb;BEGIN
 IF actor IS NULL OR coalesce(auth.role(),'')<>'authenticated' OR current_setting('app.api_subject',true)='on' THEN RETURN false;END IF;
 ctx:=public.work_access_context();
 SELECT batch.* INTO b FROM public.workflow_deliveries d JOIN public.notification_digest_batches batch ON batch.id=d.notification_digest_id WHERE d.id=p_id;
 IF b.id IS NULL OR b.workspace_id::text IS DISTINCT FROM ctx->>'workspace' OR NOT public.is_workspace_member(b.workspace_id,actor)
  OR(b.recipient_user_id<>actor AND NOT ctx->'keys'?'system.notification_deliveries.view.workspace') THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM public.notification_digest_candidates WHERE batch_id=b.id)
  AND NOT EXISTS(SELECT 1 FROM public.notification_digest_candidates c WHERE c.batch_id=b.id
   AND(c.workspace_id<>b.workspace_id OR c.recipient_user_id<>b.recipient_user_id OR c.channel<>b.channel
    OR NOT techerp_api.notification_center_source_visible(c.workspace_id,actor,c.source_table,c.source_id)));
END $$;

-- The wrapper retains the old API signature and cursor/scope validation. Its
-- personal/Slack payloads gain only occurrence metadata; digest rows have no
-- fabricated workflow, run, event key or destination address.
ALTER FUNCTION public.notification_delivery_history(uuid,jsonb,text,text,text) RENAME TO notification_delivery_history_before_scheduling;
REVOKE ALL ON FUNCTION public.notification_delivery_history_before_scheduling(uuid,jsonb,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.notification_delivery_history(p_workspace uuid,p_cursor jsonb DEFAULT NULL,p_status text DEFAULT NULL,
 p_channel text DEFAULT NULL,p_scope text DEFAULT 'own') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE original jsonb;result jsonb;actor uuid:=techerp_api.notification_center_actor(p_workspace);at timestamptz;item uuid;BEGIN
 original:=public.notification_delivery_history_before_scheduling(p_workspace,p_cursor,p_status,p_channel,p_scope);
 IF p_cursor IS NOT NULL AND p_cursor<>'null'::jsonb THEN at:=(p_cursor->>'createdAt')::timestamptz;item:=(p_cursor->>'id')::uuid;END IF;
 WITH old_items AS MATERIALIZED(
  SELECT x||jsonb_build_object('occurrence_kind',coalesce(x->>'occurrence_kind',i.occurrence_kind,'initial'),
   'parent_intent_id',coalesce(x->'parent_intent_id',to_jsonb(i.parent_intent_id)),'batch_id',NULL) payload,(x->>'created_at')::timestamptz created_at,(x->>'id')::uuid id
  FROM jsonb_array_elements(original->'items') x
  LEFT JOIN public.workflow_deliveries d ON d.id=(x->>'id')::uuid
  LEFT JOIN public.notification_delivery_intents i ON i.id=d.notification_intent_id
 ),digest_items AS MATERIALIZED(
  SELECT jsonb_build_object('id',d.id,'channel',d.channel,'status',d.status,'reason_code',d.reason_code,'attempts',d.attempts,
   'created_at',d.created_at,'updated_at',d.updated_at,'workflow_id',NULL,'provider_id',d.provider_id,'eventKey',NULL,
   'recipient_user_id',b.recipient_user_id,'recipient_name',CASE WHEN b.recipient_user_id=actor THEN 'Você' ELSE 'Destinatário do resumo' END,
   'occurrence_kind','digest','parent_intent_id',NULL,'batch_id',b.id) payload,d.created_at,d.id
  FROM public.workflow_deliveries d JOIN public.notification_digest_batches b ON b.id=d.notification_digest_id
  WHERE b.workspace_id=p_workspace AND(p_scope='workspace' OR b.recipient_user_id=actor)
   AND(p_channel IS NULL OR d.channel=p_channel) AND(p_status IS NULL OR d.status=p_status)
   AND(at IS NULL OR(d.created_at,d.id)<(at,item)) AND techerp_api.notification_digest_visible(d.id)
  ORDER BY d.created_at DESC,d.id DESC LIMIT 51
 ),page AS MATERIALIZED(SELECT * FROM(SELECT * FROM old_items UNION ALL SELECT * FROM digest_items) all_items
  ORDER BY created_at DESC,id DESC LIMIT 51),items AS(SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 50)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(payload ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
  'nextCursor',CASE WHEN(SELECT count(*) FROM page)>50 OR original->'nextCursor'<>'null'::jsonb
   THEN(SELECT jsonb_build_object('createdAt',created_at,'id',id) FROM items ORDER BY created_at,id LIMIT 1) ELSE NULL END) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.notification_delivery_history(uuid,jsonb,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_delivery_history(uuid,jsonb,text,text,text) TO authenticated;


-- Read boundaries and actual signed receipts include all ledger subtypes.
CREATE OR REPLACE FUNCTION public.notification_delivery_visible(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid();c jsonb;i public.notification_slack_intents;BEGIN
 IF EXISTS(SELECT 1 FROM public.workflow_deliveries WHERE id=p_id AND notification_digest_id IS NOT NULL) THEN RETURN techerp_api.notification_digest_visible(p_id);END IF;
 SELECT s.* INTO i FROM public.workflow_deliveries d JOIN public.notification_slack_intents s ON s.id=d.notification_slack_intent_id WHERE d.id=p_id;
 IF i.id IS NULL THEN RETURN public.notification_delivery_visible_personal_v1(p_id);END IF;
 IF u IS NULL OR coalesce(auth.role(),'')<>'authenticated' OR current_setting('app.api_subject',true)='on' THEN RETURN false;END IF;
 c:=public.work_access_context();
 RETURN coalesce(i.workspace_id::text=c->>'workspace' AND public.is_workspace_member(i.workspace_id,u)
 AND c->'keys'?'system.notification_deliveries.view.workspace'
 AND techerp_api.notification_slack_integration_access(i.workspace_id,u,i.integration_id)
 AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id),false);
END $$;


DROP POLICY notification_delivery_own ON public.workflow_deliveries;
DROP POLICY notification_delivery_boundary ON public.workflow_deliveries;
CREATE POLICY notification_delivery_own ON public.workflow_deliveries FOR SELECT TO authenticated
 USING((notification_intent_id IS NOT NULL OR notification_slack_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL)
  AND public.notification_delivery_visible(id));
CREATE POLICY notification_delivery_boundary ON public.workflow_deliveries AS RESTRICTIVE FOR SELECT TO authenticated
 USING((notification_intent_id IS NULL AND notification_slack_intent_id IS NULL AND notification_digest_id IS NULL)
  OR public.notification_delivery_visible(id));


CREATE OR REPLACE FUNCTION public.notification_delivery_history_personal_v1(p_workspace uuid,p_cursor jsonb DEFAULT NULL,p_status text DEFAULT NULL,
 p_channel text DEFAULT NULL,p_scope text DEFAULT 'own') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);c jsonb:=public.work_access_context();at timestamptz;item uuid;result jsonb;BEGIN
 IF p_scope IS NULL OR p_scope NOT IN('own','workspace') OR (p_scope='workspace' AND NOT(c->'keys'?'system.notification_deliveries.view.workspace')) THEN
  RAISE EXCEPTION 'Sem permissão para este histórico.' USING ERRCODE='42501';END IF;
 IF p_channel IS NOT NULL AND p_channel NOT IN('inapp','email','whatsapp') OR p_status IS NOT NULL AND p_status NOT IN('available','queued','in_flight','sent','retry_scheduled','failed','uncertain','deduped','accepted','delivered','read','suppressed') THEN
  RAISE EXCEPTION 'Filtro inválido.' USING ERRCODE='22023';END IF;
 IF p_cursor IS NOT NULL AND p_cursor<>'null'::jsonb THEN
  IF jsonb_typeof(p_cursor)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cursor) k WHERE k NOT IN('createdAt','id')) THEN
   RAISE EXCEPTION 'Cursor inválido.' USING ERRCODE='22023';END IF;
  BEGIN at:=(p_cursor->>'createdAt')::timestamptz;item:=(p_cursor->>'id')::uuid;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Cursor inválido.' USING ERRCODE='22023';END;
  IF at IS NULL OR item IS NULL THEN RAISE EXCEPTION 'Cursor inválido.' USING ERRCODE='22023';END IF;
 END IF;
 WITH matched AS NOT MATERIALIZED(
  SELECT d.id,d.channel,d.status,d.reason_code,d.attempts,d.created_at,d.updated_at,i.recipient_user_id,i.workflow_id,d.provider_id,i.event_key,i.occurrence_kind,i.parent_intent_id
  FROM public.workflow_deliveries d JOIN public.notification_delivery_intents i ON i.id=d.notification_intent_id
  WHERE i.workspace_id=p_workspace AND(p_scope='workspace' OR i.recipient_user_id=u)
   AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id)
   AND techerp_api.notification_hr_history_visible(i.id,u)
  UNION ALL
  SELECT CASE WHEN i.occurrence_kind='initial' THEN n.id ELSE i.id END,'inapp',CASE WHEN n.read_at IS NULL THEN 'available' ELSE 'read' END,NULL::text,0,
   CASE WHEN i.occurrence_kind='initial' THEN n.created_at ELSE i.created_at END,coalesce(n.read_at,n.created_at),i.recipient_user_id,i.workflow_id,NULL::text,i.event_key,i.occurrence_kind,i.parent_intent_id
  FROM public.notification_delivery_intents i JOIN public.notifications n ON n.id=i.notification_id AND n.user_id=i.recipient_user_id
  WHERE i.workspace_id=p_workspace AND(p_scope='workspace' OR i.recipient_user_id=u)
   AND(i.event_key<>'people.approval.pending' OR i.delivery_config->'channels'?'inapp')
   AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id)
   AND techerp_api.notification_hr_history_visible(i.id,u)
 ),page AS MATERIALIZED(SELECT * FROM matched WHERE(p_channel IS NULL OR channel=p_channel)
 AND(p_status IS NULL OR status=p_status) AND(at IS NULL OR(created_at,id)<(at,item))
 ORDER BY created_at DESC,id DESC LIMIT 51),items AS(SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 50)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'channel',channel,'status',status,'eventKey',event_key,
 'occurrence_kind',occurrence_kind,'parent_intent_id',parent_intent_id,'reason_code',reason_code,'attempts',attempts,'created_at',created_at,'updated_at',updated_at,'workflow_id',workflow_id,'provider_id',provider_id,
 'recipient_user_id',CASE WHEN recipient_user_id=u OR p_scope='workspace' THEN recipient_user_id END,
 'recipient_name',CASE WHEN recipient_user_id=u THEN 'Você' ELSE 'Destinatário do workflow' END)
 ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
 'nextCursor',CASE WHEN(SELECT count(*) FROM page)>50 THEN(SELECT jsonb_build_object('createdAt',created_at,'id',id)
 FROM items ORDER BY created_at,id LIMIT 1)ELSE NULL END) INTO result;RETURN result;
END $$;

CREATE OR REPLACE FUNCTION techerp_api.notification_delivery_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE delivery_id uuid;d public.workflow_deliveries;next_status text;destination_hash text;BEGIN
 -- Only the canonical signed webhook's service actor can update a receipt.
 IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL OR NEW.direction IS DISTINCT FROM 'outbound'
  OR NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
  OR NEW.wa_message_id IS NULL OR NEW.wa_message_id IS DISTINCT FROM OLD.wa_message_id
  OR NEW.to_number IS DISTINCT FROM OLD.to_number OR NEW.from_number IS DISTINCT FROM OLD.from_number
  OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
  OR NEW.raw#>>'{source,notification_delivery_id}' IS DISTINCT FROM OLD.raw#>>'{source,notification_delivery_id}'
  OR NEW.raw#>>'{source,attempt_token}' IS DISTINCT FROM OLD.raw#>>'{source,attempt_token}'
  OR NEW.raw#>>'{source,idempotency_key}' IS DISTINCT FROM OLD.raw#>>'{source,idempotency_key}'
  OR coalesce(NEW.raw#>>'{source,notification_delivery_id}','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN NEW;END IF;
 delivery_id:=(NEW.raw#>>'{source,notification_delivery_id}')::uuid;
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=delivery_id AND(notification_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL) FOR UPDATE;
 destination_hash:=encode(sha256(convert_to('whatsapp:+'||regexp_replace(coalesce(NEW.to_number,''),'\D','','g'),'UTF8')),'hex');
 IF d.id IS NULL OR d.workspace_id IS DISTINCT FROM NEW.workspace_id OR d.channel<>'whatsapp'
  OR(d.notification_digest_id IS NOT NULL AND(d.notification_connection_id IS NULL
   OR NEW.raw#>>'{source,connection_id}' IS DISTINCT FROM d.notification_connection_id::text))
  OR d.notification_attempt_token IS NULL OR d.notification_attempt_token::text IS DISTINCT FROM NEW.raw#>>'{source,attempt_token}'
  OR NOT EXISTS(SELECT 1 FROM public.whatsapp_conversations c WHERE c.id=NEW.conversation_id AND c.workspace_id=d.workspace_id AND c.wa_phone_number_id=d.notification_sender_id)
  OR d.endpoint_hash IS DISTINCT FROM destination_hash
  OR d.idempotency_key IS DISTINCT FROM NEW.raw#>>'{source,idempotency_key}'
  OR(d.provider_id IS NOT NULL AND d.provider_id IS DISTINCT FROM NEW.wa_message_id)
  OR NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n WHERE n.workspace_id=d.workspace_id AND n.phone_number_id=d.notification_sender_id
   AND regexp_replace(n.display_phone_number,'\D','','g')=regexp_replace(coalesce(NEW.from_number,''),'\D','','g'))
  OR d.status IN('queued','retry_scheduled','suppressed','deduped') THEN RETURN NEW;END IF;
 next_status:=CASE NEW.status WHEN 'sent' THEN 'accepted' WHEN 'accepted' THEN 'accepted' WHEN 'delivered' THEN 'delivered' WHEN 'read' THEN 'read' WHEN 'failed' THEN 'failed' END;
 IF next_status IS NULL OR d.status='read' OR(d.status='delivered' AND next_status<>'read')
  OR(d.status='failed' AND next_status IN('accepted','delivered','read')) THEN RETURN NEW;END IF;
 UPDATE public.workflow_deliveries SET status=next_status,provider='meta_cloud',provider_id=NEW.wa_message_id,
  reason_code=CASE WHEN next_status='failed' THEN 'provider_rejected' END,
  last_error=CASE WHEN next_status='failed' THEN 'provider_rejected' END,updated_at=now()
 WHERE id=d.id;
 -- A receipt never enqueues fallback, even after a prior uncertain/accepted send.
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notification_whatsapp_receipt(p_workspace uuid,p_connection uuid,p_sender text,p_wamid text,p_recipient text,p_status text,p_error_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;receipt_recipient text;next_status text;ids uuid[];BEGIN
 PERFORM techerp_api.notification_service();
 receipt_recipient:=CASE WHEN p_recipient ~ '^\+[1-9][0-9]{7,14}$' THEN p_recipient WHEN p_recipient ~ '^[1-9][0-9]{7,14}$' THEN '+'||p_recipient END;
 next_status:=CASE p_status WHEN 'sent' THEN 'accepted' WHEN 'accepted' THEN 'accepted' WHEN 'delivered' THEN 'delivered' WHEN 'read' THEN 'read' WHEN 'failed' THEN 'failed' END;
 IF p_workspace IS NULL OR p_connection IS NULL OR p_sender IS NULL OR p_sender !~ '^[0-9]{5,30}$'
 OR p_wamid IS NULL OR length(p_wamid) NOT BETWEEN 1 AND 512 OR receipt_recipient IS NULL OR next_status IS NULL THEN
  RETURN jsonb_build_object('matched',false,'updated',false);END IF;
 -- Availability, membership, consent and channel enablement govern new POSTs,
 -- not historical acknowledgements of an already proven provider acceptance.
 IF NOT EXISTS(SELECT 1 FROM public.wa_cloud_connections c WHERE c.id=p_connection AND c.workspace_id=p_workspace) THEN
  RETURN jsonb_build_object('matched',false,'updated',false);END IF;
 SELECT array_agg(id) INTO ids FROM public.workflow_deliveries WHERE workspace_id=p_workspace AND channel='whatsapp'
  AND(notification_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL) AND provider='meta_cloud' AND provider_id=p_wamid
  AND notification_connection_id=p_connection AND notification_sender_id=p_sender
  AND notification_attempt_token IS NOT NULL
  AND endpoint_hash=encode(sha256(convert_to('whatsapp:'||receipt_recipient,'UTF8')),'hex');
 IF coalesce(cardinality(ids),0)<>1 THEN RETURN jsonb_build_object('matched',false,'updated',false);END IF;
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=ids[1] FOR UPDATE;
 IF d.provider_id IS DISTINCT FROM p_wamid OR d.notification_connection_id IS DISTINCT FROM p_connection
 OR d.notification_sender_id IS DISTINCT FROM p_sender OR d.workspace_id IS DISTINCT FROM p_workspace
 OR d.notification_attempt_token IS NULL OR d.provider IS DISTINCT FROM 'meta_cloud'
 OR d.endpoint_hash IS DISTINCT FROM encode(sha256(convert_to('whatsapp:'||receipt_recipient,'UTF8')),'hex') THEN
  RETURN jsonb_build_object('matched',false,'updated',false);END IF;
 IF d.status IN('queued','retry_scheduled','suppressed','deduped') THEN RETURN jsonb_build_object('matched',true,'updated',false);END IF;
 IF d.status='failed' AND next_status='failed' AND p_error_code IN('131026','131049') THEN
  -- A later signed event may supply the refusal code missing from the first
  -- failed event. Enrich that proven failure once without regressing its state.
  PERFORM techerp_api.notification_whatsapp_suppress_once(p_workspace,receipt_recipient,p_error_code,now(),p_wamid);
  RETURN jsonb_build_object('matched',true,'updated',false);END IF;
 IF d.status=next_status OR d.status='read' OR(d.status='delivered' AND next_status<>'read')
 OR(d.status='failed' AND next_status IN('accepted','delivered','read')) THEN RETURN jsonb_build_object('matched',true,'updated',false);END IF;
 UPDATE public.workflow_deliveries SET status=next_status,
  reason_code=CASE WHEN next_status='failed' THEN 'provider_rejected' END,
  last_error=CASE WHEN next_status='failed' THEN 'provider_rejected' END,updated_at=now() WHERE id=d.id;
 IF next_status='failed' AND p_error_code IN('131026','131049') THEN
  PERFORM techerp_api.notification_whatsapp_suppress_once(p_workspace,receipt_recipient,p_error_code,now(),p_wamid);END IF;
 RETURN jsonb_build_object('matched',true,'updated',true);
END $$;


DROP INDEX public.notification_whatsapp_provider_receipt;
CREATE INDEX notification_whatsapp_provider_receipt ON public.workflow_deliveries(workspace_id,provider_id)
 WHERE(notification_intent_id IS NOT NULL OR notification_digest_id IS NOT NULL) AND channel='whatsapp' AND provider_id IS NOT NULL;


-- Private metadata, calendar, derivation and provider state are not client RPCs.
REVOKE ALL ON FUNCTION
 techerp_api.notification_digest_defaults(),
 techerp_api.notification_digest_settings_valid(jsonb),
 techerp_api.notification_digest_slot(jsonb,timestamptz,boolean),
 techerp_api.notification_followup_event(text),
 techerp_api.notification_schedule_delivery_valid(jsonb,text),
 techerp_api.notification_schedule_step(uuid,integer,text),
 techerp_api.notification_schedule_config(jsonb),
 techerp_api.notification_schedule_source_current(uuid,text,uuid),
 techerp_api.notification_schedule_capture(uuid),
 techerp_api.notification_policy_json(uuid),
 techerp_api.notification_schedule_recipients(uuid,jsonb),
 techerp_api.notification_followup_child_current(uuid),
 techerp_api.notification_followup_emit(uuid,text,integer,timestamptz),
 techerp_api.notification_digest_context(uuid,boolean),
 techerp_api.notification_schedule_tick_at(integer,timestamptz),
 techerp_api.notification_intent_context(uuid,text),
 techerp_api.notification_digest_claim_core(uuid),
 techerp_api.notification_digest_preflight_core(uuid,uuid),
 techerp_api.notification_digest_claim(uuid),
 techerp_api.notification_digest_preflight(uuid,uuid),
 techerp_api.notification_digest_finish_core(uuid,uuid,text,text,text,text,integer),
 techerp_api.notification_digest_finish(uuid,uuid,text,text,text,text,integer),
 techerp_api.notification_schedule_actions_valid(jsonb,text,integer),
 techerp_api.notification_schedule_has_config(jsonb,integer),
 techerp_api.notification_schedule_workflow_guard(),
 techerp_api.notification_digest_visible(uuid),
 techerp_api.notification_delivery_receipt()
 FROM PUBLIC,anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.notification_delivery_claim_personal_p4(uuid),public.notification_delivery_preflight_personal_p4(uuid,uuid),
 public.notification_delivery_finish_personal_p4(uuid,uuid,text,text,text,text,integer),public.notification_delivery_claim_personal_v1(uuid),
 public.notification_delivery_preflight_personal_v1(uuid,uuid),public.notification_delivery_finish_personal_v1(uuid,uuid,text,text,text,text,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.notification_worker_list(integer),public.notification_delivery_claim(uuid),public.notification_delivery_preflight(uuid,uuid),
 public.notification_delivery_finish(uuid,uuid,text,text,text,text,integer),public.notification_workflow_dispatch_v2(uuid,uuid,integer,text,uuid,jsonb,text,text,text,jsonb),
 public.notification_whatsapp_receipt(uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_worker_list(integer),public.notification_delivery_claim(uuid),public.notification_delivery_preflight(uuid,uuid),
 public.notification_delivery_finish(uuid,uuid,text,text,text,text,integer),public.notification_workflow_dispatch_v2(uuid,uuid,integer,text,uuid,jsonb,text,text,text,jsonb),
 public.notification_whatsapp_receipt(uuid,uuid,text,text,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
