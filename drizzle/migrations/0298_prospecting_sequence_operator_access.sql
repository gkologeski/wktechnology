-- Capability metadata contains decisions only, never existence or business data.
CREATE FUNCTION public.prospecting_sequence_capabilities(p_workspace uuid,p_owners uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ctx jsonb; decisions jsonb;ro boolean;BEGIN
 ctx:=public.sales_access_context();
 IF auth.uid() IS NULL OR ctx->>'workspace' IS DISTINCT FROM p_workspace::text OR cardinality(p_owners)>1000 THEN RAISE EXCEPTION 'Workspace indisponível.' USING ERRCODE='42501';END IF;
 ro:=coalesce((ctx->>'read_only')::boolean,false) OR EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=p_workspace AND m.user_id=auth.uid() AND m.is_test_user);
 SELECT coalesce(jsonb_object_agg(o::text,jsonb_build_object(
 'manage',NOT ro AND public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),o,'manage'),
 'assign',NOT ro AND public.prospecting_sequence_runtime_allowed(p_workspace,auth.uid(),o,'assign'),
 'activity',NOT ro AND public.sales_context_access(ctx,p_workspace,'techsales.activities','view',ARRAY[o]) AND public.sales_context_access(ctx,p_workspace,'techsales.activities','update',ARRAY[o]))),'{}') INTO decisions FROM(SELECT DISTINCT unnest(p_owners) o) q WHERE o IS NOT NULL;
 RETURN jsonb_build_object('readOnly',ro,'owners',decisions);
END $$;
REVOKE ALL ON FUNCTION public.prospecting_sequence_capabilities(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prospecting_sequence_capabilities(uuid,uuid[]) TO authenticated;
CREATE INDEX sequence_runs_version_state ON public.prospecting_sequence_runs(workspace_id,version_id,state);
