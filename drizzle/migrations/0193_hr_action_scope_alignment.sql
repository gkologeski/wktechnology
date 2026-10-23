-- Stage 3, batch 1: person/candidate CRUD and onboarding action/scope boundaries.
-- Reuse catalog keys; no role grants, defaults, business data or column defaults change.
CREATE OR REPLACE FUNCTION public.hr_team_contains(_workspace uuid,_users uuid[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.my_team_member_pairs() t
   WHERE t.workspace_id=_workspace AND t.user_id=ANY(_users))
$$;

CREATE OR REPLACE FUNCTION public.hr_scope_permission(_workspace uuid,_resource text,_action text,_own boolean,_team boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(auth.uid() IS NOT NULL
   AND _resource IN('techpeople.people','techpeople.onboarding','techpeople.offboarding','techpeople.onboarding_templates','techhire.candidates')
   AND _action IN('view','create','update','delete')
   AND public.is_workspace_member(_workspace,auth.uid())
   AND _workspace IN(SELECT public.current_user_workspaces())
   AND (_action='view' OR NOT public.is_read_only_view())
   AND (public.user_has_permission(auth.uid(),_workspace,_resource||'.'||_action||'.workspace')
     OR (COALESCE(_own,false) AND public.user_has_permission(auth.uid(),_workspace,_resource||'.'||_action||'.own'))
     OR (COALESCE(_team,false) AND public.user_has_permission(auth.uid(),_workspace,_resource||'.'||_action||'.team'))),false)
$$;

CREATE OR REPLACE FUNCTION public.hr_people_access(_workspace uuid,_action text,_profile uuid,_manager uuid,_responsible uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.hr_scope_permission(_workspace,'techpeople.people',_action,
   _profile=auth.uid() OR _responsible=auth.uid(),
   public.hr_team_contains(_workspace,ARRAY[_responsible,_profile]) OR _manager=auth.uid()
   OR EXISTS(SELECT 1 FROM public.people manager WHERE manager.id=_manager
     AND manager.workspace_id=_workspace AND manager.profile_id=auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.hr_onboarding_access(_workspace uuid,_kind text,_action text,_owner uuid,_person uuid,_template uuid,_assignee uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(_kind IN('onboarding','offboarding') AND EXISTS(
   SELECT 1 FROM public.people person WHERE person.id=_person AND person.workspace_id=_workspace
     AND public.hr_people_access(_workspace,'view',person.profile_id,person.manager_id,COALESCE(person.assigned_to,person.created_by,person.owner_id))
     AND public.hr_scope_permission(_workspace,'techpeople.'||_kind,_action,
       _owner=auth.uid() OR person.profile_id=auth.uid() OR _assignee=auth.uid(),
       public.hr_team_contains(_workspace,ARRAY[_owner,person.profile_id,COALESCE(person.assigned_to,person.created_by,person.owner_id)])
       OR person.manager_id=auth.uid() OR EXISTS(SELECT 1 FROM public.people manager
         WHERE manager.id=person.manager_id AND manager.workspace_id=_workspace AND manager.profile_id=auth.uid())))
   AND (_template IS NULL OR EXISTS(SELECT 1 FROM public.people_onboarding_templates t
     WHERE t.id=_template AND t.workspace_id=_workspace AND t.kind=_kind)),false)
$$;

CREATE OR REPLACE FUNCTION public.hr_task_access(_workspace uuid,_plan uuid,_action text,_assignee uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT public.hr_onboarding_access(p.workspace_id,p.kind,_action,COALESCE(p.assigned_to,p.owner_id),p.person_id,p.template_id,CASE WHEN _action='create' THEN NULL ELSE _assignee END)
   FROM public.people_onboarding_plans p WHERE p.id=_plan AND p.workspace_id=_workspace),false)
$$;

-- Read-only predicate shared by the authenticated server and direct SQL/RLS.
-- It returns a boolean only, never row contents; caller identity is auth.uid().
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
 ELSE RETURN false;
 END CASE;
 RETURN COALESCE(allowed,false);
END $$;

DO $policies$
DECLARE r record;
BEGIN
 FOR r IN SELECT c.relname,p.polname FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND p.polpermissive
   AND c.relname IN('people','ats_candidates','people_onboarding_plans','people_onboarding_tasks','people_onboarding_templates')
 LOOP EXECUTE format('DROP POLICY %I ON public.%I',r.polname,r.relname); END LOOP;
END $policies$;
CREATE POLICY hr_view ON public.people FOR SELECT TO authenticated
 USING (public.hr_people_access(workspace_id,'view',profile_id,manager_id,COALESCE(assigned_to,created_by,owner_id)));
CREATE POLICY hr_create ON public.people FOR INSERT TO authenticated
 WITH CHECK (public.hr_people_access(workspace_id,'create',profile_id,manager_id,COALESCE(assigned_to,created_by,owner_id)) AND (public.user_has_permission(auth.uid(),workspace_id,'techpeople.people.create.workspace') OR COALESCE(assigned_to,created_by,owner_id)=auth.uid()));
CREATE POLICY hr_update ON public.people FOR UPDATE TO authenticated
 USING (public.hr_people_access(workspace_id,'update',profile_id,manager_id,COALESCE(assigned_to,created_by,owner_id))) WITH CHECK (public.hr_people_access(workspace_id,'update',profile_id,manager_id,COALESCE(assigned_to,created_by,owner_id)));
CREATE POLICY hr_delete ON public.people FOR DELETE TO authenticated
 USING (public.hr_people_access(workspace_id,'delete',profile_id,manager_id,COALESCE(assigned_to,created_by,owner_id)));
CREATE POLICY hr_view ON public.ats_candidates FOR SELECT TO authenticated
 USING (public.hr_scope_permission(workspace_id,'techhire.candidates','view',COALESCE(assigned_to,owner_id)=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[COALESCE(assigned_to,owner_id)])));
CREATE POLICY hr_create ON public.ats_candidates FOR INSERT TO authenticated
 WITH CHECK (public.hr_scope_permission(workspace_id,'techhire.candidates','create',COALESCE(assigned_to,owner_id)=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[COALESCE(assigned_to,owner_id)])) AND owner_id=auth.uid() AND COALESCE(assigned_to,owner_id)=auth.uid());
CREATE POLICY hr_update ON public.ats_candidates FOR UPDATE TO authenticated
 USING (public.hr_scope_permission(workspace_id,'techhire.candidates','update',COALESCE(assigned_to,owner_id)=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[COALESCE(assigned_to,owner_id)]))) WITH CHECK (public.hr_scope_permission(workspace_id,'techhire.candidates','update',COALESCE(assigned_to,owner_id)=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[COALESCE(assigned_to,owner_id)])));
CREATE POLICY hr_delete ON public.ats_candidates FOR DELETE TO authenticated
 USING (public.hr_scope_permission(workspace_id,'techhire.candidates','delete',COALESCE(assigned_to,owner_id)=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[COALESCE(assigned_to,owner_id)])));
CREATE POLICY hr_view ON public.people_onboarding_plans FOR SELECT TO authenticated
 USING (public.hr_onboarding_access(workspace_id,kind,'view',COALESCE(assigned_to,owner_id),person_id,template_id));
CREATE POLICY hr_create ON public.people_onboarding_plans FOR INSERT TO authenticated
 WITH CHECK (public.hr_onboarding_access(workspace_id,kind,'create',COALESCE(assigned_to,owner_id),person_id,template_id) AND owner_id=auth.uid());
CREATE POLICY hr_update ON public.people_onboarding_plans FOR UPDATE TO authenticated
 USING (public.hr_onboarding_access(workspace_id,kind,'update',COALESCE(assigned_to,owner_id),person_id,template_id)) WITH CHECK (public.hr_onboarding_access(workspace_id,kind,'update',COALESCE(assigned_to,owner_id),person_id,template_id));
CREATE POLICY hr_delete ON public.people_onboarding_plans FOR DELETE TO authenticated
 USING (public.hr_onboarding_access(workspace_id,kind,'delete',COALESCE(assigned_to,owner_id),person_id,template_id));
CREATE POLICY hr_view ON public.people_onboarding_tasks FOR SELECT TO authenticated
 USING (public.hr_task_access(workspace_id,plan_id,'view',assignee_id));
CREATE POLICY hr_create ON public.people_onboarding_tasks FOR INSERT TO authenticated
 WITH CHECK (public.hr_task_access(workspace_id,plan_id,'create',assignee_id));
CREATE POLICY hr_update ON public.people_onboarding_tasks FOR UPDATE TO authenticated
 USING (public.hr_task_access(workspace_id,plan_id,'update',assignee_id)) WITH CHECK (public.hr_task_access(workspace_id,plan_id,'update',assignee_id));
CREATE POLICY hr_delete ON public.people_onboarding_tasks FOR DELETE TO authenticated
 USING (public.hr_task_access(workspace_id,plan_id,'delete',assignee_id));
CREATE POLICY hr_view ON public.people_onboarding_templates FOR SELECT TO authenticated
 USING (public.hr_scope_permission(workspace_id,'techpeople.onboarding_templates','view',owner_id=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[owner_id])));
CREATE POLICY hr_create ON public.people_onboarding_templates FOR INSERT TO authenticated
 WITH CHECK (public.hr_scope_permission(workspace_id,'techpeople.onboarding_templates','create',owner_id=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[owner_id])) AND owner_id=auth.uid());
CREATE POLICY hr_update ON public.people_onboarding_templates FOR UPDATE TO authenticated
 USING (public.hr_scope_permission(workspace_id,'techpeople.onboarding_templates','update',owner_id=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[owner_id]))) WITH CHECK (public.hr_scope_permission(workspace_id,'techpeople.onboarding_templates','update',owner_id=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[owner_id])));
CREATE POLICY hr_delete ON public.people_onboarding_templates FOR DELETE TO authenticated
 USING (public.hr_scope_permission(workspace_id,'techpeople.onboarding_templates','delete',owner_id=auth.uid(),public.hr_team_contains(workspace_id,ARRAY[owner_id])));

CREATE OR REPLACE FUNCTION public.hr_record_links_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old jsonb; v_new jsonb:=to_jsonb(NEW); v_key text; v_plan public.people_onboarding_plans%ROWTYPE;
BEGIN
 -- SQL maintenance and internal services are explicit exceptions; user calls
 -- through SECURITY DEFINER RPCs still carry auth.uid and are checked.
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
   v_old:=to_jsonb(OLD);
   IF (v_old->'workspace_id') IS DISTINCT FROM (v_new->'workspace_id')
      OR (v_old->'owner_id') IS DISTINCT FROM (v_new->'owner_id')
      OR (v_old->'created_by') IS DISTINCT FROM (v_new->'created_by') THEN
     RAISE EXCEPTION 'A origem e o workspace do registro não podem ser alterados.' USING ERRCODE='42501';
   END IF;
 END IF;
 IF TG_TABLE_NAME='people' THEN
   IF TG_OP='INSERT' THEN
     IF NEW.created_by IS NOT NULL AND NEW.created_by<>auth.uid() THEN RAISE EXCEPTION 'Autor da pessoa inválido.' USING ERRCODE='42501'; END IF;
     NEW.created_by:=auth.uid();
     IF NEW.assigned_to IS NULL OR NEW.assigned_to=NEW.workspace_id THEN NEW.assigned_to:=auth.uid(); END IF;
     v_new:=to_jsonb(NEW);
   END IF;
   IF TG_OP='UPDATE' AND (EXISTS(SELECT 1 FROM unnest(ARRAY['profile_id','manager_id','candidate_id']) k
       WHERE (v_old->k) IS DISTINCT FROM (v_new->k))
       OR COALESCE(NEW.assigned_to,NEW.created_by,NEW.owner_id) IS DISTINCT FROM COALESCE(OLD.assigned_to,OLD.created_by,OLD.owner_id))
      AND NOT public.user_has_permission(auth.uid(),NEW.workspace_id,'techpeople.people.update.workspace') THEN
     RAISE EXCEPTION 'Você não tem permissão para alterar vínculos da pessoa.' USING ERRCODE='42501';
   END IF;
   IF TG_OP='INSERT' AND NEW.profile_id IS NOT NULL AND NEW.profile_id<>auth.uid()
      AND NOT public.user_has_permission(auth.uid(),NEW.workspace_id,'techpeople.people.create.workspace') THEN
     RAISE EXCEPTION 'Você não tem permissão para vincular outro perfil.' USING ERRCODE='42501';
   END IF;
   FOREACH v_key IN ARRAY ARRAY['profile_id','assigned_to'] LOOP
     IF v_new->>v_key IS NOT NULL AND (TG_OP='INSERT' OR (v_old->v_key) IS DISTINCT FROM (v_new->v_key))
       AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=(v_new->>v_key)::uuid) THEN
       RAISE EXCEPTION 'O usuário vinculado não pertence ao workspace.' USING ERRCODE='23514';
     END IF;
   END LOOP;
   IF NEW.candidate_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id)
      AND NOT EXISTS(SELECT 1 FROM public.ats_candidates c WHERE c.id=NEW.candidate_id AND c.workspace_id=NEW.workspace_id) THEN
     RAISE EXCEPTION 'Candidato de outro workspace.' USING ERRCODE='23514';
   END IF;
   IF NEW.manager_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.manager_id IS DISTINCT FROM OLD.manager_id)
      AND NOT EXISTS(SELECT 1 FROM public.people p WHERE p.id=NEW.manager_id AND p.workspace_id=NEW.workspace_id)
      AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=NEW.manager_id) THEN
     RAISE EXCEPTION 'Gestor de outro workspace.' USING ERRCODE='23514';
   END IF;
 ELSIF TG_TABLE_NAME='ats_candidates' THEN
   IF TG_OP='UPDATE' AND (COALESCE(NEW.assigned_to,NEW.owner_id) IS DISTINCT FROM COALESCE(OLD.assigned_to,OLD.owner_id)
       OR NEW.relationship_owner_id IS DISTINCT FROM OLD.relationship_owner_id)
      AND NOT public.user_has_permission(auth.uid(),NEW.workspace_id,'techhire.candidates.assign.workspace') THEN
     RAISE EXCEPTION 'Você não tem permissão para reatribuir o candidato.' USING ERRCODE='42501';
   END IF;
   FOREACH v_key IN ARRAY ARRAY['assigned_to','relationship_owner_id'] LOOP
     IF v_new->>v_key IS NOT NULL AND (TG_OP='INSERT' OR (v_old->v_key) IS DISTINCT FROM (v_new->v_key))
       AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=(v_new->>v_key)::uuid) THEN
       RAISE EXCEPTION 'Responsável de outro workspace.' USING ERRCODE='23514';
     END IF;
   END LOOP;
 ELSIF TG_TABLE_NAME='people_onboarding_plans' THEN
   IF TG_OP='UPDATE' AND (NEW.person_id IS DISTINCT FROM OLD.person_id OR NEW.kind IS DISTINCT FROM OLD.kind
      OR COALESCE(NEW.assigned_to,NEW.owner_id) IS DISTINCT FROM COALESCE(OLD.assigned_to,OLD.owner_id)) THEN
     RAISE EXCEPTION 'Pessoa, tipo e responsável do plano não podem ser alterados.' USING ERRCODE='42501';
   END IF;
   IF NEW.assigned_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=NEW.assigned_to) THEN
     RAISE EXCEPTION 'Responsável de outro workspace.' USING ERRCODE='23514';
   END IF;
 ELSIF TG_TABLE_NAME='people_onboarding_templates' THEN
   IF TG_OP='UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind AND EXISTS(SELECT 1 FROM public.people_onboarding_plans p WHERE p.template_id=NEW.id) THEN
     RAISE EXCEPTION 'O tipo de um modelo utilizado por planos não pode ser alterado.' USING ERRCODE='23514';
   END IF;
 ELSIF TG_TABLE_NAME='people_onboarding_tasks' THEN
   IF TG_OP='UPDATE' AND NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
     RAISE EXCEPTION 'A tarefa não pode ser movida para outro plano.' USING ERRCODE='42501';
   END IF;
   SELECT * INTO v_plan FROM public.people_onboarding_plans WHERE id=NEW.plan_id AND workspace_id=NEW.workspace_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Plano de outro workspace ou inexistente.' USING ERRCODE='23514'; END IF;
   IF TG_OP='UPDATE' AND NOT public.hr_onboarding_access(v_plan.workspace_id,v_plan.kind,'update',COALESCE(v_plan.assigned_to,v_plan.owner_id),v_plan.person_id,v_plan.template_id)
      AND (v_old-ARRAY['status','completed_at','completed_by','updated_at']) IS DISTINCT FROM (v_new-ARRAY['status','completed_at','completed_by','updated_at']) THEN
     RAISE EXCEPTION 'O responsável pela tarefa só pode atualizar seu andamento.' USING ERRCODE='42501';
   END IF;
   IF NEW.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
     AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=NEW.assignee_id) THEN
     RAISE EXCEPTION 'Responsável de outro workspace.' USING ERRCODE='23514';
   END IF;
   IF NEW.completed_by IS NOT NULL AND (TG_OP='INSERT' OR NEW.completed_by IS DISTINCT FROM OLD.completed_by) AND NEW.completed_by<>auth.uid() THEN
     RAISE EXCEPTION 'O autor da conclusão deve ser o usuário autenticado.' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_hr_record_links_guard BEFORE INSERT OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.hr_record_links_guard();
CREATE TRIGGER zzz_hr_record_links_guard BEFORE INSERT OR UPDATE ON public.ats_candidates FOR EACH ROW EXECUTE FUNCTION public.hr_record_links_guard();
CREATE TRIGGER zzz_hr_record_links_guard BEFORE INSERT OR UPDATE ON public.people_onboarding_plans FOR EACH ROW EXECUTE FUNCTION public.hr_record_links_guard();
CREATE TRIGGER zzz_hr_record_links_guard BEFORE INSERT OR UPDATE ON public.people_onboarding_tasks FOR EACH ROW EXECUTE FUNCTION public.hr_record_links_guard();
REVOKE ALL ON FUNCTION public.hr_task_access(uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_task_access(uuid,uuid,text,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_team_contains(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_team_contains(uuid,uuid[]) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_scope_permission(uuid,text,text,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_scope_permission(uuid,text,text,boolean,boolean) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_people_access(uuid,text,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_people_access(uuid,text,uuid,uuid,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_onboarding_access(uuid,text,text,uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_onboarding_access(uuid,text,text,uuid,uuid,uuid,uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.hr_record_access(text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_record_access(text,text,uuid) TO authenticated,service_role;
CREATE TRIGGER zzz_hr_record_links_guard BEFORE INSERT OR UPDATE ON public.people_onboarding_templates FOR EACH ROW EXECUTE FUNCTION public.hr_record_links_guard();
REVOKE ALL ON FUNCTION public.hr_record_links_guard() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst, 'reload schema';

-- One transaction for the plan and every materialized task. Errors roll back all.
CREATE OR REPLACE FUNCTION public.hr_create_onboarding_plan(
 _person uuid,_kind text,_template uuid DEFAULT NULL,_status text DEFAULT 'in_progress',
 _started date DEFAULT NULL,_target date DEFAULT NULL,_notes text DEFAULT NULL,_automatic boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE p record; t record; v_id uuid; v_items jsonb:='[]'; v_start date:=COALESCE(_started,CURRENT_DATE); v_count integer:=0;
BEGIN
 SELECT id,workspace_id INTO p FROM public.people WHERE id=_person;
 IF NOT FOUND OR NOT public.hr_onboarding_access(p.workspace_id,_kind,'create',auth.uid(),_person,_template) THEN
   RAISE EXCEPTION 'Você não tem permissão para criar este plano.' USING ERRCODE='42501';
 END IF;
 IF _status IS NULL OR _status NOT IN('not_started','in_progress','completed','canceled') OR length(_notes)>4000 THEN
   RAISE EXCEPTION 'Dados do plano inválidos.' USING ERRCODE='22023';
 END IF;
 IF _automatic THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(p.workspace_id::text||_person::text||_kind,0));
   SELECT id INTO v_id FROM public.people_onboarding_plans WHERE person_id=_person AND workspace_id=p.workspace_id AND kind=_kind ORDER BY created_at LIMIT 1;
   IF FOUND THEN RETURN jsonb_build_object('id',v_id,'existed',true,'task_count',0); END IF;
 END IF;
 IF _template IS NOT NULL THEN
   SELECT items INTO v_items FROM public.people_onboarding_templates WHERE id=_template AND workspace_id=p.workspace_id AND kind=_kind;
   IF NOT FOUND THEN RAISE EXCEPTION 'Modelo indisponível para este plano.' USING ERRCODE='42501'; END IF;
   IF jsonb_typeof(v_items)<>'array' OR jsonb_array_length(v_items)>500 THEN
     RAISE EXCEPTION 'Modelo de tarefas inválido.' USING ERRCODE='22023';
   END IF;
 END IF;
 INSERT INTO public.people_onboarding_plans(workspace_id,owner_id,assigned_to,person_id,template_id,kind,status,started_at,target_completion_date,notes,completed_at)
 VALUES(p.workspace_id,auth.uid(),auth.uid(),_person,_template,_kind,_status,v_start,_target,_notes,CASE WHEN _status='completed' THEN now() ELSE NULL END) RETURNING id INTO v_id;
 FOR t IN SELECT value,ordinality FROM jsonb_array_elements(v_items) WITH ORDINALITY LOOP
   IF jsonb_typeof(t.value)<>'object' OR COALESCE(length(t.value->>'title'),0) NOT BETWEEN 1 AND 200 THEN
     RAISE EXCEPTION 'Título de tarefa inválido no modelo.' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.people_onboarding_tasks(workspace_id,plan_id,title,description,category,due_date,order_index,status,is_critical,revocation_system)
   VALUES(p.workspace_id,v_id,t.value->>'title',t.value->>'description',t.value->>'category',
     CASE WHEN t.value->>'due_offset_days' IS NULL THEN NULL ELSE v_start+(t.value->>'due_offset_days')::integer END,
     t.ordinality-1,'pending',COALESCE((t.value->>'is_critical')::boolean,false),t.value->>'revocation_system');
   v_count:=v_count+1;
 END LOOP;
 RETURN jsonb_build_object('id',v_id,'existed',false,'task_count',v_count);
END $$;
REVOKE ALL ON FUNCTION public.hr_create_onboarding_plan(uuid,text,uuid,text,date,date,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.hr_create_onboarding_plan(uuid,text,uuid,text,date,date,text,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
