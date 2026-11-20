-- NOTIFICA-CENTRAL P7. Harden the existing personal WhatsApp transport only.
-- No channel, scheduler, business producer or end-user grant is activated.
CREATE FUNCTION techerp_api.notification_profile_phone_revoke() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 UPDATE public.notification_delivery_consents SET revoked_at=now(),revision=revision+1,updated_at=now()
 WHERE user_id=OLD.id;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_profile_phone_revoke() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_profile_phone_revoke AFTER UPDATE OF phone ON public.profiles
 FOR EACH ROW WHEN(OLD.phone IS DISTINCT FROM NEW.phone) EXECUTE FUNCTION techerp_api.notification_profile_phone_revoke();
CREATE TRIGGER notification_profile_delete_revoke BEFORE DELETE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION techerp_api.notification_profile_phone_revoke();

CREATE OR REPLACE FUNCTION public.notification_delivery_profile_phone(p_workspace uuid,p_phone text,p_expected_phone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid:=techerp_api.notification_center_actor(p_workspace,true);actual text;BEGIN
 IF p_phone IS NULL OR p_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
  RAISE EXCEPTION 'Informe um telefone E.164 válido.' USING ERRCODE='22023';END IF;
 SELECT phone INTO actual FROM public.profiles WHERE id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil indisponível.' USING ERRCODE='42501';END IF;
 IF actual IS DISTINCT FROM p_expected_phone THEN RAISE EXCEPTION 'O telefone mudou em outra sessão. Recarregue.' USING ERRCODE='PT409';END IF;
 IF actual IS DISTINCT FROM p_phone THEN UPDATE public.profiles SET phone=p_phone WHERE id=u;END IF;
 RETURN jsonb_build_object('phone',p_phone);
END $$;

-- A connection is an immutable attempt snapshot, not a new foreign key to a
-- mutable directory entry. Removing a connection must not rewrite history.
ALTER TABLE public.workflow_deliveries ADD COLUMN notification_connection_id uuid;
CREATE INDEX notification_whatsapp_provider_receipt ON public.workflow_deliveries(workspace_id,provider_id)
 WHERE notification_intent_id IS NOT NULL AND channel='whatsapp' AND provider_id IS NOT NULL;

CREATE TABLE public.notification_whatsapp_health(
 connection_id uuid PRIMARY KEY,workspace_id uuid NOT NULL,
 paused_until timestamptz NOT NULL,reason_code text NOT NULL CHECK(reason_code IN('provider_rate_limited','provider_preflight_unavailable')),
 cooldown_until timestamptz NOT NULL DEFAULT '-infinity',
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_whatsapp_health ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_whatsapp_health FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE public.notification_whatsapp_suppression_receipts(
 workspace_id uuid NOT NULL,wamid text NOT NULL CHECK(length(wamid) BETWEEN 1 AND 512),
 error_code text NOT NULL CHECK(error_code IN('131026','131049')),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,wamid,error_code)
);
ALTER TABLE public.notification_whatsapp_suppression_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_whatsapp_suppression_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_whatsapp_suppress_once(p_workspace uuid,p_phone text,p_code text,p_at timestamptz,p_wamid text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE inserted boolean;BEGIN
 IF p_workspace IS NULL OR p_code IS NULL OR p_code NOT IN('131026','131049') OR p_at IS NULL
 OR public.wa_phone_key(p_phone)='+' OR p_wamid IS NULL OR length(p_wamid) NOT BETWEEN 1 AND 512 OR btrim(p_wamid)='' THEN RETURN;END IF;
 INSERT INTO public.notification_whatsapp_suppression_receipts(workspace_id,wamid,error_code) VALUES(p_workspace,p_wamid,p_code)
 ON CONFLICT(workspace_id,wamid,error_code) DO NOTHING RETURNING true INTO inserted;
 IF inserted THEN PERFORM public.wa_record_suppression(p_workspace,p_phone,p_code,p_at);END IF;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_suppress_once(uuid,text,text,timestamptz,text) FROM PUBLIC,anon,authenticated,service_role;

-- Keep the canonical projection trigger and its existing writer authorization;
-- only correlate its suppression side effect with the same provider receipt.
CREATE OR REPLACE FUNCTION public.wa_messages_suppression_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.direction='outbound' AND NEW.error_code IN('131026','131049')
 AND(TG_OP='INSERT' OR OLD.error_code IS DISTINCT FROM NEW.error_code) THEN
  IF NEW.wa_message_id IS NOT NULL THEN
   PERFORM techerp_api.notification_whatsapp_suppress_once(NEW.workspace_id,NEW.to_number,NEW.error_code,now(),NEW.wa_message_id);
  ELSE PERFORM public.wa_record_suppression(NEW.workspace_id,NEW.to_number,NEW.error_code,now());END IF;
 END IF;
 RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.wa_messages_suppression_trg() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_whatsapp_cooldown(p_workspace uuid,p_connection uuid,p_until timestamptz,p_reason text,p_disable boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM techerp_api.notification_service();
 IF p_until IS NULL OR p_reason NOT IN('provider_rate_limited','provider_preflight_unavailable')
 OR NOT EXISTS(SELECT 1 FROM public.wa_cloud_connections c WHERE c.id=p_connection AND c.workspace_id=p_workspace) THEN RETURN;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-whatsapp-health:'||p_connection,0));
 -- Policy before health matches the authenticated reactivation trigger's lock
 -- order. The whole pause is atomic and never changes the email configuration.
 IF p_disable THEN UPDATE public.notification_delivery_policies SET whatsapp_enabled=false,revision=revision+1,updated_at=now()
  WHERE workspace_id=p_workspace AND whatsapp_enabled;END IF;
 INSERT INTO public.notification_whatsapp_health(connection_id,workspace_id,paused_until,reason_code,cooldown_until)
 VALUES(p_connection,p_workspace,p_until,p_reason,CASE WHEN p_until='infinity'::timestamptz THEN '-infinity'::timestamptz ELSE p_until END) ON CONFLICT(connection_id) DO UPDATE
 SET paused_until=greatest(notification_whatsapp_health.paused_until,excluded.paused_until),
 cooldown_until=greatest(notification_whatsapp_health.cooldown_until,excluded.cooldown_until),
 reason_code=excluded.reason_code,updated_at=now() WHERE notification_whatsapp_health.workspace_id=excluded.workspace_id;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_cooldown(uuid,uuid,timestamptz,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION techerp_api.notification_whatsapp_reactivate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid;BEGIN
 IF coalesce(auth.role(),'')='authenticated' AND auth.uid() IS NOT NULL THEN
  actor:=techerp_api.notification_delivery_permission(NEW.workspace_id,true);
  IF actor IS DISTINCT FROM NEW.updated_by OR NOT((public.work_access_context())->'keys'?'system.whatsapp.manage.workspace')
   OR NOT((public.work_access_context())->'keys'?'system.channels.view.workspace') THEN
   RAISE EXCEPTION 'Sem permissão para reativar o canal oficial.' USING ERRCODE='42501';END IF;
  -- An explicit review clears the indefinite stop, never a still-binding
  -- finite Retry-After that preceded it on the same connection.
  UPDATE public.notification_whatsapp_health SET paused_until=cooldown_until,updated_at=now()
   WHERE workspace_id=NEW.workspace_id AND paused_until='infinity'::timestamptz;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION techerp_api.notification_whatsapp_reactivate() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_whatsapp_reactivate AFTER UPDATE OF whatsapp_enabled ON public.notification_delivery_policies
 FOR EACH ROW WHEN(NOT OLD.whatsapp_enabled AND NEW.whatsapp_enabled) EXECUTE FUNCTION techerp_api.notification_whatsapp_reactivate();

-- Keep the original context OID and every source/member/preference check. A
-- quality/reputation stop is not a missing sender and must never cause fallback.
CREATE OR REPLACE FUNCTION techerp_api.notification_intent_context(p_intent uuid,p_channel text) RETURNS jsonb
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
 IF p_channel='whatsapp' AND EXISTS(SELECT 1 FROM public.notification_whatsapp_health h WHERE h.workspace_id=i.workspace_id
  AND h.paused_until='infinity'::timestamptz AND(NOT coalesce(p.whatsapp_enabled,false) OR h.connection_id IN(
   SELECT n.connection_id FROM public.wa_cloud_numbers n WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id))) THEN
  RETURN jsonb_build_object('allowed',false,'reason','provider_rate_limited');END IF;
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
     AND connection.enabled AND connection.webhook_verified_at IS NOT NULL) THEN
   RETURN jsonb_build_object('allowed',false,'reason','sender_unavailable');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.wa_cloud_numbers n WHERE n.workspace_id=i.workspace_id AND n.phone_number_id=p.wa_sender_id
    AND upper(coalesce(n.quality_rating,'')) IN('GREEN','HIGH')) THEN
   RETURN jsonb_build_object('allowed',false,'reason','provider_rate_limited');END IF;
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

-- P6's public wrappers continue dispatching Slack and email through their
-- existing paths. Their private personal callees gain the WhatsApp invariant.
CREATE FUNCTION public.notification_delivery_claim_personal_p4(p_id uuid) RETURNS jsonb
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
CREATE FUNCTION public.notification_delivery_preflight_personal_p4(p_id uuid,p_token uuid) RETURNS jsonb
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
CREATE FUNCTION public.notification_delivery_finish_personal_p4(p_id uuid,p_token uuid,p_status text,p_provider text,
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

CREATE OR REPLACE FUNCTION public.notification_delivery_claim_personal_v1(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;r jsonb;connection uuid;initial_connection uuid;health public.notification_whatsapp_health;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 IF d.notification_intent_id IS NULL OR d.channel<>'whatsapp' THEN RETURN public.notification_delivery_claim_personal_p4(p_id);END IF;
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
 r:=public.notification_delivery_claim_personal_p4(p_id);
 IF r->>'result'<>'claimed' THEN RETURN r;END IF;
 SELECT n.connection_id INTO connection FROM public.wa_cloud_numbers n WHERE n.workspace_id=d.workspace_id AND n.phone_number_id=r->>'senderPhoneNumberId' FOR SHARE;
 IF connection IS NULL OR connection IS DISTINCT FROM initial_connection
 OR(d.notification_connection_id IS NOT NULL AND connection IS DISTINCT FROM d.notification_connection_id) THEN
  UPDATE public.workflow_deliveries SET status='uncertain',reason_code='connection_unproven',last_error='connection_unproven',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=d.id;
  RETURN jsonb_build_object('result','uncertain','reason','connection_unproven');END IF;
 UPDATE public.workflow_deliveries SET notification_connection_id=connection WHERE id=d.id;
 RETURN r||jsonb_build_object('connectionId',connection);
END $$;

CREATE OR REPLACE FUNCTION public.notification_delivery_preflight_personal_v1(p_id uuid,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;r jsonb;connection uuid;health public.notification_whatsapp_health;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 r:=public.notification_delivery_preflight_personal_p4(p_id,p_token);
 IF d.notification_intent_id IS NULL OR d.channel<>'whatsapp' OR NOT coalesce((r->>'allowed')::boolean,false) THEN RETURN r;END IF;
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

CREATE OR REPLACE FUNCTION public.notification_delivery_finish_personal_v1(p_id uuid,p_token uuid,p_status text,p_provider text,
 p_provider_id text DEFAULT NULL,p_reason text DEFAULT NULL,p_retry_after_seconds integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.workflow_deliveries;finished jsonb;delay_seconds integer;pause_until timestamptz;BEGIN
 PERFORM techerp_api.notification_service();
 SELECT * INTO d FROM public.workflow_deliveries WHERE id=p_id FOR UPDATE;
 -- A quota/reputation refusal never becomes a generic provider rejection when
 -- attempts run out: doing so would incorrectly enqueue the email fallback.
 IF d.notification_intent_id IS NOT NULL AND d.channel='whatsapp' AND(
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
 finished:=public.notification_delivery_finish_personal_p4(p_id,p_token,p_status,p_provider,p_provider_id,p_reason,p_retry_after_seconds);
 -- A throttled read before POST is safe to retry, but its provider cooldown is
 -- just as binding as a throttled POST. Never shorten a two-hour Retry-After.
 IF finished->>'updated'='true' AND p_status='retry_scheduled'
 AND p_reason IN('provider_rate_limited','provider_preflight_unavailable')
 AND p_retry_after_seconds BETWEEN 3601 AND 86400 AND d.attempts<4 THEN
  UPDATE public.workflow_deliveries SET next_attempt_at=greatest(next_attempt_at,now()+make_interval(secs=>p_retry_after_seconds))
   WHERE id=p_id AND status='retry_scheduled';
 END IF;
 IF finished->>'updated'='true' AND d.channel='whatsapp' AND d.notification_intent_id IS NOT NULL
 AND p_status='retry_scheduled' AND p_reason IN('provider_rate_limited','provider_preflight_unavailable') THEN
  delay_seconds:=greatest(least(3600,120*power(2,greatest(0,d.attempts-1))::integer),greatest(0,least(86400,coalesce(p_retry_after_seconds,0))));
  PERFORM techerp_api.notification_whatsapp_cooldown(d.workspace_id,d.notification_connection_id,now()+make_interval(secs=>delay_seconds),p_reason);
 END IF;
 RETURN finished;
END $$;

-- The canonical signature verifier supplies the exact connection, sender and
-- recipient from a durable Cloud status event. This only acknowledges an
-- existing provider ID; it cannot create an outbound attempt or a destination.
CREATE FUNCTION public.notification_whatsapp_receipt(p_workspace uuid,p_connection uuid,p_sender text,p_wamid text,p_recipient text,p_status text,p_error_code text DEFAULT NULL)
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
  AND notification_intent_id IS NOT NULL AND provider='meta_cloud' AND provider_id=p_wamid
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

REVOKE ALL ON FUNCTION public.notification_delivery_claim_personal_p4(uuid),public.notification_delivery_preflight_personal_p4(uuid,uuid),
 public.notification_delivery_finish_personal_p4(uuid,uuid,text,text,text,text,integer),public.notification_delivery_claim_personal_v1(uuid),
 public.notification_delivery_preflight_personal_v1(uuid,uuid),public.notification_delivery_finish_personal_v1(uuid,uuid,text,text,text,text,integer)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.notification_whatsapp_receipt(uuid,uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_whatsapp_receipt(uuid,uuid,text,text,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
