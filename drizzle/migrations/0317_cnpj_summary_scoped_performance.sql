-- CNPJ-ATIVO: resolve authoritative finance scope once, preserving row visibility.
CREATE OR REPLACE FUNCTION public.legal_entities_summary() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w uuid; c jsonb; u uuid; k jsonb; team_ids uuid[]; ew boolean; eo boolean; et boolean; result jsonb;
BEGIN
 w:=public.finance_business_authorize('legal_entities','view',NULL);
 c:=public.finance_access_context(); u:=(c->>'actor')::uuid; k:=c->'keys';
 IF u IS NULL OR c->>'workspace' IS DISTINCT FROM w::text THEN
  RAISE EXCEPTION 'Contexto financeiro indisponível.' USING ERRCODE='42501';
 END IF;
 ew:=public.finance_context_access(c,w,'entries','view',NULL);
 eo:=coalesce(k ? 'techfinance.entries.view.own',false);
 et:=coalesce(k ? 'techfinance.entries.view.team',false);
 SELECT coalesce(array_agg(t::uuid),'{}'::uuid[]) INTO team_ids
 FROM jsonb_object_keys(coalesce(c->'team','{}'::jsonb)) t;
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.name),'[]'::jsonb) INTO result
 FROM (
  SELECT le.id,le.name,le.code,le.cnpj,le.is_default,le.active,
   jsonb_build_object('count',coalesce(t.n,0),'receivable',coalesce(t.receivable,0),'payable',coalesce(t.payable,0)) AS totals
  FROM public.legal_entities le
  LEFT JOIN (
   SELECT e.legal_entity_id,count(*) AS n,
    sum(e.amount) FILTER(WHERE e.direction='receivable') AS receivable,
    sum(e.amount) FILTER(WHERE e.direction='payable') AS payable
   FROM public.financial_entries e
   WHERE e.workspace_id=w AND e.legal_entity_id IS NOT NULL
    AND (ew OR (eo AND coalesce(e.assigned_to,e.owner_id)=u)
      OR (et AND coalesce(e.assigned_to,e.owner_id)=ANY(team_ids)))
   GROUP BY e.legal_entity_id
  ) t ON t.legal_entity_id=le.id
  WHERE le.workspace_id=w AND public.finance_business_access(c,le.workspace_id,'legal_entities','view',le.created_by)
 ) s;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.legal_entities_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.legal_entities_summary() TO authenticated,service_role;