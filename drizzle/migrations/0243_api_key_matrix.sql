-- Own API credentials require explicit matrix actions; no grants to roles.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system) VALUES('system.api_keys.view.own','system','api_keys','view','own','Chaves de API próprias — view',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system) VALUES('system.api_keys.create.own','system','api_keys','create','own','Chaves de API próprias — create',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system) VALUES('system.api_keys.manage.own','system','api_keys','manage','own','Chaves de API próprias — manage',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system) VALUES('system.api_keys.delete.own','system','api_keys','delete','own','Chaves de API próprias — delete',true) ON CONFLICT(key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.shared_api_key_access(c jsonb,w uuid,a text,o uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'workspace'=w::text AND c->>'actor'=o::text
 AND a IN('view','create','manage','delete') AND(a='view' OR NOT coalesce((c->>'read_only')::boolean,true))
 AND c->'keys'?'system.api_keys.view.own' AND c->'keys'?('system.api_keys.'||a||'.own'),false)
$$;
REVOKE ALL ON FUNCTION public.shared_api_key_access(jsonb,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_api_key_access(jsonb,uuid,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_api_key_authorize(a text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();BEGIN
 IF NOT shared_api_key_access(c,(c->>'workspace')::uuid,a,(c->>'actor')::uuid) THEN RAISE EXCEPTION 'Sem permissão para esta ação de chave de API.' USING ERRCODE='42501';END IF;RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.shared_api_key_authorize(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_api_key_authorize(text) TO authenticated;
DO $p$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='api_keys' AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.api_keys',p.policyname);END LOOP;END $p$;
CREATE POLICY api_key_view ON public.api_keys FOR SELECT TO authenticated USING(public.shared_api_key_access((SELECT public.work_access_context()),workspace_id,'view',owner_id)) ;
CREATE POLICY api_key_create ON public.api_keys FOR INSERT TO authenticated WITH CHECK(public.shared_api_key_access((SELECT public.work_access_context()),workspace_id,'create',owner_id));
CREATE POLICY api_key_manage ON public.api_keys FOR UPDATE TO authenticated USING(public.shared_api_key_access((SELECT public.work_access_context()),workspace_id,'manage',owner_id)) WITH CHECK(public.shared_api_key_access((SELECT public.work_access_context()),workspace_id,'manage',owner_id));
CREATE POLICY api_key_delete ON public.api_keys FOR DELETE TO authenticated USING(public.shared_api_key_access((SELECT public.work_access_context()),workspace_id,'delete',owner_id)) ;
CREATE TRIGGER shared_api_key_identity BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.shared_configuration_identity_guard();
REVOKE SELECT,UPDATE ON public.api_keys FROM PUBLIC,anon,authenticated;
REVOKE SELECT(key_hash),UPDATE(id,owner_id,name,prefix,key_hash,scopes,last_used_at,expires_at,created_at,updated_at,workspace_id) ON public.api_keys FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,owner_id,name,prefix,scopes,last_used_at,expires_at,revoked_at,created_at,updated_at,workspace_id) ON public.api_keys TO authenticated;
GRANT UPDATE(revoked_at) ON public.api_keys TO authenticated;
DO $$BEGIN IF NOT has_column_privilege('service_role','public.api_keys','key_hash','SELECT') OR NOT has_column_privilege('service_role','public.api_keys','last_used_at','UPDATE') THEN RAISE EXCEPTION 'Service credential verification grants must be preserved';END IF;END$$;
