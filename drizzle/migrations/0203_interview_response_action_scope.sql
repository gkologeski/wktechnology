-- Interview scheduling and evaluation are separate capabilities; both need
-- visibility of the actual candidature, candidate and job.
CREATE OR REPLACE FUNCTION public.ats_interview_action_access(_workspace uuid,_application uuid,_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(public.hr_record_access('applications','view',_application)
 AND EXISTS(SELECT 1 FROM public.ats_applications a WHERE a.id=_application AND a.workspace_id=_workspace)
 AND public.user_has_permission(auth.uid(),_workspace,'techhire.interviews.view.workspace')
 AND CASE WHEN _action='view' THEN true
 WHEN _action IN('create','update') THEN NOT public.is_read_only_view() AND public.user_has_permission(auth.uid(),_workspace,'techhire.interviews.schedule.workspace')
 WHEN _action IN('score','ai') THEN NOT public.is_read_only_view() AND public.user_has_permission(auth.uid(),_workspace,'techhire.interviews.score.workspace') AND (_action='score' OR ((public.user_has_permission(auth.uid(),_workspace,'techhire.copilot.view.workspace') OR public.user_has_permission(auth.uid(),_workspace,'techhire.copilot.view.team') OR public.user_has_permission(auth.uid(),_workspace,'techhire.copilot.view.own')) AND (public.user_has_permission(auth.uid(),_workspace,'techhire.copilot.create.workspace') OR public.user_has_permission(auth.uid(),_workspace,'techhire.copilot.create.own'))))
 ELSE false END,false)
$$;
CREATE OR REPLACE FUNCTION public.ats_response_action_access(_workspace uuid,_application uuid,_scorecard uuid,_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(public.ats_interview_action_access(_workspace,_application,CASE WHEN _action IN('create','update') THEN 'score' ELSE _action END)
 AND EXISTS(SELECT 1 FROM public.ats_scorecards s JOIN public.ats_applications a ON a.id=_application WHERE s.id=_scorecard AND s.workspace_id=_workspace AND (s.job_id IS NULL OR s.job_id=a.job_id)),false)
$$;
CREATE OR REPLACE FUNCTION public.hr_record_access(_resource text, _action text, _id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE allowed boolean;
BEGIN
 CASE _resource
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


DO $$ DECLARE p record;BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN('ats_interviews','ats_scorecard_responses') AND (permissive='PERMISSIVE' OR policyname LIKE 'ats_interviews_rbac_%') LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);END LOOP;
END $$;
CREATE POLICY ats_interviews_action_select ON public.ats_interviews FOR SELECT TO authenticated USING(public.ats_interview_action_access(workspace_id,application_id,'view'));
CREATE POLICY ats_interviews_action_insert ON public.ats_interviews FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.ats_interview_action_access(workspace_id,application_id,'create'));
CREATE POLICY ats_interviews_action_update ON public.ats_interviews FOR UPDATE TO authenticated USING(public.ats_interview_action_access(workspace_id,application_id,'update') OR public.ats_interview_action_access(workspace_id,application_id,'score')) WITH CHECK(public.ats_interview_action_access(workspace_id,application_id,'update') OR public.ats_interview_action_access(workspace_id,application_id,'score'));
CREATE POLICY ats_responses_action_select ON public.ats_scorecard_responses FOR SELECT TO authenticated USING(public.ats_response_action_access(workspace_id,application_id,scorecard_id,'view'));
CREATE POLICY ats_responses_action_insert ON public.ats_scorecard_responses FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND evaluator_id=auth.uid() AND public.ats_response_action_access(workspace_id,application_id,scorecard_id,'create'));
CREATE POLICY ats_responses_action_update ON public.ats_scorecard_responses FOR UPDATE TO authenticated USING(public.ats_response_action_access(workspace_id,application_id,scorecard_id,'update')) WITH CHECK(public.ats_response_action_access(workspace_id,application_id,scorecard_id,'update'));

CREATE OR REPLACE FUNCTION public.ats_interview_mutation_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid();a public.ats_applications;r public.ats_interviews;u uuid;scoring boolean;general boolean;analysis boolean;
BEGIN
 IF TG_OP='DELETE' THEN
  IF actor IS NOT NULL AND NOT (pg_trigger_depth()>1 AND NOT EXISTS(SELECT 1 FROM public.ats_applications WHERE id=OLD.application_id) AND public.is_workspace_member(OLD.workspace_id,actor) AND NOT public.is_read_only_view()) THEN RAISE EXCEPTION 'Cancel interviews instead of deleting history' USING ERRCODE='42501';END IF;RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.application_id IS DISTINCT FROM OLD.application_id OR NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id) THEN RAISE EXCEPTION 'Interview author, workspace and parents are immutable' USING ERRCODE='42501';END IF;
 IF NEW.ai_score IS NOT NULL AND NEW.ai_score NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'AI score must be between 0 and 100' USING ERRCODE='22023';END IF;
 IF NEW.duration_min IS NOT NULL AND NEW.duration_min NOT BETWEEN 5 AND 480 THEN RAISE EXCEPTION 'Invalid interview duration' USING ERRCODE='22023';END IF;
 SELECT * INTO a FROM public.ats_applications WHERE id=NEW.application_id;
 IF NOT FOUND OR a.workspace_id IS DISTINCT FROM NEW.workspace_id OR a.job_id IS DISTINCT FROM NEW.job_id OR a.candidate_id IS DISTINCT FROM NEW.candidate_id THEN RAISE EXCEPTION 'Interview parent mismatch' USING ERRCODE='23514';END IF;
 scoring:=CASE WHEN TG_OP='INSERT' THEN NULLIF(NEW.transcript,'') IS NOT NULL OR NULLIF(NEW.ai_summary,'') IS NOT NULL OR COALESCE(NEW.ai_strengths,'[]'::jsonb)<>'[]'::jsonb OR COALESCE(NEW.ai_concerns,'[]'::jsonb)<>'[]'::jsonb OR COALESCE(NEW.ai_followups,'[]'::jsonb)<>'[]'::jsonb OR NEW.ai_recommendation IS NOT NULL OR NEW.ai_model IS NOT NULL OR NEW.ai_generated_at IS NOT NULL OR NEW.ai_score IS NOT NULL ELSE jsonb_build_array(NEW.transcript,NEW.ai_summary,NEW.ai_strengths,NEW.ai_concerns,NEW.ai_followups,NEW.ai_recommendation,NEW.ai_score,NEW.ai_generated_at,NEW.ai_model) IS DISTINCT FROM jsonb_build_array(OLD.transcript,OLD.ai_summary,OLD.ai_strengths,OLD.ai_concerns,OLD.ai_followups,OLD.ai_recommendation,OLD.ai_score,OLD.ai_generated_at,OLD.ai_model) END;
 analysis:=CASE WHEN TG_OP='INSERT' THEN NULLIF(NEW.ai_summary,'') IS NOT NULL OR COALESCE(NEW.ai_strengths,'[]'::jsonb)<>'[]'::jsonb OR COALESCE(NEW.ai_concerns,'[]'::jsonb)<>'[]'::jsonb OR COALESCE(NEW.ai_followups,'[]'::jsonb)<>'[]'::jsonb OR NEW.ai_recommendation IS NOT NULL OR NEW.ai_model IS NOT NULL OR NEW.ai_generated_at IS NOT NULL OR NEW.ai_score IS NOT NULL ELSE jsonb_build_array(NEW.ai_summary,NEW.ai_strengths,NEW.ai_concerns,NEW.ai_followups,NEW.ai_recommendation,NEW.ai_score,NEW.ai_generated_at,NEW.ai_model) IS DISTINCT FROM jsonb_build_array(OLD.ai_summary,OLD.ai_strengths,OLD.ai_concerns,OLD.ai_followups,OLD.ai_recommendation,OLD.ai_score,OLD.ai_generated_at,OLD.ai_model) END;
 general:=TG_OP='INSERT' OR (to_jsonb(NEW)-ARRAY['transcript','ai_summary','ai_strengths','ai_concerns','ai_followups','ai_recommendation','ai_score','ai_generated_at','ai_model','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['transcript','ai_summary','ai_strengths','ai_concerns','ai_followups','ai_recommendation','ai_score','ai_generated_at','ai_model','updated_at']);
 IF actor IS NOT NULL THEN
  IF NOT public.ats_interview_action_access(NEW.workspace_id,NEW.application_id,'update') AND NOT public.ats_interview_action_access(NEW.workspace_id,NEW.application_id,'score') THEN RAISE EXCEPTION 'Interview action denied' USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' AND NEW.owner_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Invalid interview author' USING ERRCODE='42501';END IF;
  IF general AND NOT public.ats_interview_action_access(NEW.workspace_id,NEW.application_id,CASE WHEN TG_OP='INSERT' THEN 'create' ELSE 'update' END) THEN RAISE EXCEPTION 'Scheduling permission required' USING ERRCODE='42501';END IF;
  IF analysis AND NOT public.ats_interview_action_access(NEW.workspace_id,NEW.application_id,'ai') THEN RAISE EXCEPTION 'Copilot permission required for AI analysis' USING ERRCODE='42501';END IF;
  IF scoring AND NOT public.ats_interview_action_access(NEW.workspace_id,NEW.application_id,'score') THEN RAISE EXCEPTION 'Scoring permission required' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='INSERT' OR NEW.interviewer_id IS DISTINCT FROM OLD.interviewer_id OR NEW.panel_interviewer_ids IS DISTINCT FROM OLD.panel_interviewer_ids OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
  FOR u IN SELECT DISTINCT v FROM unnest(ARRAY[NEW.interviewer_id,NEW.assigned_to]||COALESCE(NEW.panel_interviewer_ids,ARRAY[]::uuid[]))v WHERE v IS NOT NULL LOOP
   IF NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=NEW.workspace_id AND user_id=u) THEN RAISE EXCEPTION 'Interviewer outside workspace' USING ERRCODE='23514';END IF;
  END LOOP;
 END IF;
 IF NEW.interview_kit_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.interview_kit_id IS DISTINCT FROM OLD.interview_kit_id) AND NOT EXISTS(SELECT 1 FROM public.ats_interview_kits WHERE id=NEW.interview_kit_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Interview kit outside workspace' USING ERRCODE='23514';END IF;
 IF NEW.pool_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.pool_id IS DISTINCT FROM OLD.pool_id) AND NOT EXISTS(SELECT 1 FROM public.ats_interviewer_pools WHERE id=NEW.pool_id AND workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Pool outside workspace' USING ERRCODE='23514';END IF;
 IF NEW.meeting_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.meeting_id IS DISTINCT FROM OLD.meeting_id) AND NOT EXISTS(SELECT 1 FROM public.meetings WHERE id=NEW.meeting_id AND COALESCE(workspace_id,owner_id)=NEW.workspace_id) THEN RAISE EXCEPTION 'Meeting outside workspace' USING ERRCODE='23514';END IF;
 IF NEW.auto_rescheduled_from IS NOT NULL AND (TG_OP='INSERT' OR NEW.auto_rescheduled_from IS DISTINCT FROM OLD.auto_rescheduled_from) AND NOT EXISTS(SELECT 1 FROM public.ats_interviews WHERE id=NEW.auto_rescheduled_from AND workspace_id=NEW.workspace_id AND application_id=NEW.application_id) THEN RAISE EXCEPTION 'Previous interview outside candidature' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_ats_interview_action_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_interviews FOR EACH ROW EXECUTE FUNCTION public.ats_interview_mutation_guard();

CREATE OR REPLACE FUNCTION public.ats_response_mutation_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid();r public.ats_scorecard_responses;c jsonb;k text;v jsonb;num numeric:=0;den numeric:=0;weight numeric;
BEGIN
 IF TG_OP='DELETE' THEN
  IF actor IS NOT NULL AND NOT (pg_trigger_depth()>1 AND NOT EXISTS(SELECT 1 FROM public.ats_applications WHERE id=OLD.application_id) AND public.is_workspace_member(OLD.workspace_id,actor) AND NOT public.is_read_only_view()) THEN RAISE EXCEPTION 'Evaluation history cannot be deleted directly' USING ERRCODE='42501';END IF;RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.application_id IS DISTINCT FROM OLD.application_id OR NEW.scorecard_id IS DISTINCT FROM OLD.scorecard_id OR NEW.evaluator_id IS DISTINCT FROM OLD.evaluator_id) THEN RAISE EXCEPTION 'Evaluation author, evaluator and parents are immutable' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ats_applications a JOIN public.ats_scorecards s ON s.id=NEW.scorecard_id WHERE a.id=NEW.application_id AND a.workspace_id=NEW.workspace_id AND s.workspace_id=NEW.workspace_id AND (s.job_id IS NULL OR s.job_id=a.job_id)) THEN RAISE EXCEPTION 'Evaluation parents must share workspace' USING ERRCODE='23514';END IF;
 IF actor IS NOT NULL AND (NOT public.ats_response_action_access(NEW.workspace_id,NEW.application_id,NEW.scorecard_id,CASE TG_OP WHEN 'INSERT' THEN 'create' ELSE 'update' END) OR (TG_OP='INSERT' AND (NEW.owner_id IS DISTINCT FROM actor OR NEW.evaluator_id IS DISTINCT FROM actor))) THEN RAISE EXCEPTION 'Evaluation scoring denied' USING ERRCODE='42501';END IF;
 IF NEW.recommendation IS NOT NULL AND NEW.recommendation NOT IN('strong_yes','yes','maybe','no','strong_no') THEN RAISE EXCEPTION 'Invalid score recommendation' USING ERRCODE='22023';END IF;
 SELECT criteria INTO c FROM public.ats_scorecards WHERE id=NEW.scorecard_id;
 IF jsonb_typeof(NEW.scores) IS DISTINCT FROM 'object' OR jsonb_typeof(c) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid scores or criteria' USING ERRCODE='22023';END IF;
 FOR k,v IN SELECT key,value FROM jsonb_each(NEW.scores) LOOP
  IF jsonb_typeof(v)<>'number' OR (v::text)::numeric NOT BETWEEN 0 AND 5 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c) x WHERE x->>'key'=k) THEN RAISE EXCEPTION 'Invalid score criterion' USING ERRCODE='22023';END IF;
 END LOOP;
 FOR v IN SELECT value FROM jsonb_array_elements(c) LOOP
  IF NEW.scores ? (v->>'key') THEN
   weight:=COALESCE((v->>'weight')::numeric,1);IF weight<=0 THEN RAISE EXCEPTION 'Invalid criterion weight' USING ERRCODE='22023';END IF;
   num:=num+(NEW.scores->>(v->>'key'))::numeric*weight;den:=den+weight;
  END IF;
 END LOOP;
 NEW.total_score:=CASE WHEN den>0 THEN round(num/den,2) ELSE NULL END;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_ats_response_action_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_scorecard_responses FOR EACH ROW EXECUTE FUNCTION public.ats_response_mutation_guard();
REVOKE DELETE ON public.ats_interviews,public.ats_scorecard_responses FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ats_interview_action_access(uuid,uuid,text),public.ats_response_action_access(uuid,uuid,uuid,text),public.ats_interview_mutation_guard(),public.ats_response_mutation_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_interview_action_access(uuid,uuid,text),public.ats_response_action_access(uuid,uuid,uuid,text) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
