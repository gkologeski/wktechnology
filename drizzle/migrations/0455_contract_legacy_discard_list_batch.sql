-- DESCARTA-LEGADO: classification in one set-based read; no private reason or evidence paths.
CREATE OR REPLACE FUNCTION public.contract_legacy_discarded_ids(w uuid,p_contracts uuid[]) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ctx jsonb:=work_access_context();result jsonb;
BEGIN
 IF auth.uid() IS NULL OR coalesce(array_length(p_contracts,1),0)>200
  OR NOT is_workspace_member(w,auth.uid())
  OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND active_workspace_id=w)
  OR NOT EXISTS(SELECT 1 FROM workspaces WHERE id=w AND coalesce(status,'active')='active') THEN
  RAISE EXCEPTION 'Consulta de contratos indisponível.' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(d.contract_id ORDER BY d.contract_id),'[]') INTO result
 FROM contract_legacy_discards d JOIN contracts c ON c.id=d.contract_id AND c.workspace_id=d.workspace_id
 WHERE d.workspace_id=w AND d.contract_id=ANY(p_contracts)
  AND work_context_access(ctx,w,'techcontracts.contracts','view',ARRAY[coalesce(c.assigned_to,c.owner_id)]);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.contract_legacy_discarded_ids(uuid,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.contract_legacy_discarded_ids(uuid,uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema';