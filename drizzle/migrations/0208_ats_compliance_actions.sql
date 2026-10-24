-- LGPD uses the candidate's actual scope, never the request creator alone.
-- Additive RPC preparation; activate policies/guards only after compatible code.
CREATE OR REPLACE FUNCTION public.ats_compliance_access(_candidate uuid,_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.ats_candidates; actor uuid:=auth.uid(); own_scope boolean; team_scope boolean; permitted boolean;
BEGIN
 SELECT * INTO c FROM public.ats_candidates WHERE id=_candidate;
 IF NOT FOUND OR actor IS NULL OR c.workspace_id IS DISTINCT FROM (SELECT active_workspace_id FROM public.profiles WHERE id=actor)
 OR NOT public.is_workspace_member(c.workspace_id,actor) OR NOT public.hr_record_access('candidates','view',c.id)
 OR (_action<>'view' AND public.is_read_only_view()) THEN RETURN false;END IF;
 own_scope:=COALESCE(c.assigned_to,c.owner_id)=actor;
 team_scope:=public.hr_team_contains(c.workspace_id,ARRAY[COALESCE(c.assigned_to,c.owner_id)]);
 IF _action NOT IN('view','create','update','export','delete','retention') THEN RETURN false;END IF;
 IF _action<>'view' AND NOT public.ats_compliance_access(_candidate,'view') THEN RETURN false;END IF;
 IF _action IN('export','delete') THEN
  permitted:=public.user_has_permission(actor,c.workspace_id,'techhire.compliance.'||_action||'.workspace');
 ELSE
  permitted:=public.user_has_permission(actor,c.workspace_id,'techhire.compliance.'||CASE WHEN _action='retention' THEN 'update' ELSE _action END||'.workspace')
  OR (own_scope AND public.user_has_permission(actor,c.workspace_id,'techhire.compliance.'||CASE WHEN _action='retention' THEN 'update' ELSE _action END||'.own'))
  OR (team_scope AND public.user_has_permission(actor,c.workspace_id,'techhire.compliance.'||CASE WHEN _action='retention' THEN 'update' ELSE _action END||'.team'));
 END IF;
 RETURN COALESCE(permitted,false) AND (_action NOT IN('retention','delete') OR public.hr_record_access('candidates','update',c.id));
END $$;
REVOKE ALL ON FUNCTION public.ats_compliance_access(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_compliance_access(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ats_compliance_capabilities(_candidates uuid[])
RETURNS TABLE(candidate_id uuid,can_update boolean,can_export boolean,can_erase boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT c.id,ats_compliance_access(c.id,'update'),ats_compliance_access(c.id,'export'),ats_compliance_access(c.id,'delete')
 FROM ats_candidates c WHERE c.id=ANY(_candidates) AND ats_compliance_access(c.id,'view')
$$;
REVOKE ALL ON FUNCTION public.ats_compliance_capabilities(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_compliance_capabilities(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.ats_compliance_write(_action text,_candidate uuid DEFAULT NULL,_request uuid DEFAULT NULL,_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.ats_candidates;r public.ats_dsar_requests;cons public.ats_candidate_consents;v_id uuid;v_permission text;
BEGIN
 IF auth.uid() IS NULL OR public.is_read_only_view() OR jsonb_typeof(_payload)<>'object' THEN RAISE EXCEPTION 'Ação LGPD não autorizada.' USING ERRCODE='42501';END IF;
 IF _request IS NOT NULL THEN
  SELECT * INTO r FROM ats_dsar_requests WHERE id=_request FOR UPDATE;
  IF NOT FOUND OR (_candidate IS NOT NULL AND r.candidate_id<>_candidate) THEN RAISE EXCEPTION 'Solicitação indisponível ou incompatível.' USING ERRCODE='42501';END IF;
  _candidate:=r.candidate_id;
 END IF;
 IF _action='revoke_consent' THEN
  SELECT * INTO cons FROM ats_candidate_consents WHERE id=(_payload->>'id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Consentimento indisponível.' USING ERRCODE='42501';END IF;
  _candidate:=cons.candidate_id;
 END IF;
 v_permission:=CASE _action WHEN 'create_request' THEN 'create' WHEN 'record_consent' THEN 'create' WHEN 'erase' THEN 'delete' WHEN 'retention' THEN 'retention' ELSE 'update' END;
 IF NOT public.ats_compliance_access(_candidate,v_permission) THEN RAISE EXCEPTION 'Sem permissão para esta ação LGPD.' USING ERRCODE='42501';END IF;
 SELECT * INTO STRICT c FROM ats_candidates WHERE id=_candidate;
 IF _action='create_request' THEN
  IF _payload->>'request_type' NOT IN('export','erasure','rectification','access') OR _payload->>'request_type' IS NULL THEN RAISE EXCEPTION 'Tipo de solicitação inválido.' USING ERRCODE='22023';END IF;
  INSERT INTO ats_dsar_requests(workspace_id,owner_id,candidate_id,request_type,subject_email,notes,requested_by)
  VALUES(c.workspace_id,auth.uid(),c.id,_payload->>'request_type',_payload->>'subject_email',_payload->>'notes',auth.uid()) RETURNING id INTO v_id;
 ELSIF _action='status' THEN
  IF r.id IS NULL OR r.status IN('completed','rejected') OR _payload->>'status' IS NULL OR _payload->>'status' NOT IN('pending','in_progress','completed','rejected')
    OR (_payload->>'status'='completed' AND r.request_type<>'rectification') THEN RAISE EXCEPTION 'Transição indisponível; conclua exportação/anonimização pela ação correspondente.' USING ERRCODE='23514';END IF;
  UPDATE ats_dsar_requests SET status=_payload->>'status',notes=CASE WHEN _payload ? 'notes' THEN _payload->>'notes' ELSE notes END,
   processed_at=CASE WHEN _payload->>'status' IN('completed','rejected') THEN now() ELSE NULL END,
   processed_by=CASE WHEN _payload->>'status' IN('completed','rejected') THEN auth.uid() ELSE NULL END WHERE id=r.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não atualizada.' USING ERRCODE='42501';END IF;
 ELSIF _action='record_consent' THEN
  IF length(trim(COALESCE(_payload->>'purpose','')))=0 OR jsonb_typeof(_payload->'granted') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Finalidade e decisão de consentimento são obrigatórias.' USING ERRCODE='22023';END IF;
  INSERT INTO ats_candidate_consents(workspace_id,owner_id,candidate_id,purpose,granted,legal_basis,source,expires_at,revoked_at)
   VALUES(c.workspace_id,auth.uid(),c.id,_payload->>'purpose',(_payload->>'granted')::boolean,_payload->>'legal_basis',COALESCE(_payload->>'source','manual'),(_payload->>'expires_at')::timestamptz,CASE WHEN NOT (_payload->>'granted')::boolean THEN now() END) RETURNING id INTO v_id;
 ELSIF _action='revoke_consent' THEN
  UPDATE ats_candidate_consents SET granted=false,revoked_at=COALESCE(revoked_at,now()) WHERE id=cons.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Consentimento não atualizado.' USING ERRCODE='42501';END IF;
 ELSIF _action='retention' THEN
  IF NOT (_payload ? 'retention_until') THEN RAISE EXCEPTION 'Informe a data de retenção.' USING ERRCODE='22023';END IF;
  UPDATE ats_candidates SET retention_until=(_payload->>'retention_until')::timestamptz WHERE id=c.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retenção não atualizada.' USING ERRCODE='42501';END IF;
 ELSIF _action='erase' THEN
  IF _payload->>'confirm' IS DISTINCT FROM 'ANONIMIZAR' OR (r.id IS NOT NULL AND (r.request_type<>'erasure' OR r.status IN('completed','rejected'))) THEN RAISE EXCEPTION 'Confirmação ou solicitação incompatível.' USING ERRCODE='23514';END IF;
  PERFORM public.anonymize_ats_candidate(c.id);
  IF r.id IS NOT NULL THEN UPDATE ats_dsar_requests SET status='completed',processed_at=now(),processed_by=auth.uid(),result=jsonb_build_object('kind','erasure') WHERE id=r.id;IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não concluída.' USING ERRCODE='42501';END IF;END IF;
 ELSE RAISE EXCEPTION 'Ação LGPD inválida.' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('ok',true,'id',v_id);
END $$;
REVOKE ALL ON FUNCTION public.ats_compliance_write(text,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_compliance_write(text,uuid,uuid,jsonb) TO authenticated;

-- A subject export is a caller-RLS snapshot, not a privileged table dump.
-- Explicit application fields exclude private hiring terms. Interview public
-- scheduling bearers are never part of an export. Query failures abort all work.
CREATE OR REPLACE FUNCTION public.ats_compliance_export(_candidate uuid,_request uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE r public.ats_dsar_requests; snap jsonb; apps jsonb;cons jsonb;scor jsonb;intv jsonb;c jsonb;
BEGIN
 IF NOT public.ats_compliance_access(_candidate,'export') THEN RAISE EXCEPTION 'Exportação LGPD não autorizada.' USING ERRCODE='42501';END IF;
 IF _request IS NOT NULL THEN
  SELECT * INTO r FROM ats_dsar_requests WHERE id=_request FOR UPDATE;
  IF NOT FOUND OR r.candidate_id<>_candidate OR r.request_type NOT IN('export','access') OR r.status IN('completed','rejected') OR NOT ats_compliance_access(_candidate,'update') THEN RAISE EXCEPTION 'Solicitação de exportação indisponível ou incompatível.' USING ERRCODE='42501';END IF;
 END IF;
 SELECT to_jsonb(t) INTO STRICT c FROM ats_candidates t WHERE t.id=_candidate;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',a.id,'candidate_id',a.candidate_id,'job_id',a.job_id,'status',a.status,'stage_value',a.stage_value)),'[]') INTO apps FROM ats_applications a WHERE a.candidate_id=_candidate;
 SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO cons FROM ats_candidate_consents t WHERE t.candidate_id=_candidate;
 SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') INTO scor FROM ats_scorecard_responses t WHERE t.application_id IN(SELECT a.id FROM ats_applications a WHERE a.candidate_id=_candidate);
 SELECT COALESCE(jsonb_agg(to_jsonb(t)-ARRAY['self_schedule_token','self_schedule_expires_at']),'[]') INTO intv FROM ats_interviews t WHERE t.candidate_id=_candidate;
 snap:=jsonb_build_object('exported_at',now(),'candidate',c,'applications',apps,'consents',cons,'scorecards',scor,'interviews',intv,
  'scope',jsonb_build_object('description','Somente registros e campos autorizados para o operador; não é cópia integral privilegiada.','excludes',jsonb_build_array('tokens de agendamento','condições privadas de contratação')));
 IF r.id IS NOT NULL THEN
  UPDATE ats_dsar_requests SET status='completed',processed_at=now(),processed_by=auth.uid(),result=jsonb_build_object('kind','export','scope','caller_permissions','counts',jsonb_build_object('applications',jsonb_array_length(apps),'consents',jsonb_array_length(cons),'scorecards',jsonb_array_length(scor),'interviews',jsonb_array_length(intv))) WHERE id=r.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível concluir a solicitação.' USING ERRCODE='42501';END IF;
 END IF;
 RETURN snap;
END $$;
REVOKE ALL ON FUNCTION public.ats_compliance_export(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_compliance_export(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
