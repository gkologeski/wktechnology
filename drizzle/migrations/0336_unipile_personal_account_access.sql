-- LinkedIn remains a personal credential: even workspace grants cannot adopt another owner.
-- Existing RLS and read-only policies remain in place; restrictive policies intersect them.
CREATE FUNCTION public.unipile_personal_access(c jsonb,w uuid,o uuid,a text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'actor'=o::text AND c->>'workspace'=w::text
 AND a IN('view','manage')
 AND (c->'keys'?'system.linkedin.view.own' OR c->'keys'?'system.linkedin.view.workspace')
 AND (c->'keys'?('system.linkedin.'||a||'.own') OR c->'keys'?('system.linkedin.'||a||'.workspace'))
 AND (a='view' OR NOT coalesce((c->>'read_only')::boolean,true)),false)
$$;
REVOKE ALL ON FUNCTION public.unipile_personal_access(jsonb,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.unipile_personal_access(jsonb,uuid,uuid,text) TO authenticated,service_role;
CREATE POLICY unipile_personal_read ON public.unipile_accounts AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.unipile_personal_access((SELECT public.work_access_context()),workspace_id,owner_id,'view'));
CREATE POLICY unipile_personal_create ON public.unipile_accounts AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(public.unipile_personal_access((SELECT public.work_access_context()),workspace_id,owner_id,'manage'));
CREATE POLICY unipile_personal_update ON public.unipile_accounts AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(public.unipile_personal_access((SELECT public.work_access_context()),workspace_id,owner_id,'manage'))
 WITH CHECK(public.unipile_personal_access((SELECT public.work_access_context()),workspace_id,owner_id,'manage'));
CREATE POLICY unipile_personal_delete ON public.unipile_accounts AS RESTRICTIVE FOR DELETE TO authenticated
 USING(public.unipile_personal_access((SELECT public.work_access_context()),workspace_id,owner_id,'manage'));
