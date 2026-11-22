GRANT CREATE ON SCHEMA techerp_api TO authenticated;
CREATE FUNCTION techerp_api.inbox_conversation_rls(p_workspace uuid,p_channel text,p_account uuid,p_conversation uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.workflow_inbox_conversation_visible(p_workspace,p_channel,p_account,p_conversation)
$$;
ALTER FUNCTION techerp_api.inbox_conversation_rls(uuid,text,uuid,uuid) OWNER TO authenticated;
REVOKE CREATE ON SCHEMA techerp_api FROM authenticated;
REVOKE ALL ON FUNCTION techerp_api.inbox_conversation_rls(uuid,text,uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.inbox_conversation_rls(uuid,text,uuid,uuid) TO techerp_api_subject,postgres;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid,uuid) TO techerp_api_subject;
CREATE OR REPLACE FUNCTION techerp_api.inbox_subject_conversation(p_workspace uuid,p_user uuid,p_channel text,p_account uuid,p_conversation uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE allowed boolean;
BEGIN
 IF p_user IS NULL OR NOT public.is_workspace_member(p_workspace,p_user) OR current_setting('app.api_subject',true)='on' THEN RETURN false; END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims)
 VALUES(txid_current(),p_user,p_workspace,p_conversation,current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_user::text,true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('app.api_subject','on',true);
 allowed:=techerp_api.inbox_conversation_rls(p_workspace,p_channel,p_account,p_conversation);
 PERFORM techerp_api.leave();
 RETURN coalesce(allowed,false);
END $$;
CREATE OR REPLACE FUNCTION techerp_api.inbox_intent_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE run record; wf record; href text;
BEGIN
 IF NEW.source_table<>'inbox_channel_occurrences' THEN RETURN NEW; END IF;
 SELECT * INTO wf FROM public.workflows WHERE id=NEW.workflow_id AND workspace_id=NEW.workspace_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Workflow indisponível.' USING ERRCODE='42501'; END IF;
 SELECT * INTO run FROM public.workflow_runs WHERE id=NEW.run_id AND workflow_id=wf.id AND workspace_id=NEW.workspace_id
  AND entity=NEW.source_table AND entity_id=NEW.source_id AND NOT is_test;
 IF NOT FOUND OR run.owner_id IS DISTINCT FROM wf.owner_id
  OR (TG_OP='INSERT' AND NEW.occurrence_kind='initial' AND run.status<>'running')
  OR techerp_api.inbox_proof_chain_current(run.event_id,wf.id,NEW.workflow_version) IS NOT TRUE
  OR techerp_api.inbox_subject_visible(NEW.workspace_id,NEW.recipient_user_id,NEW.source_id) IS NOT TRUE THEN
  RAISE EXCEPTION 'Ocorrência ou destinatário indisponível.' USING ERRCODE='42501';
 END IF;
 href:=techerp_api.notification_inbox_href(NEW.workspace_id,NEW.source_id);
 NEW.payload_content_neutral:=jsonb_set(NEW.payload_content_neutral,'{href}',to_jsonb(href));
 RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';
