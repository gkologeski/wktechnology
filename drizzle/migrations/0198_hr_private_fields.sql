-- Phase 1: independent private-field permissions and caller-bound access. Column
-- SELECT ACLs are tightened only after all readers have migrated and deployed.
CREATE OR REPLACE FUNCTION public.hr_private_row_allowed(_resource text,_action text,_row jsonb,_new boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); w uuid:=(_row->>'workspace_id')::uuid; p jsonb; base text; own_scope boolean; team_scope boolean; primary_ok boolean;
BEGIN
 IF actor IS NULL OR _row IS NULL OR _resource NOT IN('people_sensitive','one_on_ones_private','allocations_financial')
   OR _action NOT IN('view','update') OR NOT public.is_workspace_member(w,actor)
   OR w IS DISTINCT FROM (SELECT active_workspace_id FROM public.profiles WHERE id=actor)
   OR w NOT IN(SELECT public.current_user_workspaces()) OR (_action='update' AND public.is_read_only_view()) THEN RETURN false; END IF;
 IF _resource='people_sensitive' THEN
   p:=_row;
   primary_ok:=public.hr_people_access(w,CASE WHEN _new THEN 'create' ELSE _action END,
     (p->>'profile_id')::uuid,(p->>'manager_id')::uuid,COALESCE(p->>'assigned_to',p->>'created_by',p->>'owner_id')::uuid);
 ELSE
   base:=CASE _resource WHEN 'one_on_ones_private' THEN 'one_on_ones' ELSE 'allocations' END;
   SELECT to_jsonb(t) INTO p FROM public.people t WHERE t.id=(_row->>'person_id')::uuid AND t.workspace_id=w;
   primary_ok:=public.hr_person_resource_access(w,(_row->>'person_id')::uuid,'techpeople.'||base,
     CASE WHEN _new THEN 'create' ELSE _action END,(_row->>'created_by')::uuid,(_row->>'assigned_to')::uuid);
 END IF;
 IF p IS NULL OR NOT COALESCE(primary_ok,false) THEN RETURN false; END IF;
 IF _action='update' AND NOT public.hr_private_row_allowed(_resource,'view',_row,_new) THEN RETURN false; END IF;
 own_scope:=(p->>'profile_id')::uuid=actor OR COALESCE(p->>'assigned_to',p->>'created_by',p->>'owner_id')::uuid=actor
   OR (NOT _new AND _resource<>'people_sensitive' AND actor IN((_row->>'created_by')::uuid,(_row->>'assigned_to')::uuid));
 team_scope:=public.hr_team_contains(w,ARRAY[(p->>'profile_id')::uuid,COALESCE(p->>'assigned_to',p->>'created_by',p->>'owner_id')::uuid,
   CASE WHEN NOT _new THEN (_row->>'created_by')::uuid END,CASE WHEN NOT _new THEN (_row->>'assigned_to')::uuid END])
   OR (p->>'manager_id')::uuid=actor OR EXISTS(SELECT 1 FROM public.people manager WHERE manager.id=(p->>'manager_id')::uuid AND manager.workspace_id=w AND manager.profile_id=actor);
 RETURN public.user_has_permission(actor,w,'techpeople.'||_resource||'.'||_action||'.workspace')
   OR (COALESCE(own_scope,false) AND public.user_has_permission(actor,w,'techpeople.'||_resource||'.'||_action||'.own'))
   OR (COALESCE(team_scope,false) AND public.user_has_permission(actor,w,'techpeople.'||_resource||'.'||_action||'.team'));
END $$;
REVOKE ALL ON FUNCTION public.hr_private_row_allowed(text,text,jsonb,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hr_private_fields(_resource text,_ids uuid[],_parent boolean DEFAULT false)
RETURNS TABLE(id uuid,can_view boolean,can_update boolean,fields jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE table_name text; columns text[]; r jsonb; actor uuid:=auth.uid(); w uuid; keys text[]:=ARRAY[]::text[];
 base text; row_valid boolean; broad_view boolean; broad_update boolean; person_id uuid; read_only boolean;
BEGIN
 IF _resource NOT IN('people_sensitive','one_on_ones_private','allocations_financial') OR _resource IS NULL OR _ids IS NULL OR cardinality(_ids)>200 THEN
   RAISE EXCEPTION 'Invalid private-field request' USING ERRCODE='22023'; END IF;
 SELECT active_workspace_id INTO w FROM public.profiles WHERE profiles.id=actor;
 IF actor IS NOT NULL AND w IS NOT NULL AND public.is_workspace_member(w,actor) AND w IN(SELECT public.current_user_workspaces()) THEN
   SELECT COALESCE(array_agg(k),ARRAY[]::text[]) INTO keys FROM public.user_effective_permissions(actor,w) k;
 END IF;
 read_only:=public.is_read_only_view();
 base:=CASE _resource WHEN 'people_sensitive' THEN 'techpeople.people' WHEN 'one_on_ones_private' THEN 'techpeople.one_on_ones' ELSE 'techpeople.allocations' END;
 CASE _resource WHEN 'people_sensitive' THEN table_name:='people';columns:=ARRAY['cost_hour','monthly_cost','personal_doc','bank','bank_agency','bank_account','pix_key','address'];
 WHEN 'one_on_ones_private' THEN table_name:='people_one_on_ones';columns:=ARRAY['private_notes'];
 WHEN 'allocations_financial' THEN table_name:='people_allocations';columns:=ARRAY['billable_rate','cost_rate']; END CASE;
 FOR id IN SELECT DISTINCT v FROM unnest(_ids) v WHERE v IS NOT NULL LOOP
   r:=NULL;
   IF _parent THEN
     IF _resource='people_sensitive' THEN
       r:=jsonb_build_object('workspace_id',id,'assigned_to',auth.uid(),'created_by',auth.uid());
     ELSE
       SELECT jsonb_build_object('person_id',p.id,'workspace_id',p.workspace_id) INTO r FROM public.people p WHERE p.id=hr_private_fields.id;
     END IF;
     row_valid:=r IS NOT NULL AND (r->>'workspace_id')::uuid=w;
     broad_update:=row_valid AND (base||'.create.workspace')=ANY(keys)
       AND ('techpeople.'||_resource||'.view.workspace')=ANY(keys) AND ('techpeople.'||_resource||'.update.workspace')=ANY(keys)
       AND (_resource='people_sensitive' OR 'techpeople.people.view.workspace'=ANY(keys));
     can_update:=NOT read_only AND (broad_update OR COALESCE(public.hr_private_row_allowed(_resource,'update',r,true),false));
     can_view:=can_update;fields:='{}'::jsonb;
   ELSE
     EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',table_name) INTO r USING id;
     row_valid:=r IS NOT NULL AND (r->>'workspace_id')::uuid=w;
     IF row_valid AND _resource<>'people_sensitive' THEN
       person_id:=(r->>'person_id')::uuid;
       row_valid:=EXISTS(SELECT 1 FROM public.people p WHERE p.id=person_id AND p.workspace_id=w);
     END IF;
     broad_view:=row_valid AND (base||'.view.workspace')=ANY(keys)
       AND ('techpeople.'||_resource||'.view.workspace')=ANY(keys)
       AND (_resource='people_sensitive' OR 'techpeople.people.view.workspace'=ANY(keys));
     broad_update:=broad_view AND (base||'.update.workspace')=ANY(keys) AND ('techpeople.'||_resource||'.update.workspace')=ANY(keys);
     can_view:=COALESCE(broad_view,false) OR COALESCE(public.hr_private_row_allowed(_resource,'view',r,false),false);
     can_update:=can_view AND NOT read_only AND (COALESCE(broad_update,false) OR COALESCE(public.hr_private_row_allowed(_resource,'update',r,false),false));
     SELECT COALESCE(jsonb_object_agg(k,r->k),'{}'::jsonb) INTO fields FROM unnest(columns) k WHERE can_view;
   END IF;
   RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.hr_private_fields(text,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hr_private_fields(text,uuid[],boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.hr_private_write_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE resource_name text; columns text[]; k text; changed boolean:=false; r jsonb:=to_jsonb(NEW); old_r jsonb;
BEGIN
 -- Trusted jobs without a user JWT remain an explicit service path. A caller
 -- with a JWT is checked even if the connection can otherwise bypass row RLS.
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 CASE TG_TABLE_NAME WHEN 'people' THEN resource_name:='people_sensitive';columns:=ARRAY['cost_hour','monthly_cost','personal_doc','bank','bank_agency','bank_account','pix_key','address'];
 WHEN 'people_one_on_ones' THEN resource_name:='one_on_ones_private';columns:=ARRAY['private_notes'];
 WHEN 'people_allocations' THEN resource_name:='allocations_financial';columns:=ARRAY['billable_rate','cost_rate'];
 ELSE RAISE EXCEPTION 'Unsupported private table'; END CASE;
 IF TG_OP='UPDATE' THEN old_r:=to_jsonb(OLD); END IF;
 FOREACH k IN ARRAY columns LOOP
   IF TG_OP='INSERT' THEN changed:=changed OR (r->k IS NOT NULL AND r->k NOT IN('null'::jsonb,'{}'::jsonb,'""'::jsonb));
   ELSE changed:=changed OR (r->k IS DISTINCT FROM old_r->k); END IF;
 END LOOP;
 IF changed AND NOT public.hr_private_row_allowed(resource_name,'update',CASE WHEN TG_OP='INSERT' THEN r ELSE old_r END,TG_OP='INSERT') THEN
   RAISE EXCEPTION 'Sem permissão para alterar dados privados deste registro.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hr_private_write_guard() FROM PUBLIC,anon,authenticated;
-- Activation is deferred to 0199, after every consumer is deployed. Existing
-- readers and writers remain usable while the new caller-bound RPC is introduced.

INSERT INTO public.permissions(key,module,resource,action,scope,label_pt)
SELECT 'techpeople.'||r.resource||'.'||a.action||'.'||s.scope,'techpeople',r.resource,a.action::public.perm_action,s.scope::public.perm_scope,r.label||' — '||CASE a.action WHEN 'view' THEN 'Ver' ELSE 'Editar' END||' ('||s.scope||')'
FROM (VALUES('people_sensitive','Dados privados de pessoas'),('one_on_ones_private','Notas privadas de 1:1'),('allocations_financial','Valores financeiros de alocações')) r(resource,label)
CROSS JOIN (VALUES('view'),('update')) a(action) CROSS JOIN (VALUES('own'),('team'),('workspace')) s(scope) ON CONFLICT(key) DO NOTHING;
-- Existing explicit authorization: full HR access for Head de RH in WK only.
INSERT INTO public.job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by)
SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid,'aaaaaaaa-0000-4000-8000-000000000004'::uuid,p.key,'grant','1c237fbe-079e-4eb9-a3e6-c08d85e79688'::uuid FROM public.permissions p WHERE p.resource IN('people_sensitive','one_on_ones_private','allocations_financial') AND p.module='techpeople'
ON CONFLICT(workspace_id,role_id,permission_key) DO NOTHING;

-- The legacy rate picker is also a read path for allocation private columns.
CREATE OR REPLACE FUNCTION public.project_rate_legacy_candidates(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  PERFORM public.project_bill_assert(p_ws, false, 'techprojects.rates.view.workspace');
  SELECT jsonb_build_object(
    'project_members', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id', m.project_id, 'project_name', p.name, 'user_id', m.user_id,
        'user_name', pr.full_name, 'cost_rate_hour', m.cost_rate_hour, 'bill_rate_hour', m.bill_rate_hour) ORDER BY p.name)
      FROM public.project_members m JOIN public.projects p ON p.id = m.project_id LEFT JOIN public.profiles pr ON pr.id = m.user_id
     WHERE m.workspace_id = p_ws AND (m.cost_rate_hour IS NOT NULL OR m.bill_rate_hour IS NOT NULL)), '[]'::jsonb),
    'allocations', coalesce((SELECT jsonb_agg(jsonb_build_object('allocation_id', a.id, 'person_name', pe.full_name, 'project_id', a.project_id,
        'service_id', a.service_id, 'cost_rate', a.cost_rate, 'billable_rate', a.billable_rate, 'currency', a.currency,
        'starts_at', a.starts_at, 'ends_at', a.ends_at) ORDER BY pe.full_name)
      FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
     WHERE a.workspace_id = p_ws AND (a.cost_rate IS NOT NULL OR a.billable_rate IS NOT NULL) AND public.hr_private_row_allowed('allocations_financial','view',to_jsonb(a),false)), '[]'::jsonb),
    'services', coalesce((SELECT jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'unit', s.unit, 'billing_model', s.billing_model,
        'unit_price', s.unit_price, 'quantity', s.quantity, 'currency', s.currency, 'type', s.type, 'status', s.status) ORDER BY s.name)
      FROM public.services s WHERE s.workspace_id = p_ws), '[]'::jsonb)) INTO v;
  RETURN v;
END $function$;

NOTIFY pgrst, 'reload schema';
