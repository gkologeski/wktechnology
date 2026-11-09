-- The lifecycle UI already requires this resource; enforce it for direct RPC too.
CREATE OR REPLACE FUNCTION public.legal_entity_usage(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.finance_business_authorize('legal_entities','view',_id);
 RETURN public._legal_entity_usage_counts(_id);
END $$;
REVOKE ALL ON FUNCTION public.legal_entity_usage(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.legal_entity_usage(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.legal_entities_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.financial_entries_active_entity_guard() FROM PUBLIC,anon,authenticated;
