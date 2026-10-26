-- Reuse the authenticated context for audit rows; preserve scope, denies and masking.
CREATE OR REPLACE FUNCTION public.shared_audit_page_read_access(c jsonb,t text,i uuid,b jsonb,a jsonb,u uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid:=shared_audit_workspace(b,a);r text;j jsonb;responsible uuid;current_workspace uuid;present boolean;BEGIN
 IF w IS NULL OR c->>'actor' IS NULL OR w::text IS DISTINCT FROM c->>'workspace' THEN RETURN false;END IF;
 IF NOT(c->'keys'?'system.audit.view.workspace' OR(c->'keys'?'system.audit.view.own' AND c->>'actor'=u::text) OR(c->'keys'?'system.audit.view.team' AND (c->>'actor'=u::text OR c->'team'?u::text))) THEN RETURN false;END IF;
 r:=CASE t WHEN 'leads' THEN 'techsales.leads' WHEN 'contacts' THEN 'techsales.contacts' WHEN 'companies' THEN 'techsales.companies' WHEN 'deals' THEN 'techsales.deals' END;
 IF r IS NULL OR i IS NULL THEN RETURN false;END IF;
 -- These four sales_record_access branches use exactly this workspace/assignee rule.
 -- Do not rebuild work_access_context() for every historical row.
 EXECUTE format('SELECT true,workspace_id,coalesce(assigned_to,owner_id) FROM public.%I WHERE id=$1',t)
 INTO present,current_workspace,responsible USING i;
 IF present THEN
  RETURN public.sales_context_access(c,current_workspace,r,'view',ARRAY[responsible]);
 END IF;
 j:=coalesce(a,b);BEGIN responsible:=coalesce(nullif(j->>'assigned_to',''),nullif(j->>'owner_id',''))::uuid;EXCEPTION WHEN invalid_text_representation THEN RETURN false;END;
 RETURN public.sales_context_access(c,w,r,'view',ARRAY[responsible]);
END $$;
REVOKE ALL ON FUNCTION public.shared_audit_page_read_access(jsonb,text,uuid,jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;


-- Pure projection of caller-supplied JSON using already resolved rules. No row reads.
CREATE OR REPLACE FUNCTION public.shared_audit_mask_row(c jsonb,t text,j jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE r text;k text;v text;BEGIN
 SELECT resource INTO r FROM shared_field_catalog WHERE table_name=t LIMIT 1;
 IF r IS NULL OR j IS NULL THEN RETURN j;END IF;
 FOR k,v IN SELECT key,value FROM jsonb_each_text(coalesce(c->r,'{}')) LOOP
  IF j?k AND v IN('hidden','masked') THEN j:=jsonb_set(j,ARRAY[k],'null'::jsonb);END IF;
 END LOOP;
 FOR k IN SELECT field::text FROM shared_field_catalog WHERE table_name=t AND NOT configurable LOOP
  IF j?k AND public.shared_field_mode_for(c,t,k) IN('hidden','masked') THEN j:=jsonb_set(j,ARRAY[k],'null'::jsonb);END IF;
 END LOOP;RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.shared_audit_mask_row(jsonb,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_audit_mask_row(jsonb,text,jsonb) TO authenticated;

CREATE OR REPLACE VIEW public.shared_audit_logs WITH(security_barrier=true) AS
WITH access AS MATERIALIZED(SELECT public.work_access_context() AS c),
 field_policy AS MATERIALIZED(SELECT public.shared_field_context()->'rules' AS rules)
SELECT l.id,l.actor_user_id,l.entity,l.entity_id,l.action,l.created_at,l.module_id,
 public.shared_audit_mask_row((SELECT rules FROM field_policy),l.entity,l.before-ARRAY['portal_token','public_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret','password','key_hash','hs_raw']) AS before,
 public.shared_audit_mask_row((SELECT rules FROM field_policy),l.entity,l.after-ARRAY['portal_token','public_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret','password','key_hash','hs_raw']) AS after,
 '{}'::jsonb AS metadata
FROM public.audit_logs l
WHERE public.shared_audit_workspace(l.before,l.after)=((SELECT c FROM access)->>'workspace')::uuid
AND public.shared_audit_read_access((SELECT c FROM access),l.entity,l.entity_id,l.before,l.after,l.actor_user_id);
REVOKE ALL ON public.shared_audit_logs FROM PUBLIC,anon;
GRANT SELECT ON public.shared_audit_logs TO authenticated;
NOTIFY pgrst,'reload schema';

-- Select the authorized page before masking snapshots. The limit never precedes
-- tenant/record authorization, and the browser cannot supply an access context.
CREATE OR REPLACE FUNCTION public.shared_audit_list(
 _entity text DEFAULT NULL,_entity_id uuid DEFAULT NULL,_actor uuid DEFAULT NULL,
 _action text DEFAULT NULL,_module text DEFAULT NULL,_since timestamptz DEFAULT NULL,_limit integer DEFAULT 100)
RETURNS SETOF public.shared_audit_logs LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c jsonb:=public.work_access_context();f jsonb;w uuid;BEGIN
 IF c->>'actor' IS NULL OR NOT(c->'keys'?'system.audit.view.workspace' OR c->'keys'?'system.audit.view.team' OR c->'keys'?'system.audit.view.own') THEN RETURN;END IF;
 IF _limit IS NULL OR _limit NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid audit page size' USING ERRCODE='22023';END IF;
 w:=(c->>'workspace')::uuid;
 f:=public.shared_field_context()->'rules';
 RETURN QUERY WITH page AS MATERIALIZED (
  SELECT l.* FROM public.audit_logs l
  WHERE public.shared_audit_workspace(l.before,l.after)=w
   AND (_entity IS NULL OR l.entity=_entity) AND (_entity_id IS NULL OR l.entity_id=_entity_id)
   AND (_actor IS NULL OR l.actor_user_id=_actor) AND (_action IS NULL OR l.action=_action)
   AND (_module IS NULL OR l.module_id=_module) AND (_since IS NULL OR l.created_at>=_since)
   AND public.shared_audit_page_read_access(c,l.entity,l.entity_id,l.before,l.after,l.actor_user_id)
  ORDER BY l.created_at DESC,l.id DESC LIMIT _limit
 ) SELECT l.id,l.actor_user_id,l.entity,l.entity_id,l.action,l.created_at,l.module_id,
 public.shared_audit_mask_row(f,l.entity,l.before-ARRAY['portal_token','public_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret','password','key_hash','hs_raw']),
 public.shared_audit_mask_row(f,l.entity,l.after-ARRAY['portal_token','public_token','access_token','refresh_token','oauth_tokens','credentials_secret_ref','secret','password','key_hash','hs_raw']),
 '{}'::jsonb FROM page l ORDER BY l.created_at DESC,l.id DESC;
END $$;
REVOKE ALL ON FUNCTION public.shared_audit_list(text,uuid,uuid,text,text,timestamptz,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_audit_list(text,uuid,uuid,text,text,timestamptz,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
