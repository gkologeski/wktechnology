-- Candidatures are part of the candidate aggregate: existing candidate CRUD
-- keys apply, with BOTH the actual candidate and job visibility required.
CREATE OR REPLACE FUNCTION public.ats_application_action_access(_workspace uuid,_action text,_candidate uuid,_job uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(EXISTS(SELECT 1 FROM public.ats_candidates c JOIN public.ats_jobs j ON j.id=_job
 WHERE c.id=_candidate AND c.workspace_id=_workspace AND j.workspace_id=_workspace)
 AND public.hr_record_access('jobs','view',_job)
 AND public.hr_record_access('candidates','view',_candidate)
 AND public.hr_record_access('candidates',_action,_candidate),false)
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
 view_all boolean; update_all boolean; delete_all boolean; create_all boolean; constant_scope boolean;
BEGIN
 IF _resource NOT IN('applications','pipelines','jobs','people','candidates','onboarding_plans','onboarding_tasks','onboarding_templates',
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
   needs_person:=parent_mode OR base_resource NOT IN('applications','pipelines','jobs','people','candidates','onboarding_templates');
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
   view_all:=(resource_name||'.view.workspace')=ANY(keys);
   update_all:=(resource_name||'.update.workspace')=ANY(keys);
   delete_all:=(resource_name||'.delete.workspace')=ANY(keys);
   create_all:=(resource_name||'.create.workspace')=ANY(keys);
   constant_scope:=base_resource<>'applications' AND COALESCE(valid_row,false) AND view_all
     AND (NOT needs_person OR person_id IS NULL OR 'techpeople.people.view.workspace'=ANY(keys))
     AND (update_all OR NOT keys && ARRAY[resource_name||'.update.own',resource_name||'.update.team'])
     AND (delete_all OR NOT keys && ARRAY[resource_name||'.delete.own',resource_name||'.delete.team'])
     AND (create_all OR NOT keys && ARRAY[resource_name||'.create.own',resource_name||'.create.team']);
   IF constant_scope THEN
     can_view:=true;
     can_update:=update_all AND NOT read_only AND base_resource<>'events';
     can_delete:=delete_all AND NOT read_only AND base_resource<>'events';
     can_create_child:=(parent_mode OR base_resource='onboarding_plans') AND create_all AND NOT read_only;
     can_edit_settings:=can_update;
   ELSE
     -- Mixed workspace and own/team grants retain the original exact predicate.
     can_view:=public.hr_record_access(_resource,'view',id);
     can_update:=can_view AND public.hr_record_access(_resource,'update',id);
     can_delete:=can_view AND public.hr_record_access(_resource,'delete',id);
     can_create_child:=can_view AND (_resource='onboarding_plans' OR parent_mode) AND public.hr_record_access(_resource,'create',id);
     can_edit_settings:=can_update;
     IF _resource='onboarding_tasks' THEN
       can_edit_settings:=can_update AND COALESCE((SELECT public.hr_record_access('onboarding_plans','update',t.plan_id)
         FROM public.people_onboarding_tasks t WHERE t.id=hr_record_capabilities.id),false);
     END IF;
   END IF;
   RETURN NEXT;
 END LOOP;
END $function$;


DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ats_applications' AND permissive='PERMISSIVE' LOOP
 EXECUTE format('DROP POLICY %I ON public.ats_applications',p.policyname);END LOOP;
END $$;
CREATE POLICY ats_applications_action_select ON public.ats_applications FOR SELECT TO authenticated USING(public.ats_application_action_access(workspace_id,'view',candidate_id,job_id));
CREATE POLICY ats_applications_action_insert ON public.ats_applications FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.ats_application_action_access(workspace_id,'create',candidate_id,job_id));
CREATE POLICY ats_applications_action_update ON public.ats_applications FOR UPDATE TO authenticated USING(public.ats_application_action_access(workspace_id,'update',candidate_id,job_id)) WITH CHECK(public.ats_application_action_access(workspace_id,'update',candidate_id,job_id));
CREATE POLICY ats_applications_action_delete ON public.ats_applications FOR DELETE TO authenticated USING(public.ats_application_action_access(workspace_id,'delete',candidate_id,job_id));
CREATE OR REPLACE FUNCTION public.ats_application_mutation_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ats_applications;actor uuid:=auth.uid();action text;parent_cascade boolean:=false;
BEGIN
 IF TG_OP='INSERT' THEN r:=NEW;action:='create';ELSE r:=OLD;action:=CASE TG_OP WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;END IF;
 -- Referential cascades follow an already authorized candidate/job deletion.
 -- The parent is gone, so its ordinary view predicate cannot be re-evaluated.
 IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN
 parent_cascade:=NOT EXISTS(SELECT 1 FROM public.ats_candidates WHERE id=OLD.candidate_id) OR NOT EXISTS(SELECT 1 FROM public.ats_jobs WHERE id=OLD.job_id);
 END IF;
 IF actor IS NOT NULL AND NOT (parent_cascade AND public.is_workspace_member(r.workspace_id,actor) AND r.workspace_id IN(SELECT public.current_user_workspaces()) AND NOT public.is_read_only_view())
 AND NOT public.ats_application_action_access(r.workspace_id,action,r.candidate_id,r.job_id) THEN RAISE EXCEPTION 'Candidature action denied' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 IF TG_OP='UPDATE' AND (NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.job_id IS DISTINCT FROM OLD.job_id OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id) THEN RAISE EXCEPTION 'Candidature author, workspace and parents are immutable' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' AND actor IS NOT NULL AND NEW.owner_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Invalid candidature author' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ats_candidates c JOIN public.ats_jobs j ON j.id=NEW.job_id WHERE c.id=NEW.candidate_id AND c.workspace_id=NEW.workspace_id AND j.workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Candidature parents must share workspace' USING ERRCODE='23514';END IF;
 IF (TG_OP='INSERT' AND NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM actor) OR (TG_OP='UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
  IF actor IS NOT NULL AND (public.is_read_only_view() OR NOT public.user_has_permission(actor,NEW.workspace_id,'techhire.candidates.assign.workspace')) THEN RAISE EXCEPTION 'Candidate assignment permission required' USING ERRCODE='42501';END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id=NEW.workspace_id AND user_id=NEW.assigned_to) THEN RAISE EXCEPTION 'Assignee outside candidature workspace' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_ats_application_action_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_applications FOR EACH ROW EXECUTE FUNCTION public.ats_application_mutation_guard();
REVOKE ALL ON FUNCTION public.ats_application_action_access(uuid,text,uuid,uuid),public.ats_application_mutation_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_application_action_access(uuid,text,uuid,uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';

-- Timeline is a child of the visible candidature, never workspace-wide data.
CREATE OR REPLACE FUNCTION public.ats_application_event_insert_access(_workspace uuid,_application uuid,_event text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(NOT public.is_read_only_view() AND public.hr_record_access('applications','view',_application)
 AND EXISTS(SELECT 1 FROM public.ats_applications a WHERE a.id=_application AND a.workspace_id=_workspace)
 AND CASE
 WHEN _event='application_created' THEN public.hr_record_access('applications','create',_application) AND EXISTS(SELECT 1 FROM public.ats_applications a WHERE a.id=_application AND a.owner_id=auth.uid())
 WHEN _event='stage_moved' THEN public.hr_record_access('applications','update',_application)
 WHEN _event='scorecard_submitted' THEN public.user_has_permission(auth.uid(),_workspace,'techhire.interviews.score.workspace')
 WHEN _event IN('interview_scheduled','interview_rescheduled','interview_canceled','interview_completed','interview_no_show','interview_link_sent') THEN public.user_has_permission(auth.uid(),_workspace,'techhire.interviews.schedule.workspace')
 ELSE false END,false)
$$;
DO $$ DECLARE p record;BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ats_application_events' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.ats_application_events',p.policyname);END LOOP;
END $$;
CREATE POLICY ats_application_events_parent_read ON public.ats_application_events FOR SELECT TO authenticated USING(public.hr_record_access('applications','view',application_id) AND EXISTS(SELECT 1 FROM public.ats_applications a WHERE a.id=application_id AND a.job_id=ats_application_events.job_id AND a.candidate_id=ats_application_events.candidate_id AND (ats_application_events.workspace_id IS NULL OR ats_application_events.workspace_id=a.workspace_id)));
CREATE POLICY ats_application_events_append ON public.ats_application_events FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND actor_id=auth.uid() AND public.ats_application_event_insert_access(workspace_id,application_id,event_type));
CREATE OR REPLACE FUNCTION public.ats_application_event_links_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.ats_applications;actor uuid:=auth.uid();BEGIN
 IF TG_OP<>'INSERT' THEN
  IF actor IS NOT NULL AND NOT (TG_OP='DELETE' AND pg_trigger_depth()>1 AND NOT EXISTS(SELECT 1 FROM public.ats_applications WHERE id=OLD.application_id) AND public.is_workspace_member(COALESCE(OLD.workspace_id,(SELECT active_workspace_id FROM public.profiles WHERE id=actor)),actor) AND NOT public.is_read_only_view()) THEN RAISE EXCEPTION 'Timeline is append-only' USING ERRCODE='42501';END IF;
  IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
 END IF;
 SELECT * INTO p FROM public.ats_applications WHERE id=NEW.application_id;
 IF NOT FOUND OR NEW.job_id IS DISTINCT FROM p.job_id OR NEW.candidate_id IS DISTINCT FROM p.candidate_id OR (NEW.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM p.workspace_id) THEN RAISE EXCEPTION 'Timeline parent mismatch' USING ERRCODE='23514';END IF;
 NEW.workspace_id:=p.workspace_id;
 IF actor IS NOT NULL AND (NEW.owner_id IS DISTINCT FROM actor OR NEW.actor_id IS DISTINCT FROM actor OR NOT public.ats_application_event_insert_access(p.workspace_id,NEW.application_id,NEW.event_type)) THEN RAISE EXCEPTION 'Timeline append denied' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_ats_application_event_links_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_application_events FOR EACH ROW EXECUTE FUNCTION public.ats_application_event_links_guard();
REVOKE UPDATE,DELETE ON public.ats_application_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ats_application_event_insert_access(uuid,uuid,text),public.ats_application_event_links_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_application_event_insert_access(uuid,uuid,text) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
