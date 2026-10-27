-- Public chat identity claims never authorize access to private CRM context.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
VALUES('system.channels.approve.workspace','system','channels','approve','workspace','Confirmar identidade no atendimento','Autorizar uso do contexto privado do cliente após conferir sua identidade.',true)
ON CONFLICT(key) DO NOTHING;

CREATE FUNCTION public.service_agent_verify_identity(p_channel text,p_source uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context();w uuid:=(c->>'workspace')::uuid;
 s public.service_agent_sessions;r text;person_contact uuid;person_lead uuid;company uuid;deal uuid;ref record;
BEGIN
 r:=CASE p_channel WHEN 'email' THEN 'email_threads' WHEN 'chat' THEN 'live_chat_sessions' END;
 IF w IS NULL OR r IS NULL OR coalesce((c->>'read_only')::boolean,true)
 OR NOT coalesce(c->'keys' ? 'system.channels.approve.workspace',false)
 OR NOT public.sales_record_access(r,p_source,'view') OR NOT public.sales_record_access(r,p_source,'update')
 THEN RAISE EXCEPTION 'Sem permissão para confirmar identidade.' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE workspace_id=w AND channel=p_channel AND source_id=p_source FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento indisponível.' USING ERRCODE='42501';END IF;
 IF p_channel='email' THEN
  SELECT contact_id,lead_id,company_id,deal_id INTO person_contact,person_lead,company,deal FROM public.email_threads WHERE id=p_source AND workspace_id=w FOR UPDATE;
 ELSE
  SELECT contact_id,lead_id,NULL::uuid,NULL::uuid INTO person_contact,person_lead,company,deal FROM public.live_chat_sessions WHERE id=p_source AND workspace_id=w FOR UPDATE;
 END IF;
 IF person_contact IS NULL AND person_lead IS NULL THEN RAISE EXCEPTION 'Associe uma pessoa antes de confirmar a identidade.';END IF;
 FOR ref IN SELECT * FROM (VALUES('contacts',person_contact),('leads',person_lead),('companies',company),('deals',deal)) t(tab,id) WHERE id IS NOT NULL LOOP
  IF NOT public.sales_record_access(ref.tab,ref.id,'view') THEN RAISE EXCEPTION 'Contexto indisponível.' USING ERRCODE='42501';END IF;
 END LOOP;
 UPDATE public.sdr_enrollments SET contact_id=person_contact,lead_id=person_lead,company_id=company,deal_id=deal,
 qualification_id=CASE WHEN contact_id IS DISTINCT FROM person_contact OR lead_id IS DISTINCT FROM person_lead THEN NULL ELSE qualification_id END
 WHERE id=s.enrollment_id AND workspace_id=w;
 UPDATE public.service_agent_sessions SET identity_verified=true,context_approved=true,ai_version=ai_version+1 WHERE id=s.id;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_verify_identity(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.service_agent_verify_identity(text,uuid) TO authenticated;

CREATE FUNCTION public.service_agent_invalidate_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.service_agent_sessions;
BEGIN
 IF (to_jsonb(NEW)->'contact_id',to_jsonb(NEW)->'lead_id',to_jsonb(NEW)->'company_id',to_jsonb(NEW)->'deal_id') IS NOT DISTINCT FROM (to_jsonb(OLD)->'contact_id',to_jsonb(OLD)->'lead_id',to_jsonb(OLD)->'company_id',to_jsonb(OLD)->'deal_id') THEN RETURN NEW;END IF;
 SELECT * INTO s FROM public.service_agent_sessions WHERE source_id=NEW.id AND workspace_id=NEW.workspace_id
 AND channel=CASE TG_TABLE_NAME WHEN 'email_threads' THEN 'email' ELSE 'chat' END FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW;END IF;
 UPDATE public.sdr_enrollments SET contact_id=NULL,lead_id=NULL,company_id=NULL,deal_id=NULL,qualification_id=NULL WHERE id=s.enrollment_id AND workspace_id=s.workspace_id;
 UPDATE public.service_agent_sessions SET identity_verified=false,context_approved=false,ai_version=ai_version+1 WHERE id=s.id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_invalidate_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER service_agent_email_identity AFTER UPDATE OF contact_id,lead_id,company_id,deal_id ON public.email_threads FOR EACH ROW EXECUTE FUNCTION public.service_agent_invalidate_identity();
CREATE TRIGGER service_agent_chat_identity AFTER UPDATE OF contact_id,lead_id ON public.live_chat_sessions FOR EACH ROW EXECUTE FUNCTION public.service_agent_invalidate_identity();

-- Inbox readers use the minimal state RPC, not raw prompts/tool payloads.
REVOKE SELECT ON public.service_agent_sessions,public.service_agent_jobs,public.service_agent_evidence FROM authenticated;
CREATE FUNCTION public.service_agent_enrollment_exists(p_enrollment uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.service_agent_sessions WHERE enrollment_id=p_enrollment)
$$;
REVOKE ALL ON FUNCTION public.service_agent_enrollment_exists(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.service_agent_enrollment_exists(uuid) TO authenticated,service_role;

CREATE FUNCTION public.service_agent_protect_enrollment_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role','supabase_admin') AND auth.uid() IS NOT NULL AND public.service_agent_enrollment_exists(OLD.id)
 AND ROW(NEW.workspace_id,NEW.playbook_id,NEW.owner_id,NEW.contact_id,NEW.lead_id,NEW.company_id,NEW.deal_id)
 IS DISTINCT FROM ROW(OLD.workspace_id,OLD.playbook_id,OLD.owner_id,OLD.contact_id,OLD.lead_id,OLD.company_id,OLD.deal_id)
 THEN RAISE EXCEPTION 'Use a confirmação de identidade do atendimento.' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.service_agent_protect_enrollment_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER service_agent_enrollment_identity BEFORE UPDATE ON public.sdr_enrollments FOR EACH ROW EXECUTE FUNCTION public.service_agent_protect_enrollment_identity();
