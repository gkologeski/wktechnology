-- Remaining HR child resources: action and actual own/team scope, without role bypass.
-- Existing View As / restricted-visibility policies and process triggers are retained.
CREATE OR REPLACE FUNCTION public.hr_scope_permission(_workspace uuid,_resource text,_action text,_own boolean,_team boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(auth.uid() IS NOT NULL
   AND _resource IN('techpeople.people','techpeople.onboarding','techpeople.offboarding','techpeople.onboarding_templates','techhire.candidates','techpeople.documents','techpeople.benefits','techpeople.allocations','techpeople.goals','techpeople.one_on_ones','techpeople.reviews','techpeople.wellbeing.assessments','techpeople.incidents','techpeople.events')
   AND _action IN('view','create','update','delete')
   AND public.is_workspace_member(_workspace,auth.uid())
   AND _workspace IN(SELECT public.current_user_workspaces())
   AND (_action='view' OR NOT public.is_read_only_view())
   AND (public.user_has_permission(auth.uid(),_workspace,_resource||'.'||_action||'.workspace')
     OR (COALESCE(_own,false) AND public.user_has_permission(auth.uid(),_workspace,_resource||'.'||_action||'.own'))
     OR (COALESCE(_team,false) AND public.user_has_permission(auth.uid(),_workspace,_resource||'.'||_action||'.team'))),false)
$$;


CREATE OR REPLACE FUNCTION public.hr_person_resource_access(_workspace uuid,_person uuid,_resource text,_action text,_creator uuid DEFAULT NULL,_assigned uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.people; own_scope boolean; team_scope boolean;
BEGIN
 IF _resource NOT IN('techpeople.documents','techpeople.benefits','techpeople.allocations','techpeople.goals','techpeople.one_on_ones','techpeople.reviews','techpeople.wellbeing.assessments','techpeople.incidents','techpeople.events') THEN RETURN false; END IF;
 IF _person IS NULL THEN
   RETURN _resource='techpeople.incidents' AND public.hr_scope_permission(_workspace,_resource,_action,_creator=auth.uid(),public.hr_team_contains(_workspace,ARRAY[_creator,_assigned]));
 END IF;
 SELECT * INTO p FROM public.people WHERE id=_person AND workspace_id=_workspace;
 IF NOT FOUND OR NOT public.hr_people_access(p.workspace_id,'view',p.profile_id,p.manager_id,COALESCE(p.assigned_to,p.created_by,p.owner_id)) THEN RETURN false; END IF;
 own_scope:=p.profile_id=auth.uid() OR COALESCE(p.assigned_to,p.created_by,p.owner_id)=auth.uid()
   OR (_action<>'create' AND (_creator=auth.uid() OR _assigned=auth.uid()));
 team_scope:=public.hr_team_contains(_workspace,ARRAY[p.profile_id,COALESCE(p.assigned_to,p.created_by,p.owner_id),_creator,_assigned])
   OR p.manager_id=auth.uid() OR EXISTS(SELECT 1 FROM public.people manager WHERE manager.id=p.manager_id AND manager.workspace_id=_workspace AND manager.profile_id=auth.uid());
 RETURN public.hr_scope_permission(_workspace,_resource,_action,own_scope,team_scope);
END $$;

CREATE OR REPLACE FUNCTION public.hr_child_record_access(_resource text,_action text,_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE table_name text; permission_resource text; row_data jsonb; parent_mode boolean; w uuid;
BEGIN
 parent_mode:=left(_resource,7)='person_';
 CASE (CASE WHEN parent_mode THEN substr(_resource,8) ELSE _resource END)
 WHEN 'documents' THEN table_name:='people_documents'; permission_resource:='techpeople.documents';
 WHEN 'benefits' THEN table_name:='people_benefits'; permission_resource:='techpeople.benefits';
 WHEN 'allocations' THEN table_name:='people_allocations'; permission_resource:='techpeople.allocations';
 WHEN 'goals' THEN table_name:='people_goals'; permission_resource:='techpeople.goals';
 WHEN 'one_on_ones' THEN table_name:='people_one_on_ones'; permission_resource:='techpeople.one_on_ones';
 WHEN 'reviews' THEN table_name:='people_reviews'; permission_resource:='techpeople.reviews';
 WHEN 'assessments' THEN table_name:='people_psychosocial_assessments'; permission_resource:='techpeople.wellbeing.assessments';
 WHEN 'incidents' THEN table_name:='people_incidents'; permission_resource:='techpeople.incidents';
 WHEN 'events' THEN table_name:='people_events'; permission_resource:='techpeople.events';
 ELSE RETURN false; END CASE;
 IF parent_mode THEN
   SELECT to_jsonb(p) INTO row_data FROM public.people p WHERE p.id=_id;
   IF row_data IS NULL THEN RETURN false; END IF;
   w:=(row_data->>'workspace_id')::uuid;
   IF _action='view' THEN
     RETURN public.hr_record_access('people','view',_id) AND public.hr_scope_permission(w,permission_resource,'view',true,true);
   END IF;
   RETURN public.hr_person_resource_access(w,_id,permission_resource,_action,NULL,NULL);
 END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',table_name) INTO row_data USING _id;
 IF row_data IS NULL THEN RETURN false; END IF;
 IF _resource='events' AND _action<>'view' THEN RETURN false; END IF;
 RETURN public.hr_person_resource_access((row_data->>'workspace_id')::uuid,(row_data->>'person_id')::uuid,permission_resource,_action,
   COALESCE(row_data->>'created_by',row_data->>'actor_id',row_data->>'owner_id')::uuid,(row_data->>'assigned_to')::uuid)
   AND (_resource<>'events' OR COALESCE((row_data->>'visible_to_person')::boolean,false)
     OR public.user_has_permission(auth.uid(),(row_data->>'workspace_id')::uuid,'techpeople.events.view.workspace'));
END $$;
CREATE OR REPLACE FUNCTION public.hr_record_access(_resource text,_action text,_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE allowed boolean;
BEGIN
 CASE _resource
 WHEN 'people' THEN SELECT public.hr_people_access(p.workspace_id,_action,p.profile_id,p.manager_id,COALESCE(p.assigned_to,p.created_by,p.owner_id)) INTO allowed FROM public.people p WHERE p.id=_id;
 WHEN 'candidates' THEN SELECT public.hr_scope_permission(c.workspace_id,'techhire.candidates',_action,
   COALESCE(c.assigned_to,c.owner_id)=auth.uid(),public.hr_team_contains(c.workspace_id,ARRAY[COALESCE(c.assigned_to,c.owner_id)])) INTO allowed FROM public.ats_candidates c WHERE c.id=_id;
 WHEN 'onboarding_templates' THEN SELECT public.hr_scope_permission(t.workspace_id,'techpeople.onboarding_templates',_action,t.owner_id=auth.uid(),public.hr_team_contains(t.workspace_id,ARRAY[t.owner_id])) INTO allowed FROM public.people_onboarding_templates t WHERE t.id=_id;
 WHEN 'onboarding_plans' THEN SELECT public.hr_onboarding_access(p.workspace_id,p.kind,_action,COALESCE(p.assigned_to,p.owner_id),p.person_id,p.template_id) INTO allowed FROM public.people_onboarding_plans p WHERE p.id=_id;
 WHEN 'onboarding_tasks' THEN SELECT public.hr_task_access(t.workspace_id,t.plan_id,_action,t.assignee_id) INTO allowed FROM public.people_onboarding_tasks t WHERE t.id=_id;
 ELSE RETURN public.hr_child_record_access(_resource,_action,_id);
 END CASE;
 RETURN COALESCE(allowed,false);
END $$;


CREATE OR REPLACE FUNCTION public.hr_child_links_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j jsonb; previous jsonb; expected_workspace uuid; member uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 j:=to_jsonb(NEW);
 IF TG_OP='UPDATE' THEN
   previous:=to_jsonb(OLD);
   IF j->>'workspace_id' IS DISTINCT FROM previous->>'workspace_id' OR j->>'owner_id' IS DISTINCT FROM previous->>'owner_id'
      OR j->>'person_id' IS DISTINCT FROM previous->>'person_id' OR j->>'created_by' IS DISTINCT FROM previous->>'created_by' THEN
     RAISE EXCEPTION 'Workspace, pessoa e autoria são imutáveis.' USING ERRCODE='42501';
   END IF;
 END IF;
 IF NEW.person_id IS NOT NULL THEN
   SELECT workspace_id INTO expected_workspace FROM public.people WHERE id=NEW.person_id;
   IF expected_workspace IS NULL OR (NEW.workspace_id IS NOT NULL AND NEW.workspace_id<>expected_workspace) THEN
     RAISE EXCEPTION 'Pessoa e registro devem pertencer ao mesmo workspace.' USING ERRCODE='23514';
   END IF;
   NEW.workspace_id:=expected_workspace;
 END IF;
 IF TG_OP='INSERT' AND j ? 'created_by' THEN NEW:=jsonb_populate_record(NEW,jsonb_build_object('created_by',auth.uid())); END IF;
 member:=(j->>'assigned_to')::uuid;
 IF member IS NOT NULL AND (TG_OP='INSERT' OR j->>'assigned_to' IS DISTINCT FROM previous->>'assigned_to')
   AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=member) THEN
   RAISE EXCEPTION 'Responsável não pertence ao workspace.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DO $cleanup$ DECLARE p record; BEGIN
 FOR p IN SELECT c.relname,r.polname FROM pg_policy r JOIN pg_class c ON c.oid=r.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND r.polpermissive AND c.relname IN('people_documents','people_benefits','people_allocations','people_allocation_company_splits','people_events','people_goals','people_one_on_ones','people_reviews','people_psychosocial_assessments','people_incidents')
 LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.polname,p.relname); END LOOP;
END $cleanup$;
DROP POLICY IF EXISTS "people_docs_perm_delete" ON public.people_documents;
DROP POLICY IF EXISTS "people_docs_perm_insert" ON public.people_documents;
DROP POLICY IF EXISTS "people_docs_perm_select" ON public.people_documents;
DROP POLICY IF EXISTS "people_docs_perm_update" ON public.people_documents;
DROP POLICY IF EXISTS "people_documents_select" ON public.people_documents;
DROP POLICY IF EXISTS "people_documents_write" ON public.people_documents;
DROP POLICY IF EXISTS "wk_head_rh_create" ON public.people_documents;
DROP POLICY IF EXISTS "wk_head_rh_delete" ON public.people_documents;
DROP POLICY IF EXISTS "wk_head_rh_update" ON public.people_documents;
DROP POLICY IF EXISTS "wk_head_rh_view" ON public.people_documents;
CREATE POLICY hr_child_view ON public.people_documents FOR SELECT TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.documents','view',created_by,assigned_to));
CREATE POLICY hr_child_create ON public.people_documents FOR INSERT TO authenticated WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.documents','create',created_by,assigned_to));
CREATE POLICY hr_child_update ON public.people_documents FOR UPDATE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.documents','update',created_by,assigned_to)) WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.documents','update',created_by,assigned_to));
CREATE POLICY hr_child_delete ON public.people_documents FOR DELETE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.documents','delete',created_by,assigned_to));
DROP TRIGGER IF EXISTS zzz_hr_child_links_guard ON public.people_documents;
CREATE TRIGGER zzz_hr_child_links_guard BEFORE INSERT OR UPDATE ON public.people_documents FOR EACH ROW EXECUTE FUNCTION public.hr_child_links_guard();
DROP POLICY IF EXISTS "people_benefits_perm_delete" ON public.people_benefits;
DROP POLICY IF EXISTS "people_benefits_perm_insert" ON public.people_benefits;
DROP POLICY IF EXISTS "people_benefits_perm_select" ON public.people_benefits;
DROP POLICY IF EXISTS "people_benefits_perm_update" ON public.people_benefits;
DROP POLICY IF EXISTS "people_benefits_select" ON public.people_benefits;
DROP POLICY IF EXISTS "people_benefits_write" ON public.people_benefits;
DROP POLICY IF EXISTS "wk_head_rh_create" ON public.people_benefits;
DROP POLICY IF EXISTS "wk_head_rh_delete" ON public.people_benefits;
DROP POLICY IF EXISTS "wk_head_rh_update" ON public.people_benefits;
DROP POLICY IF EXISTS "wk_head_rh_view" ON public.people_benefits;
CREATE POLICY hr_child_view ON public.people_benefits FOR SELECT TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.benefits','view',created_by,NULL::uuid));
CREATE POLICY hr_child_create ON public.people_benefits FOR INSERT TO authenticated WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.benefits','create',created_by,NULL::uuid));
CREATE POLICY hr_child_update ON public.people_benefits FOR UPDATE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.benefits','update',created_by,NULL::uuid)) WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.benefits','update',created_by,NULL::uuid));
CREATE POLICY hr_child_delete ON public.people_benefits FOR DELETE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.benefits','delete',created_by,NULL::uuid));
DROP TRIGGER IF EXISTS zzz_hr_child_links_guard ON public.people_benefits;
CREATE TRIGGER zzz_hr_child_links_guard BEFORE INSERT OR UPDATE ON public.people_benefits FOR EACH ROW EXECUTE FUNCTION public.hr_child_links_guard();
DROP POLICY IF EXISTS "allocations_ws_delete" ON public.people_allocations;
DROP POLICY IF EXISTS "allocations_ws_insert" ON public.people_allocations;
DROP POLICY IF EXISTS "allocations_ws_select" ON public.people_allocations;
DROP POLICY IF EXISTS "allocations_ws_update" ON public.people_allocations;
DROP POLICY IF EXISTS "people_alloc_perm_delete" ON public.people_allocations;
DROP POLICY IF EXISTS "people_alloc_perm_insert" ON public.people_allocations;
DROP POLICY IF EXISTS "people_alloc_perm_select" ON public.people_allocations;
DROP POLICY IF EXISTS "people_alloc_perm_update" ON public.people_allocations;
DROP POLICY IF EXISTS "wk_head_rh_delete" ON public.people_allocations;
DROP POLICY IF EXISTS "wk_head_rh_update" ON public.people_allocations;
CREATE POLICY hr_child_view ON public.people_allocations FOR SELECT TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.allocations','view',owner_id,assigned_to));
CREATE POLICY hr_child_create ON public.people_allocations FOR INSERT TO authenticated WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.allocations','create',owner_id,assigned_to));
CREATE POLICY hr_child_update ON public.people_allocations FOR UPDATE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.allocations','update',owner_id,assigned_to)) WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.allocations','update',owner_id,assigned_to));
CREATE POLICY hr_child_delete ON public.people_allocations FOR DELETE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.allocations','delete',owner_id,assigned_to));
DROP TRIGGER IF EXISTS zzz_hr_child_links_guard ON public.people_allocations;
CREATE TRIGGER zzz_hr_child_links_guard BEFORE INSERT OR UPDATE ON public.people_allocations FOR EACH ROW EXECUTE FUNCTION public.hr_child_links_guard();
DROP POLICY IF EXISTS "people_goals_delete" ON public.people_goals;
DROP POLICY IF EXISTS "people_goals_insert" ON public.people_goals;
DROP POLICY IF EXISTS "people_goals_perm_delete" ON public.people_goals;
DROP POLICY IF EXISTS "people_goals_perm_insert" ON public.people_goals;
DROP POLICY IF EXISTS "people_goals_perm_select" ON public.people_goals;
DROP POLICY IF EXISTS "people_goals_perm_update" ON public.people_goals;
DROP POLICY IF EXISTS "people_goals_select" ON public.people_goals;
DROP POLICY IF EXISTS "people_goals_update" ON public.people_goals;
CREATE POLICY hr_child_view ON public.people_goals FOR SELECT TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.goals','view',created_by,assigned_to));
CREATE POLICY hr_child_create ON public.people_goals FOR INSERT TO authenticated WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.goals','create',created_by,assigned_to));
CREATE POLICY hr_child_update ON public.people_goals FOR UPDATE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.goals','update',created_by,assigned_to)) WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.goals','update',created_by,assigned_to));
CREATE POLICY hr_child_delete ON public.people_goals FOR DELETE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.goals','delete',created_by,assigned_to));
DROP TRIGGER IF EXISTS zzz_hr_child_links_guard ON public.people_goals;
CREATE TRIGGER zzz_hr_child_links_guard BEFORE INSERT OR UPDATE ON public.people_goals FOR EACH ROW EXECUTE FUNCTION public.hr_child_links_guard();
DROP POLICY IF EXISTS "people_1on1_delete" ON public.people_one_on_ones;
DROP POLICY IF EXISTS "people_1on1_insert" ON public.people_one_on_ones;
DROP POLICY IF EXISTS "people_1on1_select" ON public.people_one_on_ones;
DROP POLICY IF EXISTS "people_1on1_update" ON public.people_one_on_ones;
DROP POLICY IF EXISTS "people_1x1_perm_delete" ON public.people_one_on_ones;
DROP POLICY IF EXISTS "people_1x1_perm_insert" ON public.people_one_on_ones;
DROP POLICY IF EXISTS "people_1x1_perm_select" ON public.people_one_on_ones;
DROP POLICY IF EXISTS "people_1x1_perm_update" ON public.people_one_on_ones;
CREATE POLICY hr_child_view ON public.people_one_on_ones FOR SELECT TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.one_on_ones','view',created_by,assigned_to));
CREATE POLICY hr_child_create ON public.people_one_on_ones FOR INSERT TO authenticated WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.one_on_ones','create',created_by,assigned_to));
CREATE POLICY hr_child_update ON public.people_one_on_ones FOR UPDATE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.one_on_ones','update',created_by,assigned_to)) WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.one_on_ones','update',created_by,assigned_to));
CREATE POLICY hr_child_delete ON public.people_one_on_ones FOR DELETE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.one_on_ones','delete',created_by,assigned_to));
DROP TRIGGER IF EXISTS zzz_hr_child_links_guard ON public.people_one_on_ones;
CREATE TRIGGER zzz_hr_child_links_guard BEFORE INSERT OR UPDATE ON public.people_one_on_ones FOR EACH ROW EXECUTE FUNCTION public.hr_child_links_guard();
DROP POLICY IF EXISTS "people_reviews_delete" ON public.people_reviews;
DROP POLICY IF EXISTS "people_reviews_insert" ON public.people_reviews;
DROP POLICY IF EXISTS "people_reviews_perm_delete" ON public.people_reviews;
DROP POLICY IF EXISTS "people_reviews_perm_insert" ON public.people_reviews;
DROP POLICY IF EXISTS "people_reviews_perm_select" ON public.people_reviews;
DROP POLICY IF EXISTS "people_reviews_perm_update" ON public.people_reviews;
DROP POLICY IF EXISTS "people_reviews_select" ON public.people_reviews;
DROP POLICY IF EXISTS "people_reviews_update" ON public.people_reviews;
CREATE POLICY hr_child_view ON public.people_reviews FOR SELECT TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.reviews','view',created_by,assigned_to));
CREATE POLICY hr_child_create ON public.people_reviews FOR INSERT TO authenticated WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.reviews','create',created_by,assigned_to));
CREATE POLICY hr_child_update ON public.people_reviews FOR UPDATE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.reviews','update',created_by,assigned_to)) WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.reviews','update',created_by,assigned_to));
CREATE POLICY hr_child_delete ON public.people_reviews FOR DELETE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.reviews','delete',created_by,assigned_to));
DROP TRIGGER IF EXISTS zzz_hr_child_links_guard ON public.people_reviews;
CREATE TRIGGER zzz_hr_child_links_guard BEFORE INSERT OR UPDATE ON public.people_reviews FOR EACH ROW EXECUTE FUNCTION public.hr_child_links_guard();
DROP POLICY IF EXISTS "psych_ws_delete" ON public.people_psychosocial_assessments;
DROP POLICY IF EXISTS "psych_ws_insert" ON public.people_psychosocial_assessments;
DROP POLICY IF EXISTS "psych_ws_select" ON public.people_psychosocial_assessments;
DROP POLICY IF EXISTS "psych_ws_update" ON public.people_psychosocial_assessments;
CREATE POLICY hr_child_view ON public.people_psychosocial_assessments FOR SELECT TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.wellbeing.assessments','view',created_by,NULL::uuid));
CREATE POLICY hr_child_create ON public.people_psychosocial_assessments FOR INSERT TO authenticated WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.wellbeing.assessments','create',created_by,NULL::uuid));
CREATE POLICY hr_child_update ON public.people_psychosocial_assessments FOR UPDATE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.wellbeing.assessments','update',created_by,NULL::uuid)) WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.wellbeing.assessments','update',created_by,NULL::uuid));
CREATE POLICY hr_child_delete ON public.people_psychosocial_assessments FOR DELETE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.wellbeing.assessments','delete',created_by,NULL::uuid));
DROP TRIGGER IF EXISTS zzz_hr_child_links_guard ON public.people_psychosocial_assessments;
CREATE TRIGGER zzz_hr_child_links_guard BEFORE INSERT OR UPDATE ON public.people_psychosocial_assessments FOR EACH ROW EXECUTE FUNCTION public.hr_child_links_guard();
DROP POLICY IF EXISTS "incidents_delete_admin" ON public.people_incidents;
DROP POLICY IF EXISTS "incidents_insert_manage" ON public.people_incidents;
DROP POLICY IF EXISTS "incidents_select_sensitive" ON public.people_incidents;
DROP POLICY IF EXISTS "incidents_update_manage" ON public.people_incidents;
DROP POLICY IF EXISTS "people_incidents_perm_delete" ON public.people_incidents;
DROP POLICY IF EXISTS "people_incidents_select_gate" ON public.people_incidents;
DROP POLICY IF EXISTS "people_incidents_update_gate" ON public.people_incidents;
DROP POLICY IF EXISTS "wk_head_rh_create" ON public.people_incidents;
DROP POLICY IF EXISTS "wk_head_rh_delete" ON public.people_incidents;
DROP POLICY IF EXISTS "wk_head_rh_update" ON public.people_incidents;
DROP POLICY IF EXISTS "wk_head_rh_view" ON public.people_incidents;
CREATE POLICY hr_child_view ON public.people_incidents FOR SELECT TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.incidents','view',created_by,assigned_to));
CREATE POLICY hr_child_create ON public.people_incidents FOR INSERT TO authenticated WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.incidents','create',created_by,assigned_to));
CREATE POLICY hr_child_update ON public.people_incidents FOR UPDATE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.incidents','update',created_by,assigned_to)) WITH CHECK(public.hr_person_resource_access(workspace_id,person_id,'techpeople.incidents','update',created_by,assigned_to));
CREATE POLICY hr_child_delete ON public.people_incidents FOR DELETE TO authenticated USING(public.hr_person_resource_access(workspace_id,person_id,'techpeople.incidents','delete',created_by,assigned_to));
DROP TRIGGER IF EXISTS zzz_hr_child_links_guard ON public.people_incidents;
CREATE TRIGGER zzz_hr_child_links_guard BEFORE INSERT OR UPDATE ON public.people_incidents FOR EACH ROW EXECUTE FUNCTION public.hr_child_links_guard();
DROP POLICY IF EXISTS "people_events_ws_select" ON public.people_events;
DROP POLICY IF EXISTS "people_events_ws_write" ON public.people_events;
DROP POLICY IF EXISTS "wk_head_rh_create" ON public.people_events;
DROP POLICY IF EXISTS "wk_head_rh_delete" ON public.people_events;
DROP POLICY IF EXISTS "wk_head_rh_update" ON public.people_events;
CREATE POLICY hr_child_view ON public.people_events FOR SELECT TO authenticated USING(public.hr_child_record_access('events','view',id));
DROP POLICY IF EXISTS "alloc_splits_select" ON public.people_allocation_company_splits;
DROP POLICY IF EXISTS "alloc_splits_write" ON public.people_allocation_company_splits;
CREATE POLICY hr_child_view ON public.people_allocation_company_splits FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.people_allocations a WHERE a.id=allocation_id AND a.workspace_id=people_allocation_company_splits.workspace_id AND public.hr_child_record_access('allocations','view',a.id)));
CREATE POLICY hr_child_create ON public.people_allocation_company_splits FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.people_allocations a WHERE a.id=allocation_id AND a.workspace_id=people_allocation_company_splits.workspace_id AND (public.hr_child_record_access('allocations','update',a.id) OR (a.owner_id=auth.uid() AND public.hr_child_record_access('allocations','create',a.id)))));
CREATE POLICY hr_child_update ON public.people_allocation_company_splits FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.people_allocations a WHERE a.id=allocation_id AND a.workspace_id=people_allocation_company_splits.workspace_id AND public.hr_child_record_access('allocations','update',a.id))) WITH CHECK(EXISTS(SELECT 1 FROM public.people_allocations a WHERE a.id=allocation_id AND a.workspace_id=people_allocation_company_splits.workspace_id AND public.hr_child_record_access('allocations','update',a.id)));
CREATE POLICY hr_child_delete ON public.people_allocation_company_splits FOR DELETE TO authenticated USING(EXISTS(SELECT 1 FROM public.people_allocations a WHERE a.id=allocation_id AND a.workspace_id=people_allocation_company_splits.workspace_id AND public.hr_child_record_access('allocations','update',a.id)));

-- Legacy helpers now mean their own resource, never access to wellbeing/benefits.
CREATE OR REPLACE FUNCTION public.can_view_person(_person_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.hr_record_access('people','view',_person_id) $$;
CREATE OR REPLACE FUNCTION public.can_manage_person(_person_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.hr_record_access('people','update',_person_id) $$;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.view.own','techpeople','documents','view','own','documents — view (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.view.team','techpeople','documents','view','team','documents — view (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.view.workspace','techpeople','documents','view','workspace','documents — view (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.create.own','techpeople','documents','create','own','documents — create (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.create.workspace','techpeople','documents','create','workspace','documents — create (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.update.own','techpeople','documents','update','own','documents — update (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.update.team','techpeople','documents','update','team','documents — update (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.update.workspace','techpeople','documents','update','workspace','documents — update (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.delete.own','techpeople','documents','delete','own','documents — delete (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.delete.team','techpeople','documents','delete','team','documents — delete (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.documents.delete.workspace','techpeople','documents','delete','workspace','documents — delete (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.view.own','techpeople','benefits','view','own','benefits — view (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.view.team','techpeople','benefits','view','team','benefits — view (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.view.workspace','techpeople','benefits','view','workspace','benefits — view (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.create.own','techpeople','benefits','create','own','benefits — create (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.create.workspace','techpeople','benefits','create','workspace','benefits — create (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.update.own','techpeople','benefits','update','own','benefits — update (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.update.team','techpeople','benefits','update','team','benefits — update (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.update.workspace','techpeople','benefits','update','workspace','benefits — update (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.delete.own','techpeople','benefits','delete','own','benefits — delete (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.delete.team','techpeople','benefits','delete','team','benefits — delete (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.benefits.delete.workspace','techpeople','benefits','delete','workspace','benefits — delete (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.view.own','techpeople','allocations','view','own','allocations — view (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.view.team','techpeople','allocations','view','team','allocations — view (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.view.workspace','techpeople','allocations','view','workspace','allocations — view (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.create.own','techpeople','allocations','create','own','allocations — create (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.create.workspace','techpeople','allocations','create','workspace','allocations — create (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.update.own','techpeople','allocations','update','own','allocations — update (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.update.team','techpeople','allocations','update','team','allocations — update (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.update.workspace','techpeople','allocations','update','workspace','allocations — update (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.delete.own','techpeople','allocations','delete','own','allocations — delete (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.delete.team','techpeople','allocations','delete','team','allocations — delete (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.allocations.delete.workspace','techpeople','allocations','delete','workspace','allocations — delete (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.view.own','techpeople','goals','view','own','goals — view (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.view.team','techpeople','goals','view','team','goals — view (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.view.workspace','techpeople','goals','view','workspace','goals — view (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.create.own','techpeople','goals','create','own','goals — create (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.create.workspace','techpeople','goals','create','workspace','goals — create (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.update.own','techpeople','goals','update','own','goals — update (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.update.team','techpeople','goals','update','team','goals — update (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.update.workspace','techpeople','goals','update','workspace','goals — update (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.delete.own','techpeople','goals','delete','own','goals — delete (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.delete.team','techpeople','goals','delete','team','goals — delete (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.goals.delete.workspace','techpeople','goals','delete','workspace','goals — delete (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.view.own','techpeople','one_on_ones','view','own','one_on_ones — view (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.view.team','techpeople','one_on_ones','view','team','one_on_ones — view (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.view.workspace','techpeople','one_on_ones','view','workspace','one_on_ones — view (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.create.own','techpeople','one_on_ones','create','own','one_on_ones — create (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.create.workspace','techpeople','one_on_ones','create','workspace','one_on_ones — create (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.update.own','techpeople','one_on_ones','update','own','one_on_ones — update (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.update.team','techpeople','one_on_ones','update','team','one_on_ones — update (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.update.workspace','techpeople','one_on_ones','update','workspace','one_on_ones — update (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.delete.own','techpeople','one_on_ones','delete','own','one_on_ones — delete (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.delete.team','techpeople','one_on_ones','delete','team','one_on_ones — delete (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.one_on_ones.delete.workspace','techpeople','one_on_ones','delete','workspace','one_on_ones — delete (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.view.own','techpeople','reviews','view','own','reviews — view (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.view.team','techpeople','reviews','view','team','reviews — view (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.view.workspace','techpeople','reviews','view','workspace','reviews — view (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.create.own','techpeople','reviews','create','own','reviews — create (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.create.workspace','techpeople','reviews','create','workspace','reviews — create (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.update.own','techpeople','reviews','update','own','reviews — update (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.update.team','techpeople','reviews','update','team','reviews — update (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.update.workspace','techpeople','reviews','update','workspace','reviews — update (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.delete.own','techpeople','reviews','delete','own','reviews — delete (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.delete.team','techpeople','reviews','delete','team','reviews — delete (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.reviews.delete.workspace','techpeople','reviews','delete','workspace','reviews — delete (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.view.own','techpeople','wellbeing.assessments','view','own','assessments — view (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.view.team','techpeople','wellbeing.assessments','view','team','assessments — view (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.view.workspace','techpeople','wellbeing.assessments','view','workspace','assessments — view (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.create.own','techpeople','wellbeing.assessments','create','own','assessments — create (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.create.workspace','techpeople','wellbeing.assessments','create','workspace','assessments — create (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.update.own','techpeople','wellbeing.assessments','update','own','assessments — update (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.update.team','techpeople','wellbeing.assessments','update','team','assessments — update (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.update.workspace','techpeople','wellbeing.assessments','update','workspace','assessments — update (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.delete.own','techpeople','wellbeing.assessments','delete','own','assessments — delete (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.delete.team','techpeople','wellbeing.assessments','delete','team','assessments — delete (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.wellbeing.assessments.delete.workspace','techpeople','wellbeing.assessments','delete','workspace','assessments — delete (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.view.own','techpeople','incidents','view','own','incidents — view (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.view.team','techpeople','incidents','view','team','incidents — view (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.view.workspace','techpeople','incidents','view','workspace','incidents — view (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.create.own','techpeople','incidents','create','own','incidents — create (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.create.workspace','techpeople','incidents','create','workspace','incidents — create (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.update.own','techpeople','incidents','update','own','incidents — update (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.update.team','techpeople','incidents','update','team','incidents — update (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.update.workspace','techpeople','incidents','update','workspace','incidents — update (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.delete.own','techpeople','incidents','delete','own','incidents — delete (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.delete.team','techpeople','incidents','delete','team','incidents — delete (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.incidents.delete.workspace','techpeople','incidents','delete','workspace','incidents — delete (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.events.view.own','techpeople','events','view','own','events — view (own)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.events.view.team','techpeople','events','view','team','events — view (team)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt) VALUES('techpeople.events.view.workspace','techpeople','events','view','workspace','events — view (workspace)') ON CONFLICT(key) DO NOTHING;
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid,'aaaaaaaa-0000-4000-8000-000000000004'::uuid,p.key,'grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688'::uuid FROM public.permissions p WHERE p.module='techpeople'
ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;
REVOKE ALL ON FUNCTION public.hr_child_links_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hr_person_resource_access(uuid,uuid,text,text,uuid,uuid),public.hr_child_record_access(text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_person_resource_access(uuid,uuid,text,text,uuid,uuid),public.hr_child_record_access(text,text,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.hr_record_capabilities(_resource text,_ids uuid[])
RETURNS TABLE(id uuid,can_view boolean,can_update boolean,can_delete boolean,can_create_child boolean,can_edit_settings boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF _resource NOT IN('people','candidates','onboarding_plans','onboarding_tasks','onboarding_templates','documents','benefits','allocations','goals','one_on_ones','reviews','assessments','incidents','events','person_documents','person_benefits','person_allocations','person_goals','person_one_on_ones','person_reviews','person_assessments','person_incidents','person_events')
   OR _resource IS NULL OR _ids IS NULL OR cardinality(_ids)>200 THEN
   RAISE EXCEPTION 'Invalid capability request' USING ERRCODE='22023';
 END IF;
 FOR id IN SELECT DISTINCT v FROM unnest(_ids) v WHERE v IS NOT NULL LOOP
   can_view:=public.hr_record_access(_resource,'view',id);
   can_update:=can_view AND public.hr_record_access(_resource,'update',id);
   can_delete:=can_view AND public.hr_record_access(_resource,'delete',id);
   can_create_child:=can_view AND (_resource='onboarding_plans' OR left(_resource,7)='person_') AND public.hr_record_access(_resource,'create',id);
   can_edit_settings:=can_update;
   IF _resource='onboarding_tasks' THEN
     -- Assignees may update status; editing task settings requires plan update.
     can_edit_settings:=can_update AND COALESCE((SELECT public.hr_record_access('onboarding_plans','update',t.plan_id)
       FROM public.people_onboarding_tasks t WHERE t.id=hr_record_capabilities.id),false);
   END IF;
   RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.hr_record_capabilities(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_record_capabilities(text,uuid[]) TO authenticated;

-- Split rows cannot change tenant/allocation or link a company from another workspace.
CREATE OR REPLACE FUNCTION public.hr_allocation_split_links_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE expected_workspace uuid;
BEGIN
 SELECT workspace_id INTO expected_workspace FROM public.people_allocations WHERE id=NEW.allocation_id;
 IF expected_workspace IS NULL OR NEW.workspace_id IS DISTINCT FROM expected_workspace
   OR NOT EXISTS(SELECT 1 FROM public.companies c WHERE c.id=NEW.company_id AND c.workspace_id=expected_workspace) THEN
   RAISE EXCEPTION 'Alocação, empresa e rateio devem pertencer ao mesmo workspace.' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND (OLD.workspace_id IS DISTINCT FROM NEW.workspace_id OR OLD.allocation_id IS DISTINCT FROM NEW.allocation_id OR OLD.created_by IS DISTINCT FROM NEW.created_by) THEN
   RAISE EXCEPTION 'Workspace, alocação e autoria são imutáveis.' USING ERRCODE='42501';
 END IF;
 IF TG_OP='INSERT' AND auth.uid() IS NOT NULL THEN NEW.created_by:=auth.uid(); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hr_allocation_split_links_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS zzz_hr_split_links_guard ON public.people_allocation_company_splits;
CREATE TRIGGER zzz_hr_split_links_guard BEFORE INSERT OR UPDATE ON public.people_allocation_company_splits FOR EACH ROW EXECUTE FUNCTION public.hr_allocation_split_links_guard();
