-- Export configuration and service execution are separate permission boundaries.
ALTER TABLE public.audit_exports ADD COLUMN cursor_at timestamptz,ADD COLUMN cursor_id uuid;
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,is_system) VALUES
('system.audit_exports.view.workspace','system','audit_exports','view','workspace','Exportação programada de auditoria — view',true),
('system.audit_exports.create.workspace','system','audit_exports','create','workspace','Exportação programada de auditoria — create',true),
('system.audit_exports.update.workspace','system','audit_exports','update','workspace','Exportação programada de auditoria — update',true),
('system.audit_exports.delete.workspace','system','audit_exports','delete','workspace','Exportação programada de auditoria — delete',true),
('system.audit_exports.manage.workspace','system','audit_exports','manage','workspace','Exportação programada de auditoria — manage',true) ON CONFLICT(key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.shared_audit_export_access(c jsonb,w uuid,a text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(c->>'actor' IS NOT NULL AND c->>'workspace'=w::text
 AND a IN('view','create','update','delete','manage')
 AND c->'keys'?'system.audit_exports.view.workspace'
 AND c->'keys'?('system.audit_exports.'||a||'.workspace')
 AND(a='view' OR NOT coalesce((c->>'read_only')::boolean,true)),false)
$$;
REVOKE ALL ON FUNCTION public.shared_audit_export_access(jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_audit_export_access(jsonb,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_audit_export_authorize(a text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();BEGIN
 IF NOT shared_audit_export_access(c,(c->>'workspace')::uuid,a) THEN RAISE EXCEPTION 'Sem permissão para esta ação de exportação programada.' USING ERRCODE='42501';END IF;RETURN c;
END$$;
REVOKE ALL ON FUNCTION public.shared_audit_export_authorize(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_audit_export_authorize(text) TO authenticated;
ALTER TABLE public.audit_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_export_runs ENABLE ROW LEVEL SECURITY;
DO $p$DECLARE p record;BEGIN FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN('audit_exports','audit_export_runs') AND permissive='PERMISSIVE' LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);END LOOP;END $p$;
CREATE POLICY audit_export_view ON public.audit_exports FOR SELECT TO authenticated USING(public.shared_audit_export_access((SELECT work_access_context()),workspace_id,'view'));
CREATE POLICY audit_export_create ON public.audit_exports FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.shared_audit_export_access((SELECT work_access_context()),workspace_id,'create'));
CREATE POLICY audit_export_update ON public.audit_exports FOR UPDATE TO authenticated USING(public.shared_audit_export_access((SELECT work_access_context()),workspace_id,'update')) WITH CHECK(public.shared_audit_export_access((SELECT work_access_context()),workspace_id,'update'));
CREATE POLICY audit_export_delete ON public.audit_exports FOR DELETE TO authenticated USING(public.shared_audit_export_access((SELECT work_access_context()),workspace_id,'delete'));
CREATE POLICY audit_export_runs_view ON public.audit_export_runs FOR SELECT TO authenticated USING(public.shared_audit_export_access((SELECT work_access_context()),workspace_id,'view') AND EXISTS(SELECT 1 FROM public.audit_exports e WHERE e.id=export_id AND e.workspace_id=audit_export_runs.workspace_id));
CREATE TRIGGER audit_export_identity BEFORE UPDATE ON public.audit_exports FOR EACH ROW EXECUTE FUNCTION public.shared_configuration_identity_guard();
REVOKE SELECT,INSERT,UPDATE ON public.audit_exports FROM PUBLIC,anon,authenticated;
REVOKE SELECT(hmac_secret),UPDATE(id,owner_id,workspace_id,last_run_at,last_status,created_at) ON public.audit_exports FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,owner_id,workspace_id,name,destination,config,format,schedule_cron,enabled,last_run_at,last_status,created_at,updated_at,cursor_at,cursor_id) ON public.audit_exports TO authenticated;
GRANT INSERT(owner_id,workspace_id,name,destination,config,format,schedule_cron,hmac_secret,enabled) ON public.audit_exports TO authenticated;
GRANT UPDATE(name,destination,config,format,schedule_cron,hmac_secret,enabled,updated_at) ON public.audit_exports TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.audit_export_runs FROM PUBLIC,anon,authenticated;
-- Private subject helper reuses the established transaction-bound execution model.
CREATE OR REPLACE FUNCTION techerp_api.audit_export_rows(p_ws uuid,p_user uuid,p_id uuid,p_since timestamptz,p_after uuid,p_until timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;rows jsonb;more boolean;last_row jsonb;result jsonb;BEGIN
 IF current_setting('app.api_subject',true)='on' THEN RAISE EXCEPTION 'Nested execution forbidden' USING ERRCODE='42501';END IF;
 INSERT INTO techerp_api.subject_sessions(txid,user_id,workspace_id,api_key_id,prev_claims) VALUES(txid_current(),p_user,p_ws,p_id,current_setting('request.jwt.claims',true));
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aud','authenticated')::text,true);
 PERFORM set_config('request.jwt.claim.sub',p_user::text,true);PERFORM set_config('request.jwt.claim.role','authenticated',true);PERFORM set_config('app.api_subject','on',true);
 c:=shared_audit_export_authorize('manage');
 IF c->>'workspace' IS DISTINCT FROM p_ws::text OR NOT(c->'keys'?'system.audit.export.workspace') OR NOT(c->'keys'?'system.audit.view.workspace') THEN RAISE EXCEPTION 'Responsável sem permissão atual para exportar auditoria.' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.created_at,v.id),'[]') INTO rows FROM(SELECT * FROM public.shared_audit_logs WHERE (created_at>p_since OR(created_at=p_since AND(p_after IS NULL OR id>p_after))) AND created_at<=p_until ORDER BY created_at,id LIMIT 501)v;
 more:=jsonb_array_length(rows)>500;IF more THEN rows:=rows-500;END IF;
 last_row:=rows->(jsonb_array_length(rows)-1);
 result:=jsonb_build_object('rows',rows,'has_more',more,'cursor_at',coalesce(last_row->>'created_at',p_until::text),'cursor_id',last_row->>'id');
 PERFORM techerp_api.leave();RETURN result;
END$$;
ALTER FUNCTION techerp_api.audit_export_rows(uuid,uuid,uuid,timestamptz,uuid,timestamptz) OWNER TO techerp_api_subject;
REVOKE ALL ON FUNCTION techerp_api.audit_export_rows(uuid,uuid,uuid,timestamptz,uuid,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION techerp_api.audit_export_rows(uuid,uuid,uuid,timestamptz,uuid,timestamptz) TO postgres;
CREATE OR REPLACE FUNCTION public.shared_audit_export_rows(p_id uuid,p_workspace uuid,p_since timestamptz,p_after uuid DEFAULT NULL,p_until timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.audit_exports;BEGIN
 IF p_since IS NULL OR p_until IS NULL OR p_since>p_until THEN RAISE EXCEPTION 'Intervalo inválido.';END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service execution only' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM public.audit_exports WHERE id=p_id AND workspace_id=p_workspace;
 IF NOT FOUND OR NOT is_workspace_member(e.workspace_id,e.owner_id) THEN RAISE EXCEPTION 'Responsável humano ativo obrigatório.' USING ERRCODE='42501';END IF;
 RETURN techerp_api.audit_export_rows(e.workspace_id,e.owner_id,e.id,p_since,p_after,p_until);
END$$;
REVOKE ALL ON FUNCTION public.shared_audit_export_rows(uuid,uuid,timestamptz,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.shared_audit_export_rows(uuid,uuid,timestamptz,uuid,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
