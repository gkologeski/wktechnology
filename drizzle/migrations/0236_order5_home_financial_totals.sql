-- Finite Home totals. The ordinary Finance RLS and all role grants stay intact.
-- Resolve authoritative action/scope bits once; avoid copying the entire effective
-- permissions JSON through finance_context_access for every financial row.
CREATE OR REPLACE FUNCTION public.shared_home_financial_totals(p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE hc jsonb:=shared_area_authorize('system.home','view');fc jsonb:=finance_access_context();
 w uuid:=(hc->>'workspace')::uuid;u uuid:=(hc->>'actor')::uuid;k jsonb:=fc->'keys';team_ids uuid[];
 ew boolean;eo boolean;et boolean;pw boolean;po boolean;pt boolean;
 recv numeric;pay numeric;payments numeric;
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from THEN RAISE EXCEPTION 'Período inválido.' USING ERRCODE='22023';END IF;
 IF fc->>'workspace' IS DISTINCT FROM w::text OR fc->>'actor' IS DISTINCT FROM u::text THEN RAISE EXCEPTION 'Contexto financeiro indisponível.' USING ERRCODE='42501';END IF;
 -- The same effective keys and team membership used by finance_context_access.
 -- With literal resource/action and the validated actor/workspace, these scope
 -- bits are its exact predicate (view is also permitted in read-only sessions).
 ew:=finance_context_access(fc,w,'entries','view',NULL);
 pw:=finance_context_access(fc,w,'payments','view',NULL);
 eo:=coalesce(k?'techfinance.entries.view.own',false);
 et:=coalesce(k?'techfinance.entries.view.team',false);
 po:=coalesce(k?'techfinance.payments.view.own',false);
 pt:=coalesce(k?'techfinance.payments.view.team',false);
 SELECT coalesce(array_agg(t::uuid),'{}'::uuid[]) INTO team_ids FROM jsonb_object_keys(coalesce(fc->'team','{}'::jsonb)) t;
 IF ew OR eo OR et THEN
  SELECT coalesce(sum(e.amount) FILTER(WHERE e.direction='receivable'),0),coalesce(sum(e.amount) FILTER(WHERE e.direction='payable'),0) INTO recv,pay
  FROM financial_entries e WHERE e.workspace_id=w AND e.status IN('open','partial','overdue')
   AND (ew OR(eo AND coalesce(e.assigned_to,e.owner_id)=u) OR(et AND coalesce(e.assigned_to,e.owner_id)=ANY(team_ids)));
  IF pw OR po OR pt THEN
   -- Payment visibility is the intersection with the actual parent entry's
   -- visibility and responsible, exactly as finance_context_payment_access.
   SELECT coalesce(sum(p.amount),0) INTO payments FROM financial_payments p
   JOIN financial_entries e ON e.id=p.entry_id AND e.workspace_id=p.workspace_id
   WHERE p.workspace_id=w AND p.paid_at>=p_from AND p.paid_at<=p_to
    AND (ew OR(eo AND coalesce(e.assigned_to,e.owner_id)=u) OR(et AND coalesce(e.assigned_to,e.owner_id)=ANY(team_ids)))
    AND (pw OR(po AND coalesce(e.assigned_to,e.owner_id)=u) OR(pt AND coalesce(e.assigned_to,e.owner_id)=ANY(team_ids)));
  END IF;
 END IF;
 RETURN jsonb_build_object('receivable_open',recv,'payable_open',pay,'payments_in_period',payments);
END $$;
REVOKE ALL ON FUNCTION public.shared_home_financial_totals(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_home_financial_totals(date,date) TO authenticated;
CREATE INDEX IF NOT EXISTS idx_home_financial_open_scope ON public.financial_entries(workspace_id,direction,status) INCLUDE(amount,assigned_to,owner_id) WHERE status IN('open','partial','overdue');
CREATE INDEX IF NOT EXISTS idx_home_financial_payment_period ON public.financial_payments(workspace_id,paid_at,entry_id) INCLUDE(amount);
