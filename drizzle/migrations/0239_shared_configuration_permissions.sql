-- Complement to Orders 5/6: configuration actions are matrix-controlled.
-- No role, permission-set, membership or default grants are changed.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.communication.subscription_types.view.workspace','system','communication.subscription_types','view','workspace','Tipos de assinatura de comunicação — view','Exige membro ativo, workspace selecionado e ação efetiva; deny prevalece.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.communication.subscription_types.create.workspace','system','communication.subscription_types','create','workspace','Tipos de assinatura de comunicação — create','Exige membro ativo, workspace selecionado e ação efetiva; deny prevalece.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.communication.subscription_types.update.workspace','system','communication.subscription_types','update','workspace','Tipos de assinatura de comunicação — update','Exige membro ativo, workspace selecionado e ação efetiva; deny prevalece.',true) ON CONFLICT(key) DO NOTHING;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES('system.communication.subscription_types.delete.workspace','system','communication.subscription_types','delete','workspace','Tipos de assinatura de comunicação — delete','Exige membro ativo, workspace selecionado e ação efetiva; deny prevalece.',true) ON CONFLICT(key) DO NOTHING;

-- Legacy macro grants remain aliases only for the exact same action/scope.
-- A deny on either spelling removes both; no admin or ownership shortcut.
CREATE OR REPLACE FUNCTION public.shared_configuration_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();w uuid:=(c->>'workspace')::uuid;u uuid:=(c->>'actor')::uuid;
 k jsonb:=coalesce(c->'keys','{}'::jsonb);denies text[];suffix text;old_key text;new_key text;
BEGIN
 IF u IS NULL OR w IS NULL THEN RETURN '{}'::jsonb;END IF;
 SELECT coalesce(array_agg(regexp_replace(o.permission_key,'^(techservice\.macros|system\.automation\.macros)\.','')),'{}'::text[])
 INTO denies FROM user_job_roles uj JOIN job_roles jr ON jr.id=uj.role_id
 JOIN job_role_permission_overrides o ON o.role_id=uj.role_id AND o.workspace_id=w AND o.effect='deny'
 WHERE uj.user_id=u AND (uj.workspace_id=w OR uj.owner_id=w)
 AND (jr.workspace_id IS NULL OR jr.workspace_id=w)
 AND o.permission_key ~ '^(techservice\.macros|system\.automation\.macros)\.(view|create|update|delete|manage|export)\.(own|team|workspace)$';
 FOR suffix IN SELECT a||'.'||s FROM unnest(ARRAY['view','create','update','delete','manage','export'])a CROSS JOIN unnest(ARRAY['own','team','workspace'])s LOOP
  old_key:='techservice.macros.'||suffix;new_key:='system.automation.macros.'||suffix;
  IF suffix=ANY(denies) THEN k:=k-old_key-new_key;
  ELSIF k?old_key THEN k:=k||jsonb_build_object(new_key,true);END IF;
 END LOOP;
 RETURN c||jsonb_build_object('keys',k);
END $$;
REVOKE ALL ON FUNCTION public.shared_configuration_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_configuration_context() TO authenticated;

CREATE OR REPLACE FUNCTION public.shared_configuration_access(c jsonb,w uuid,r text,a text,o uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'actor' IS NOT NULL AND c->>'workspace'=w::text
 AND r IN('system.automation.macros','system.communication.subscription_types')
 AND a IN('view','create','update','delete')
 AND (a='view' OR NOT coalesce((c->>'read_only')::boolean,true))
 AND (c->'keys'?(r||'.view.workspace')
  OR (r='system.automation.macros' AND c->'keys'?(r||'.view.own') AND c->>'actor'=o::text)
  OR (r='system.automation.macros' AND c->'keys'?(r||'.view.team') AND (c->>'actor'=o::text OR c->'team'?o::text)))
 AND (c->'keys'?(r||'.'||a||'.workspace')
  OR (r='system.automation.macros' AND c->'keys'?(r||'.'||a||'.own') AND c->>'actor'=o::text)
  OR (r='system.automation.macros' AND c->'keys'?(r||'.'||a||'.team') AND (c->>'actor'=o::text OR c->'team'?o::text))),false)
$$;
REVOKE ALL ON FUNCTION public.shared_configuration_access(jsonb,uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_configuration_access(jsonb,uuid,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.shared_configuration_permission_keys(p_workspace uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=shared_configuration_context();BEGIN
 IF p_workspace IS NULL OR c->>'workspace' IS DISTINCT FROM p_workspace::text THEN RAISE EXCEPTION 'Workspace indisponível.' USING ERRCODE='42501';END IF;
 RETURN (SELECT coalesce(jsonb_agg(k),'[]'::jsonb) FROM jsonb_object_keys(c->'keys')k);
END $$;
REVOKE ALL ON FUNCTION public.shared_configuration_permission_keys(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_configuration_permission_keys(uuid) TO authenticated;

-- Identity cannot be moved to expand an own/team grant or change tenants.
CREATE OR REPLACE FUNCTION public.shared_configuration_identity_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
 RAISE EXCEPTION 'Responsável e workspace são imutáveis nesta configuração.' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.shared_configuration_identity_guard() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS shared_configuration_identity ON public.macros;
CREATE TRIGGER shared_configuration_identity BEFORE UPDATE ON public.macros FOR EACH ROW EXECUTE FUNCTION public.shared_configuration_identity_guard();
ALTER TABLE public.macros ENABLE ROW LEVEL SECURITY;
DO $p$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='macros' AND (permissive='PERMISSIVE' OR policyname LIKE 'macros_perm_%') LOOP EXECUTE format('DROP POLICY %I ON public.macros',p.policyname);END LOOP;END $p$;
CREATE POLICY shared_configuration_view ON public.macros FOR SELECT TO authenticated USING(public.shared_configuration_access((SELECT public.shared_configuration_context()),workspace_id,'system.automation.macros','view',owner_id));
CREATE POLICY shared_configuration_create ON public.macros FOR INSERT TO authenticated  WITH CHECK(public.shared_configuration_access((SELECT public.shared_configuration_context()),workspace_id,'system.automation.macros','create',owner_id) AND owner_id=auth.uid());
CREATE POLICY shared_configuration_update ON public.macros FOR UPDATE TO authenticated USING(public.shared_configuration_access((SELECT public.shared_configuration_context()),workspace_id,'system.automation.macros','update',owner_id)) WITH CHECK(public.shared_configuration_access((SELECT public.shared_configuration_context()),workspace_id,'system.automation.macros','update',owner_id));
CREATE POLICY shared_configuration_delete ON public.macros FOR DELETE TO authenticated USING(public.shared_configuration_access((SELECT public.shared_configuration_context()),workspace_id,'system.automation.macros','delete',owner_id));

DROP TRIGGER IF EXISTS shared_configuration_identity ON public.subscription_types;
CREATE TRIGGER shared_configuration_identity BEFORE UPDATE ON public.subscription_types FOR EACH ROW EXECUTE FUNCTION public.shared_configuration_identity_guard();
ALTER TABLE public.subscription_types ENABLE ROW LEVEL SECURITY;
DO $p$DECLARE p record;BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='subscription_types' AND (permissive='PERMISSIVE' OR policyname LIKE 'macros_perm_%') LOOP EXECUTE format('DROP POLICY %I ON public.subscription_types',p.policyname);END LOOP;END $p$;
CREATE POLICY shared_configuration_view ON public.subscription_types FOR SELECT TO authenticated USING(public.shared_configuration_access((SELECT public.shared_configuration_context()),workspace_id,'system.communication.subscription_types','view',owner_id));
CREATE POLICY shared_configuration_create ON public.subscription_types FOR INSERT TO authenticated  WITH CHECK(public.shared_configuration_access((SELECT public.shared_configuration_context()),workspace_id,'system.communication.subscription_types','create',owner_id) AND owner_id=auth.uid());
CREATE POLICY shared_configuration_update ON public.subscription_types FOR UPDATE TO authenticated USING(public.shared_configuration_access((SELECT public.shared_configuration_context()),workspace_id,'system.communication.subscription_types','update',owner_id)) WITH CHECK(public.shared_configuration_access((SELECT public.shared_configuration_context()),workspace_id,'system.communication.subscription_types','update',owner_id));
CREATE POLICY shared_configuration_delete ON public.subscription_types FOR DELETE TO authenticated USING(public.shared_configuration_access((SELECT public.shared_configuration_context()),workspace_id,'system.communication.subscription_types','delete',owner_id));
