-- The same audience lookup is used by WhatsApp and Sequences. Root RLS and
-- field rules remain mandatory; reading suggestions never grants campaign access.
CREATE OR REPLACE FUNCTION public.whatsapp_campaign_filter_values(
 p_entity text,p_workspace uuid,p_column text,p_custom_key text DEFAULT NULL,p_search text DEFAULT NULL,p_limit int DEFAULT 200)
RETURNS SETOF text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE ctx jsonb;rules jsonb;expr text;source text;lim int:=least(greatest(coalesce(p_limit,200),1),500);BEGIN
 ctx:=public.sales_access_context();
 IF p_entity IS NULL OR p_entity NOT IN('leads','contacts','companies','deals') OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text THEN RAISE EXCEPTION 'Base indisponível.' USING ERRCODE='42501';END IF;
 PERFORM public.sales_area_authorize('techsales.'||p_entity,'view',NULL,NULL);
 rules:=public.shared_field_context()->'rules';
 IF (rules->('techsales.'||p_entity)->>p_column) IN('hidden','masked') OR public.shared_field_mode_for(rules,p_entity,p_column) IN('hidden','masked') THEN RAISE EXCEPTION 'Campo indisponível.' USING ERRCODE='42501';END IF;
 source:='shared_fields_'||p_entity;
 IF p_custom_key IS NOT NULL THEN
  IF p_column IS DISTINCT FROM 'custom_fields' OR p_custom_key !~ '^[a-z0-9_]{1,60}$' OR (rules->('techsales.'||p_entity)->>('cf:'||p_custom_key)) IN('hidden','masked') OR NOT EXISTS(SELECT 1 FROM public.custom_properties cp WHERE cp.workspace_id=p_workspace AND cp.entity=p_entity AND cp.key=p_custom_key AND cp.enabled) THEN RAISE EXCEPTION 'Campo personalizado indisponível.' USING ERRCODE='42501';END IF;
  expr:=format('btrim(custom_fields->>%L)',p_custom_key);
 ELSE
  IF p_column IS NULL OR p_column ~ '^(id|owner_id|workspace_id|deleted_at|portal_token|hs_raw|external_ids|custom_fields|import_batch_id|sync_state_id)$' OR p_column ~ '_digits$' OR p_column ~* '(token|secret|password|hash)' OR p_column ~ '^(hs_|hubspot_)' OR NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=('public.'||source)::regclass AND a.attname=p_column AND a.attnum>0 AND NOT a.attisdropped) THEN RAISE EXCEPTION 'Campo não permitido.' USING ERRCODE='42501';END IF;
  expr:=format('btrim(%I::text)',p_column);
 END IF;
 RETURN QUERY EXECUTE format('SELECT v FROM(SELECT DISTINCT ON(lower(v)) v FROM(SELECT %s v FROM public.%I WHERE workspace_id=$1 AND deleted_at IS NULL) s WHERE v IS NOT NULL AND v<>'''' AND ($2 IS NULL OR v ILIKE ''%%''||$2||''%%'') ORDER BY lower(v),v)d ORDER BY v LIMIT %s',expr,source,lim) USING p_workspace,nullif(btrim(coalesce(p_search,'')),'');
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_campaign_filter_values(text,uuid,text,text,text,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_campaign_filter_values(text,uuid,text,text,text,int) TO authenticated;
