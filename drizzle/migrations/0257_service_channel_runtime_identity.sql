-- Discovery alone must not change existing automations. Explicit save opts the account in.
ALTER TABLE public.service_channel_accounts ADD COLUMN routing_configured boolean NOT NULL DEFAULT false;
ALTER TABLE public.sdr_enrollments ADD COLUMN channel_identity jsonb;
CREATE FUNCTION public.sdr_channel_identity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF ((TG_OP='INSERT' AND NEW.channel_identity IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.channel_identity IS DISTINCT FROM OLD.channel_identity))
 AND NOT (coalesce(auth.role(),'')='service_role' OR (auth.uid() IS NULL AND current_user IN('postgres','supabase_admin')))
 THEN RAISE EXCEPTION 'A identidade da conversa é definida pelo servidor.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sdr_channel_identity_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sdr_channel_identity_guard BEFORE INSERT OR UPDATE ON public.sdr_enrollments FOR EACH ROW EXECUTE FUNCTION public.sdr_channel_identity_guard();

CREATE OR REPLACE FUNCTION public.service_channel_save(p_account uuid,p_label text,p_name text,p_enabled boolean,
 p_agent uuid,p_agent_name text,p_inbound boolean,p_campaigns boolean,p_agent_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context(); w uuid:=(c->>'workspace')::uuid; ac public.service_channel_accounts; agent_check uuid;
BEGIN
 IF NOT public.service_channel_access(c,w,'manage') THEN RAISE EXCEPTION 'Sem permissão para configurar canais.' USING ERRCODE='42501'; END IF;
 SELECT * INTO ac FROM public.service_channel_accounts WHERE id=p_account AND workspace_id=w FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conta indisponível.' USING ERRCODE='42501'; END IF;
 FOR agent_check IN SELECT p_agent WHERE p_agent IS NOT NULL UNION SELECT agent_id FROM public.service_channel_bindings WHERE account_id=p_account AND workspace_id=w LOOP
  IF NOT EXISTS(SELECT 1 FROM public.sdr_playbooks p WHERE p.id=agent_check AND p.workspace_id=w
   AND public.sales_context_access(public.sales_access_context(),w,'techsales.marketing.sdr_agent','view',ARRAY[coalesce(p.assigned_to,p.owner_id)])
   AND public.sales_context_access(public.sales_access_context(),w,'techsales.marketing.sdr_agent','update',ARRAY[coalesce(p.assigned_to,p.owner_id)]))
  THEN RAISE EXCEPTION 'Agente indisponível ou sem permissão de edição.' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF p_agent_enabled AND (NOT p_enabled OR p_agent IS NULL OR NOT(p_inbound OR p_campaigns)) THEN
  RAISE EXCEPTION 'Selecione um agente, um modo de atendimento e ative a conta.' USING ERRCODE='23514'; END IF;
 UPDATE public.service_channel_accounts SET label=p_label,display_name=p_name,enabled=p_enabled,routing_configured=true WHERE id=p_account AND workspace_id=w;
 IF p_agent IS NULL THEN
  DELETE FROM public.service_channel_bindings WHERE account_id=p_account AND workspace_id=w;
 ELSE
  INSERT INTO public.service_channel_bindings(account_id,workspace_id,agent_id,display_name,inbound,campaigns,enabled)
   VALUES(p_account,w,p_agent,p_agent_name,p_inbound,p_campaigns,p_agent_enabled)
  ON CONFLICT(account_id) DO UPDATE SET agent_id=excluded.agent_id,display_name=excluded.display_name,
   inbound=excluded.inbound,campaigns=excluded.campaigns,enabled=excluded.enabled,updated_at=now();
 END IF;
END $$;

-- Provider-authenticated ingest only. Row lock prevents duplicate receptive enrollments.
CREATE FUNCTION public.sdr_bind_inbound_channel(p_workspace uuid,p_conversation uuid,p_phone_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cv public.whatsapp_conversations; pb public.sdr_playbooks; enrollment uuid;
BEGIN
 SELECT * INTO cv FROM public.whatsapp_conversations WHERE id=p_conversation AND workspace_id=p_workspace AND wa_phone_number_id=p_phone_id FOR UPDATE;
 IF NOT FOUND OR cv.ai_owner IN('human','paused') THEN RETURN NULL; END IF;
 IF cv.sdr_enrollment_id IS NOT NULL THEN RETURN cv.sdr_enrollment_id; END IF;
 IF cv.origin_campaign_id IS NOT NULL THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sdr_workspace_settings WHERE workspace_id=p_workspace AND enabled) THEN RETURN NULL; END IF;
 SELECT p.* INTO pb FROM public.service_channel_accounts a JOIN public.service_channel_bindings b ON b.account_id=a.id AND b.workspace_id=a.workspace_id
 JOIN public.sdr_playbooks p ON p.id=b.agent_id AND p.workspace_id=b.workspace_id
 WHERE a.workspace_id=p_workspace AND a.channel='whatsapp' AND a.source_key=p_phone_id
 AND a.routing_configured AND a.enabled AND b.enabled AND b.inbound AND p.enabled;
 IF NOT FOUND OR NOT public.is_workspace_member(p_workspace,pb.owner_id) THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.sdr_enrollments e WHERE e.workspace_id=p_workspace AND e.opted_out_at IS NOT NULL
 AND (e.contact_phone=cv.contact_phone OR (cv.contact_id IS NOT NULL AND e.contact_id=cv.contact_id) OR (cv.lead_id IS NOT NULL AND e.lead_id=cv.lead_id))) THEN RETURN NULL; END IF;
 INSERT INTO public.sdr_enrollments(owner_id,workspace_id,playbook_id,contact_phone,contact_id,lead_id,conversation_id,status,commercial_stage,follow_up_at)
 VALUES(pb.owner_id,p_workspace,pb.id,cv.contact_phone,cv.contact_id,cv.lead_id,cv.id,'active','awaiting_reply',NULL)
 RETURNING id INTO enrollment;
 UPDATE public.whatsapp_conversations SET sdr_enrollment_id=enrollment,ai_owner='ai',ai_version=ai_version+1 WHERE id=cv.id AND workspace_id=p_workspace;
 RETURN enrollment;
END $$;
REVOKE ALL ON FUNCTION public.sdr_bind_inbound_channel(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sdr_bind_inbound_channel(uuid,uuid,text) TO service_role;
