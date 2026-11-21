-- WhatsApp inbound occurrences reuse the canonical Workflow queue/proofs and
-- notification delivery ledger. No rule, grant, channel or historical event is enabled.
-- The physical message is a READ-ONLY Workflow origin, never a generic write target.
DO $extend$ DECLARE relation text;name text;definition text;BEGIN
 FOREACH relation IN ARRAY ARRAY['workflows','workflow_events'] LOOP
  name:=relation||'_entity_check';
  SELECT pg_get_constraintdef(c.oid) INTO definition FROM pg_constraint c WHERE c.conrelid=('public.'||relation)::regclass AND c.conname=name;
  IF definition IS NOT NULL THEN
   EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',relation,name);
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s OR entity=''whatsapp_messages'')',relation,name,substr(definition,7));
  END IF;
 END LOOP;
END $extend$;
ALTER TABLE public.notification_business_event_proofs DROP CONSTRAINT notification_business_event_proofs_source_table_check;
ALTER TABLE public.notification_business_event_proofs ADD CONSTRAINT notification_business_event_proofs_source_table_check
 CHECK(source_table IN('deals','proposals','contracts','projects','project_tasks','project_milestones','ats_applications','ats_interviews','ats_offers','people','people_documents','hiring_preparation_requests','financial_entries','hiring_fiscal_documents','whatsapp_messages'));

CREATE OR REPLACE FUNCTION techerp_api.notification_business_category(p_key text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT CASE
 WHEN p_key='shared.message.received' THEN 'message'
 WHEN p_key IN('crm.deal.won','crm.deal.lost','crm.deal.stage_changed') THEN 'deal_stage'
 WHEN p_key IN('crm.proposal.accepted','contracts.signature.completed','projects.project.started','finance.invoice.received') THEN 'workflow'
 WHEN p_key IN('contracts.draft.accepted','people.approval.pending') THEN 'approval'
 WHEN p_key IN('ats.application.received','ats.interview.scheduled','ats.offer.accepted','people.employment.started') THEN 'hiring'
 WHEN p_key IN('contracts.contract.expiring','contracts.contract.renewal_due','projects.project.overdue','projects.task.overdue','projects.milestone.due','people.document.expiring','finance.payable.due','finance.receivable.due','finance.payable.overdue','finance.receivable.overdue') THEN 'task' END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_category(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION techerp_api.notification_business_module(p_key text,p_workspace uuid,p_user uuid,p_table text,p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF techerp_api.notification_business_category(p_key) IS NOT NULL THEN
  IF NOT techerp_api.notification_center_source_visible(p_workspace,p_user,p_table,p_id) THEN RETURN NULL;END IF;
  RETURN CASE WHEN p_key='shared.message.received' THEN 'crm' ELSE split_part(p_key,'.',1) END;
 END IF;
 RETURN techerp_api.notification_center_source_module(p_workspace,p_user,p_table,p_id);
END $$;

-- This is routing metadata, not a credential catalogue. It is private because
-- recipients must never be able to impersonate a different actor/workspace.
-- The project has one Lovable gateway. Its official current phone is observed
-- by the trusted server, never inferred from optional Meta mirror tables or
-- historical conversations. SDK refresh runs outside SQL while configuring filters.
CREATE TABLE public.notification_whatsapp_gateway_binding(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 account_id uuid NOT NULL,workspace_id uuid NOT NULL,
 phone_number_id text NOT NULL CHECK(phone_number_id ~ '^[0-9]{5,30}$'),
 display_phone_number text NOT NULL CHECK(display_phone_number ~ '^\+[1-9][0-9]{6,14}$'),
 observed_at timestamptz NOT NULL,
 FOREIGN KEY(account_id,workspace_id) REFERENCES public.service_channel_accounts(id,workspace_id) ON DELETE CASCADE
);
ALTER TABLE public.notification_whatsapp_gateway_binding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_whatsapp_gateway_binding FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.notification_whatsapp_gateway_current()
RETURNS TABLE(account_id uuid,workspace_id uuid,phone_number_id text,display_phone_number text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT b.account_id,b.workspace_id,b.phone_number_id,b.display_phone_number
 FROM public.notification_whatsapp_gateway_binding b JOIN public.service_channel_accounts a
 ON a.id=b.account_id AND a.workspace_id=b.workspace_id AND a.channel='whatsapp'
  AND a.source_key=b.phone_number_id AND a.archived_at IS NULL
 WHERE b.singleton
  AND (SELECT count(*) FROM public.service_channel_accounts x WHERE x.channel='whatsapp' AND x.archived_at IS NULL AND x.source_key=b.phone_number_id)=1
  AND NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n WHERE n.phone_number_id=b.phone_number_id)
  AND NOT EXISTS(SELECT 1 FROM public.wa_phone_numbers n LEFT JOIN public.wa_business_accounts w ON w.id=n.waba_id
   WHERE n.phone_number_id=b.phone_number_id AND (n.workspace_id IS DISTINCT FROM b.workspace_id
    OR (nullif(regexp_replace(coalesce(n.display_phone_number,''),'[^0-9]','','g'),'') IS NOT NULL
     AND regexp_replace(n.display_phone_number,'[^0-9]','','g')<>regexp_replace(b.display_phone_number,'[^0-9]','','g'))
    OR (w.id IS NOT NULL AND w.workspace_id IS DISTINCT FROM b.workspace_id)))
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_gateway_current() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.notification_whatsapp_gateway_observe(p_phone text,p_display text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.service_channel_accounts;digits text;BEGIN
 PERFORM techerp_api.notification_service();
 IF p_phone IS NULL AND p_display IS NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('notification-whatsapp-gateway',0));
  DELETE FROM public.notification_whatsapp_gateway_binding;RETURN false;
 END IF;
 digits:=regexp_replace(coalesce(p_display,''),'[^0-9]','','g');
 IF p_phone IS NULL OR p_phone !~ '^[0-9]{5,30}$' OR p_display IS NULL
  OR length(p_display)>50 OR p_display !~ '^[+0-9() .-]+$' OR digits !~ '^[1-9][0-9]{6,14}$' THEN
  RAISE EXCEPTION 'Identificadores do gateway WhatsApp inválidos.' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-whatsapp-gateway',0));
 IF (SELECT count(*) FROM public.service_channel_accounts WHERE channel='whatsapp' AND archived_at IS NULL AND source_key=p_phone)<>1
  OR EXISTS(SELECT 1 FROM public.wa_cloud_numbers WHERE phone_number_id=p_phone) THEN
  DELETE FROM public.notification_whatsapp_gateway_binding;RETURN false;
 END IF;
 SELECT * INTO a FROM public.service_channel_accounts WHERE channel='whatsapp' AND archived_at IS NULL AND source_key=p_phone;
 INSERT INTO public.notification_whatsapp_gateway_binding(singleton,account_id,workspace_id,phone_number_id,display_phone_number,observed_at)
 VALUES(true,a.id,a.workspace_id,p_phone,'+'||digits,clock_timestamp())
 ON CONFLICT(singleton) DO UPDATE SET account_id=excluded.account_id,workspace_id=excluded.workspace_id,
  phone_number_id=excluded.phone_number_id,display_phone_number=excluded.display_phone_number,observed_at=excluded.observed_at;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.notification_whatsapp_gateway_observe(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.notification_whatsapp_gateway_observe(text,text) TO service_role;
CREATE FUNCTION techerp_api.notification_whatsapp_accounts(p_workspace uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.label,a.id),'[]'::jsonb) FROM (
  SELECT 'cloud:'||c.id::text id,c.label,
   (SELECT jsonb_agg(jsonb_build_object('id',n.phone_number_id,'label',coalesce(nullif(n.verified_name,''),n.display_phone_number),'phone',n.display_phone_number) ORDER BY n.phone_number_id)
    FROM public.wa_cloud_numbers n WHERE n.connection_id=c.id AND n.workspace_id=p_workspace AND n.available AND n.status='CONNECTED') numbers
  FROM public.wa_cloud_connections c WHERE c.workspace_id=p_workspace AND c.enabled AND c.webhook_verified_at IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.wa_cloud_numbers n WHERE n.connection_id=c.id AND n.workspace_id=p_workspace AND n.available AND n.status='CONNECTED')
  UNION ALL
  SELECT 'lovable:'||a.id::text,a.label,jsonb_build_array(jsonb_build_object('id',a.source_key,'label',coalesce(nullif(a.display_name,''),a.label),'phone',b.display_phone_number))
  FROM techerp_api.notification_whatsapp_gateway_current() b JOIN public.service_channel_accounts a
   ON a.id=b.account_id AND a.workspace_id=b.workspace_id AND a.source_key=b.phone_number_id
  WHERE a.workspace_id=p_workspace
 )a
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_accounts(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.notification_whatsapp_sources(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid();c jsonb:=public.work_access_context();k jsonb;BEGIN
 k:=coalesce(c->'keys','{}');
 IF auth.role() IS DISTINCT FROM 'authenticated' OR u IS NULL OR p_workspace IS NULL
 OR c->>'actor' IS DISTINCT FROM u::text OR c->>'workspace' IS DISTINCT FROM p_workspace::text
 OR NOT coalesce(k ?| ARRAY['system.workflows.view.own','system.workflows.view.team','system.workflows.view.workspace'],false)
 OR NOT coalesce(k ?| ARRAY['techsales.inbox.whatsapp.view.own','techsales.inbox.whatsapp.view.team','techsales.inbox.whatsapp.view.workspace'],false) THEN
  RAISE EXCEPTION 'Sem permissão para consultar as origens WhatsApp do Workflow.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('workspace_id',p_workspace,'sources',techerp_api.notification_whatsapp_accounts(p_workspace));
END $$;
REVOKE ALL ON FUNCTION public.notification_whatsapp_sources(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.notification_whatsapp_sources(uuid) TO authenticated;

CREATE FUNCTION techerp_api.notification_whatsapp_selection_valid(p_workspace uuid,p_config jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE sources jsonb;v jsonb;BEGIN
 IF jsonb_typeof(p_config) IS DISTINCT FROM 'object' OR p_config->>'key' IS DISTINCT FROM 'shared.message.received'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_config) k WHERE k NOT IN('key','source_keys','phone_number_ids')) THEN RETURN false;END IF;
 FOREACH sources IN ARRAY ARRAY[p_config->'source_keys',p_config->'phone_number_ids'] LOOP
  IF sources IS NOT NULL AND (jsonb_typeof(sources) IS DISTINCT FROM 'array') THEN RETURN false;END IF;
  IF sources IS NOT NULL AND jsonb_array_length(sources)>100 THEN RETURN false;END IF;
  IF sources IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(sources)x WHERE jsonb_typeof(x)<>'string') THEN RETURN false;END IF;
  IF sources IS NOT NULL AND (SELECT count(DISTINCT x) FROM jsonb_array_elements(sources)x)<>jsonb_array_length(sources) THEN RETURN false;END IF;
 END LOOP;
 sources:=techerp_api.notification_whatsapp_accounts(p_workspace);
 FOR v IN SELECT * FROM jsonb_array_elements(coalesce(p_config->'source_keys','[]')) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(sources)a WHERE a->'id'=v) THEN RETURN false;END IF;
 END LOOP;
 FOR v IN SELECT * FROM jsonb_array_elements(coalesce(p_config->'phone_number_ids','[]')) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(sources)a CROSS JOIN LATERAL jsonb_array_elements(a->'numbers')n WHERE n->'id'=v
   AND (jsonb_array_length(coalesce(p_config->'source_keys','[]'))=0 OR p_config->'source_keys' ? (a->>'id'))) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_selection_valid(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.notification_whatsapp_selection_matches(p_config jsonb,p_source text,p_phone text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT
 (NOT p_config?'source_keys' OR p_config->'source_keys'='[]' OR p_config->'source_keys'?p_source)
 AND (NOT p_config?'phone_number_ids' OR p_config->'phone_number_ids'='[]' OR p_config->'phone_number_ids'?p_phone)
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_selection_matches(jsonb,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.notification_whatsapp_activations(
 workflow_id uuid PRIMARY KEY REFERENCES public.workflows(id) ON DELETE CASCADE,workspace_id uuid NOT NULL,
 workflow_version integer NOT NULL,activated_at timestamptz NOT NULL
);
ALTER TABLE public.notification_whatsapp_activations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_whatsapp_activations FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.notification_whatsapp_actions_valid(p_actions jsonb,p_depth integer DEFAULT 0) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=public,pg_temp AS $$
DECLARE a jsonb;child jsonb;k text;BEGIN
 IF p_depth>12 OR jsonb_typeof(p_actions) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 FOR a IN SELECT * FROM jsonb_array_elements(p_actions) LOOP
  IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR a->>'type' IS NULL OR a->>'type' IN(
   'set_field','set_substatus','clear_field','increment_field','copy_field_from_association','associate_records','disassociate_records',
   'assign_to','rotate_assign','send_whatsapp','send_email','handoff','sdr_agent','add_to_sequence','share_material','share_booking_link')
   OR (a->>'type' IN('create_record','update_record','delete_record') AND a->>'table'='whatsapp_messages') THEN RETURN false;END IF;
  FOREACH k IN ARRAY ARRAY['then','else','default','actions'] LOOP
   IF a?k AND NOT techerp_api.notification_whatsapp_actions_valid(a->k,p_depth+1) THEN RETURN false;END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['cases','branches'] LOOP
   IF a?k THEN
    IF jsonb_typeof(a->k) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
    FOR child IN SELECT * FROM jsonb_array_elements(a->k) LOOP
     IF NOT techerp_api.notification_whatsapp_actions_valid(child->'actions',p_depth+1) THEN RETURN false;END IF;
    END LOOP;
   END IF;
  END LOOP;
 END LOOP;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_actions_valid(jsonb,integer) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.notification_whatsapp_workflow_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE config jsonb;BEGIN
 IF NEW.entity<>'whatsapp_messages' THEN RETURN NEW;END IF;
 config:=NEW.trigger->'notification_event';
 IF NEW.trigger?'time_based' OR NOT techerp_api.notification_whatsapp_selection_valid(NEW.workspace_id,config)
 OR NOT techerp_api.notification_whatsapp_actions_valid(NEW.actions)
 OR (NEW.draft_trigger IS NOT NULL AND (NEW.draft_trigger?'time_based' OR NOT techerp_api.notification_whatsapp_selection_valid(NEW.workspace_id,NEW.draft_trigger->'notification_event')))
 OR (NEW.draft_actions IS NOT NULL AND NOT techerp_api.notification_whatsapp_actions_valid(NEW.draft_actions)) THEN
  RAISE EXCEPTION 'Origem WhatsApp exige evento e contas autorizadas, sem alterações da mensagem.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_workflow_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_whatsapp_workflow_guard BEFORE INSERT OR UPDATE OF entity,trigger,draft_trigger,actions,draft_actions ON public.workflows
 FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_whatsapp_workflow_guard();
CREATE FUNCTION techerp_api.notification_whatsapp_activation_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF NEW.entity='whatsapp_messages' AND NEW.enabled AND NEW.status='published' AND NEW.trigger#>>'{notification_event,key}'='shared.message.received' THEN
  IF TG_OP='INSERT' OR NOT OLD.enabled OR OLD.status<>'published' OR OLD.entity<>NEW.entity OR OLD.published_version IS DISTINCT FROM NEW.published_version THEN
   INSERT INTO public.notification_whatsapp_activations(workflow_id,workspace_id,workflow_version,activated_at)
    VALUES(NEW.id,NEW.workspace_id,NEW.published_version,clock_timestamp())
    ON CONFLICT(workflow_id) DO UPDATE SET workspace_id=excluded.workspace_id,workflow_version=excluded.workflow_version,activated_at=excluded.activated_at;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_activation_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_whatsapp_activation_capture AFTER INSERT OR UPDATE OF enabled,status,published_version,entity ON public.workflows
 FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_whatsapp_activation_capture();

-- Read visibility runs as the non-BYPASSRLS subject, with both message and parent
-- SELECT policies. Metadata or a workflow key cannot grant conversation access.
CREATE FUNCTION techerp_api.notification_whatsapp_subject_visible(p_ws uuid,p_user uuid,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean;BEGIN
 IF p_ws IS NULL OR p_user IS NULL OR p_id IS NULL OR current_setting('app.api_subject',true)='on'
 OR NOT public.is_workspace_member(p_ws,p_user) THEN RETURN false;END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims)
  VALUES(txid_current(),p_user,p_ws,p_id,current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_user::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('app.api_subject','on',true);
 SELECT EXISTS(SELECT 1 FROM public.whatsapp_messages m JOIN public.whatsapp_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id
  WHERE m.id=p_id AND m.workspace_id=p_ws) INTO allowed;
 PERFORM techerp_api.leave();RETURN coalesce(allowed,false);
END $$;
ALTER FUNCTION techerp_api.notification_whatsapp_subject_visible(uuid,uuid,uuid) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_subject_visible(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.notification_whatsapp_subject_visible(uuid,uuid,uuid) TO postgres;
ALTER FUNCTION techerp_api.notification_source_visible(uuid,uuid,text,uuid) RENAME TO notification_source_visible_before_whatsapp;
CREATE FUNCTION techerp_api.notification_source_visible(p_ws uuid,p_user uuid,p_table text,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF p_table='whatsapp_messages' THEN RETURN techerp_api.notification_whatsapp_subject_visible(p_ws,p_user,p_id);END IF;
 RETURN techerp_api.notification_source_visible_before_whatsapp(p_ws,p_user,p_table,p_id);
END $$;
ALTER FUNCTION techerp_api.notification_source_visible(uuid,uuid,text,uuid) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.notification_source_visible(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.notification_source_visible(uuid,uuid,text,uuid) TO postgres;
ALTER FUNCTION techerp_api.notification_center_source_visible(uuid,uuid,text,uuid) RENAME TO notification_center_source_visible_before_whatsapp;
CREATE FUNCTION techerp_api.notification_center_source_visible(p_ws uuid,p_user uuid,p_table text,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF p_table='whatsapp_messages' THEN
  IF p_user IS DISTINCT FROM auth.uid() OR auth.role() IS DISTINCT FROM 'authenticated'
   OR current_setting('app.api_subject',true)='on' OR public.work_access_context()->>'workspace' IS DISTINCT FROM p_ws::text THEN RETURN false;END IF;
  RETURN EXISTS(SELECT 1 FROM public.whatsapp_messages m JOIN public.whatsapp_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id WHERE m.id=p_id AND m.workspace_id=p_ws);
 END IF;
 RETURN techerp_api.notification_center_source_visible_before_whatsapp(p_ws,p_user,p_table,p_id);
END $$;
ALTER FUNCTION techerp_api.notification_center_source_visible(uuid,uuid,text,uuid) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.notification_center_source_visible(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.notification_center_source_visible(uuid,uuid,text,uuid) TO postgres;
-- Policies bind this function by OID. Extend its existing definition in place,
-- retaining all nine policy dependencies and its authenticated INVOKER boundary.
DO $reference$ DECLARE d text;needle text;BEGIN
 d:=pg_get_functiondef('public.sales_event_reference_access(text,uuid)'::regprocedure);
 needle:=' IF e=''hiring_fiscal_documents'' THEN';
 IF (length(d)-length(replace(d,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unknown event reference seam';END IF;
 d:=replace(d,needle,$seam$ IF e='whatsapp_messages' THEN RETURN EXISTS(SELECT 1 FROM public.whatsapp_messages m JOIN public.whatsapp_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id
  WHERE m.id=i AND m.workspace_id=(public.sales_access_context()->>'workspace')::uuid);END IF;
 IF e='hiring_fiscal_documents' THEN$seam$);
 EXECUTE d;
END $reference$;

-- The old worker remains the authority for its source, version and every other
-- reference/action. This wrapper removes only a fully authorized read-only WA ref.
ALTER FUNCTION techerp_api.sales_worker_check(text,uuid,uuid,uuid,jsonb) RENAME TO sales_worker_check_before_whatsapp;
CREATE FUNCTION techerp_api.sales_worker_check(p_source text,p_id uuid,p_user uuid,p_ws uuid,p_refs jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r jsonb;remaining jsonb:='[]';BEGIN
 IF jsonb_typeof(p_refs) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(p_refs) LOOP
  IF r->>'record_table'='whatsapp_messages' OR r->>'table'='whatsapp_messages' THEN
   IF coalesce(r->>'action','view')<>'view' OR r->>'id' IS NULL OR NOT techerp_api.notification_whatsapp_subject_visible(p_ws,p_user,(r->>'id')::uuid) THEN RETURN false;END IF;
  ELSE remaining:=remaining||jsonb_build_array(r);END IF;
 END LOOP;
 IF p_source='workflows' AND EXISTS(SELECT 1 FROM public.workflows w WHERE w.id=p_id AND w.entity='whatsapp_messages'
  AND (w.trigger?'time_based' OR NOT techerp_api.notification_whatsapp_selection_valid(w.workspace_id,w.trigger->'notification_event')
   OR NOT techerp_api.notification_whatsapp_actions_valid(w.actions))) THEN RETURN false;END IF;
 RETURN techerp_api.sales_worker_check_before_whatsapp(p_source,p_id,p_user,p_ws,remaining);
END $$;
ALTER FUNCTION techerp_api.sales_worker_check(text,uuid,uuid,uuid,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION techerp_api.sales_worker_check(text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.sales_worker_check(text,uuid,uuid,uuid,jsonb) TO postgres;

-- The HMAC-verified routes durably store this envelope before the common
-- processor persists the message. Never trust a client supplied source key,
-- actor, workspace, number, content or timestamp as an occurrence.
-- Identical directional variants to whatsapp/phone-variants.ts: the common
-- processor may preserve an existing Brazilian conversation's ninth digit.
CREATE FUNCTION techerp_api.notification_whatsapp_sender_matches(p_raw text,p_persisted text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(raw ~ '^[0-9]{6,20}$' AND (raw=persisted
  OR raw ~ '^55[0-9]{2}9[0-9]{8}$' AND persisted=substr(raw,1,4)||substr(raw,6)
  OR raw ~ '^55[0-9]{2}[6-9][0-9]{7}$' AND persisted=substr(raw,1,4)||'9'||substr(raw,5)),false)
 FROM (SELECT p_raw raw,regexp_replace(coalesce(p_persisted,''),'[^0-9]','','g') persisted)s
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_sender_matches(text,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.notification_whatsapp_origin(p_message uuid,p_webhook uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp SET timezone='UTC' AS $$
DECLARE m public.whatsapp_messages;c public.whatsapp_conversations;h public.whatsapp_webhook_events;
 value jsonb;raw_message jsonb;account jsonb;phone text;source text;transport text;occurred timestamptz;BEGIN
 SELECT * INTO m FROM public.whatsapp_messages WHERE id=p_message;
 SELECT * INTO c FROM public.whatsapp_conversations WHERE id=m.conversation_id AND workspace_id=m.workspace_id;
 SELECT * INTO h FROM public.whatsapp_webhook_events WHERE id=p_webhook AND event='whatsapp.message';
 IF m.id IS NULL OR c.id IS NULL OR h.id IS NULL OR m.direction<>'inbound' OR m.provider<>'meta'
 OR m.wa_message_id IS NULL OR m.wa_message_id='' OR m.created_at IS NULL
 OR public.is_test_record(m.id) OR public.is_test_record(c.id) THEN RETURN NULL;END IF;
 value:=h.payload#>'{entry,0,changes,0,value}';phone:=value#>>'{metadata,phone_number_id}';
 IF phone IS NULL OR phone !~ '^[0-9]{5,30}$' OR c.wa_phone_number_id IS DISTINCT FROM phone
 OR m.raw->>'_cloud_phone_number_id' IS DISTINCT FROM phone
 OR regexp_replace(coalesce(m.to_number,''),'[^0-9]','','g') IS DISTINCT FROM regexp_replace(coalesce(value#>>'{metadata,display_phone_number}',''),'[^0-9]','','g')
 OR regexp_replace(coalesce(c.twilio_number,''),'[^0-9]','','g') IS DISTINCT FROM regexp_replace(coalesce(m.to_number,''),'[^0-9]','','g')
 OR jsonb_typeof(value->'messages') IS DISTINCT FROM 'array' THEN RETURN NULL;END IF;
 SELECT x INTO raw_message FROM jsonb_array_elements(value->'messages')x WHERE x->>'id'=m.wa_message_id;
 IF raw_message IS NULL OR coalesce(raw_message->>'timestamp','') !~ '^[0-9]{1,12}$' OR coalesce(raw_message->>'type','') NOT IN('text','image','video','audio','document','sticker','location','contacts','interactive','button','reaction','order')
 OR raw_message->>'id' IS DISTINCT FROM m.raw->>'id'
 OR NOT techerp_api.notification_whatsapp_sender_matches(raw_message->>'from',m.from_number)
 OR regexp_replace(coalesce(c.contact_phone,''),'[^0-9]','','g') IS DISTINCT FROM regexp_replace(coalesce(m.from_number,''),'[^0-9]','','g') THEN RETURN NULL;END IF;
 occurred:=to_timestamp((raw_message->>'timestamp')::double precision);
 -- Provider timestamps have second precision. The server received_at remains a
 -- separate, full-precision cutoff, so historic/replayed deliveries cannot join
 -- a rule that was activated later, even if their message is inserted later.
 IF occurred>h.received_at+interval '5 minutes' OR m.created_at<h.received_at-interval '5 minutes' THEN RETURN NULL;END IF;
 IF value?'_verified_connection_id' OR value?'_verified_workspace_id' OR h.delivery_id LIKE 'cloud:%' THEN
  IF value->>'_verified_connection_id' !~ '^[0-9a-f-]{36}$' OR value->>'_verified_workspace_id' IS DISTINCT FROM m.workspace_id::text
   OR h.delivery_id NOT LIKE 'cloud:'||(value->>'_verified_connection_id')||':%'
   OR NOT EXISTS(SELECT 1 FROM public.wa_cloud_connections a JOIN public.wa_cloud_numbers n ON n.connection_id=a.id AND n.workspace_id=a.workspace_id
    WHERE a.id=(value->>'_verified_connection_id')::uuid AND a.workspace_id=m.workspace_id AND a.enabled AND a.webhook_verified_at IS NOT NULL
     AND a.waba_id=h.payload#>>'{entry,0,id}' AND n.phone_number_id=phone AND n.available AND n.status='CONNECTED') THEN RETURN NULL;END IF;
  source:='cloud:'||(value->>'_verified_connection_id');transport:='cloud';
 ELSE
  SELECT a.account_id::text INTO source FROM techerp_api.notification_whatsapp_gateway_current() a
   WHERE a.workspace_id=m.workspace_id AND a.phone_number_id=phone
    AND regexp_replace(a.display_phone_number,'[^0-9]','','g')=regexp_replace(value#>>'{metadata,display_phone_number}','[^0-9]','','g');
  -- WABA and phone are part of the persisted, HMAC-verified provider envelope.
  -- A WABA mirror is optional and never establishes the gateway's identity.
  IF coalesce(h.payload#>>'{entry,0,id}','') !~ '^[0-9]{5,30}$' THEN RETURN NULL;END IF;
  IF EXISTS(SELECT 1 FROM public.wa_phone_numbers n JOIN public.wa_business_accounts b ON b.id=n.waba_id
   WHERE n.phone_number_id=phone AND nullif(b.waba_id,'') IS NOT NULL AND b.waba_id IS DISTINCT FROM h.payload#>>'{entry,0,id}') THEN RETURN NULL;END IF;
  IF source IS NULL OR h.workspace_id IS NOT NULL AND h.workspace_id IS DISTINCT FROM m.workspace_id THEN RETURN NULL;END IF;
  source:='lovable:'||source;transport:='lovable';
 END IF;
 RETURN jsonb_build_object('id',m.id,'workspace_id',m.workspace_id,'owner_id',m.owner_id,'conversation_id',c.id,'direction','inbound',
  'source_key',source,'phone_number_id',phone,'provider',transport,'occurred_at',occurred,'message_type',raw_message->>'type','assigned_to',c.assigned_to,
  '_received_at',h.received_at);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_origin(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_whatsapp_snapshot(p_payload jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p_payload IS NULL THEN NULL WHEN jsonb_typeof(p_payload)<>'object' THEN '{}'::jsonb ELSE
 coalesce((SELECT jsonb_object_agg(k,p_payload->k) FROM unnest(ARRAY['id','workspace_id','owner_id','conversation_id','direction','source_key','phone_number_id','provider','occurred_at','message_type','assigned_to','__wf_state','__wf_wait','__wf_path'])k WHERE p_payload?k),'{}'::jsonb) END
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_snapshot(jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.notification_whatsapp_snapshot_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF NEW.entity='whatsapp_messages' THEN
  IF NEW.notification_event_key IS DISTINCT FROM 'shared.message.received' THEN RAISE EXCEPTION 'Mensagem exige ocorrência inbound comprovada.' USING ERRCODE='42501';END IF;
  NEW.before:=techerp_api.notification_whatsapp_snapshot(NEW.before);NEW.after:=techerp_api.notification_whatsapp_snapshot(NEW.after);
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_snapshot_capture() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_a_whatsapp_snapshot BEFORE INSERT ON public.workflow_events FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_whatsapp_snapshot_capture();

CREATE FUNCTION public.notification_whatsapp_received(p_message uuid,p_webhook uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE source jsonb;event public.workflow_events;occurrence text;existing uuid;revision text;occurred timestamptz;received timestamptz;w uuid;owner uuid;BEGIN
 PERFORM techerp_api.notification_service();
 source:=techerp_api.notification_whatsapp_origin(p_message,p_webhook);
 IF source IS NULL THEN RETURN NULL;END IF;
 w:=(source->>'workspace_id')::uuid;occurred:=(source->>'occurred_at')::timestamptz;received:=(source->>'_received_at')::timestamptz;
 source:=source-'_received_at';
 IF NOT EXISTS(SELECT 1 FROM public.workflows f JOIN public.notification_whatsapp_activations a ON a.workflow_id=f.id AND a.workspace_id=f.workspace_id AND a.workflow_version=f.published_version
  WHERE f.workspace_id=w AND f.entity='whatsapp_messages' AND f.enabled AND f.status='published' AND f.trigger#>>'{notification_event,key}'='shared.message.received'
   AND received>=a.activated_at AND occurred>=date_trunc('second',a.activated_at)
   AND techerp_api.notification_whatsapp_selection_valid(w,f.trigger->'notification_event')
   AND techerp_api.notification_whatsapp_selection_matches(f.trigger->'notification_event',source->>'source_key',source->>'phone_number_id')) THEN RETURN NULL;END IF;
 SELECT created_by INTO owner FROM public.workspaces WHERE id=w;
 IF owner IS NULL THEN RETURN NULL;END IF;
 occurrence:='wa:'||encode(sha256(convert_to((source->>'source_key')||':'||(source->>'phone_number_id')||':'||(SELECT wa_message_id FROM public.whatsapp_messages WHERE id=p_message),'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-whatsapp:'||w||':'||occurrence,0));
 SELECT event_id INTO existing FROM public.notification_business_occurrence_receipts WHERE workspace_id=w AND event_key='shared.message.received' AND occurrence_key=occurrence;
 IF existing IS NOT NULL THEN RETURN existing;END IF;
 revision:=encode(sha256(convert_to((source-'assigned_to')::text,'UTF8')),'hex');
 event.id:=gen_random_uuid();event.workspace_id:=w;event.owner_id:=owner;event.entity:='whatsapp_messages';event.entity_id:=p_message;
 event.event_type:='updated';event.before:=NULL;event.after:=source;event.notification_event_key:='shared.message.received';
 INSERT INTO public.notification_business_event_proofs(event_id,root_event_id,workspace_id,event_key,source_table,source_id,producer_table,producer_id,reference_id,source_revision,occurrence_key,payload_hash,occurred_at)
  VALUES(event.id,event.id,w,event.notification_event_key,event.entity,p_message,'whatsapp_webhook_events',p_webhook,(source->>'conversation_id')::uuid,revision,occurrence,techerp_api.notification_business_event_hash(event),occurred);
 INSERT INTO public.workflow_events(id,workspace_id,owner_id,entity,entity_id,event_type,before,after,notification_event_key)
  VALUES(event.id,w,owner,event.entity,p_message,'updated',NULL,source,event.notification_event_key) RETURNING * INTO event;
 IF event.id IS NULL THEN DELETE FROM public.notification_business_event_proofs WHERE workspace_id=w AND event_key='shared.message.received' AND occurrence_key=occurrence;RETURN NULL;END IF;
 INSERT INTO public.notification_business_occurrence_receipts(workspace_id,event_key,occurrence_key,event_id,source_table,source_id,producer_table,producer_id,reference_id,source_revision)
  VALUES(w,event.notification_event_key,occurrence,event.id,event.entity,p_message,'whatsapp_webhook_events',p_webhook,(source->>'conversation_id')::uuid,revision);
 RETURN event.id;
END $$;
REVOKE ALL ON FUNCTION public.notification_whatsapp_received(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.notification_whatsapp_received(uuid,uuid) TO service_role;

ALTER FUNCTION techerp_api.notification_business_proof_current(public.notification_business_event_proofs) RENAME TO notification_business_proof_current_before_whatsapp;
CREATE FUNCTION techerp_api.notification_business_proof_current(p public.notification_business_event_proofs) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE source jsonb;BEGIN
 IF p.event_key IS DISTINCT FROM 'shared.message.received' THEN RETURN techerp_api.notification_business_proof_current_before_whatsapp(p);END IF;
 source:=techerp_api.notification_whatsapp_origin(p.source_id,p.producer_id)-'_received_at';
 RETURN coalesce(p.source_table='whatsapp_messages' AND p.producer_table='whatsapp_webhook_events'
  AND source IS NOT NULL AND source->>'workspace_id'=p.workspace_id::text AND source->>'conversation_id'=p.reference_id::text
  AND p.source_revision=encode(sha256(convert_to((source-'assigned_to')::text,'UTF8')),'hex')
  AND (source->>'occurred_at')::timestamptz=p.occurred_at,false);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_business_proof_current(public.notification_business_event_proofs) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.notification_business_event_check(uuid,uuid,integer) RENAME TO notification_business_event_check_before_whatsapp;
CREATE FUNCTION public.notification_business_event_check(p_event uuid,p_workflow uuid,p_version integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.workflow_events;p public.notification_business_event_proofs;r public.notification_business_event_proofs;root public.workflow_events;f public.workflows;a public.notification_whatsapp_activations;source jsonb;executor uuid;config jsonb;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO e FROM public.workflow_events WHERE id=p_event;
 IF e.notification_event_key IS DISTINCT FROM 'shared.message.received' THEN RETURN public.notification_business_event_check_before_whatsapp(p_event,p_workflow,p_version);END IF;
 SELECT * INTO p FROM public.notification_business_event_proofs WHERE event_id=e.id;
 SELECT * INTO r FROM public.notification_business_event_proofs WHERE event_id=p.root_event_id;
 SELECT * INTO root FROM public.workflow_events WHERE id=r.event_id;
 SELECT * INTO f FROM public.workflows WHERE id=p_workflow AND workspace_id=e.workspace_id AND entity='whatsapp_messages' AND enabled AND status='published' AND published_version=p_version;
 SELECT * INTO a FROM public.notification_whatsapp_activations WHERE workflow_id=f.id AND workspace_id=f.workspace_id AND workflow_version=p_version;
 config:=f.trigger->'notification_event';source:=techerp_api.notification_whatsapp_origin(r.source_id,r.producer_id);
 IF f.id IS NULL OR a.workflow_id IS NULL OR p.event_id IS NULL OR r.event_id IS NULL OR root.id IS NULL
 OR e.entity<>'whatsapp_messages' OR p.workspace_id IS DISTINCT FROM e.workspace_id OR p.source_table IS DISTINCT FROM e.entity
 OR p.source_id IS DISTINCT FROM e.entity_id OR p.event_key IS DISTINCT FROM e.notification_event_key
 OR p.payload_hash IS DISTINCT FROM techerp_api.notification_business_event_hash(e)
 OR r.root_event_id IS DISTINCT FROM r.event_id OR r.parent_event_id IS NOT NULL OR root.notification_parent_event_id IS NOT NULL
 OR r.payload_hash IS DISTINCT FROM techerp_api.notification_business_event_hash(root)
 OR ROW(p.workspace_id,p.event_key,p.source_table,p.source_id,p.producer_table,p.producer_id,p.reference_id,p.source_revision)
 IS DISTINCT FROM ROW(r.workspace_id,r.event_key,r.source_table,r.source_id,r.producer_table,r.producer_id,r.reference_id,r.source_revision)
 OR r.workspace_id IS DISTINCT FROM root.workspace_id OR r.source_table IS DISTINCT FROM root.entity OR r.source_id IS DISTINCT FROM root.entity_id OR r.event_key IS DISTINCT FROM root.notification_event_key
 OR (p.workflow_id IS NOT NULL AND (p.workflow_id IS DISTINCT FROM f.id OR p.workflow_version IS DISTINCT FROM p_version))
 OR (e.workflow_version IS NOT NULL AND e.workflow_version IS DISTINCT FROM p_version)
 OR (e.resume_workflow_id IS NOT NULL AND e.resume_workflow_id IS DISTINCT FROM f.id)
 OR source IS NULL OR (source->>'_received_at')::timestamptz<a.activated_at OR r.occurred_at<date_trunc('second',a.activated_at)
 OR NOT techerp_api.notification_business_proof_current(r)
 OR f.trigger?'time_based' OR NOT techerp_api.notification_whatsapp_selection_valid(f.workspace_id,config)
 OR NOT techerp_api.notification_whatsapp_selection_matches(config,source->>'source_key',source->>'phone_number_id')
 OR NOT techerp_api.notification_whatsapp_actions_valid(f.actions) THEN RETURN false;END IF;
 executor:=coalesce(f.execution_user_id,f.owner_id);
 RETURN public.is_workspace_member(f.workspace_id,executor)
  AND techerp_api.notification_source_visible(f.workspace_id,executor,'whatsapp_messages',e.entity_id)
  AND public.sales_worker_authorize('workflows',f.id,jsonb_build_array(jsonb_build_object('workflow_version',p_version),jsonb_build_object('record_table','whatsapp_messages','id',e.entity_id,'action','view')));
END $$;
REVOKE ALL ON FUNCTION public.notification_business_event_check(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.notification_business_event_check(uuid,uuid,integer) TO service_role;
REVOKE ALL ON FUNCTION public.notification_business_event_check_before_whatsapp(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;

-- New occurrences render only safe metadata; links always open the parent
-- conversation. Reuse an existing assigned-user unread notice instead of adding
-- another implicit in-app copy of the legacy first-unread notification.
CREATE FUNCTION techerp_api.notification_whatsapp_href(p_workspace uuid,p_message uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT '/inbox/whatsapp?conversation='||conversation_id::text FROM public.whatsapp_messages WHERE id=p_message AND workspace_id=p_workspace $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_href(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.notification_whatsapp_existing_inapp(p_event uuid,p_user uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c uuid;w uuid;BEGIN
 SELECT m.conversation_id,m.workspace_id INTO c,w FROM public.workflow_events e JOIN public.whatsapp_messages m ON m.id=e.entity_id AND m.workspace_id=e.workspace_id
  JOIN public.whatsapp_conversations cv ON cv.id=m.conversation_id AND cv.workspace_id=m.workspace_id AND cv.assigned_to=p_user
  WHERE e.id=p_event AND e.notification_event_key='shared.message.received';
 RETURN (SELECT n.id FROM public.notifications n JOIN public.notification_workspace_context nc ON nc.notification_id=n.id AND nc.workspace_id=n.workspace_id
  WHERE n.workspace_id=w AND n.user_id=p_user AND n.type='message' AND n.entity='inbox_conversation' AND n.entity_id=c AND n.read_at IS NULL
   AND nc.source_table='whatsapp_conversations' AND nc.source_id=c ORDER BY n.created_at DESC,n.id LIMIT 1);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_existing_inapp(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Extend only the documented seams of the existing, fully guarded dispatchers.
-- Exact-count checks fail closed if an upstream definition has changed. Their
-- complete authorization, current versions, recipients, consent, ledger, quotas,
-- private projections and external neutral content remain untouched.
DO $patch$
DECLARE signature text;d text;needle text;replacement text;expected integer;BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'public.notification_workflow_dispatch(uuid,uuid,integer,text,uuid,jsonb,text,text,text)',
  'public.notification_workflow_dispatch_v2(uuid,uuid,integer,text,uuid,jsonb,text,text,text,jsonb)',
  'techerp_api.notification_schedule_recipients(uuid,jsonb)'] LOOP
  d:=pg_get_functiondef(signature::regprocedure);
  needle:='  FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP';
  IF (length(d)-length(replace(d,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unknown recipient source seam: %',signature;END IF;
  replacement:=$seam$  IF p_entity='whatsapp_messages' THEN
   source:=jsonb_build_object('assigned_to',(SELECT c.assigned_to FROM public.whatsapp_messages m JOIN public.whatsapp_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id WHERE m.id=p_record AND m.workspace_id=w));
  END IF;
  FOR rule IN SELECT value FROM jsonb_array_elements(p_rules) LOOP$seam$;
  d:=replace(d,needle,replacement);
  IF signature NOT LIKE '%notification_schedule_recipients%' THEN
   needle:='  href:=CASE p_entity';
   IF (length(d)-length(replace(d,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unknown href seam: %',signature;END IF;
   d:=replace(d,needle,needle||E'\n    WHEN ''whatsapp_messages'' THEN techerp_api.notification_whatsapp_href(w,p_record)');
   needle:='IF resolved_event=''people.approval.pending'' THEN'||E'\n';
   expected:=CASE WHEN signature LIKE '%dispatch_v2%' THEN 2 ELSE 1 END;
   IF (length(d)-length(replace(d,needle,'')))/length(needle)<>expected THEN RAISE EXCEPTION 'Unknown existing-notice seam: %',signature;END IF;
   d:=replace(d,needle,'IF resolved_event=''people.approval.pending'' OR (resolved_event=''shared.message.received'' AND techerp_api.notification_whatsapp_existing_inapp(ev.id,recipient) IS NOT NULL) THEN'||E'\n');
   needle:='created:=techerp_api.notification_people_existing_inapp(ev.id,recipient);';
   IF (length(d)-length(replace(d,needle,'')))/length(needle)<>expected THEN RAISE EXCEPTION 'Unknown existing-notice function seam: %',signature;END IF;
   d:=replace(d,needle,$seam$created:=CASE WHEN resolved_event='shared.message.received' THEN techerp_api.notification_whatsapp_existing_inapp(ev.id,recipient) ELSE techerp_api.notification_people_existing_inapp(ev.id,recipient) END;
      IF resolved_event='shared.message.received' AND created IS NOT NULL THEN UPDATE public.notification_workspace_context SET event_key=resolved_event WHERE notification_id=created AND workspace_id=w;END IF;$seam$);
  END IF;
  EXECUTE d;
 END LOOP;
 d:=pg_get_functiondef('techerp_api.notification_center_capture()'::regprocedure);
 needle:='ELSIF t IN(''leads''';
 IF (length(d)-length(replace(d,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unknown notification context capture seam';END IF;
 d:=replace(d,needle,'ELSIF t IN(''whatsapp_messages'',''leads''');EXECUTE d;
 d:=pg_get_functiondef('techerp_api.notification_center_module(text)'::regprocedure);
 needle:='WHEN p_table IN(''leads''';
 IF (length(d)-length(replace(d,needle,'')))/length(needle)<>1 THEN RAISE EXCEPTION 'Unknown notification module seam';END IF;
 d:=replace(d,needle,'WHEN p_table IN(''whatsapp_messages'',''leads''');EXECUTE d;
END $patch$;

NOTIFY pgrst,'reload schema';
