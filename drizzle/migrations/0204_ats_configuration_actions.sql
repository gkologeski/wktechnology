-- Configuration administration is distinct from read-only use in interviews.
ALTER TABLE public.ats_interview_kits ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
SELECT 'techhire.'||r.key||'.'||a.key||'.'||scope,'techhire',r.key,a.key::public.perm_action,scope::public.perm_scope,
 a.label||' '||r.label||' ('||scope||')','Administração do recurso; agendamento possui acesso de uso separado.',true
FROM (VALUES('interviewer_pools','pools de entrevistadores'),('interviewer_availability','disponibilidade de entrevistadores'))r(key,label)
CROSS JOIN (VALUES('view','Ver'),('create','Criar'),('update','Editar'),('delete','Excluir'))a(key,label)
CROSS JOIN unnest(ARRAY['own','team','workspace'])scope
WHERE NOT(a.key IN('create','delete') AND scope='team') ON CONFLICT(key) DO NOTHING;
-- Preserve all existing grants, denies, presets and other tenants.
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000004',p.key,'grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688'
FROM public.permissions p WHERE p.resource IN('interviewer_pools','interviewer_availability') AND p.module='techhire'
AND EXISTS(SELECT 1 FROM public.job_roles WHERE id='aaaaaaaa-0000-4000-8000-000000000004')
AND EXISTS(SELECT 1 FROM public.workspaces WHERE id='184b9435-0a9b-4334-9e89-8854dc883f5d')
ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
SET check_function_bodies=off;
CREATE OR REPLACE FUNCTION public.ats_config_action_access(_workspace uuid,_resource text,_action text,_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(_resource IN('scorecards','interview_kits','interviewer_pools','interviewer_availability')
 AND _action IN('view','create','update','delete') AND auth.uid() IS NOT NULL
 AND _workspace=(SELECT active_workspace_id FROM public.profiles WHERE id=auth.uid())
 AND public.is_workspace_member(_workspace,auth.uid()) AND _workspace IN(SELECT public.current_user_workspaces())
 AND (_action='view' OR NOT public.is_read_only_view())
 AND (public.user_has_permission(auth.uid(),_workspace,'techhire.'||_resource||'.'||_action||'.workspace')
  OR (_subject=auth.uid() AND public.user_has_permission(auth.uid(),_workspace,'techhire.'||_resource||'.'||_action||'.own'))
  OR (public.hr_team_contains(_workspace,ARRAY[_subject]) AND public.user_has_permission(auth.uid(),_workspace,'techhire.'||_resource||'.'||_action||'.team')))
 AND (_action IN('view','create') OR public.ats_config_action_access(_workspace,_resource,'view',_subject)),false)
$$;
-- Scheduler/scorer may read catalog metadata without gaining administration.
CREATE OR REPLACE FUNCTION public.ats_config_catalog_access(_workspace uuid,_resource text,_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.ats_config_action_access(_workspace,_resource,'view',_subject) OR COALESCE(
 _workspace=(SELECT active_workspace_id FROM public.profiles WHERE id=auth.uid())
 AND public.is_workspace_member(_workspace,auth.uid()) AND _workspace IN(SELECT public.current_user_workspaces())
 AND public.user_has_permission(auth.uid(),_workspace,'techhire.interviews.view.workspace')
 AND public.user_has_permission(auth.uid(),_workspace,CASE WHEN _resource='scorecards' THEN 'techhire.interviews.score.workspace' ELSE 'techhire.interviews.schedule.workspace' END),false)
$$;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ats_scorecards' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.ats_scorecards',p.policyname);END LOOP;END $$;
CREATE POLICY config_select ON public.ats_scorecards FOR SELECT TO authenticated USING(public.ats_config_catalog_access(workspace_id,'scorecards',owner_id));
CREATE POLICY config_insert ON public.ats_scorecards FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.ats_config_action_access(workspace_id,'scorecards','create',owner_id));
CREATE POLICY config_update ON public.ats_scorecards FOR UPDATE TO authenticated USING(public.ats_config_action_access(workspace_id,'scorecards','update',owner_id)) WITH CHECK(public.ats_config_action_access(workspace_id,'scorecards','update',owner_id));
CREATE POLICY config_delete ON public.ats_scorecards FOR DELETE TO authenticated USING(public.ats_config_action_access(workspace_id,'scorecards','delete',owner_id));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ats_interview_kits' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.ats_interview_kits',p.policyname);END LOOP;END $$;
CREATE POLICY config_select ON public.ats_interview_kits FOR SELECT TO authenticated USING(public.ats_config_catalog_access(workspace_id,'interview_kits',owner_id));
CREATE POLICY config_insert ON public.ats_interview_kits FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.ats_config_action_access(workspace_id,'interview_kits','create',owner_id));
CREATE POLICY config_update ON public.ats_interview_kits FOR UPDATE TO authenticated USING(public.ats_config_action_access(workspace_id,'interview_kits','update',owner_id)) WITH CHECK(public.ats_config_action_access(workspace_id,'interview_kits','update',owner_id));
CREATE POLICY config_delete ON public.ats_interview_kits FOR DELETE TO authenticated USING(public.ats_config_action_access(workspace_id,'interview_kits','delete',owner_id));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ats_interviewer_pools' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.ats_interviewer_pools',p.policyname);END LOOP;END $$;
CREATE POLICY config_select ON public.ats_interviewer_pools FOR SELECT TO authenticated USING(public.ats_config_catalog_access(workspace_id,'interviewer_pools',owner_id));
CREATE POLICY config_insert ON public.ats_interviewer_pools FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.ats_config_action_access(workspace_id,'interviewer_pools','create',owner_id));
CREATE POLICY config_update ON public.ats_interviewer_pools FOR UPDATE TO authenticated USING(public.ats_config_action_access(workspace_id,'interviewer_pools','update',owner_id)) WITH CHECK(public.ats_config_action_access(workspace_id,'interviewer_pools','update',owner_id));
CREATE POLICY config_delete ON public.ats_interviewer_pools FOR DELETE TO authenticated USING(public.ats_config_action_access(workspace_id,'interviewer_pools','delete',owner_id));
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ats_interviewer_availability' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.ats_interviewer_availability',p.policyname);END LOOP;END $$;
CREATE POLICY config_select ON public.ats_interviewer_availability FOR SELECT TO authenticated USING(public.ats_config_catalog_access(workspace_id,'interviewer_availability',interviewer_id));
CREATE POLICY config_insert ON public.ats_interviewer_availability FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.ats_config_action_access(workspace_id,'interviewer_availability','create',interviewer_id));
CREATE POLICY config_update ON public.ats_interviewer_availability FOR UPDATE TO authenticated USING(public.ats_config_action_access(workspace_id,'interviewer_availability','update',interviewer_id)) WITH CHECK(public.ats_config_action_access(workspace_id,'interviewer_availability','update',interviewer_id));
CREATE POLICY config_delete ON public.ats_interviewer_availability FOR DELETE TO authenticated USING(public.ats_config_action_access(workspace_id,'interviewer_availability','delete',interviewer_id));
DO $$ DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ats_interviewer_pool_members' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.ats_interviewer_pool_members',p.policyname);END LOOP;END $$;
CREATE POLICY config_select ON public.ats_interviewer_pool_members FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.ats_interviewer_pools p WHERE p.id=pool_id AND p.workspace_id=ats_interviewer_pool_members.workspace_id AND public.ats_config_catalog_access(p.workspace_id,'interviewer_pools',p.owner_id)));
CREATE POLICY config_insert ON public.ats_interviewer_pool_members FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND EXISTS(SELECT 1 FROM public.ats_interviewer_pools p WHERE p.id=pool_id AND p.workspace_id=ats_interviewer_pool_members.workspace_id AND public.ats_config_action_access(p.workspace_id,'interviewer_pools','update',p.owner_id)));
CREATE POLICY config_update ON public.ats_interviewer_pool_members FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.ats_interviewer_pools p WHERE p.id=pool_id AND p.workspace_id=ats_interviewer_pool_members.workspace_id AND public.ats_config_action_access(p.workspace_id,'interviewer_pools','update',p.owner_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.ats_interviewer_pools p WHERE p.id=pool_id AND p.workspace_id=ats_interviewer_pool_members.workspace_id AND public.ats_config_action_access(p.workspace_id,'interviewer_pools','update',p.owner_id)));
CREATE POLICY config_delete ON public.ats_interviewer_pool_members FOR DELETE TO authenticated USING(EXISTS(SELECT 1 FROM public.ats_interviewer_pools p WHERE p.id=pool_id AND p.workspace_id=ats_interviewer_pool_members.workspace_id AND public.ats_config_action_access(p.workspace_id,'interviewer_pools','update',p.owner_id)));
CREATE OR REPLACE FUNCTION public.ats_configuration_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE resource text;subject uuid;actor uuid:=auth.uid();r jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; item jsonb;seen text[]:=ARRAY[]::text[];key text;
BEGIN
 resource:=CASE TG_TABLE_NAME WHEN 'ats_scorecards' THEN 'scorecards' WHEN 'ats_interview_kits' THEN 'interview_kits' WHEN 'ats_interviewer_availability' THEN 'interviewer_availability' ELSE 'interviewer_pools' END;
 subject:=(r->>CASE WHEN resource='interviewer_availability' THEN 'interviewer_id' ELSE 'owner_id' END)::uuid;
 IF TG_OP='UPDATE' AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.id IS DISTINCT FROM OLD.id) THEN RAISE EXCEPTION 'Autoria e workspace são imutáveis.' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='ats_interviewer_pool_members' AND (r->>'pool_id' IS DISTINCT FROM to_jsonb(OLD)->>'pool_id' OR r->>'interviewer_id' IS DISTINCT FROM to_jsonb(OLD)->>'interviewer_id') THEN RAISE EXCEPTION 'Vínculos do membro são imutáveis.' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' AND resource='interviewer_availability' AND r->>'interviewer_id' IS DISTINCT FROM to_jsonb(OLD)->>'interviewer_id' THEN RAISE EXCEPTION 'Entrevistador da janela é imutável.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='ats_interviewer_pool_members' THEN
  IF TG_OP='DELETE' AND pg_trigger_depth()>1 AND NOT EXISTS(SELECT 1 FROM ats_interviewer_pools WHERE id=OLD.pool_id) THEN RETURN OLD;END IF;
  IF NOT EXISTS(SELECT 1 FROM ats_interviewer_pools p WHERE p.id=(r->>'pool_id')::uuid AND p.workspace_id=(r->>'workspace_id')::uuid AND (actor IS NULL OR public.ats_config_action_access(p.workspace_id,'interviewer_pools','update',p.owner_id))) THEN RAISE EXCEPTION 'Alteração do pool não permitida.' USING ERRCODE='42501';END IF;
 ELSIF actor IS NOT NULL AND NOT public.ats_config_action_access((r->>'workspace_id')::uuid,resource,CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END,subject) THEN RAISE EXCEPTION 'Ação não permitida para esta configuração.' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN
  IF resource='scorecards' AND EXISTS(SELECT 1 FROM ats_scorecard_responses WHERE scorecard_id=OLD.id) THEN RAISE EXCEPTION 'Modelo possui avaliações; desative-o para preservar o histórico.' USING ERRCODE='23514';END IF;
  IF resource='interview_kits' AND EXISTS(SELECT 1 FROM ats_interviews WHERE interview_kit_id=OLD.id) THEN RAISE EXCEPTION 'Kit possui entrevistas; desative-o para preservar o histórico.' USING ERRCODE='23514';END IF;
  IF resource='interviewer_pools' AND TG_TABLE_NAME='ats_interviewer_pools' AND EXISTS(SELECT 1 FROM ats_interviews WHERE pool_id=OLD.id) THEN RAISE EXCEPTION 'Pool possui entrevistas vinculadas.' USING ERRCODE='23514';END IF;
  RETURN OLD;
 END IF;
 IF actor IS NOT NULL AND TG_OP='INSERT' AND NEW.owner_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Autoria inválida.' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME<>'ats_interviewer_pool_members' AND resource<>'interviewer_availability' AND length(trim(COALESCE(r->>'name',''))) NOT BETWEEN 1 AND (CASE WHEN resource='scorecards' THEN 100 ELSE 120 END) THEN RAISE EXCEPTION 'Nome inválido.' USING ERRCODE='22023';END IF;
 IF resource='scorecards' THEN
  IF r->>'job_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ats_jobs WHERE id=(r->>'job_id')::uuid AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Vaga fora do workspace.' USING ERRCODE='23514';END IF;
  IF TG_OP='UPDATE' AND (NEW.criteria IS DISTINCT FROM OLD.criteria OR NEW.job_id IS DISTINCT FROM OLD.job_id) AND EXISTS(SELECT 1 FROM ats_scorecard_responses WHERE scorecard_id=OLD.id) THEN RAISE EXCEPTION 'Duplique o modelo para alterar critérios já utilizados.' USING ERRCODE='23514';END IF;
  IF jsonb_typeof(NEW.criteria) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.criteria) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Critérios inválidos.' USING ERRCODE='22023';END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.criteria) LOOP
   key:=item->>'key';IF key IS NULL OR length(key) NOT BETWEEN 1 AND 40 OR key=ANY(seen) OR length(COALESCE(item->>'label','')) NOT BETWEEN 1 AND 80 OR jsonb_typeof(item->'weight') IS DISTINCT FROM 'number' OR (item->>'weight')::numeric NOT BETWEEN 0.1 AND 10 THEN RAISE EXCEPTION 'Critério inválido ou duplicado.' USING ERRCODE='22023';END IF;seen:=array_append(seen,key);
  END LOOP;
 ELSIF resource='interview_kits' THEN
  IF NEW.pipeline_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ats_pipelines WHERE id=NEW.pipeline_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Funil fora do workspace.' USING ERRCODE='23514';END IF;
  IF TG_OP='UPDATE' AND (NEW.questions IS DISTINCT FROM OLD.questions OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id OR NEW.stage_value IS DISTINCT FROM OLD.stage_value) AND EXISTS(SELECT 1 FROM ats_interviews WHERE interview_kit_id=OLD.id) THEN RAISE EXCEPTION 'Duplique o kit para alterar perguntas já utilizadas.' USING ERRCODE='23514';END IF;
  IF jsonb_typeof(NEW.questions) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.questions) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Perguntas inválidas.' USING ERRCODE='22023';END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.questions) LOOP
   key:=item->>'id';IF key IS NULL OR length(key) NOT BETWEEN 1 AND 40 OR key=ANY(seen) OR length(COALESCE(item->>'text','')) NOT BETWEEN 1 AND 2000 OR COALESCE(item->>'kind','text') NOT IN('text','video') OR (item ? 'time_limit_sec' AND (jsonb_typeof(item->'time_limit_sec')<>'number' OR (item->>'time_limit_sec')::numeric NOT BETWEEN 15 AND 600)) OR (item ? 'max_takes' AND (jsonb_typeof(item->'max_takes')<>'number' OR (item->>'max_takes')::numeric NOT BETWEEN 1 AND 5)) THEN RAISE EXCEPTION 'Pergunta inválida ou duplicada.' USING ERRCODE='22023';END IF;seen:=array_append(seen,key);
  END LOOP;
  IF actor IS NOT NULL AND (NEW.is_default OR (TG_OP='UPDATE' AND OLD.is_default)) AND (TG_OP='INSERT' OR NEW.is_default IS DISTINCT FROM OLD.is_default OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id OR NEW.stage_value IS DISTINCT FROM OLD.stage_value) AND NOT (public.user_has_permission(actor,NEW.workspace_id,'techhire.interview_kits.view.workspace') AND public.user_has_permission(actor,NEW.workspace_id,'techhire.interview_kits.update.workspace')) THEN RAISE EXCEPTION 'Alterar padrão exige edição do workspace.' USING ERRCODE='42501';END IF;
  IF NEW.is_default THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text||COALESCE(NEW.pipeline_id::text,'')||COALESCE(NEW.stage_value,''),0));
   IF EXISTS(SELECT 1 FROM ats_interview_kits k WHERE k.workspace_id=NEW.workspace_id AND k.pipeline_id IS NOT DISTINCT FROM NEW.pipeline_id AND k.stage_value IS NOT DISTINCT FROM NEW.stage_value AND k.is_default AND k.id<>NEW.id) THEN RAISE EXCEPTION 'Já existe um kit padrão neste contexto.' USING ERRCODE='23505';END IF;
  END IF;
  IF NOT NEW.is_active AND NEW.is_default THEN RAISE EXCEPTION 'Kit inativo não pode ser padrão.' USING ERRCODE='23514';END IF;
 ELSIF resource='interviewer_availability' OR TG_TABLE_NAME='ats_interviewer_pool_members' THEN
  IF NOT public.is_workspace_member(NEW.workspace_id,NEW.interviewer_id) THEN RAISE EXCEPTION 'Entrevistador deve ser membro ativo do workspace.' USING ERRCODE='23514';END IF;
  IF resource='interviewer_availability' THEN
   IF (NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) OR NEW.weekday NOT BETWEEN 0 AND 6 OR NEW.start_minute<0 OR NEW.end_minute>1440 OR NEW.end_minute<=NEW.start_minute) THEN RAISE EXCEPTION 'Janela ou fuso inválido.' USING ERRCODE='22023';END IF;
  ELSE
   IF NEW.weight NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Peso inválido.' USING ERRCODE='22023';END IF;
  END IF;
 ELSE
  IF NEW.rotation_strategy NOT IN('round_robin','load_balanced') OR NEW.load_window_days NOT BETWEEN 1 AND 90 OR NEW.rotation_cursor<0 THEN RAISE EXCEPTION 'Rotação inválida.' USING ERRCODE='22023';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_ats_configuration_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_scorecards FOR EACH ROW EXECUTE FUNCTION public.ats_configuration_guard();
CREATE TRIGGER zzz_ats_configuration_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_interview_kits FOR EACH ROW EXECUTE FUNCTION public.ats_configuration_guard();
CREATE TRIGGER zzz_ats_configuration_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_interviewer_pools FOR EACH ROW EXECUTE FUNCTION public.ats_configuration_guard();
CREATE TRIGGER zzz_ats_configuration_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_interviewer_pool_members FOR EACH ROW EXECUTE FUNCTION public.ats_configuration_guard();
CREATE TRIGGER zzz_ats_configuration_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_interviewer_availability FOR EACH ROW EXECUTE FUNCTION public.ats_configuration_guard();
CREATE OR REPLACE FUNCTION public.hr_record_access(_resource text, _action text, _id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE allowed boolean;
BEGIN
 CASE _resource
 WHEN 'scorecards' THEN SELECT public.ats_config_action_access(c.workspace_id,'scorecards',_action,c.owner_id) INTO allowed FROM public.ats_scorecards c WHERE c.id=_id;
 WHEN 'interview_kits' THEN SELECT public.ats_config_action_access(c.workspace_id,'interview_kits',_action,c.owner_id) INTO allowed FROM public.ats_interview_kits c WHERE c.id=_id;
 WHEN 'interviewer_pools' THEN SELECT public.ats_config_action_access(c.workspace_id,'interviewer_pools',_action,c.owner_id) INTO allowed FROM public.ats_interviewer_pools c WHERE c.id=_id;
 WHEN 'interviewer_availability' THEN SELECT public.ats_config_action_access(c.workspace_id,'interviewer_availability',_action,c.interviewer_id) INTO allowed FROM public.ats_interviewer_availability c WHERE c.id=_id;
 WHEN 'interviews' THEN SELECT public.ats_interview_action_access(i.workspace_id,i.application_id,_action) INTO allowed FROM public.ats_interviews i WHERE i.id=_id;
 WHEN 'interview_scoring' THEN SELECT public.ats_interview_action_access(i.workspace_id,i.application_id,CASE WHEN _action='update' THEN 'ai' ELSE _action END) INTO allowed FROM public.ats_interviews i WHERE i.id=_id;
 WHEN 'scorecard_responses' THEN SELECT public.ats_response_action_access(r.workspace_id,r.application_id,r.scorecard_id,_action) INTO allowed FROM public.ats_scorecard_responses r WHERE r.id=_id;
 WHEN 'application_interviews' THEN SELECT public.ats_interview_action_access(a.workspace_id,a.id,CASE WHEN _action IN('view','create') THEN _action ELSE 'denied' END) INTO allowed FROM public.ats_applications a WHERE a.id=_id;
 WHEN 'application_scores' THEN SELECT public.ats_interview_action_access(a.workspace_id,a.id,CASE _action WHEN 'view' THEN 'view' WHEN 'create' THEN 'score' ELSE 'denied' END) INTO allowed FROM public.ats_applications a WHERE a.id=_id;
 WHEN 'applications' THEN SELECT public.ats_application_action_access(a.workspace_id,_action,a.candidate_id,a.job_id) INTO allowed FROM public.ats_applications a WHERE a.id=_id;
 WHEN 'candidate_applications' THEN allowed:=_action='create' AND public.hr_record_access('candidates','view',_id) AND public.hr_record_access('candidates',_action,_id);
 WHEN 'pipelines' THEN SELECT public.ats_pipeline_action_access(p.workspace_id,_action,p.owner_id) INTO allowed FROM public.ats_pipelines p WHERE p.id=_id;
 WHEN 'jobs' THEN SELECT public.ats_job_action_access(j.workspace_id,_action,j.owner_id,j.assigned_to,j.hiring_manager_id,j.recruiter_id) INTO allowed FROM public.ats_jobs j WHERE j.id=_id;
 WHEN 'people' THEN SELECT public.hr_people_access(p.workspace_id,_action,p.profile_id,p.manager_id,COALESCE(p.assigned_to,p.created_by,p.owner_id)) INTO allowed FROM public.people p WHERE p.id=_id;
 WHEN 'candidates' THEN SELECT public.hr_scope_permission(c.workspace_id,'techhire.candidates',_action,
   COALESCE(c.assigned_to,c.owner_id)=auth.uid(),public.hr_team_contains(c.workspace_id,ARRAY[COALESCE(c.assigned_to,c.owner_id)])) INTO allowed FROM public.ats_candidates c WHERE c.id=_id;
 WHEN 'onboarding_templates' THEN SELECT public.hr_scope_permission(t.workspace_id,'techpeople.onboarding_templates',_action,t.owner_id=auth.uid(),public.hr_team_contains(t.workspace_id,ARRAY[t.owner_id])) INTO allowed FROM public.people_onboarding_templates t WHERE t.id=_id;
 WHEN 'onboarding_plans' THEN SELECT public.hr_onboarding_access(p.workspace_id,p.kind,_action,COALESCE(p.assigned_to,p.owner_id),p.person_id,p.template_id) INTO allowed FROM public.people_onboarding_plans p WHERE p.id=_id;
 WHEN 'onboarding_tasks' THEN SELECT public.hr_task_access(t.workspace_id,t.plan_id,_action,t.assignee_id) INTO allowed FROM public.people_onboarding_tasks t WHERE t.id=_id;
 ELSE RETURN public.hr_child_record_access(_resource,_action,_id);
 END CASE;
 RETURN COALESCE(allowed,false);
END $function$;

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
   ELSE EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',table_name) INTO row_data USING id; END IF;
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
CREATE OR REPLACE FUNCTION public.ats_save_interview_kit(_id uuid,_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE w uuid:=(SELECT active_workspace_id FROM public.profiles WHERE id=auth.uid());v uuid;
BEGIN
 IF _payload->>'is_default'='true' AND NOT EXISTS(SELECT 1 FROM ats_interview_kits k WHERE k.id=_id AND k.workspace_id=w AND k.is_default AND k.pipeline_id IS NOT DISTINCT FROM (_payload->>'pipeline_id')::uuid AND k.stage_value IS NOT DISTINCT FROM (_payload->>'stage_value')) THEN
  IF NOT public.ats_config_action_access(w,'interview_kits','update',auth.uid()) OR NOT public.user_has_permission(auth.uid(),w,'techhire.interview_kits.view.workspace') OR NOT public.user_has_permission(auth.uid(),w,'techhire.interview_kits.update.workspace') THEN RAISE EXCEPTION 'Alterar padrão exige edição do workspace.' USING ERRCODE='42501';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(w::text||COALESCE(_payload->>'pipeline_id','')||COALESCE(_payload->>'stage_value',''),0));
  UPDATE public.ats_interview_kits SET is_default=false WHERE workspace_id=w AND pipeline_id IS NOT DISTINCT FROM (_payload->>'pipeline_id')::uuid AND stage_value IS NOT DISTINCT FROM (_payload->>'stage_value') AND is_default AND id IS DISTINCT FROM _id;
 END IF;
 IF _id IS NULL THEN
  INSERT INTO public.ats_interview_kits(owner_id,workspace_id,name,pipeline_id,stage_value,questions,is_default,is_active)
  VALUES(auth.uid(),w,_payload->>'name',(_payload->>'pipeline_id')::uuid,_payload->>'stage_value',_payload->'questions',COALESCE((_payload->>'is_default')::boolean,false),COALESCE((_payload->>'is_active')::boolean,true)) RETURNING id INTO v;
 ELSE
  UPDATE public.ats_interview_kits SET name=_payload->>'name',pipeline_id=(_payload->>'pipeline_id')::uuid,stage_value=_payload->>'stage_value',questions=_payload->'questions',is_default=COALESCE((_payload->>'is_default')::boolean,false),is_active=COALESCE((_payload->>'is_active')::boolean,true) WHERE id=_id AND workspace_id=w RETURNING id INTO v;
 END IF;
 IF v IS NULL THEN RAISE EXCEPTION 'Kit indisponível ou sem permissão.' USING ERRCODE='42501';END IF;RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.ats_save_interview_kit(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_save_interview_kit(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ats_config_action_access(uuid,text,text,uuid),public.ats_config_catalog_access(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_config_action_access(uuid,text,text,uuid),public.ats_config_catalog_access(uuid,text,uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
