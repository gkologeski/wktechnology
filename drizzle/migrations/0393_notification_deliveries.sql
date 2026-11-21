-- NOTIFICA-CENTRAL package 4. Prepared locally; no channel is enabled by default.
-- The existing Workflow engine owns occurrences; its existing delivery ledger owns sends.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
VALUES
 ('system.notification_settings.view.workspace','system','notification_settings','view','workspace','Consultar canais de notificações','Consultar a configuração de comunicação do workspace.',true),
 ('system.notification_settings.manage.workspace','system','notification_settings','manage','workspace','Administrar canais de notificações','Configurar canais e remetentes; não concede consentimento por outra pessoa.',true),
 ('system.notification_deliveries.view.workspace','system','notification_deliveries','view','workspace','Consultar entregas de notificações do workspace','Consultar histórico mínimo, mantendo a leitura da origem e sem destinos pessoais.',true)
ON CONFLICT(key) DO NOTHING;

CREATE TABLE public.notification_delivery_policies (
 workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0),
 email_enabled boolean NOT NULL DEFAULT false,whatsapp_enabled boolean NOT NULL DEFAULT false,
 email_daily_limit integer NOT NULL DEFAULT 0 CHECK(email_daily_limit BETWEEN 0 AND 10000),
 whatsapp_daily_limit integer NOT NULL DEFAULT 0 CHECK(whatsapp_daily_limit BETWEEN 0 AND 10000),
 wa_sender_id text,wa_template_name text,wa_template_language text,
 wa_estimated_unit_micros bigint NOT NULL DEFAULT 0 CHECK(wa_estimated_unit_micros BETWEEN 0 AND 1000000000000),
 wa_daily_budget_micros bigint NOT NULL DEFAULT 0 CHECK(wa_daily_budget_micros BETWEEN 0 AND 1000000000000),
 currency text NOT NULL DEFAULT 'BRL' CHECK(currency IN('BRL','USD','EUR')),
 updated_by uuid NOT NULL REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT whatsapp_enabled OR(wa_estimated_unit_micros>0 AND wa_daily_budget_micros>=wa_estimated_unit_micros))
);
CREATE TABLE public.notification_delivery_consents (
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 phone text NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{7,14}$'),
 granted_at timestamptz,revoked_at timestamptz,
 version text NOT NULL DEFAULT 'notifica-wa-v1' CHECK(version='notifica-wa-v1'),
 revision integer NOT NULL CHECK(revision>0),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE public.notification_delivery_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
 run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,workflow_version integer NOT NULL,
 step_path text NOT NULL CHECK(length(step_path) BETWEEN 1 AND 300),
 source_table text NOT NULL,source_id uuid NOT NULL,recipient_user_id uuid NOT NULL REFERENCES public.profiles(id),
 notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
 event_key text NOT NULL DEFAULT 'legacy.workflow' CHECK(event_key='legacy.workflow'),
 delivery_config jsonb NOT NULL,payload_content_neutral jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,run_id,step_path,recipient_user_id)
);
ALTER TABLE public.notification_delivery_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_delivery_policies,public.notification_delivery_consents,public.notification_delivery_intents
 FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.workflow_deliveries
 ADD COLUMN notification_intent_id uuid REFERENCES public.notification_delivery_intents(id) ON DELETE CASCADE,
 ADD COLUMN lease_token uuid,ADD COLUMN notification_attempt_token uuid,ADD COLUMN reason_code text,
 ADD COLUMN endpoint_hash text,ADD COLUMN policy_revision integer,ADD COLUMN consent_revision integer,
 ADD COLUMN notification_cost_micros bigint,ADD COLUMN notification_currency text,ADD COLUMN notification_reserved_at timestamptz,
 ADD COLUMN notification_sender_id text,ADD COLUMN notification_template_name text,ADD COLUMN notification_template_language text;
ALTER TABLE public.workflow_deliveries DROP CONSTRAINT workflow_deliveries_status_check;
ALTER TABLE public.workflow_deliveries ADD CONSTRAINT workflow_deliveries_status_check
 CHECK(status IN('queued','in_flight','sent','retry_scheduled','failed','uncertain','deduped','accepted','delivered','read','suppressed'));
CREATE UNIQUE INDEX notification_delivery_occurrence_channel ON public.workflow_deliveries(notification_intent_id,channel)
 WHERE notification_intent_id IS NOT NULL;
CREATE INDEX notification_delivery_pending ON public.workflow_deliveries(next_attempt_at,created_at,id)
 WHERE notification_intent_id IS NOT NULL AND status IN('queued','retry_scheduled','in_flight');
-- Attempts' fencing token, endpoint and financial snapshots are server-only columns.
REVOKE SELECT ON public.workflow_deliveries FROM authenticated;
GRANT SELECT(id,workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,
 lease_until,next_attempt_at,provider,provider_id,last_error,created_at,updated_at,notification_intent_id,reason_code)
 ON public.workflow_deliveries TO authenticated;

CREATE FUNCTION techerp_api.notification_service() RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL OR public.is_read_only_view() THEN
  RAISE EXCEPTION 'Operação reservada ao motor de notificações.' USING ERRCODE='42501';END IF;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_service() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.notification_delivery_permission(p_workspace uuid,p_manage boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace,p_manage);c jsonb:=public.work_access_context();BEGIN
 IF NOT(c->'keys'?'system.notification_settings.view.workspace') OR
  (p_manage AND NOT(c->'keys'?'system.notification_settings.manage.workspace')) THEN
  RAISE EXCEPTION 'Sem permissão para configurar notificações.' USING ERRCODE='42501';END IF;
 RETURN u;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_delivery_permission(uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.notification_delivery_capabilities(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);c jsonb:=public.work_access_context();BEGIN
 RETURN jsonb_build_object('settingsView',c->'keys'?'system.notification_settings.view.workspace',
  'settingsManage',NOT public.is_read_only_view() AND c->'keys'?'system.notification_settings.view.workspace' AND c->'keys'?'system.notification_settings.manage.workspace',
  'whatsappConfigure',NOT public.is_read_only_view() AND c->'keys'?'system.notification_settings.view.workspace' AND c->'keys'?'system.notification_settings.manage.workspace' AND c->'keys'?'system.channels.view.workspace' AND c->'keys'?'system.whatsapp.manage.workspace','deliveriesView',true,'deliveriesWorkspaceView',c->'keys'?'system.notification_deliveries.view.workspace');
END $$;
CREATE FUNCTION techerp_api.notification_policy_json(p_workspace uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce((SELECT to_jsonb(p)-ARRAY['workspace_id','revision','updated_by','updated_at']
 FROM public.notification_delivery_policies p WHERE workspace_id=p_workspace),jsonb_build_object(
 'email_enabled',false,'whatsapp_enabled',false,'email_daily_limit',0,'whatsapp_daily_limit',0,
 'wa_sender_id',NULL,'wa_template_name',NULL,'wa_template_language',NULL,
 'wa_estimated_unit_micros',0,'wa_daily_budget_micros',0,'currency','BRL'))
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_policy_json(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.notification_delivery_settings(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_delivery_permission(p_workspace);BEGIN
 RETURN jsonb_build_object('policy',techerp_api.notification_policy_json(p_workspace),'revision',
 coalesce((SELECT revision FROM public.notification_delivery_policies WHERE workspace_id=p_workspace),0));
END $$;
CREATE FUNCTION public.notification_delivery_settings_save(p_workspace uuid,p_policy jsonb,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_delivery_permission(p_workspace,true);r public.notification_delivery_policies;
 p jsonb:=p_policy;k text;expected integer;BEGIN
 IF p_revision IS NULL OR p_revision<0 OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>10000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) x WHERE x NOT IN('email_enabled','whatsapp_enabled',
 'email_daily_limit','whatsapp_daily_limit','wa_sender_id','wa_template_name','wa_template_language',
 'wa_estimated_unit_micros','wa_daily_budget_micros','currency')) THEN
  RAISE EXCEPTION 'Configuração de canais inválida.' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['email_enabled','whatsapp_enabled'] LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Configuração de canais inválida.' USING ERRCODE='22023';END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['email_daily_limit','whatsapp_daily_limit','wa_estimated_unit_micros','wa_daily_budget_micros'] LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'number' OR p->>k !~ '^[0-9]+$'
  OR (p->>k)::numeric>(CASE WHEN k LIKE '%daily_limit' THEN 10000 ELSE 1000000000000 END) THEN
   RAISE EXCEPTION 'Limites de comunicação inválidos.' USING ERRCODE='22023';END IF;
 END LOOP;
 IF jsonb_typeof(p->'currency') IS DISTINCT FROM 'string' OR p->>'currency' NOT IN('BRL','USD','EUR') THEN
  RAISE EXCEPTION 'Informe o código de moeda com três letras.' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['wa_sender_id','wa_template_name','wa_template_language'] LOOP
  IF p?k AND jsonb_typeof(p->k) NOT IN('string','null') THEN RAISE EXCEPTION 'Modelo ou remetente inválido.' USING ERRCODE='22023';END IF;
 END LOOP;
 IF coalesce(length(p->>'wa_sender_id'),0)>30 OR coalesce(length(p->>'wa_template_name'),0)>512
 OR coalesce(length(p->>'wa_template_language'),0)>20 THEN RAISE EXCEPTION 'Modelo ou remetente inválido.' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-policy:'||p_workspace,0));
 SELECT * INTO r FROM public.notification_delivery_policies WHERE workspace_id=p_workspace FOR UPDATE;expected:=r.revision;
 IF coalesce(expected,0)<>p_revision THEN RAISE EXCEPTION 'A configuração mudou em outra sessão. Recarregue.' USING ERRCODE='PT409';END IF;
 IF (((p->>'whatsapp_enabled')::boolean IS DISTINCT FROM coalesce(r.whatsapp_enabled,false))
  OR (p->>'whatsapp_daily_limit')::integer IS DISTINCT FROM coalesce(r.whatsapp_daily_limit,0)
  OR (p->>'wa_estimated_unit_micros')::bigint IS DISTINCT FROM coalesce(r.wa_estimated_unit_micros,0)
  OR (p->>'wa_daily_budget_micros')::bigint IS DISTINCT FROM coalesce(r.wa_daily_budget_micros,0)
  OR ((r.wa_sender_id IS NOT NULL OR nullif(p->>'wa_sender_id','') IS NOT NULL OR coalesce(r.whatsapp_enabled,false) OR p->>'whatsapp_enabled'='true')
   AND p->>'currency' IS DISTINCT FROM coalesce(r.currency,'BRL'))
  OR nullif(p->>'wa_sender_id','') IS DISTINCT FROM r.wa_sender_id
  OR nullif(p->>'wa_template_name','') IS DISTINCT FROM r.wa_template_name
  OR nullif(p->>'wa_template_language','') IS DISTINCT FROM r.wa_template_language)
  AND NOT((public.work_access_context())->'keys'?'system.channels.view.workspace'
   AND (public.work_access_context())->'keys'?'system.whatsapp.manage.workspace') THEN
  RAISE EXCEPTION 'Sem permissão para configurar os canais oficiais.' USING ERRCODE='42501';END IF;
 IF p->>'whatsapp_enabled'='true' THEN
  IF coalesce(p->>'wa_sender_id','') !~ '^[0-9]{5,30}$' OR coalesce(p->>'wa_template_name','') !~ '^[a-z0-9_]+$'
   OR coalesce(p->>'wa_template_language','') !~ '^[a-z]{2,3}(_[A-Z]{2})?$'
   OR (p->>'wa_estimated_unit_micros')::bigint<=0 OR (p->>'wa_daily_budget_micros')::bigint<(p->>'wa_estimated_unit_micros')::bigint
   OR (p->>'whatsapp_daily_limit')::integer<=0 THEN
   RAISE EXCEPTION 'Configure remetente, modelo, idioma, cota e orçamento antes de habilitar WhatsApp.' USING ERRCODE='22023';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n JOIN public.wa_cloud_connections c ON c.id=n.connection_id AND c.workspace_id=n.workspace_id
   WHERE n.workspace_id=p_workspace AND n.phone_number_id=p->>'wa_sender_id' AND n.available
    AND n.status='CONNECTED' AND upper(coalesce(n.quality_rating,'')) IN('GREEN','HIGH') AND c.enabled AND c.webhook_verified_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Remetente oficial indisponível neste workspace.' USING ERRCODE='42501';END IF;
 END IF;
 IF p->>'email_enabled'='true' AND (p->>'email_daily_limit')::integer<=0 THEN
  RAISE EXCEPTION 'Informe uma cota positiva antes de habilitar e-mail.' USING ERRCODE='22023';END IF;
 INSERT INTO public.notification_delivery_policies(workspace_id,revision,email_enabled,whatsapp_enabled,email_daily_limit,whatsapp_daily_limit,
 wa_sender_id,wa_template_name,wa_template_language,wa_estimated_unit_micros,wa_daily_budget_micros,currency,updated_by)
 VALUES(p_workspace,p_revision+1,(p->>'email_enabled')::boolean,(p->>'whatsapp_enabled')::boolean,
 (p->>'email_daily_limit')::integer,(p->>'whatsapp_daily_limit')::integer,nullif(p->>'wa_sender_id',''),
 nullif(p->>'wa_template_name',''),nullif(p->>'wa_template_language',''),(p->>'wa_estimated_unit_micros')::bigint,
 (p->>'wa_daily_budget_micros')::bigint,p->>'currency',u)
 ON CONFLICT(workspace_id) DO UPDATE SET revision=excluded.revision,email_enabled=excluded.email_enabled,
 whatsapp_enabled=excluded.whatsapp_enabled,email_daily_limit=excluded.email_daily_limit,whatsapp_daily_limit=excluded.whatsapp_daily_limit,
 wa_sender_id=excluded.wa_sender_id,wa_template_name=excluded.wa_template_name,wa_template_language=excluded.wa_template_language,
 wa_estimated_unit_micros=excluded.wa_estimated_unit_micros,wa_daily_budget_micros=excluded.wa_daily_budget_micros,
 currency=excluded.currency,updated_by=u,updated_at=now();
 RETURN jsonb_build_object('policy',techerp_api.notification_policy_json(p_workspace),'revision',p_revision+1);
END $$;

CREATE FUNCTION public.get_notification_delivery_consent(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);c public.notification_delivery_consents;phone text;BEGIN
 SELECT p.phone INTO phone FROM public.profiles p WHERE id=u;
 SELECT * INTO c FROM public.notification_delivery_consents WHERE workspace_id=p_workspace AND user_id=u;
 RETURN jsonb_build_object('phone',phone,'consent',CASE WHEN c.user_id IS NOT NULL THEN jsonb_build_object(
 'phone',c.phone,'grantedAt',c.granted_at,'revokedAt',c.revoked_at,'version',c.version,'revision',c.revision) ELSE NULL END);
END $$;
CREATE FUNCTION public.save_notification_delivery_consent(p_workspace uuid,p_granted boolean,p_phone text,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace,true);actual_phone text;expected integer;BEGIN
 IF p_granted IS NULL OR p_revision IS NULL OR p_revision<0 OR (p_granted AND(p_phone IS NULL OR p_phone !~ '^\+[1-9][0-9]{7,14}$')) THEN
  RAISE EXCEPTION 'Confirme seu número no formato internacional antes de consentir.' USING ERRCODE='22023';END IF;
 SELECT phone INTO actual_phone FROM public.profiles WHERE id=u FOR SHARE;
 IF p_granted AND actual_phone IS DISTINCT FROM p_phone THEN RAISE EXCEPTION 'O número informado difere do seu perfil atual.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-consent:'||p_workspace||':'||u,0));
 SELECT revision INTO expected FROM public.notification_delivery_consents WHERE workspace_id=p_workspace AND user_id=u FOR UPDATE;
 IF coalesce(expected,0)<>p_revision THEN RAISE EXCEPTION 'O consentimento mudou em outra sessão. Recarregue.' USING ERRCODE='PT409';END IF;
 IF NOT p_granted THEN
  IF expected IS NOT NULL THEN UPDATE public.notification_delivery_consents SET revoked_at=now(),revision=p_revision+1,updated_at=now()
   WHERE workspace_id=p_workspace AND user_id=u;END IF;
  RETURN public.get_notification_delivery_consent(p_workspace);END IF;
 INSERT INTO public.notification_delivery_consents(workspace_id,user_id,phone,granted_at,revoked_at,revision)
 VALUES(p_workspace,u,p_phone,CASE WHEN p_granted THEN now() END,CASE WHEN NOT p_granted THEN now() END,p_revision+1)
 ON CONFLICT(workspace_id,user_id) DO UPDATE SET phone=p_phone,
 granted_at=CASE WHEN p_granted THEN now() ELSE notification_delivery_consents.granted_at END,
 revoked_at=CASE WHEN p_granted THEN NULL ELSE now() END,revision=p_revision+1,updated_at=now();
 RETURN public.get_notification_delivery_consent(p_workspace);
END $$;

CREATE FUNCTION public.notification_delivery_visible(p_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=auth.uid();c jsonb;i public.notification_delivery_intents;BEGIN
 IF u IS NULL OR coalesce(auth.role(),'')<>'authenticated' OR current_setting('app.api_subject',true)='on' THEN RETURN false;END IF;
 c:=public.work_access_context();
 SELECT n.* INTO i FROM public.workflow_deliveries d JOIN public.notification_delivery_intents n ON n.id=d.notification_intent_id WHERE d.id=p_id;
 RETURN coalesce(i.workspace_id::text=c->>'workspace' AND public.is_workspace_member(i.workspace_id,u)
  AND (i.recipient_user_id=u OR c->'keys'?'system.notification_deliveries.view.workspace')
  AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id),false);
END $$;
CREATE POLICY notification_delivery_own ON public.workflow_deliveries FOR SELECT TO authenticated
 USING(notification_intent_id IS NOT NULL AND public.notification_delivery_visible(id));
CREATE POLICY notification_delivery_boundary ON public.workflow_deliveries AS RESTRICTIVE FOR SELECT TO authenticated
 USING(notification_intent_id IS NULL OR public.notification_delivery_visible(id));

CREATE FUNCTION public.notification_delivery_history(p_workspace uuid,p_cursor jsonb DEFAULT NULL,p_status text DEFAULT NULL,
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
  SELECT d.id,d.channel,d.status,d.reason_code,d.attempts,d.created_at,d.updated_at,i.recipient_user_id,i.workflow_id,d.provider_id
  FROM public.workflow_deliveries d JOIN public.notification_delivery_intents i ON i.id=d.notification_intent_id
  WHERE i.workspace_id=p_workspace AND(p_scope='workspace' OR i.recipient_user_id=u)
   AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id)
  UNION ALL
  SELECT n.id,'inapp',CASE WHEN n.read_at IS NULL THEN 'available' ELSE 'read' END,NULL::text,0,
   n.created_at,coalesce(n.read_at,n.created_at),i.recipient_user_id,i.workflow_id,NULL::text
  FROM public.notification_delivery_intents i JOIN public.notifications n ON n.id=i.notification_id AND n.user_id=i.recipient_user_id
  WHERE i.workspace_id=p_workspace AND(p_scope='workspace' OR i.recipient_user_id=u)
   AND techerp_api.notification_center_source_visible(i.workspace_id,u,i.source_table,i.source_id)
 ),page AS MATERIALIZED(SELECT * FROM matched WHERE(p_channel IS NULL OR channel=p_channel)
 AND(p_status IS NULL OR status=p_status) AND(at IS NULL OR(created_at,id)<(at,item))
 ORDER BY created_at DESC,id DESC LIMIT 51),items AS(SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 50)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'channel',channel,'status',status,
 'reason_code',reason_code,'attempts',attempts,'created_at',created_at,'updated_at',updated_at,'workflow_id',workflow_id,'provider_id',provider_id,
 'recipient_user_id',CASE WHEN recipient_user_id=u OR p_scope='workspace' THEN recipient_user_id END,
 'recipient_name',CASE WHEN recipient_user_id=u THEN 'Você' ELSE 'Destinatário do workflow' END)
 ORDER BY created_at DESC,id DESC) FROM items),'[]'::jsonb),
 'nextCursor',CASE WHEN(SELECT count(*) FROM page)>50 THEN(SELECT jsonb_build_object('createdAt',created_at,'id',id)
 FROM items ORDER BY created_at,id LIMIT 1)ELSE NULL END) INTO result;RETURN result;
END $$;

CREATE FUNCTION techerp_api.notification_transport_allowed(p_ws uuid,p_actor uuid,p_channel text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(p_channel IN('email','whatsapp') AND public.is_workspace_member(p_ws,p_actor)
 AND public.sales_context_access(public.work_subject_context(p_ws,p_actor),p_ws,'techsales.inbox.'||p_channel,'view',ARRAY[p_actor])
 AND public.sales_context_access(public.work_subject_context(p_ws,p_actor),p_ws,'techsales.inbox.'||p_channel,'create',ARRAY[p_actor]),false)
$$;
REVOKE ALL ON FUNCTION techerp_api.notification_transport_allowed(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

-- Re-evaluate the same category/event precedence as P3 without inventing an
-- external default: the legacy Workflow email default is false.
CREATE FUNCTION techerp_api.notification_external_preference(p_ws uuid,p_user uuid,p_channel text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p jsonb;s jsonb;v jsonb;allowed boolean:=false;section text;entry record;q jsonb;BEGIN
 IF p_channel<>'email' OR NOT public.is_workspace_member(p_ws,p_user) THEN RETURN false;END IF;
 SELECT notification_preferences INTO p FROM public.profiles WHERE id=p_user;
 IF NOT FOUND THEN RETURN false;END IF;
 IF p IS NOT NULL AND p<>'null'::jsonb THEN
  IF jsonb_typeof(p)<>'object' THEN RETURN false;END IF;
  IF p?'workflow' THEN
   IF jsonb_typeof(p->'workflow')<>'object' THEN RETURN false;END IF;
   IF p->'workflow'?'email' THEN allowed:=p#>'{workflow,email}'='true'::jsonb;END IF;
  END IF;
 END IF;
 SELECT settings INTO s FROM public.notification_user_preferences WHERE workspace_id=p_ws AND user_id=p_user;
 IF s IS NOT NULL THEN
  IF jsonb_typeof(s)<>'object' THEN RETURN false;END IF;
  FOREACH section IN ARRAY ARRAY['categories','eventOverrides'] LOOP
   IF s?section THEN
    IF jsonb_typeof(s->section)<>'object' THEN RETURN false;END IF;
    FOR entry IN SELECT j.key,j.value FROM jsonb_each(s->section) j LOOP
     IF((section='categories' AND entry.key IN('mention','assignment','deal_stage','ticket','task','sla','message','workflow','approval','hiring','form','portfolio','platform'))
      OR(section='eventOverrides' AND techerp_api.notification_center_category(CASE WHEN left(entry.key,7)='legacy.' THEN substr(entry.key,8) END) IS NOT NULL))
      AND jsonb_typeof(entry.value)<>'object' THEN RETURN false;END IF;
    END LOOP;
   END IF;
  END LOOP;
  IF s#>'{categories,workflow,email}' IS NOT NULL THEN allowed:=s#>'{categories,workflow,email}'='true'::jsonb;END IF;
  IF s#>'{eventOverrides,legacy.workflow,email}' IS NOT NULL THEN allowed:=s#>'{eventOverrides,legacy.workflow,email}'='true'::jsonb;END IF;
 END IF;
 RETURN coalesce(allowed,false);
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_external_preference(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION techerp_api.notification_quiet_until(p_ws uuid,p_user uuid,p_at timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE q jsonb;tz text;local_time text;start_time text;end_time text;inside boolean;candidate timestamptz;k integer;BEGIN
 SELECT settings->'quiet' INTO q FROM public.notification_user_preferences WHERE workspace_id=p_ws AND user_id=p_user;
 IF q IS NULL THEN RETURN NULL;END IF;
 IF jsonb_typeof(q)<>'object' OR jsonb_typeof(q->'enabled') IS DISTINCT FROM 'boolean'
  OR jsonb_typeof(q->'timezone') IS DISTINCT FROM 'string' OR length(q->>'timezone')>80
  OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE lower(name)=lower(q->>'timezone'))
  OR coalesce(q->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  OR coalesce(q->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  OR(q->>'enabled'='true' AND q->>'start'=q->>'end') THEN
  RETURN 'infinity'::timestamptz;
 END IF;
 IF q->>'enabled'='false' THEN RETURN NULL;END IF;
 SELECT name INTO tz FROM pg_timezone_names WHERE lower(name)=lower(q->>'timezone') LIMIT 1;
 start_time:=q->>'start';end_time:=q->>'end';
 local_time:=to_char(p_at AT TIME ZONE tz,'HH24:MI');
 inside:=CASE WHEN start_time<end_time THEN local_time>=start_time AND local_time<end_time
  ELSE local_time>=start_time OR local_time<end_time END;
 IF NOT inside THEN RETURN NULL;END IF;
 -- Scan real instants in minutes: no fixed-offset math, and both repeated DST
 -- hours respect the same local rule. At most 26 hours, not a busy wait.
 FOR k IN 1..1560 LOOP
  candidate:=date_trunc('minute',p_at)+make_interval(mins=>k);
  local_time:=to_char(candidate AT TIME ZONE tz,'HH24:MI');
  inside:=CASE WHEN start_time<end_time THEN local_time>=start_time AND local_time<end_time
   ELSE local_time>=start_time OR local_time<end_time END;
  IF NOT inside THEN RETURN candidate;END IF;
 END LOOP;
 RETURN 'infinity'::timestamptz;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_quiet_until(uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_intent_context(p_intent uuid,p_channel text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;wf public.workflows;r public.workflow_runs;executor uuid;
 p public.notification_delivery_policies;c public.notification_delivery_consents;email text;phone text;quiet timestamptz;
 href text;BEGIN
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_intent;
 IF i.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','invalid_configuration');END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=i.workflow_id AND workspace_id=i.workspace_id
  AND status='published' AND enabled AND published_version=i.workflow_version AND entity=i.source_table;
 IF wf.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','workflow_changed');END IF;
 SELECT * INTO r FROM public.workflow_runs WHERE id=i.run_id AND workflow_id=wf.id AND workspace_id=i.workspace_id
  AND entity=i.source_table AND entity_id=i.source_id AND owner_id=wf.owner_id AND NOT is_test
  AND status NOT IN('failed','cancelled','canceled','error');
 IF r.id IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','run_unavailable');END IF;
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
 IF p.workspace_id IS NULL OR(p_channel='email' AND NOT p.email_enabled) OR(p_channel='whatsapp' AND NOT p.whatsapp_enabled) THEN
  RETURN jsonb_build_object('allowed',false,'reason','policy_disabled');END IF;
 IF p_channel='email' THEN
  IF NOT techerp_api.notification_external_preference(i.workspace_id,i.recipient_user_id,'email') THEN
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
     AND upper(coalesce(n.quality_rating,'')) IN('GREEN','HIGH') AND connection.enabled AND connection.webhook_verified_at IS NOT NULL) THEN
   RETURN jsonb_build_object('allowed',false,'reason','sender_unavailable');END IF;
  IF EXISTS(SELECT 1 FROM public.whatsapp_number_suppressions s WHERE s.workspace_id=i.workspace_id
   AND s.phone_key=public.wa_phone_key(phone) AND s.released_at IS NULL AND s.expires_at>now()) THEN
   RETURN jsonb_build_object('allowed',false,'reason','recipient_suppressed');END IF;
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
  'source',jsonb_build_object('table',i.source_table,'id',i.source_id,'href',href));
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_intent_context(uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_fallback(p_intent uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE i public.notification_delivery_intents;BEGIN
 IF p_reason IS NULL OR p_reason NOT IN('policy_disabled','sender_unavailable','invalid_template','invalid_configuration','provider_rejected',
 'recipient_suppressed','consent_missing','executor_transport_forbidden','quota_exceeded','budget_exceeded','budget_currency_changed','provider_permanent') THEN RETURN;END IF;
 SELECT * INTO i FROM public.notification_delivery_intents WHERE id=p_intent;
 IF i.delivery_config->>'fallback'<>'email' THEN RETURN;END IF;
 -- Eligibility is checked again on the email claim; no endpoint is copied.
 INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,next_attempt_at,notification_intent_id,reason_code)
 VALUES(i.workspace_id,i.workflow_id,'nfd:'||i.id||':email',i.step_path,'email','user:'||i.recipient_user_id,'queued',0,now(),i.id,'fallback_pending')
 ON CONFLICT(notification_intent_id,channel) WHERE notification_intent_id IS NOT NULL DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_fallback(uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.notification_worker_list(p_limit integer DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM techerp_api.notification_service();
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Limite de processamento inválido.' USING ERRCODE='22023';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'channel',channel) ORDER BY created_at,id)
  FROM(SELECT id,channel,created_at FROM public.workflow_deliveries WHERE notification_intent_id IS NOT NULL
   AND((status IN('queued','retry_scheduled') AND coalesce(next_attempt_at,created_at)<=now()) OR(status='in_flight' AND lease_until<=now()))
   ORDER BY created_at,id LIMIT p_limit)s),'[]'::jsonb);
END $$;
CREATE FUNCTION public.notification_delivery_claim(p_id uuid) RETURNS jsonb
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
   AND notification_intent_id IS NOT NULL AND notification_currency IS DISTINCT FROM p.currency AND coalesce(notification_reserved_at,created_at)>now()-interval '24 hours'
   AND status IN('sent','in_flight','uncertain','retry_scheduled','accepted','delivered','read')) THEN reason:='budget_currency_changed';END IF;
  SELECT coalesce(sum(notification_cost_micros),0) INTO cost FROM public.workflow_deliveries
   WHERE workspace_id=i.workspace_id AND notification_intent_id IS NOT NULL AND channel='whatsapp' AND id<>d.id
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

CREATE FUNCTION public.notification_delivery_preflight(p_id uuid,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;c jsonb;reason text;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id AND notification_intent_id IS NOT NULL FOR UPDATE;
 IF d.id IS NULL OR p_token IS NULL OR d.lease_token IS DISTINCT FROM p_token OR d.status<>'in_flight' OR d.lease_until<=now() THEN
  IF d.id IS NOT NULL AND d.status='in_flight' AND d.lease_token=p_token AND d.lease_until<=now() THEN
   UPDATE public.workflow_deliveries SET status='uncertain',lease_token=NULL,lease_until=NULL,reason_code='lease_expired',last_error='lease_expired',updated_at=now() WHERE id=d.id;
  END IF;
  RETURN jsonb_build_object('allowed',false,'result','uncertain','reason','lease_unavailable');END IF;
 c:=techerp_api.notification_intent_context(d.notification_intent_id,d.channel);
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
   PERFORM techerp_api.notification_fallback(d.notification_intent_id,reason);
  END IF;
  RETURN c||jsonb_build_object('result',CASE WHEN reason='quiet_hours' THEN 'deferred' ELSE 'suppressed' END);
 END IF;
 RETURN(c-ARRAY['endpointHash','policyRevision','consentRevision'])||jsonb_build_object('id',d.id,'token',p_token,'channel',d.channel,'idempotencyKey',d.idempotency_key);
END $$;
CREATE FUNCTION public.notification_delivery_finish(p_id uuid,p_token uuid,p_status text,p_provider text,
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
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id AND notification_intent_id IS NOT NULL FOR UPDATE;
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
 IF d.channel='whatsapp' AND p_status IN('failed','suppressed') THEN PERFORM techerp_api.notification_fallback(d.notification_intent_id,p_reason);END IF;
 RETURN jsonb_build_object('updated',true);
END $$;

CREATE FUNCTION public.notification_delivery_rules(p_workspace uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace);result jsonb;BEGIN
 WITH rules AS MATERIALIZED(SELECT w.* FROM public.workflows w WHERE w.workspace_id=p_workspace
 AND public.sales_record_access('workflows',w.id,'view') AND
 (jsonb_path_exists(w.actions,'$.** ? (@.type == "send_notification")') OR jsonb_path_exists(coalesce(w.draft_actions,'[]'::jsonb),'$.** ? (@.type == "send_notification")'))
 ORDER BY w.updated_at DESC,w.id DESC LIMIT 101)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(x.payload ORDER BY x.updated_at DESC,x.id DESC)
 FROM(SELECT id,updated_at,jsonb_build_object('id',id,'name',name,'entity',entity,'enabled',enabled,'status',status,
 'published_version',published_version,'trigger',trigger,'actions',actions,'draft_trigger',draft_trigger,'draft_actions',draft_actions,
 'goal_filters',goal_filters,'draft_goal_filters',draft_goal_filters,'updated_at',updated_at)payload FROM rules ORDER BY updated_at DESC,id DESC LIMIT 100)x),'[]'::jsonb),
 'truncated',(SELECT count(*)>100 FROM rules)) INTO result;RETURN result;
END $$;

-- Versioned entry point; the original in-app RPC remains unchanged.
CREATE FUNCTION public.notification_workflow_dispatch_v2(
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
BEGIN
  IF coalesce(auth.role(),'')<>'service_role' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Execução reservada ao motor de Workflows.' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_delivery) IS DISTINCT FROM 'object' OR
   EXISTS(SELECT 1 FROM jsonb_object_keys(p_delivery) k WHERE k NOT IN('channels','fallback'))
   OR jsonb_typeof(p_delivery->'channels') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Canais de notificação inválidos.' USING ERRCODE='22023';END IF;
  channels:=p_delivery->'channels';fallback:=coalesce(p_delivery->>'fallback','none');
  IF jsonb_array_length(channels) NOT BETWEEN 1 AND 3 OR fallback NOT IN('none','email')
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(channels)c WHERE jsonb_typeof(c)<>'string' OR c#>>'{}' NOT IN('inapp','email','whatsapp'))
   OR(SELECT count(DISTINCT c) FROM jsonb_array_elements(channels)c)<>jsonb_array_length(channels)
   OR(fallback='email' AND(NOT channels?'whatsapp' OR channels?'email')) THEN
   RAISE EXCEPTION 'Canais ou fallback inválidos.' USING ERRCODE='22023';END IF;
  SELECT jsonb_agg(c ORDER BY c) INTO channels FROM jsonb_array_elements(channels)c;
  config:=jsonb_build_object('channels',channels,'fallback',fallback);
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
        selected:=ARRAY[nullif(source->>'created_by','')::uuid];
      WHEN 'source_responsible' THEN
        CASE p_entity
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
        IF p_entity='contracts' THEN
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
    WHEN 'ats_candidates' THEN '/candidates/'||p_record WHEN 'people' THEN '/people/'||p_record
    WHEN 'projects' THEN '/projects/'||p_record
    WHEN 'project_tasks' THEN '/projects/tasks?taskId='||p_record
    WHEN 'contracts' THEN '/contracts/'||p_record
    WHEN 'financial_entries' THEN '/finance/entries/'||p_record WHEN 'services' THEN '/services/'||p_record
    WHEN 'proposals' THEN '/proposals/'||p_record ELSE NULL END;
  FOREACH recipient IN ARRAY recipients LOOP
    IF NOT public.is_workspace_member(w,recipient)
      OR NOT techerp_api.notification_source_visible(w,recipient,p_entity,p_record) THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    SELECT notification_preferences INTO prefs FROM public.profiles WHERE id=recipient;
    IF NOT FOUND THEN
      excluded_count:=excluded_count+1;issues:=array_append(issues,'recipient_unavailable');CONTINUE;
    END IF;
    intent_id:=NULL;
    INSERT INTO public.notification_delivery_intents(workspace_id,workflow_id,run_id,workflow_version,step_path,
     source_table,source_id,recipient_user_id,delivery_config,payload_content_neutral)
    VALUES(w,p_workflow,p_run,p_version,p_step,p_entity,p_record,recipient,config,
     jsonb_build_object('title','Atualização no TechERP','body','Consulte a central de notificações do TechERP.','href',href))
    ON CONFLICT(workspace_id,run_id,step_path,recipient_user_id) DO NOTHING RETURNING id INTO intent_id;
    intent_existed:=intent_id IS NULL;
    IF intent_existed THEN
     SELECT id INTO intent_id FROM public.notification_delivery_intents WHERE workspace_id=w AND run_id=p_run AND step_path=p_step
      AND recipient_user_id=recipient AND workflow_id=p_workflow AND workflow_version=p_version AND source_table=p_entity AND source_id=p_record
      AND delivery_config=config;
     IF intent_id IS NULL THEN RAISE EXCEPTION 'A ocorrência já possui outra configuração.' USING ERRCODE='22023';END IF;
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
    inapp:=channels?'inapp' AND public.notification_event_inapp(w,recipient,'legacy.workflow');
    IF inapp THEN
     dedupe:='workflow-notification:'||p_run||':'||p_step||':'||recipient;created:=NULL;
     INSERT INTO public.notifications(workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,dedupe_key)
      VALUES(w,executor,recipient,'workflow',title,body,href,p_entity,p_record,dedupe)
      ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id INTO created;
     IF created IS NOT NULL THEN sent_count:=sent_count+1;
     ELSE SELECT id INTO created FROM public.notifications WHERE dedupe_key=dedupe;
      IF created IS NOT NULL THEN duplicate_count:=duplicate_count+1;
      ELSE excluded_count:=excluded_count+1;issues:=array_append(issues,'notification_not_created');END IF;
     END IF;
     IF created IS NOT NULL THEN UPDATE public.notification_delivery_intents SET notification_id=created WHERE id=intent_id AND notification_id IS NULL;END IF;
    ELSE
     IF channels?'inapp' THEN excluded_count:=excluded_count+1;issues:=array_append(issues,'preferences_disabled');END IF;
     IF intent_existed THEN duplicate_count:=duplicate_count+1;END IF;
    END IF;
  END LOOP;
  IF sent_count=0 AND duplicate_count=0 AND queued_count=0 AND cardinality(issues)=0 THEN
    issues:=ARRAY['no_eligible_recipients'];
  END IF;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO issues FROM unnest(issues) x;
  RETURN jsonb_build_object('sent',sent_count,'candidates',candidate_count,'excluded',excluded_count,
    'issues',to_jsonb(issues),'duplicate',duplicate_count,'queued',queued_count,'suppressed',0);
END $$;

-- Preserve legacy semantics, but old entry points cannot operate new fenced jobs.
CREATE OR REPLACE FUNCTION public.workflow_delivery_claim(
  p_workspace uuid, p_workflow uuid, p_key text, p_channel text, p_step_path text,
  p_recipient text, p_lease_seconds integer DEFAULT 120, p_max_attempts integer DEFAULT 4)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.workflow_deliveries%ROWTYPE;
  pol public.workflow_send_policies%ROWTYPE;
  lim integer; used integer;
BEGIN
  SELECT * INTO r FROM public.workflow_deliveries WHERE idempotency_key = p_key FOR UPDATE;
  IF FOUND THEN
    IF r.notification_intent_id IS NOT NULL THEN RETURN jsonb_build_object('result','forbidden');END IF;
    IF r.workspace_id <> p_workspace THEN RETURN jsonb_build_object('result','forbidden'); END IF;
    IF r.status IN ('sent','deduped') THEN RETURN jsonb_build_object('result','already_sent','provider_id',r.provider_id,'attempts',r.attempts); END IF;
    IF r.status = 'uncertain' THEN RETURN jsonb_build_object('result','uncertain','attempts',r.attempts); END IF;
    IF r.status = 'in_flight' THEN
      IF r.lease_until > now() THEN RETURN jsonb_build_object('result','in_flight','attempts',r.attempts); END IF;
      UPDATE public.workflow_deliveries SET status='uncertain', last_error='Lease expirou durante o envio', updated_at=now() WHERE id=r.id;
      RETURN jsonb_build_object('result','uncertain','attempts',r.attempts);
    END IF;
    IF r.status = 'failed' OR r.attempts >= p_max_attempts THEN
      RETURN jsonb_build_object('result','exhausted','attempts',r.attempts,'error',r.last_error);
    END IF;
    UPDATE public.workflow_deliveries SET status='in_flight', attempts=attempts+1,
      lease_until=now()+make_interval(secs=>p_lease_seconds), next_attempt_at=NULL, updated_at=now()
      WHERE id=r.id;
    RETURN jsonb_build_object('result','claimed','attempts',r.attempts+1);
  END IF;

  -- Primeiro envio: cota comercial e deduplicação, serializadas por workspace.
  PERFORM pg_advisory_xact_lock(hashtext('wfq:'||p_workspace::text||':'||p_channel));
  SELECT * INTO pol FROM public.workflow_send_policies WHERE workspace_id = p_workspace;
  IF FOUND THEN
    IF pol.dedupe_hours > 0 AND p_recipient IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.workflow_deliveries d WHERE d.workspace_id=p_workspace AND d.channel=p_channel
        AND d.recipient=p_recipient AND d.status IN ('sent','in_flight','uncertain','accepted','delivered','read')
        AND (CASE WHEN d.notification_intent_id IS NULL THEN d.created_at ELSE coalesce(d.notification_reserved_at,d.created_at) END) > now()-make_interval(hours=>pol.dedupe_hours)) THEN
      INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts)
        VALUES (p_workspace,p_workflow,p_key,p_step_path,p_channel,p_recipient,'deduped',0);
      RETURN jsonb_build_object('result','deduped');
    END IF;
    lim := CASE p_channel WHEN 'whatsapp' THEN pol.whatsapp_daily_limit ELSE pol.email_daily_limit END;
    IF lim IS NOT NULL THEN
      SELECT count(*) INTO used FROM public.workflow_deliveries d WHERE d.workspace_id=p_workspace
        AND d.channel=p_channel AND d.status IN ('sent','in_flight','uncertain','retry_scheduled','accepted','delivered','read')
        AND (CASE WHEN d.notification_intent_id IS NULL THEN d.created_at ELSE coalesce(d.notification_reserved_at,d.created_at) END) > now()-interval '24 hours';
      IF used >= lim THEN RETURN jsonb_build_object('result','quota','used',used,'limit',lim); END IF;
    END IF;
  END IF;
  INSERT INTO public.workflow_deliveries(workspace_id,workflow_id,idempotency_key,step_path,channel,recipient,status,attempts,lease_until)
    VALUES (p_workspace,p_workflow,p_key,p_step_path,p_channel,p_recipient,'in_flight',1,now()+make_interval(secs=>p_lease_seconds))
    ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','in_flight','attempts',1); END IF;
  RETURN jsonb_build_object('result','claimed','attempts',1);
END $$;

CREATE OR REPLACE FUNCTION public.workflow_delivery_finish(
  p_key text, p_status text, p_provider text, p_provider_id text, p_error text, p_next_attempt timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('sent','retry_scheduled','failed','uncertain') THEN RAISE EXCEPTION 'status inválido'; END IF;
  UPDATE public.workflow_deliveries SET status=p_status, provider=COALESCE(p_provider,provider),
    provider_id=COALESCE(p_provider_id,provider_id), last_error=p_error, next_attempt_at=p_next_attempt,
    lease_until=NULL, updated_at=now()
  WHERE idempotency_key=p_key AND notification_intent_id IS NULL AND status IN ('in_flight','uncertain');
END $$;


CREATE FUNCTION public.notification_delivery_profile_phone(p_workspace uuid,p_phone text,p_expected_phone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace,true);actual text;BEGIN
 IF p_phone IS NULL OR p_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
  RAISE EXCEPTION 'Informe um telefone E.164 válido.' USING ERRCODE='22023';END IF;
 SELECT phone INTO actual FROM public.profiles WHERE id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil indisponível.' USING ERRCODE='42501';END IF;
 IF actual IS DISTINCT FROM p_expected_phone THEN RAISE EXCEPTION 'O telefone mudou em outra sessão. Recarregue.' USING ERRCODE='PT409';END IF;
 IF actual IS DISTINCT FROM p_phone THEN
  UPDATE public.profiles SET phone=p_phone WHERE id=u;
  UPDATE public.notification_delivery_consents SET revoked_at=now(),revision=revision+1,updated_at=now()
   WHERE user_id=u;
 END IF;
 RETURN jsonb_build_object('phone',p_phone);
END $$;

CREATE FUNCTION techerp_api.notification_delivery_receipt() RETURNS trigger
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
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=delivery_id AND notification_intent_id IS NOT NULL FOR UPDATE;
 destination_hash:=encode(sha256(convert_to('whatsapp:+'||regexp_replace(coalesce(NEW.to_number,''),'\D','','g'),'UTF8')),'hex');
 IF d.id IS NULL OR d.workspace_id IS DISTINCT FROM NEW.workspace_id OR d.channel<>'whatsapp'
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
REVOKE ALL ON FUNCTION techerp_api.notification_delivery_receipt() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_delivery_receipt AFTER UPDATE OF status ON public.whatsapp_messages
 FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_delivery_receipt();

-- Private helpers/tables are never a preference-inspection or arbitrary send API.
REVOKE ALL ON FUNCTION public.notification_delivery_capabilities(uuid),public.notification_delivery_settings(uuid),
 public.notification_delivery_settings_save(uuid,jsonb,integer),public.get_notification_delivery_consent(uuid),
 public.save_notification_delivery_consent(uuid,boolean,text,integer),public.notification_delivery_profile_phone(uuid,text,text),
 public.notification_delivery_visible(uuid),public.notification_delivery_history(uuid,jsonb,text,text,text),
 public.notification_delivery_rules(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.notification_delivery_capabilities(uuid),public.notification_delivery_settings(uuid),
 public.notification_delivery_settings_save(uuid,jsonb,integer),public.get_notification_delivery_consent(uuid),
 public.save_notification_delivery_consent(uuid,boolean,text,integer),public.notification_delivery_profile_phone(uuid,text,text),
 public.notification_delivery_visible(uuid),public.notification_delivery_history(uuid,jsonb,text,text,text),
 public.notification_delivery_rules(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.notification_workflow_dispatch_v2(uuid,uuid,integer,text,uuid,jsonb,text,text,text,jsonb),
 public.notification_worker_list(integer),public.notification_delivery_claim(uuid),public.notification_delivery_preflight(uuid,uuid),
 public.notification_delivery_finish(uuid,uuid,text,text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_workflow_dispatch_v2(uuid,uuid,integer,text,uuid,jsonb,text,text,text,jsonb),
 public.notification_worker_list(integer),public.notification_delivery_claim(uuid),public.notification_delivery_preflight(uuid,uuid),
 public.notification_delivery_finish(uuid,uuid,text,text,text,text,integer) TO service_role;
NOTIFY pgrst,'reload schema';
