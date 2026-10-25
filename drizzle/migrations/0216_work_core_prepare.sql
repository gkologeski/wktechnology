-- Order 3, core contracts/projects/tasks. Additive preparation; no grants to roles.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system)
SELECT m||'.'||r||'.assign.workspace',m,r,'assign','workspace',l,'Requer também edição e leitura do registro; destino ativo no mesmo workspace.',true
FROM (VALUES('techcontracts','contracts','Reatribuir contrato'),('techprojects','projects','Reatribuir projeto'))v(m,r,l) ON CONFLICT(key) DO NOTHING;

-- Core context, resolved once per statement by RLS initplans. No cached GUC supplied by callers.
CREATE OR REPLACE FUNCTION public.work_access_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;k jsonb;t jsonb;BEGIN
 IF auth.uid() IS NULL THEN RETURN '{}'::jsonb;END IF;
 IF current_setting('app.api_subject',true)='on' THEN
 SELECT workspace_id INTO w FROM techerp_api.subject_sessions WHERE txid=txid_current_if_assigned() AND user_id=auth.uid();
 ELSE SELECT active_workspace_id INTO w FROM profiles WHERE id=auth.uid();END IF;
 IF w IS NULL OR NOT is_workspace_member(w,auth.uid()) THEN RETURN '{}'::jsonb;END IF;
 SELECT coalesce(jsonb_object_agg(x,true),'{}') INTO k FROM user_effective_permissions(auth.uid(),w)x;
 SELECT coalesce(jsonb_object_agg(x.user_id::text,true),'{}') INTO t FROM my_team_member_pairs()x WHERE x.workspace_id=w;
 RETURN jsonb_build_object('workspace',w,'actor',auth.uid(),'keys',k,'team',t,'read_only',is_read_only_view());
END $$;
CREATE OR REPLACE FUNCTION public.work_context_access(c jsonb,w uuid,r text,a text,responsibles uuid[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'workspace'=w::text AND c->>'actor' IS NOT NULL
 AND r IN('techcontracts.contracts','techprojects.projects','techprojects.tasks')
 AND a IN('view','create','update','delete','export','assign')
 AND (a='view' OR NOT (c->>'read_only')::boolean)
 AND (c->'keys' ? (r||'.'||a||'.workspace')
 OR (c->'keys' ? (r||'.'||a||'.own') AND (c->>'actor')::uuid=ANY(responsibles))
 OR (c->'keys' ? (r||'.'||a||'.team') AND EXISTS(SELECT 1 FROM unnest(responsibles)x WHERE c->'team' ? x::text))),false)
$$;
CREATE OR REPLACE FUNCTION public.work_record_access(r text,i uuid,a text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid;s uuid[];BEGIN
 CASE r
 WHEN 'techcontracts.contracts' THEN SELECT workspace_id,ARRAY[coalesce(assigned_to,owner_id)] INTO w,s FROM contracts WHERE id=i;
 WHEN 'techprojects.projects' THEN SELECT workspace_id,ARRAY[coalesce(assigned_to,owner_id)] INTO w,s FROM projects WHERE id=i;
 WHEN 'techprojects.tasks' THEN SELECT workspace_id,array_append(coalesce(assignee_ids,'{}'),assignee_id) INTO w,s FROM project_tasks WHERE id=i;
 ELSE RETURN false;END CASE;
 RETURN work_context_access(c,w,r,a,s) AND (a='view' OR work_context_access(c,w,r,'view',s));
END $$;
CREATE OR REPLACE FUNCTION public.work_core_capabilities(r text,ids uuid[])
RETURNS TABLE(id uuid,can_view boolean,can_update boolean,can_delete boolean,can_assign boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();t text;s text;BEGIN
 IF cardinality(ids)>500 THEN RAISE EXCEPTION 'Limite excedido.';END IF;
 t:=CASE r WHEN 'techcontracts.contracts' THEN 'contracts' WHEN 'techprojects.projects' THEN 'projects' WHEN 'techprojects.tasks' THEN 'project_tasks' END;
 IF t IS NULL THEN RAISE EXCEPTION 'Recurso inválido.';END IF;
 s:=CASE WHEN t='project_tasks' THEN 'array_append(coalesce(assignee_ids,''{}''),assignee_id)' ELSE 'ARRAY[coalesce(assigned_to,owner_id)]' END;
 RETURN QUERY EXECUTE format('SELECT id,true,work_context_access($1,workspace_id,$2,''update'',%s),work_context_access($1,workspace_id,$2,''delete'',%s),work_context_access($1,workspace_id,$2,''assign'',%s) AND work_context_access($1,workspace_id,$2,''update'',%s) FROM %I WHERE id=ANY($3) AND work_context_access($1,workspace_id,$2,''view'',%s)',s,s,s,s,t,s) USING c,r,ids;
END $$;
CREATE OR REPLACE FUNCTION public.work_time_reference_allowed(c jsonb,w uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'workspace'=w::text AND c->>'actor' IS NOT NULL AND NOT (c->>'read_only')::boolean AND c->'keys' ?| ARRAY['techprojects.time_entries.create.own','techprojects.time_entries.create.workspace'],false)
$$;
-- Minimal task references for an authorized time recorder, independent of full task/project read.
CREATE OR REPLACE FUNCTION public.project_time_task_references(p_project uuid,p_search text DEFAULT NULL)
RETURNS TABLE(id uuid,title text,status text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid;v jsonb;c jsonb:=work_access_context();BEGIN
 w:=(c->>'workspace')::uuid;
 IF NOT work_time_reference_allowed(c,w) THEN RAISE EXCEPTION 'Sem permissão para apontar horas.' USING ERRCODE='42501';END IF;
 v:=project_time_trackable_projects(w);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v->'projects')x WHERE x->>'id'=p_project::text) THEN RAISE EXCEPTION 'Projeto indisponível para apontamento.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT t.id,t.title,t.status::text FROM project_tasks t WHERE t.workspace_id=w AND t.project_id=p_project AND (nullif(trim(p_search),'') IS NULL OR t.title ILIKE '%'||left(trim(p_search),120)||'%') ORDER BY t.updated_at DESC,t.id LIMIT 50;
END $$;
-- Minimal labels only for time entries the caller can read; the same canonical
-- scope as project_time_entries RLS (dashboard equivalence is tested separately).
CREATE OR REPLACE FUNCTION public.project_time_entry_labels(p_ids uuid[])
RETURNS TABLE(id uuid,project_id uuid,project_name text,task_id uuid,task_title text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF cardinality(p_ids)>1000 THEN RAISE EXCEPTION 'Limite excedido.';END IF;
 RETURN QUERY WITH v AS MATERIALIZED(SELECT * FROM project_dash_vis())
 SELECT e.id,p.id,p.name,t.id,t.title FROM project_time_entries e CROSS JOIN v
 LEFT JOIN projects p ON p.id=e.project_id AND p.workspace_id=e.workspace_id
 LEFT JOIN project_tasks t ON t.id=e.task_id AND t.workspace_id=e.workspace_id
 WHERE e.id=ANY(p_ids) AND e.workspace_id=v.ws AND v.te_perm
 AND (e.user_id=v.uid OR v.te_full OR e.project_id=ANY(v.te_led) OR (e.project_id::text||':'||e.user_id::text)=ANY(v.te_pairs));
END $$;
CREATE OR REPLACE FUNCTION public.work_time_project_reference_allowed(p_project uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();v jsonb;w uuid:=(c->>'workspace')::uuid;BEGIN
 IF NOT work_time_reference_allowed(c,w) THEN RETURN false;END IF;
 v:=project_time_trackable_projects(w);
 RETURN EXISTS(SELECT 1 FROM jsonb_array_elements(v->'projects')x WHERE x->>'id'=p_project::text);
END $$;
DO $$ DECLARE f regprocedure;BEGIN
 FOREACH f IN ARRAY ARRAY['project_time_entry_labels(uuid[])'::regprocedure,'work_time_project_reference_allowed(uuid)'::regprocedure,'work_access_context()'::regprocedure,'work_context_access(jsonb,uuid,text,text,uuid[])'::regprocedure,'work_record_access(text,uuid,text)'::regprocedure,'work_core_capabilities(text,uuid[])'::regprocedure,'work_time_reference_allowed(jsonb,uuid)'::regprocedure,'project_time_task_references(uuid,text)'::regprocedure] LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
