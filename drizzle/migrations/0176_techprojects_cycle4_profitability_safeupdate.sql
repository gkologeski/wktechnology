-- Ciclo 4: o banco gerenciado recusa UPDATE sem WHERE (safeupdate) nas chamadas da API;
-- a rentabilidade atualizava a tabela temporária da própria consulta sem WHERE. Só acrescenta `WHERE true`.
CREATE OR REPLACE FUNCTION public.project_profitability(p_ws uuid, p_project uuid, p_contract uuid, p_from date, p_to date, p_currency text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rates boolean; v_cur text := upper(btrim(coalesce(p_currency, ''))); v_eff jsonb; v_mc jsonb; v_rev jsonb; v_fin jsonb;
  v_cost_act numeric; v_people jsonb; v_projects jsonb; v_months jsonb; v_other jsonb; v_recon int; v_unattr numeric; v_shared jsonb;
  v_rev_appr numeric; v_cost_est numeric; v_cov numeric; v_total bigint; v_covered bigint; v_margin numeric;
  v_pr_id uuid; v_pr_contract uuid; v_pr_service uuid;
BEGIN
  PERFORM public.project_bill_assert(p_ws, false, 'techprojects.profitability.view.workspace');
  IF (p_project IS NULL) = (p_contract IS NULL) THEN RAISE EXCEPTION 'Informe projeto ou contrato.'; END IF;
  IF p_project IS NOT NULL THEN
    SELECT id, contract_id, service_id INTO v_pr_id, v_pr_contract, v_pr_service FROM public.projects WHERE id = p_project AND workspace_id = p_ws;
    IF v_pr_id IS NULL THEN RAISE EXCEPTION 'Projeto fora do workspace.'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.contracts WHERE id = p_contract AND workspace_id = p_ws) THEN
    RAISE EXCEPTION 'Contrato fora do workspace.';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from <> date_trunc('month', p_from)::date
     OR p_to <> (date_trunc('month', p_to) + interval '1 month - 1 day')::date OR p_to < p_from OR p_to - p_from > 366 THEN
    RAISE EXCEPTION 'Período em meses completos, até 12 meses.'; END IF;
  IF v_cur !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Moeda inválida.'; END IF;
  v_rates := public.user_has_permission(auth.uid(), p_ws, 'techprojects.rates.view.workspace');

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.c4_scope (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE pg_temp.c4_scope;
  INSERT INTO pg_temp.c4_scope SELECT p.id FROM public.projects p WHERE p.workspace_id = p_ws
     AND (p.id = p_project OR (p_contract IS NOT NULL AND (p.contract_id = p_contract
          OR p.service_id IN (SELECT s.id FROM public.services s WHERE s.contract_id = p_contract AND s.workspace_id = p_ws))));

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.c4_entries (id uuid, user_id uuid, project_id uuid, entry_date date, status text, source text,
    billable boolean, person_id uuid, secs bigint, cst text, crate uuid, camt numeric, cscope text, pst text, pamt numeric, covered boolean, cost numeric) ON COMMIT DROP;
  TRUNCATE pg_temp.c4_entries;
  INSERT INTO pg_temp.c4_entries
  SELECT t.id, t.user_id, t.project_id, t.entry_date, t.status, t.source, coalesce(t.billable, false), t.person_id,
         coalesce(t.duration_seconds, round(public.project_entry_seconds(t.started_at, t.stopped_at, t.duration_minutes, t.hours)))::bigint,
         c.status, c.rate_id, c.amount, c.scope, pr.status, pr.amount, false, NULL
    FROM public.project_time_entries t
    LEFT JOIN LATERAL public.project_rate_pick(p_ws, 'cost', v_cur, t.entry_date, t.project_id, t.user_id) c ON true
    LEFT JOIN LATERAL public.project_rate_pick(p_ws, 'price', v_cur, t.entry_date, t.project_id, t.user_id) pr ON true
   WHERE t.workspace_id = p_ws AND t.project_id IN (SELECT id FROM pg_temp.c4_scope)
     AND t.entry_date BETWEEN p_from AND p_to AND t.status IS DISTINCT FROM 'rejected';
  -- Custo mensal só cobre a hora se a alocação é deste escopo (projeto) — senão não é atribuível.
  UPDATE pg_temp.c4_entries e SET covered = CASE
      WHEN e.cst = 'found' THEN true
      WHEN e.cst = 'monthly' AND e.cscope = 'allocation' THEN EXISTS (SELECT 1 FROM public.project_rates r JOIN public.people_allocations a ON a.id = r.allocation_id
             WHERE r.id = e.crate AND (a.project_id = e.project_id OR (p_contract IS NOT NULL AND a.service_id IN (SELECT s.id FROM public.services s WHERE s.contract_id = p_contract))))
      ELSE false END,
    cost = CASE WHEN e.cst = 'found' THEN e.secs::numeric * e.camt / 3600 ELSE 0 END
  WHERE true;

  SELECT jsonb_build_object(
      'total_seconds', coalesce(sum(secs), 0),
      'approved_seconds', coalesce(sum(secs) FILTER (WHERE status = 'approved'), 0),
      'pending_seconds', coalesce(sum(secs) FILTER (WHERE status IN ('draft','submitted')), 0),
      'imported_seconds', coalesce(sum(secs) FILTER (WHERE source = 'import' OR status = 'locked'), 0),
      'billable_seconds', coalesce(sum(secs) FILTER (WHERE billable), 0),
      'cost_covered_seconds', coalesce(sum(secs) FILTER (WHERE covered), 0),
      'cost_ambiguous_seconds', coalesce(sum(secs) FILTER (WHERE cst = 'ambiguous'), 0),
      'price_covered_seconds', coalesce(sum(secs) FILTER (WHERE pst = 'found'), 0),
      'person_linked_seconds', coalesce(sum(secs) FILTER (WHERE person_id IS NOT NULL), 0),
      'cost_hourly', round(coalesce(sum(cost), 0), 2),
      'partial_seconds', coalesce(sum(secs) FILTER (WHERE cst = 'found' AND pst = 'found' AND billable), 0),
      'partial_price_value', round(coalesce(sum(secs::numeric * pamt / 3600) FILTER (WHERE cst = 'found' AND pst = 'found' AND billable), 0), 2),
      'partial_cost', round(coalesce(sum(cost) FILTER (WHERE cst = 'found' AND pst = 'found' AND billable), 0), 2))
    INTO v_eff FROM pg_temp.c4_entries;

  -- Custo mensal alocado (sem converter para hora), por mês, com pró-rata declarada na tarifa.
  WITH months AS (SELECT g::date AS m0, (g + interval '1 month - 1 day')::date AS m1 FROM generate_series(p_from, p_to, interval '1 month') g),
  r AS (SELECT r.id, r.amount, r.proration, r.valid_from, r.valid_to, a.starts_at, a.ends_at FROM public.project_rates r
          JOIN public.people_allocations a ON a.id = r.allocation_id
         WHERE r.workspace_id = p_ws AND r.kind = 'cost' AND r.unit = 'month' AND r.currency = v_cur AND r.status = 'active'
           AND (a.project_id IN (SELECT id FROM pg_temp.c4_scope)
                OR (p_contract IS NOT NULL AND a.service_id IN (SELECT s.id FROM public.services s WHERE s.contract_id = p_contract)))),
  w AS (SELECT r.*, mo.m0, mo.m1,
          greatest(0, least(mo.m1, coalesce(r.valid_to - 1, mo.m1), coalesce(r.ends_at, mo.m1)) - greatest(mo.m0, r.valid_from, r.starts_at) + 1) AS days,
          (mo.m1 - mo.m0 + 1) AS mdays FROM r CROSS JOIN months mo)
  SELECT jsonb_build_object('amount', round(coalesce(sum(CASE WHEN w.days = 0 THEN 0 WHEN w.proration = 'full_month' THEN w.amount
                                                   ELSE w.amount * w.days / w.mdays END), 0), 2),
                            'rates', count(DISTINCT w.id))
    INTO v_mc FROM w;

  -- Receitas por situação (nunca somadas entre si).
  WITH ms AS (SELECT m.* FROM public.project_measurements m WHERE m.workspace_id = p_ws AND m.currency = v_cur
                 AND m.period_from BETWEEN p_from AND p_to
                 AND CASE WHEN p_contract IS NOT NULL THEN m.contract_id = p_contract
                     ELSE (m.service_id IS NOT NULL AND m.service_id = v_pr_service) OR (m.service_id IS NULL AND m.contract_id = v_pr_contract)
                       OR EXISTS (SELECT 1 FROM public.project_measurement_lines l WHERE l.measurement_id = m.id AND l.included AND l.project_id = p_project) END),
  val AS (SELECT ms.*, CASE WHEN p_contract IS NOT NULL THEN ms.total_amount
             ELSE (SELECT round(coalesce(sum(l.amount), 0), 2) FROM public.project_measurement_lines l
                    WHERE l.measurement_id = ms.id AND l.included AND l.project_id = p_project) END AS v,
             CASE WHEN p_contract IS NOT NULL THEN 0
             ELSE (SELECT round(coalesce(sum(l.amount), 0), 2) FROM public.project_measurement_lines l
                    WHERE l.measurement_id = ms.id AND l.included AND l.project_id IS NULL) END AS unattr,
             NOT EXISTS (SELECT 1 FROM public.project_measurement_lines l WHERE l.measurement_id = ms.id AND l.included
                           AND (l.project_id IS NULL OR l.project_id <> p_project)) AS exclusive
           FROM ms)
  SELECT jsonb_build_object(
      'forecast', round(coalesce(sum(v) FILTER (WHERE status IN ('draft','in_review')), 0), 2),
      'approved', round(coalesce(sum(v) FILTER (WHERE status IN ('approved','ready','generated','failed')), 0), 2),
      'reversed', round(coalesce(sum(v) FILTER (WHERE status = 'reversed'), 0), 2),
      'unknown_amount', count(*) FILTER (WHERE total_amount IS NULL AND status NOT IN ('cancelled','reversed')),
      'unattributed_approved', round(coalesce(sum(unattr) FILTER (WHERE status IN ('approved','ready','generated','failed')), 0), 2),
      'count', count(*) FILTER (WHERE status NOT IN ('cancelled'))),
    jsonb_build_object(
      'launched', round(coalesce((SELECT sum(fe.amount) FROM public.project_measurement_financial_links x JOIN public.financial_entries fe ON fe.id = x.financial_entry_id
          WHERE x.active AND x.measurement_id IN (SELECT id FROM val WHERE p_contract IS NOT NULL OR exclusive) AND fe.status::text <> 'cancelled' AND fe.currency = v_cur), 0), 2),
      'received', round(coalesce((SELECT sum(fe.paid_amount) FROM public.project_measurement_financial_links x JOIN public.financial_entries fe ON fe.id = x.financial_entry_id
          WHERE x.active AND x.measurement_id IN (SELECT id FROM val WHERE p_contract IS NOT NULL OR exclusive) AND fe.status::text <> 'cancelled' AND fe.currency = v_cur), 0), 2),
      'shared_measurements', count(*) FILTER (WHERE p_contract IS NULL AND NOT exclusive AND status IN ('generated')))
    INTO v_rev, v_fin FROM val;

  SELECT round(coalesce(sum(fe.amount), 0), 2) INTO v_cost_act FROM public.financial_entries fe
   WHERE fe.workspace_id = p_ws AND fe.direction::text = 'payable' AND fe.status::text <> 'cancelled' AND fe.currency = v_cur
     AND fe.competence_date BETWEEN p_from AND p_to
     AND (fe.project_id IN (SELECT id FROM pg_temp.c4_scope) OR (p_contract IS NOT NULL AND fe.contract_id = p_contract));

  SELECT coalesce(jsonb_agg(DISTINCT x.cur), '[]'::jsonb) INTO v_other FROM (
    SELECT m.currency AS cur FROM public.project_measurements m WHERE m.workspace_id = p_ws AND m.currency <> v_cur
       AND m.period_from BETWEEN p_from AND p_to AND (m.contract_id = coalesce(p_contract, v_pr_contract))
    UNION SELECT fe.currency FROM public.financial_entries fe WHERE fe.workspace_id = p_ws AND fe.currency <> v_cur AND fe.status::text <> 'cancelled'
       AND fe.competence_date BETWEEN p_from AND p_to AND (fe.project_id IN (SELECT id FROM pg_temp.c4_scope) OR (p_contract IS NOT NULL AND fe.contract_id = p_contract))
    UNION SELECT r.currency FROM public.project_rates r WHERE r.workspace_id = p_ws AND r.currency <> v_cur AND r.status = 'active') x;

  SELECT count(*) INTO v_recon FROM public.project_reconciliation_issues i
   WHERE i.workspace_id = p_ws AND i.status = 'open' AND i.project_id IN (SELECT id FROM pg_temp.c4_scope);

  SELECT coalesce(jsonb_agg(jsonb_build_object('month', mo, 'seconds', s, 'cost_hourly', c) ORDER BY mo), '[]'::jsonb)
    INTO v_months FROM (SELECT date_trunc('month', entry_date)::date mo, sum(secs) s, round(sum(cost), 2) c FROM pg_temp.c4_entries GROUP BY 1) q;

  IF v_rates THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', q.user_id, 'name', pf.full_name, 'seconds', q.s, 'covered_seconds', q.cs,
             'cost_hourly', q.c) ORDER BY q.s DESC), '[]'::jsonb)
      INTO v_people FROM (SELECT user_id, sum(secs) s, sum(secs) FILTER (WHERE covered) cs, round(sum(cost), 2) c FROM pg_temp.c4_entries GROUP BY 1) q
      LEFT JOIN public.profiles pf ON pf.id = q.user_id;
  END IF;
  IF p_contract IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('project_id', q.project_id, 'name', p.name, 'seconds', q.s, 'covered_seconds', q.cs) ORDER BY q.s DESC), '[]'::jsonb)
      INTO v_projects FROM (SELECT project_id, sum(secs) s, sum(secs) FILTER (WHERE covered) cs FROM pg_temp.c4_entries GROUP BY 1) q
      JOIN public.projects p ON p.id = q.project_id;
  END IF;

  v_total := (v_eff->>'total_seconds')::bigint;
  v_covered := (v_eff->>'cost_covered_seconds')::bigint;
  v_cost_est := (v_eff->>'cost_hourly')::numeric + (v_mc->>'amount')::numeric;
  v_rev_appr := (v_rev->>'approved')::numeric;
  v_cov := CASE WHEN v_total > 0 THEN round(v_covered::numeric * 100 / v_total, 2) END;
  v_margin := CASE WHEN v_total = v_covered THEN v_rev_appr - v_cost_est END;

  RETURN jsonb_build_object(
    'currency', v_cur, 'period_from', p_from, 'period_to', p_to, 'scope', CASE WHEN p_contract IS NOT NULL THEN 'contract' ELSE 'project' END,
    'can_view_rates', v_rates,
    'effort', v_eff - 'cost_hourly' - 'partial_cost' - 'partial_price_value',
    'revenue', v_rev, 'finance', v_fin,
    'cost', jsonb_build_object('estimated', round(v_cost_est, 2), 'hourly', (v_eff->>'cost_hourly')::numeric, 'monthly_allocated', v_mc->'amount',
       'monthly_rates', v_mc->'rates', 'actual_payables', v_cost_act),
    'coverage', jsonb_build_object('cost_pct', v_cov,
       'price_pct', CASE WHEN v_total > 0 THEN round((v_eff->>'price_covered_seconds')::numeric * 100 / v_total, 2) END,
       'person_link_pct', CASE WHEN v_total > 0 THEN round((v_eff->>'person_linked_seconds')::numeric * 100 / v_total, 2) END),
    'margin', jsonb_build_object(
       'estimated', v_margin,
       'estimated_pct', CASE WHEN v_margin IS NOT NULL AND v_rev_appr > 0 THEN round(v_margin * 100 / v_rev_appr, 2) END,
       'status', CASE WHEN v_margin IS NULL THEN 'unknown' ELSE 'complete' END,
       'partial_hours', jsonb_build_object('seconds', v_eff->'partial_seconds', 'price_value', v_eff->'partial_price_value',
          'cost', v_eff->'partial_cost', 'margin', (v_eff->>'partial_price_value')::numeric - (v_eff->>'partial_cost')::numeric,
          'margin_pct', CASE WHEN (v_eff->>'partial_price_value')::numeric > 0
             THEN round(((v_eff->>'partial_price_value')::numeric - (v_eff->>'partial_cost')::numeric) * 100 / (v_eff->>'partial_price_value')::numeric, 2) END),
       'actual', v_rev_appr - v_cost_act,
       'actual_pct', CASE WHEN v_rev_appr > 0 THEN round((v_rev_appr - v_cost_act) * 100 / v_rev_appr, 2) END),
    'months', v_months, 'people', v_people, 'projects', v_projects,
    'other_currencies', v_other, 'reconciliation_open', v_recon);
END $$;
REVOKE ALL ON FUNCTION public.project_profitability(uuid, uuid, uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_profitability(uuid, uuid, uuid, date, date, text) TO authenticated;

