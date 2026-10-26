-- Read-only audit boundary: never infer tenant from a historical user/owner id.
CREATE OR REPLACE FUNCTION public.shared_audit_workspace(b jsonb,a jsonb)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT CASE
 WHEN nullif(b->>'workspace_id','') IS NOT NULL AND nullif(a->>'workspace_id','') IS NOT NULL AND b->>'workspace_id'<>a->>'workspace_id' THEN NULL
 WHEN coalesce(nullif(a->>'workspace_id',''),nullif(b->>'workspace_id','')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN coalesce(nullif(a->>'workspace_id',''),nullif(b->>'workspace_id',''))::uuid ELSE NULL END
$$;
CREATE OR REPLACE FUNCTION public.shared_audit_read_access(c jsonb,t text,i uuid,b jsonb,a jsonb,u uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=shared_audit_workspace(b,a);r text;j jsonb;responsible uuid;present boolean;BEGIN
 IF w IS NULL OR c->>'actor' IS NULL OR w::text IS DISTINCT FROM c->>'workspace' THEN RETURN false;END IF;
 IF NOT(c->'keys'?'system.audit.view.workspace' OR(c->'keys'?'system.audit.view.own' AND c->>'actor'=u::text) OR(c->'keys'?'system.audit.view.team' AND (c->>'actor'=u::text OR c->'team'?u::text))) THEN RETURN false;END IF;
 r:=CASE t WHEN 'leads' THEN 'techsales.leads' WHEN 'contacts' THEN 'techsales.contacts' WHEN 'companies' THEN 'techsales.companies' WHEN 'deals' THEN 'techsales.deals' END;
 IF r IS NULL OR i IS NULL THEN RETURN false;END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1)',t) INTO present USING i;
 IF present THEN RETURN public.sales_record_access(t,i,'view');END IF;
 -- Deleted records retain only the scope proved by their own tenant-bound snapshot.
 j:=coalesce(a,b);BEGIN responsible:=coalesce(nullif(j->>'assigned_to',''),nullif(j->>'owner_id',''))::uuid;EXCEPTION WHEN invalid_text_representation THEN RETURN false;END;
 RETURN public.sales_context_access(c,w,r,'view',ARRAY[responsible]);
END $$;
REVOKE ALL ON FUNCTION public.shared_audit_workspace(jsonb,jsonb),public.shared_audit_read_access(jsonb,text,uuid,jsonb,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_audit_workspace(jsonb,jsonb),public.shared_audit_read_access(jsonb,text,uuid,jsonb,jsonb,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.shared_audit_authorize()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=work_access_context();BEGIN
 IF c->>'actor' IS NULL OR NOT(c->'keys'?|ARRAY['system.audit.view.own','system.audit.view.team','system.audit.view.workspace']) THEN RAISE EXCEPTION 'Sem permissão para consultar auditoria.' USING ERRCODE='42501';END IF;RETURN c;
END$$;
REVOKE ALL ON FUNCTION public.shared_audit_authorize() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_audit_authorize() TO authenticated;
CREATE INDEX audit_logs_snapshot_workspace_created_idx ON public.audit_logs(public.shared_audit_workspace(before,after),created_at DESC);
DO $p$DECLARE p record;BEGIN FOR p IN SELECT policyname,cmd FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND permissive='PERMISSIVE' AND cmd IN('SELECT','ALL') LOOP IF p.cmd='ALL' THEN RAISE EXCEPTION 'Unexpected writable audit policy';END IF;EXECUTE format('DROP POLICY %I ON public.audit_logs',p.policyname);END LOOP;END $p$;
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated USING(public.shared_audit_read_access((SELECT public.work_access_context()),entity,entity_id,before,after,actor_user_id));
-- Base payloads and free-form metadata are never exposed to browser SELECT.
REVOKE SELECT ON public.audit_logs FROM PUBLIC,anon,authenticated;
REVOKE SELECT(before,after,metadata) ON public.audit_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,workspace_owner_id,actor_user_id,entity,entity_id,action,created_at,module_id,session_id) ON public.audit_logs TO authenticated;
CREATE VIEW public.shared_audit_logs WITH(security_barrier=true) AS
SELECT l.id,l.actor_user_id,l.entity,l.entity_id,l.action,l.created_at,l.module_id,
 public.shared_field_mask_row(l.entity,l.before-ARRAY['portal_token','public_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret','password','key_hash','hs_raw']) AS before,
 public.shared_field_mask_row(l.entity,l.after-ARRAY['portal_token','public_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret','password','key_hash','hs_raw']) AS after,
 '{}'::jsonb AS metadata
FROM public.audit_logs l
WHERE public.shared_audit_workspace(l.before,l.after)=((SELECT public.work_access_context())->>'workspace')::uuid
AND public.shared_audit_read_access((SELECT public.work_access_context()),l.entity,l.entity_id,l.before,l.after,l.actor_user_id);
REVOKE ALL ON public.shared_audit_logs FROM PUBLIC,anon;
GRANT SELECT ON public.shared_audit_logs TO authenticated;
NOTIFY pgrst,'reload schema';
