-- O cargo do modelo contribui apenas com restrições; seus grants/presets não são herdados.
CREATE OR REPLACE FUNCTION public.hiring_restricted_roles(u uuid,w uuid) RETURNS TABLE(role_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT DISTINCT v.role_id FROM hiring_access_grants g JOIN hiring_engagements e ON e.id=g.engagement_id JOIN hiring_access_model_versions v ON v.id=e.model_version_id
 WHERE g.user_id=u AND g.workspace_id=w AND e.workspace_id=w AND g.revoked_at IS NULL AND e.status='active' AND v.role_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.hiring_restricted_roles(uuid,uuid) FROM PUBLIC,anon,authenticated;

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
       AND public.hiring_set_live(ps.id,_user_id,_workspace_id)
    UNION
    SELECT ps.id
      FROM my_roles r
      JOIN public.job_role_sets jrs ON jrs.role_id = r.role_id
      LEFT JOIN public.job_role_set_replacements rep
        ON rep.workspace_id = _workspace_id AND rep.role_id = r.role_id AND rep.set_id = jrs.set_id
      JOIN public.permission_sets ps ON ps.id = COALESCE(rep.replacement_set_id, jrs.set_id)
     WHERE (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
       AND public.hiring_set_live(ps.id,_user_id,_workspace_id)
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
    UNION SELECT o.permission_key FROM public.hiring_restricted_roles(_user_id,_workspace_id) r(role_id) JOIN public.job_role_permission_overrides o ON o.role_id=r.role_id AND o.workspace_id=_workspace_id AND o.effect='deny'
  )
  SELECT DISTINCT key
    FROM (SELECT key FROM base_permissions UNION SELECT key FROM role_grants) effective
   WHERE EXISTS (SELECT 1 FROM active_member)
     AND NOT EXISTS (SELECT 1 FROM denied d WHERE d.key = effective.key)
$function$;

CREATE OR REPLACE FUNCTION public.shared_field_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;u uuid:=(c->>'actor')::uuid;rules jsonb;invalid jsonb;BEGIN
 IF w IS NULL OR u IS NULL THEN RETURN jsonb_build_object('workspace_id',NULL,'is_privileged',false,'rules','{}'::jsonb,'invalid_rules','[]'::jsonb);END IF;
 IF EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=w AND user_id=u AND status='active' AND role IN('owner','admin')) THEN RETURN jsonb_build_object('workspace_id',w,'is_privileged',true,'rules','{}'::jsonb,'invalid_rules','[]'::jsonb);END IF;
 WITH roles AS (SELECT uj.role_id FROM user_job_roles uj JOIN job_roles jr ON jr.id=uj.role_id WHERE uj.user_id=u AND uj.workspace_id=w AND (jr.workspace_id IS NULL OR jr.workspace_id=w) UNION SELECT role_id FROM public.hiring_restricted_roles(u,w)),sets AS (
 SELECT ps.id FROM user_permission_sets us JOIN permission_sets ps ON ps.id=us.set_id WHERE us.user_id=u AND us.workspace_id=w AND (ps.workspace_id=w OR (ps.workspace_id IS NULL AND ps.module<>'__bundle__'))
 UNION SELECT ps.id FROM roles r JOIN job_role_sets jrs ON jrs.role_id=r.role_id LEFT JOIN job_role_set_replacements rep ON rep.workspace_id=w AND rep.role_id=r.role_id AND rep.set_id=jrs.set_id JOIN permission_sets ps ON ps.id=coalesce(rep.replacement_set_id,jrs.set_id) WHERE (ps.workspace_id=w OR (ps.workspace_id IS NULL AND ps.module<>'__bundle__')) AND (rep.replacement_set_id IS NULL OR ps.workspace_id=w)
 ), applicable AS (
 SELECT f.resource,CASE WHEN f.resource='techhire.offers' AND f.field='amount' THEN 'salary_amount' WHEN f.resource='techhire.interviews' AND f.field='private_notes' THEN 'notes' ELSE f.field END field,f.mode FROM field_permission_rules f WHERE (f.workspace_id IS NULL OR f.workspace_id=w) AND (f.role_id IN(SELECT role_id FROM roles) OR f.set_id IN(SELECT id FROM sets))
 ), ranked AS (SELECT a.resource,a.field,max(CASE mode WHEN 'hidden' THEN 3 WHEN 'masked' THEN 2 ELSE 1 END) rank FROM applicable a JOIN shared_field_catalog c ON c.resource=a.resource AND c.field::text=a.field AND c.configurable GROUP BY a.resource,a.field), grouped AS (SELECT resource,jsonb_object_agg(field,CASE rank WHEN 3 THEN 'hidden' WHEN 2 THEN 'masked' ELSE 'readonly' END) values FROM ranked GROUP BY resource)
 SELECT coalesce((SELECT jsonb_object_agg(resource,values) FROM grouped),'{}'),coalesce((SELECT jsonb_agg(jsonb_build_object('resource',a.resource,'field',a.field,'reason','Campo sem contrato de proteção no schema atual')) FROM applicable a WHERE NOT EXISTS(SELECT 1 FROM shared_field_catalog c WHERE c.resource=a.resource AND c.field::text=a.field AND c.configurable)),'[]') INTO rules,invalid;
 RETURN jsonb_build_object('workspace_id',w,'is_privileged',false,'rules',rules,'invalid_rules',invalid);
END $function$;


NOTIFY pgrst,'reload schema';
