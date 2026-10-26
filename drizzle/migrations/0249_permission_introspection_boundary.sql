-- Self permission metadata is personal; other-user inspection is governed IAM.
CREATE OR REPLACE FUNCTION techerp_api.effective_permissions_unchecked(_user_id uuid, _workspace_id uuid)
 RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $function$
  WITH active_member AS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id AND wm.status = 'active'
  ), ws AS (
    SELECT w.id, w.created_by FROM public.workspaces w WHERE w.id = _workspace_id
  ), my_roles AS (
    SELECT ujr.role_id
      FROM public.user_job_roles ujr
      LEFT JOIN public.job_roles jr ON jr.id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.workspace_id = _workspace_id OR ujr.owner_id = _workspace_id)
       AND (jr.id IS NULL OR jr.workspace_id IS NULL OR jr.workspace_id = _workspace_id)
  ), my_sets AS (
    SELECT ps.id AS set_id
      FROM public.user_permission_sets ups
      JOIN public.permission_sets ps ON ps.id = ups.set_id
     WHERE ups.user_id = _user_id
       AND (ups.workspace_id = _workspace_id OR ups.owner_id = _workspace_id)
       AND (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
    UNION
    SELECT ps.id
      FROM my_roles r
      JOIN public.job_role_sets jrs ON jrs.role_id = r.role_id
      LEFT JOIN public.job_role_set_replacements rep
        ON rep.workspace_id = _workspace_id AND rep.role_id = r.role_id AND rep.set_id = jrs.set_id
      JOIN public.permission_sets ps ON ps.id = COALESCE(rep.replacement_set_id, jrs.set_id)
     WHERE (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
       AND (rep.replacement_set_id IS NULL OR ps.workspace_id = _workspace_id)
  ), base_permissions AS (
    SELECT p.key FROM public.permissions p
     WHERE EXISTS (SELECT 1 FROM ws WHERE ws.created_by = _user_id)
        OR EXISTS (SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id
                AND wm.role IN ('owner','admin') AND wm.status = 'active')
    UNION
    SELECT psi.permission_key FROM my_sets s JOIN public.permission_set_items psi ON psi.set_id = s.set_id
  ), role_grants AS (
    SELECT o.permission_key AS key FROM my_roles r
      JOIN public.job_role_permission_overrides o ON o.role_id = r.role_id
     WHERE o.workspace_id = _workspace_id AND o.effect = 'grant'
  ), denied AS (
    SELECT o.permission_key AS key FROM my_roles r
      JOIN public.job_role_permission_overrides o ON o.role_id = r.role_id
     WHERE o.workspace_id = _workspace_id AND o.effect = 'deny'
  )
  SELECT DISTINCT key
    FROM (SELECT key FROM base_permissions UNION SELECT key FROM role_grants) effective
   WHERE EXISTS (SELECT 1 FROM active_member)
     AND NOT EXISTS (SELECT 1 FROM denied d WHERE d.key = effective.key)
$function$;

ALTER FUNCTION techerp_api.effective_permissions_unchecked(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION techerp_api.effective_permissions_unchecked(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.permission_metadata_access(_target uuid,_workspace uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=auth.uid();allowed boolean:=false;BEGIN
 IF auth.role()='service_role' OR(actor IS NULL AND auth.role() IS NULL AND session_user IN('postgres','supabase_admin')) THEN RETURN true;
 ELSIF actor=_target THEN RETURN public.is_workspace_member(_workspace,actor);
 ELSIF actor IS NOT NULL AND public.is_workspace_member(_workspace,actor)
 AND public.is_workspace_admin_v2(_workspace,actor)
 AND EXISTS(SELECT 1 FROM profiles WHERE id=actor AND active_workspace_id=_workspace) THEN
  SELECT coalesce(bool_or(k IN('system.rbac_diagnostics.view.workspace','system.roles.view.workspace')),false) INTO allowed
  FROM techerp_api.effective_permissions_unchecked(actor,_workspace)k;
 END IF;
 RETURN allowed;
END$$;
REVOKE ALL ON FUNCTION public.permission_metadata_access(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.user_effective_permissions(_user_id uuid,_workspace_id uuid)
RETURNS SETOF text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.permission_metadata_access(_user_id,_workspace_id) THEN RETURN;END IF;
 RETURN QUERY SELECT * FROM techerp_api.effective_permissions_unchecked(_user_id,_workspace_id);
END$$;
ALTER FUNCTION public.user_effective_permissions(uuid,uuid) OWNER TO postgres;
CREATE OR REPLACE FUNCTION public.user_data_scope(_user_id uuid,_workspace_id uuid)
RETURNS public.data_scope LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE scope public.data_scope;BEGIN
 IF NOT public.permission_metadata_access(_user_id,_workspace_id) OR NOT public.is_workspace_member(_workspace_id,_user_id) THEN RETURN 'own';END IF;
 IF public.is_workspace_admin_v2(_workspace_id,_user_id) THEN RETURN 'workspace';END IF;
 SELECT jr.data_scope INTO scope FROM user_job_roles uj JOIN job_roles jr ON jr.id=uj.role_id
 WHERE uj.user_id=_user_id AND(uj.workspace_id=_workspace_id OR uj.owner_id=_workspace_id)
 AND(jr.workspace_id IS NULL OR jr.workspace_id=_workspace_id)
 ORDER BY CASE jr.data_scope WHEN 'workspace' THEN 1 WHEN 'team' THEN 2 WHEN 'custom' THEN 3 ELSE 4 END LIMIT 1;
 RETURN coalesce(scope,'own');
END$$;
ALTER FUNCTION public.user_data_scope(uuid,uuid) OWNER TO postgres;
-- Existing wrapper ACLs are preserved. No stored business-role grants or configured scope values are changed.
-- Canonical role bindings replace the obsolete creator-id fallback for data scope.
NOTIFY pgrst,'reload schema';

-- Field simulation uses the exact same resolver as real projected reads.
CREATE OR REPLACE FUNCTION techerp_api.permission_field_context(p_user uuid,p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;BEGIN
 IF current_setting('app.api_subject',true)='on' THEN RAISE EXCEPTION 'Nested metadata context forbidden' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) VALUES(txid_current(),p_user,p_ws,gen_random_uuid(),current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_user::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('app.api_subject','on',true);
 result:=public.shared_field_context();PERFORM techerp_api.leave();RETURN result;
END$$;
ALTER FUNCTION techerp_api.permission_field_context(uuid,uuid) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.permission_field_context(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.permission_field_context(uuid,uuid) TO postgres;
CREATE OR REPLACE FUNCTION public.permission_field_context(_user_id uuid,_workspace_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.permission_metadata_access(_user_id,_workspace_id) THEN RAISE EXCEPTION 'Inspeção de campos não autorizada.' USING ERRCODE='42501';END IF;
 IF NOT public.is_workspace_member(_workspace_id,_user_id) THEN RETURN jsonb_build_object('workspace_id',NULL,'is_privileged',false,'rules','{}'::jsonb,'invalid_rules','[]'::jsonb,'unavailable_reason','inactive_membership');END IF;
 IF auth.uid()=_user_id AND public.work_access_context()->>'workspace'=_workspace_id::text THEN RETURN public.shared_field_context();END IF;
 RETURN techerp_api.permission_field_context(_user_id,_workspace_id);
END$$;
-- This wrapper enters a private transaction context, therefore it is VOLATILE.
ALTER FUNCTION public.permission_field_context(uuid,uuid) VOLATILE;
REVOKE ALL ON FUNCTION public.permission_field_context(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.permission_field_context(uuid,uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';

ALTER FUNCTION public.permission_metadata_access(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.permission_field_context(uuid,uuid) OWNER TO postgres;

-- Trusted capability contexts retain counterfactual checks (reviewers, delegates).
-- They never expose a target permission set through a client RPC.
CREATE OR REPLACE FUNCTION public.work_subject_context(p_ws uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE k jsonb;t jsonb;BEGIN
 IF NOT is_workspace_member(p_ws,p_actor) THEN RETURN '{}';END IF;
 SELECT coalesce(jsonb_object_agg(key,true),'{}') INTO k FROM techerp_api.effective_permissions_unchecked(p_actor,p_ws)key;
 SELECT coalesce(jsonb_object_agg(b.user_id::text,true),'{}') INTO t FROM user_group_members a JOIN user_group_members b ON b.group_id=a.group_id JOIN user_groups g ON g.id=a.group_id WHERE a.user_id=p_actor AND g.workspace_id=p_ws;
 RETURN jsonb_build_object('workspace',p_ws,'actor',p_actor,'keys',k,'team',t,'read_only',false);
END $$;
CREATE OR REPLACE FUNCTION public.work_delegated_authorize(p_ws uuid,p_actor uuid,p_kind text,p_record uuid,p_copy boolean DEFAULT false,p_template uuid DEFAULT NULL,p_status text DEFAULT 'draft')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;k jsonb;t jsonb;j jsonb;s uuid;r text;requirements text[];x text;ok boolean;BEGIN
 IF p_ws IS NULL OR p_actor IS NULL OR NOT is_workspace_member(p_ws,p_actor) THEN RETURN false;END IF;
 SELECT coalesce(jsonb_object_agg(key,true),'{}') INTO k FROM techerp_api.effective_permissions_unchecked(p_actor,p_ws)key;
 SELECT coalesce(jsonb_object_agg(b.user_id::text,true),'{}') INTO t FROM user_group_members a JOIN user_group_members b ON b.group_id=a.group_id JOIN user_groups g ON g.id=a.group_id WHERE a.user_id=p_actor AND g.workspace_id=p_ws;
 c:=jsonb_build_object('workspace',p_ws,'actor',p_actor,'keys',k,'team',t,'read_only',false);
 IF p_kind IN('contract_from_deal','contract_from_person') THEN
 IF p_kind='contract_from_deal' THEN
 SELECT to_jsonb(d) INTO j FROM deals d WHERE id=p_record AND workspace_id=p_ws;
 IF j IS NULL OR NOT work_deal_context_access(c,p_record,'view') THEN RETURN false;END IF;
 ELSE
 IF NOT work_person_context_access(c,p_record) THEN RETURN false;END IF;
 END IF;
 requirements:=ARRAY['techcontracts.contracts.view','techcontracts.contracts.create'];
 IF p_copy THEN requirements:=requirements||ARRAY['techservice.services.view','techservice.services.create'];END IF;
 IF p_template IS NOT NULL AND NOT work_record_context_access(c,'techcontracts.contract_templates',p_template,'view') THEN RETURN false;END IF;
 IF p_status<>'draft' THEN requirements:=requirements||ARRAY['techcontracts.contract_transition.manage'];IF p_status='active' THEN requirements:=requirements||ARRAY['techcontracts.contract_activation.manage'];END IF;IF p_status NOT IN('in_negotiation','active','renewing','ended','terminated') THEN RETURN false;END IF;END IF;
 ELSIF p_kind='person_contracts' THEN
 RETURN work_person_context_access(c,p_record) AND NOT EXISTS(SELECT 1 FROM contracts d WHERE d.workspace_id=p_ws AND d.metadata->>'person_id'=p_record::text AND NOT work_record_context_access(c,'techcontracts.contracts',d.id,'view'));
 ELSIF p_kind='service_billing' THEN
 SELECT to_jsonb(d) INTO j FROM services d WHERE id=p_record AND workspace_id=p_ws;
 IF j IS NULL OR NOT work_record_context_access(c,'techservice.services',p_record,'view') THEN RETURN false;END IF;
 requirements:=ARRAY['techservice.billing.manage','techfinance.entries.view','techfinance.entries.create'];
 ELSE RETURN false;END IF;
 FOREACH x IN ARRAY requirements LOOP
 -- Created records belong to the explicit delegating actor. A team key alone
 -- never authorizes an unrelated creator or a different source tenant.
 ok:=k?(x||'.workspace') OR k?(x||'.own') OR (k?(x||'.team') AND t?p_actor::text);
 IF NOT coalesce(ok,false) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
END $$;
ALTER FUNCTION public.work_subject_context(uuid,uuid) OWNER TO postgres;
ALTER FUNCTION public.work_delegated_authorize(uuid,uuid,text,uuid,boolean,uuid,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.work_subject_context(uuid,uuid),public.work_delegated_authorize(uuid,uuid,text,uuid,boolean,uuid,text) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
