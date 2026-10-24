-- Pipeline editor action isolation; defaults affect the whole workspace.
CREATE OR REPLACE FUNCTION public.hr_scope_permission(_workspace uuid, _resource text, _action text, _own boolean, _team boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT COALESCE(auth.uid() IS NOT NULL
   AND _resource IN('techpeople.people','techpeople.onboarding','techpeople.offboarding','techpeople.onboarding_templates','techhire.candidates','techhire.jobs','techhire.pipelines','techpeople.documents','techpeople.benefits','techpeople.allocations','techpeople.goals','techpeople.one_on_ones','techpeople.reviews','techpeople.wellbeing.assessments','techpeople.incidents','techpeople.events')
   AND _action IN('view','create','update','delete')
   AND public.is_workspace_member(_workspace,auth.uid())
   AND _workspace IN(SELECT public.current_user_workspaces())
   AND (_action='view' OR NOT public.is_read_only_view())
   AND (public.user_has_permission(auth.uid(),_workspace,_resource||'.'||_action||'.workspace')
     OR (COALESCE(_own,false) AND public.user_has_permission(auth.uid(),_workspace,_resource||'.'||_action||'.own'))
     OR (COALESCE(_team,false) AND public.user_has_permission(auth.uid(),_workspace,_resource||'.'||_action||'.team'))),false)
$function$;

CREATE OR REPLACE FUNCTION public.ats_pipeline_action_access(_workspace uuid,_action text,_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(_workspace=(SELECT active_workspace_id FROM public.profiles WHERE id=auth.uid())
 AND public.hr_scope_permission(_workspace,'techhire.pipelines',_action,_owner=auth.uid(),public.hr_team_contains(_workspace,ARRAY[_owner]))
 AND (_action IN('view','create') OR public.hr_scope_permission(_workspace,'techhire.pipelines','view',_owner=auth.uid(),public.hr_team_contains(_workspace,ARRAY[_owner]))),false)
$$;
-- Shared read-only catalog metadata is required to render authorized job boards.
-- This exception grants neither editor access nor mutations of any pipeline.
CREATE OR REPLACE FUNCTION public.ats_pipeline_catalog_access(_workspace uuid,_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.ats_pipeline_action_access(_workspace,'view',_owner) OR COALESCE(
 _workspace=(SELECT active_workspace_id FROM public.profiles WHERE id=auth.uid())
 AND public.hr_scope_permission(_workspace,'techhire.jobs','view',true,true),false)
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
 IF _resource NOT IN('pipelines','jobs','people','candidates','onboarding_plans','onboarding_tasks','onboarding_templates',
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
   needs_person:=parent_mode OR base_resource NOT IN('pipelines','jobs','people','candidates','onboarding_templates');
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
   constant_scope:=COALESCE(valid_row,false) AND view_all
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
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ats_pipelines' AND permissive='PERMISSIVE' LOOP
 EXECUTE format('DROP POLICY %I ON public.ats_pipelines',p.policyname); END LOOP;
END $$;
CREATE POLICY ats_pipelines_action_select ON public.ats_pipelines FOR SELECT TO authenticated USING(public.ats_pipeline_catalog_access(workspace_id,owner_id));
CREATE POLICY ats_pipelines_action_insert ON public.ats_pipelines FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.ats_pipeline_action_access(workspace_id,'create',owner_id));
CREATE POLICY ats_pipelines_action_update ON public.ats_pipelines FOR UPDATE TO authenticated USING(public.ats_pipeline_action_access(workspace_id,'update',owner_id)) WITH CHECK(public.ats_pipeline_action_access(workspace_id,'update',owner_id));
CREATE POLICY ats_pipelines_action_delete ON public.ats_pipelines FOR DELETE TO authenticated USING(public.ats_pipeline_action_access(workspace_id,'delete',owner_id));

CREATE OR REPLACE FUNCTION public.ats_pipeline_mutation_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); r public.ats_pipelines; action text;
BEGIN
 IF TG_OP='INSERT' THEN r:=NEW;action:='create'; ELSE r:=OLD;action:=CASE WHEN TG_OP='DELETE' THEN 'delete' ELSE 'update' END; END IF;
 IF actor IS NOT NULL AND NOT public.ats_pipeline_action_access(r.workspace_id,action,r.owner_id) THEN
 RAISE EXCEPTION 'Pipeline action denied' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' AND actor IS NOT NULL AND NEW.owner_id IS DISTINCT FROM actor THEN
 RAISE EXCEPTION 'Invalid pipeline author' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id) THEN
 RAISE EXCEPTION 'Pipeline author and workspace are immutable' USING ERRCODE='42501'; END IF;
 -- A workspace default can demote another creator's pipeline. Own/team update
 -- must never authorize this workspace-wide side effect.
 IF (TG_OP='INSERT' AND NEW.is_default) OR (TG_OP='UPDATE' AND NEW.is_default IS DISTINCT FROM OLD.is_default) THEN
  IF actor IS NOT NULL AND (public.is_read_only_view() OR NOT public.user_has_permission(actor,r.workspace_id,'techhire.pipelines.update.workspace')) THEN
   RAISE EXCEPTION 'Changing workspace default requires workspace pipeline update' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ats-pipeline-default:'||r.workspace_id::text,0));
 END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.is_default THEN RAISE EXCEPTION 'Cannot delete default pipeline' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM public.ats_jobs j WHERE j.pipeline_id=OLD.id) THEN RAISE EXCEPTION 'Pipeline has linked jobs' USING ERRCODE='23503'; END IF;
  RETURN OLD;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_ats_pipeline_action_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ats_pipelines FOR EACH ROW EXECUTE FUNCTION public.ats_pipeline_mutation_guard();
REVOKE ALL ON FUNCTION public.ats_pipeline_action_access(uuid,text,uuid),public.ats_pipeline_catalog_access(uuid,uuid),public.ats_pipeline_mutation_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ats_pipeline_action_access(uuid,text,uuid),public.ats_pipeline_catalog_access(uuid,uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
