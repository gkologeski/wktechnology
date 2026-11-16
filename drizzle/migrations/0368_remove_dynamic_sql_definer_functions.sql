CREATE OR REPLACE FUNCTION public.shared_audit_read_access(c jsonb, t text, i uuid, b jsonb, a jsonb, u uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE w uuid:=shared_audit_workspace(b,a);r text;j jsonb;responsible uuid;present boolean;BEGIN
 IF w IS NULL OR c->>'actor' IS NULL OR w::text IS DISTINCT FROM c->>'workspace' THEN RETURN false;END IF;
 IF NOT(c->'keys'?'system.audit.view.workspace' OR(c->'keys'?'system.audit.view.own' AND c->>'actor'=u::text) OR(c->'keys'?'system.audit.view.team' AND (c->>'actor'=u::text OR c->'team'?u::text))) THEN RETURN false;END IF;
 r:=CASE t WHEN 'leads' THEN 'techsales.leads' WHEN 'contacts' THEN 'techsales.contacts' WHEN 'companies' THEN 'techsales.companies' WHEN 'deals' THEN 'techsales.deals' END;
 IF r IS NULL OR i IS NULL THEN RETURN false;END IF;
 present:=CASE t WHEN 'leads' THEN EXISTS(SELECT 1 FROM public.leads x WHERE x.id=i) WHEN 'contacts' THEN EXISTS(SELECT 1 FROM public.contacts x WHERE x.id=i) WHEN 'companies' THEN EXISTS(SELECT 1 FROM public.companies x WHERE x.id=i) WHEN 'deals' THEN EXISTS(SELECT 1 FROM public.deals x WHERE x.id=i) ELSE false END;
 IF present THEN RETURN public.sales_record_access(t,i,'view');END IF;
 -- Deleted records retain only the scope proved by their own tenant-bound snapshot.
 j:=coalesce(a,b);BEGIN responsible:=coalesce(nullif(j->>'assigned_to',''),nullif(j->>'owner_id',''))::uuid;EXCEPTION WHEN invalid_text_representation THEN RETURN false;END;
 RETURN public.sales_context_access(c,w,r,'view',ARRAY[responsible]);
END $function$;

CREATE OR REPLACE FUNCTION public.save_workspace_sensitive_settings(_workspace uuid, _section text, _value jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_allowed text[]; v_column text; v_previous jsonb; v_changed jsonb;
BEGIN
  PERFORM public.workspace_settings_assert(_workspace,_section,true);
  IF jsonb_typeof(_value) IS DISTINCT FROM 'object' OR octet_length(_value::text)>16384 THEN
    RAISE EXCEPTION 'Formato de configuração inválido.' USING ERRCODE='22023';
  END IF;
  v_allowed := CASE _section
    WHEN 'payments' THEN ARRAY['gateway','mode','default_method']
    WHEN 'nfse' THEN ARRAY['provider','enabled','service_code','municipal_inscription','company_id_nfeio']
    WHEN 'meeting' THEN ARRAY['provider','require_consent','retention_days','transcription_model'] END;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(_value) k WHERE NOT k=ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Campo não permitido na configuração.' USING ERRCODE='22023';
  END IF;
  IF _section='payments' AND NOT COALESCE(
      _value->>'gateway' IN('asaas','pagarme','mercadopago','manual')
      AND _value->>'mode' IN('sandbox','live')
      AND _value->>'default_method' IN('pix','boleto','credit_card'),false) THEN
    RAISE EXCEPTION 'Parâmetros de pagamento inválidos.' USING ERRCODE='22023';
  ELSIF _section='nfse' THEN
    IF NOT COALESCE(_value->>'provider'='nfe_io' AND jsonb_typeof(_value->'enabled')='boolean',false)
       OR EXISTS(SELECT 1 FROM unnest(ARRAY['service_code','municipal_inscription','company_id_nfeio']) k
         WHERE (_value ? k) AND (jsonb_typeof(_value->k) NOT IN('string','null')
           OR length(_value->>k)>CASE WHEN k='company_id_nfeio' THEN 120 ELSE 50 END)) THEN
      RAISE EXCEPTION 'Parâmetros de NFS-e inválidos.' USING ERRCODE='22023';
    END IF;
  ELSIF _section='meeting' THEN
    IF NOT COALESCE(_value->>'provider'='jitsi'
        AND jsonb_typeof(_value->'require_consent')='boolean'
        AND jsonb_typeof(_value->'retention_days')='number'
        AND _value->>'retention_days' ~ '^[0-9]{1,3}$'
        AND jsonb_typeof(_value->'transcription_model')='string'
        AND length(_value->>'transcription_model') BETWEEN 1 AND 100,false) THEN
      RAISE EXCEPTION 'Parâmetros de reunião inválidos.' USING ERRCODE='22023';
    END IF;
    IF (_value->>'retention_days')::integer NOT BETWEEN 1 AND 365 THEN
      RAISE EXCEPTION 'A retenção deve ser entre 1 e 365 dias.' USING ERRCODE='22023';
    END IF;
  END IF;
  v_column := CASE _section WHEN 'payments' THEN 'payments_settings'
    WHEN 'nfse' THEN 'nfse_settings' WHEN 'meeting' THEN 'meeting_settings' END;
  SELECT CASE _section WHEN 'payments' THEN w.payments_settings WHEN 'nfse' THEN w.nfse_settings WHEN 'meeting' THEN w.meeting_settings END
    INTO v_previous FROM public.workspaces w WHERE w.id=_workspace FOR UPDATE;
  IF v_previous IS NULL THEN RAISE EXCEPTION 'Configuração indisponível.' USING ERRCODE='42501'; END IF;
  IF v_previous IS NOT DISTINCT FROM _value THEN RETURN false; END IF;
  IF _section='payments' THEN UPDATE public.workspaces SET payments_settings=_value WHERE id=_workspace;
  ELSIF _section='nfse' THEN UPDATE public.workspaces SET nfse_settings=_value WHERE id=_workspace;
  ELSIF _section='meeting' THEN UPDATE public.workspaces SET meeting_settings=_value WHERE id=_workspace;
  ELSE RAISE EXCEPTION 'Configuração indisponível.' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(k ORDER BY k),'[]'::jsonb) INTO v_changed FROM (
    SELECT jsonb_object_keys(COALESCE(v_previous,'{}'::jsonb)) AS k
    UNION SELECT jsonb_object_keys(_value)
  ) keys WHERE (v_previous->k) IS DISTINCT FROM (_value->k);
  INSERT INTO public.access_audit_log(workspace_id,actor_id,action,entity_type,entity_id,details)
    VALUES(_workspace,auth.uid(),'workspace_settings_updated','workspace_settings',_workspace,
      jsonb_build_object('section',_section,'changed_keys',v_changed));
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hr_record_capabilities(_resource text, _ids uuid[])
 RETURNS TABLE(id uuid, can_view boolean, can_update boolean, can_delete boolean, can_create_child boolean, can_edit_settings boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE actor uuid:=auth.uid(); w uuid; keys text[]:=ARRAY[]::text[]; read_only boolean;
 table_name text; resource_name text; base_resource text; row_data jsonb; parent_data jsonb;
 parent_mode boolean; needs_person boolean; valid_row boolean; person_id uuid; v_kind text;
 view_all boolean; update_all boolean; delete_all boolean; create_all boolean; constant_scope boolean;app_data jsonb;extra_workspace_view boolean;
BEGIN
 IF _resource='application_hiring' THEN
 IF _ids IS NULL OR cardinality(_ids)>200 THEN RAISE EXCEPTION 'Invalid capability request' USING ERRCODE='22023';END IF;
 RETURN QUERY SELECT v,public.hr_record_access(_resource,'view',v),public.hr_record_access(_resource,'update',v),public.hr_record_access(_resource,'delete',v),public.hr_record_access(_resource,'create',v),false FROM (SELECT DISTINCT unnest(_ids) AS v) s;RETURN;
 END IF;
 IF _resource IN('scorecards','interview_kits','interviewer_pools','interviewer_availability') THEN
  IF _ids IS NULL OR cardinality(_ids)>200 THEN RAISE EXCEPTION 'Invalid capability request' USING ERRCODE='22023';END IF;
  FOR id IN SELECT DISTINCT x FROM unnest(_ids)x WHERE x IS NOT NULL LOOP
   can_view:=public.hr_record_access(_resource,'view',id);can_update:=public.hr_record_access(_resource,'update',id);can_delete:=public.hr_record_access(_resource,'delete',id);can_create_child:=false;can_edit_settings:=false;RETURN NEXT;
  END LOOP;RETURN;
 END IF;
 IF _resource NOT IN('interview_scoring','application_interviews','application_scores','interviews','scorecard_responses','applications','pipelines','jobs','people','candidates','onboarding_plans','onboarding_tasks','onboarding_templates',
   'documents','benefits','allocations','goals','one_on_ones','reviews','assessments','incidents','events',
   'person_documents','person_benefits','person_allocations','person_goals','person_one_on_ones','person_reviews','person_assessments','person_incidents','person_events')
   OR _resource IS NULL OR _ids IS NULL OR cardinality(_ids)>200 THEN
   RAISE EXCEPTION 'Invalid capability request' USING ERRCODE='22023';
 END IF;
 SELECT active_workspace_id INTO w FROM public.profiles WHERE profiles.id=actor;
 IF actor IS NOT NULL AND w IS NOT NULL AND public.is_workspace_member(w,actor)
    AND w IN(SELECT public.current_user_workspaces()) THEN
   SELECT COALESCE(array_agg(k),ARRAY[]::text[]) INTO keys FROM public.user_effective_permissions(actor,w) k;
 END IF;
 read_only:=public.is_read_only_view();
 parent_mode:=left(_resource,7)='person_';
 base_resource:=CASE WHEN parent_mode THEN substr(_resource,8) ELSE _resource END;
 CASE base_resource
 WHEN 'application_interviews' THEN table_name:='ats_applications';resource_name:='techhire.interviews';
 WHEN 'application_scores' THEN table_name:='ats_applications';resource_name:='techhire.interviews';
 WHEN 'interview_scoring' THEN table_name:='ats_interviews';resource_name:='techhire.interviews';
 WHEN 'interviews' THEN table_name:='ats_interviews';resource_name:='techhire.interviews';
 WHEN 'scorecard_responses' THEN table_name:='ats_scorecard_responses';resource_name:='techhire.interviews';
 WHEN 'applications' THEN table_name:='ats_applications';resource_name:='techhire.candidates';
 WHEN 'pipelines' THEN table_name:='ats_pipelines';resource_name:='techhire.pipelines';
 WHEN 'jobs' THEN table_name:='ats_jobs';resource_name:='techhire.jobs';
 WHEN 'people' THEN table_name:='people';resource_name:='techpeople.people';
 WHEN 'candidates' THEN table_name:='ats_candidates';resource_name:='techhire.candidates';
 WHEN 'onboarding_templates' THEN table_name:='people_onboarding_templates';resource_name:='techpeople.onboarding_templates';
 WHEN 'onboarding_plans' THEN table_name:='people_onboarding_plans';
 WHEN 'onboarding_tasks' THEN table_name:='people_onboarding_tasks';
 WHEN 'documents' THEN table_name:='people_documents';resource_name:='techpeople.documents';
 WHEN 'benefits' THEN table_name:='people_benefits';resource_name:='techpeople.benefits';
 WHEN 'allocations' THEN table_name:='people_allocations';resource_name:='techpeople.allocations';
 WHEN 'goals' THEN table_name:='people_goals';resource_name:='techpeople.goals';
 WHEN 'one_on_ones' THEN table_name:='people_one_on_ones';resource_name:='techpeople.one_on_ones';
 WHEN 'reviews' THEN table_name:='people_reviews';resource_name:='techpeople.reviews';
 WHEN 'assessments' THEN table_name:='people_psychosocial_assessments';resource_name:='techpeople.wellbeing.assessments';
 WHEN 'incidents' THEN table_name:='people_incidents';resource_name:='techpeople.incidents';
 WHEN 'events' THEN table_name:='people_events';resource_name:='techpeople.events';
 END CASE;
 FOR id IN SELECT DISTINCT v FROM unnest(_ids) v WHERE v IS NOT NULL LOOP
   row_data:=NULL;parent_data:=NULL;person_id:=NULL;
   IF parent_mode THEN SELECT to_jsonb(p) INTO row_data FROM public.people p WHERE p.id=hr_record_capabilities.id;
   ELSE
   IF table_name='ats_applications' THEN SELECT to_jsonb(t) INTO row_data FROM public.ats_applications t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='ats_candidates' THEN SELECT to_jsonb(t) INTO row_data FROM public.ats_candidates t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='ats_interviews' THEN SELECT to_jsonb(t) INTO row_data FROM public.ats_interviews t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='ats_jobs' THEN SELECT to_jsonb(t) INTO row_data FROM public.ats_jobs t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='ats_pipelines' THEN SELECT to_jsonb(t) INTO row_data FROM public.ats_pipelines t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='ats_scorecard_responses' THEN SELECT to_jsonb(t) INTO row_data FROM public.ats_scorecard_responses t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people' THEN SELECT to_jsonb(t) INTO row_data FROM public.people t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_allocations' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_allocations t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_benefits' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_benefits t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_documents' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_documents t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_events' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_events t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_goals' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_goals t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_incidents' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_incidents t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_onboarding_plans' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_onboarding_plans t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_onboarding_tasks' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_onboarding_tasks t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_onboarding_templates' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_onboarding_templates t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_one_on_ones' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_one_on_ones t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_psychosocial_assessments' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_psychosocial_assessments t WHERE t.id=hr_record_capabilities.id;
   ELSIF table_name='people_reviews' THEN SELECT to_jsonb(t) INTO row_data FROM public.people_reviews t WHERE t.id=hr_record_capabilities.id;
   END IF; END IF;
   valid_row:=row_data IS NOT NULL AND (row_data->>'workspace_id')::uuid=w;
   needs_person:=parent_mode OR base_resource NOT IN('interview_scoring','application_interviews','application_scores','interviews','scorecard_responses','applications','pipelines','jobs','people','candidates','onboarding_templates');
   IF valid_row AND base_resource='onboarding_tasks' THEN
     SELECT to_jsonb(p) INTO parent_data FROM public.people_onboarding_plans p
       WHERE p.id=(row_data->>'plan_id')::uuid AND p.workspace_id=w;
     valid_row:=parent_data IS NOT NULL;
   ELSIF parent_mode OR base_resource='onboarding_plans' THEN parent_data:=row_data;
   END IF;
   IF valid_row AND base_resource IN('onboarding_tasks','onboarding_plans') THEN
     v_kind:=parent_data->>'kind'; resource_name:='techpeople.'||v_kind;
     valid_row:=v_kind IN('onboarding','offboarding') AND ((parent_data->>'template_id') IS NULL OR EXISTS(
       SELECT 1 FROM public.people_onboarding_templates t WHERE t.id=(parent_data->>'template_id')::uuid AND t.workspace_id=w AND t.kind=v_kind));
   END IF;
   IF valid_row AND needs_person THEN
     person_id:=CASE WHEN parent_mode THEN id ELSE COALESCE(parent_data->>'person_id',row_data->>'person_id')::uuid END;
     valid_row:=(person_id IS NULL AND base_resource='incidents') OR EXISTS(SELECT 1 FROM public.people p WHERE p.id=person_id AND p.workspace_id=w);
   END IF;
   extra_workspace_view:=true;app_data:=NULL;
   IF base_resource IN('applications','application_interviews','application_scores','interviews','interview_scoring','scorecard_responses') THEN
     IF valid_row THEN
       IF base_resource IN('applications','application_interviews','application_scores') THEN app_data:=row_data;
       ELSE SELECT to_jsonb(a) INTO app_data FROM public.ats_applications a WHERE a.id=(row_data->>'application_id')::uuid AND a.workspace_id=w;END IF;
       valid_row:=app_data IS NOT NULL AND EXISTS(SELECT 1 FROM public.ats_candidates c JOIN public.ats_jobs j ON j.id=(app_data->>'job_id')::uuid WHERE c.id=(app_data->>'candidate_id')::uuid AND c.workspace_id=w AND j.workspace_id=w);
       IF valid_row AND base_resource='scorecard_responses' THEN valid_row:=EXISTS(SELECT 1 FROM public.ats_scorecards sc WHERE sc.id=(row_data->>'scorecard_id')::uuid AND sc.workspace_id=w AND (sc.job_id IS NULL OR sc.job_id=(app_data->>'job_id')::uuid));END IF;
     END IF;
     extra_workspace_view:='techhire.candidates.view.workspace'=ANY(keys) AND 'techhire.jobs.view.workspace'=ANY(keys);
   END IF;
   view_all:=(resource_name||'.view.workspace')=ANY(keys);
   update_all:=(resource_name||'.update.workspace')=ANY(keys);
   delete_all:=(resource_name||'.delete.workspace')=ANY(keys);
   create_all:=(resource_name||'.create.workspace')=ANY(keys);
   IF base_resource IN('interviews','interview_scoring','scorecard_responses','application_interviews','application_scores') THEN
     update_all:=CASE base_resource
       WHEN 'interviews' THEN 'techhire.interviews.schedule.workspace'=ANY(keys)
       WHEN 'scorecard_responses' THEN 'techhire.interviews.score.workspace'=ANY(keys)
       WHEN 'interview_scoring' THEN 'techhire.interviews.score.workspace'=ANY(keys) AND keys && ARRAY['techhire.copilot.view.workspace','techhire.copilot.view.team','techhire.copilot.view.own'] AND keys && ARRAY['techhire.copilot.create.workspace','techhire.copilot.create.own']
       ELSE false END;
     delete_all:=false;
     create_all:=CASE base_resource WHEN 'application_interviews' THEN 'techhire.interviews.schedule.workspace'=ANY(keys) WHEN 'application_scores' THEN 'techhire.interviews.score.workspace'=ANY(keys) ELSE false END;
   END IF;
   constant_scope:=extra_workspace_view AND COALESCE(valid_row,false) AND view_all
     AND (NOT needs_person OR person_id IS NULL OR 'techpeople.people.view.workspace'=ANY(keys))
     AND (update_all OR NOT keys && ARRAY[resource_name||'.update.own',resource_name||'.update.team'])
     AND (delete_all OR NOT keys && ARRAY[resource_name||'.delete.own',resource_name||'.delete.team'])
     AND (create_all OR NOT keys && ARRAY[resource_name||'.create.own',resource_name||'.create.team']);
   IF constant_scope THEN
     can_view:=true;
     can_update:=update_all AND NOT read_only AND base_resource<>'events';
     can_delete:=delete_all AND NOT read_only AND base_resource<>'events';
     can_create_child:=(parent_mode OR base_resource IN('onboarding_plans','application_interviews','application_scores')) AND create_all AND NOT read_only;
     can_edit_settings:=can_update;
   ELSE
     -- Mixed workspace and own/team grants retain the original exact predicate.
     can_view:=public.hr_record_access(_resource,'view',id);
     can_update:=can_view AND public.hr_record_access(_resource,'update',id);
     can_delete:=can_view AND public.hr_record_access(_resource,'delete',id);
     can_create_child:=can_view AND (_resource IN('onboarding_plans','application_interviews','application_scores') OR parent_mode) AND public.hr_record_access(_resource,'create',id);
     can_edit_settings:=can_update;
     IF _resource='onboarding_tasks' THEN
       can_edit_settings:=can_update AND COALESCE((SELECT public.hr_record_access('onboarding_plans','update',t.plan_id)
         FROM public.people_onboarding_tasks t WHERE t.id=hr_record_capabilities.id),false);
     END IF;
   END IF;
   RETURN NEXT;
 END LOOP;
END $function$;

REVOKE EXECUTE ON FUNCTION public.shared_audit_read_access(jsonb,text,uuid,jsonb,jsonb,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_workspace_sensitive_settings(uuid,text,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hr_record_capabilities(text,uuid[]) FROM PUBLIC, anon;