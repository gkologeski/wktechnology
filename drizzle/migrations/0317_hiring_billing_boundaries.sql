-- Gated billing: explicit delivery acceptance, current commercial signature and canonical success event.
INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
 ('techprojects.billing_acceptance.approve.workspace','techprojects','billing_acceptance','approve','workspace','Registrar aceite de entregável','Confirma evidência do aceite do marco concluído; não gera título.',true) ON CONFLICT(key) DO NOTHING;
CREATE TABLE public.hiring_delivery_acceptances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),milestone_id uuid NOT NULL REFERENCES public.project_milestones(id),
 source_hash text NOT NULL,reference text NOT NULL CHECK(length(btrim(reference))>=10),accepted_by uuid NOT NULL,accepted_at timestamptz NOT NULL DEFAULT now(),UNIQUE(milestone_id,source_hash)
);
ALTER TABLE public.hiring_delivery_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hiring_delivery_acceptances FROM PUBLIC,anon,authenticated;GRANT ALL ON public.hiring_delivery_acceptances TO service_role;
CREATE TRIGGER hiring_delivery_acceptances_immutable BEFORE UPDATE OR DELETE ON public.hiring_delivery_acceptances FOR EACH ROW EXECUTE FUNCTION public.hiring_provision_immutable();
CREATE OR REPLACE FUNCTION public.hiring_milestone_accepted(w uuid,p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND finance_gate_enabled)
 OR EXISTS(SELECT 1 FROM project_milestones m JOIN hiring_delivery_acceptances a ON a.milestone_id=m.id AND a.workspace_id=w AND a.source_hash=md5(to_jsonb(m)::text) WHERE m.id=p_id AND m.workspace_id=w)
$$;
REVOKE ALL ON FUNCTION public.hiring_milestone_accepted(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.hiring_milestone_accept(w uuid,p_id uuid,p_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.project_milestones;p public.projects;r uuid;
BEGIN
 PERFORM public.project_bill_assert(w,true,'techprojects.billing_acceptance.approve.workspace');
 IF NOT EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND finance_gate_enabled) THEN RAISE EXCEPTION 'Fluxo financeiro integrado não está ativo.';END IF;
 SELECT * INTO m FROM project_milestones WHERE id=p_id AND workspace_id=w FOR UPDATE;
 SELECT * INTO p FROM projects WHERE id=m.project_id AND workspace_id=w;
 IF m.id IS NULL OR NOT public.work_record_access('techprojects.projects',p.id,'view') OR NOT public.work_record_access('techcontracts.contracts',p.contract_id,'view') THEN RAISE EXCEPTION 'Entregável indisponível.' USING ERRCODE='42501';END IF;
 IF m.status::text<>'done' OR m.completed_at IS NULL THEN RAISE EXCEPTION 'Conclua o entregável antes de registrar o aceite.';END IF;
 IF length(btrim(coalesce(p_reference,'')))<10 THEN RAISE EXCEPTION 'Informe a referência/evidência do aceite (mínimo 10 caracteres).';END IF;
 PERFORM public.hiring_finance_contract_check(w,p.contract_id,(m.completed_at AT TIME ZONE 'America/Sao_Paulo')::date,(m.completed_at AT TIME ZONE 'America/Sao_Paulo')::date);
 INSERT INTO hiring_delivery_acceptances(workspace_id,milestone_id,source_hash,reference,accepted_by)
 VALUES(w,m.id,md5(to_jsonb(m)::text),btrim(p_reference),auth.uid()) ON CONFLICT(milestone_id,source_hash) DO NOTHING RETURNING id INTO r;
 IF r IS NULL THEN SELECT id INTO r FROM hiring_delivery_acceptances WHERE milestone_id=m.id AND source_hash=md5(to_jsonb(m)::text);END IF;
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.hiring_milestone_accept(uuid,uuid,text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.hiring_milestone_accept(uuid,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.project_measurement_compute(p_cfg uuid, p_from date, p_to date, p_self uuid, p_kind text, p_tz text)
 RETURNS TABLE(source_type text, source_id uuid, source_revision integer, project_id uuid, user_id uuid, work_date date, seconds bigint, billed_seconds bigint, quantity numeric, unit text, rate_id uuid, rate_amount numeric, amount numeric, included boolean, issue text, description text, detail jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  c public.project_billing_configs; k public.contracts; s public.services; e record; ms record; r record;
  v_pool bigint := 0; v_use bigint; v_inc int; v_mode text; v_closed boolean; v_line boolean;
  v_base numeric; v_start date; v_end date; v_days int; v_active int; v_carry bigint := 0;
BEGIN
  SELECT * INTO c FROM public.project_billing_configs WHERE id = p_cfg;
  SELECT * INTO k FROM public.contracts WHERE id = c.contract_id;
  IF c.service_id IS NOT NULL THEN SELECT * INTO s FROM public.services WHERE id = c.service_id; END IF;
  v_inc := coalesce((c.params->>'increment_seconds')::int, 1);
  v_mode := coalesce(c.params->>'increment_mode', 'none');
  v_closed := coalesce((c.params->>'require_closed_period')::boolean, true) OR EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=c.workspace_id AND finance_gate_enabled);
  v_line := coalesce(c.params->>'rounding', 'total') = 'line';

  IF c.model IN ('per_hour','package') THEN
    IF c.model = 'package' THEN
      v_carry := coalesce((public.project_package_carry_in(p_cfg, p_from)->>'seconds')::bigint, 0);
      v_pool := coalesce((c.params->>'included_seconds')::bigint, 0) + v_carry;
    END IF;
    FOR e IN
      SELECT t.id, t.revision, t.project_id, t.user_id, t.entry_date, t.status, t.source, t.billable, t.financial_entry_id,
             t.invoiced_at, t.period_closing_id,
             coalesce(t.duration_seconds, round(public.project_entry_seconds(t.started_at, t.stopped_at, t.duration_minutes, t.hours)))::bigint AS secs
        FROM public.project_time_entries t JOIN public.projects p ON p.id = t.project_id
       WHERE t.workspace_id = c.workspace_id AND p.workspace_id = c.workspace_id
         AND t.entry_date BETWEEN p_from AND p_to
         AND (CASE WHEN c.service_id IS NOT NULL THEN p.service_id = c.service_id ELSE p.contract_id = c.contract_id END)
       ORDER BY t.entry_date, t.started_at NULLS LAST, t.id
    LOOP
      source_type := 'time_entry'; source_id := e.id; source_revision := e.revision; project_id := e.project_id;
      user_id := e.user_id; work_date := e.entry_date; seconds := e.secs; billed_seconds := 0; quantity := NULL; unit := 'second';
      rate_id := NULL; rate_amount := NULL; amount := NULL; included := false; issue := NULL; description := NULL; detail := '{}'::jsonb;
      IF EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=c.workspace_id AND finance_gate_enabled) AND (e.entry_date<k.starts_at OR e.entry_date>k.ends_at) THEN issue := 'excluded:outside_contract';
      ELSIF e.status = 'rejected' THEN issue := 'excluded:rejected';
      ELSIF e.source = 'import' OR e.status = 'locked' THEN issue := 'excluded:imported_locked';
      ELSIF NOT coalesce(e.billable, false) THEN issue := 'excluded:not_billable';
      ELSIF e.status IS DISTINCT FROM 'approved' THEN issue := 'excluded:not_approved';
      ELSIF v_closed AND (e.period_closing_id IS NULL OR (EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=c.workspace_id AND finance_gate_enabled) AND NOT EXISTS(SELECT 1 FROM project_period_closings pc WHERE pc.id=e.period_closing_id AND pc.workspace_id=c.workspace_id AND pc.status='closed' AND e.entry_date BETWEEN pc.period_from AND pc.period_to AND ((pc.scope='project' AND pc.project_id=e.project_id) OR (pc.scope='person' AND pc.user_id=e.user_id))))) THEN issue := 'excluded:not_closed';
      ELSIF e.financial_entry_id IS NOT NULL OR e.invoiced_at IS NOT NULL THEN issue := 'excluded:already_billed';
      ELSIF EXISTS (SELECT 1 FROM public.project_measurement_lines l WHERE l.source_type = 'time_entry' AND l.source_id = e.id
                      AND l.active AND l.measurement_id IS DISTINCT FROM p_self) THEN issue := 'excluded:already_measured';
      ELSIF coalesce(e.secs, 0) <= 0 THEN issue := 'excluded:zero_duration';
      ELSE
        included := true;
        billed_seconds := CASE WHEN v_mode = 'up' THEN (ceil(e.secs::numeric / v_inc) * v_inc)::bigint
                               WHEN v_mode = 'nearest' THEN (round(e.secs::numeric / v_inc) * v_inc)::bigint ELSE e.secs END;
        IF c.model = 'package' THEN
          v_use := least(v_pool, billed_seconds); v_pool := v_pool - v_use;
          detail := jsonb_build_object('package_seconds', v_use);
          billed_seconds := billed_seconds - v_use;
        END IF;
        IF billed_seconds > 0 THEN
          SELECT * INTO r FROM public.project_rate_pick(c.workspace_id, 'price', c.currency, e.entry_date, e.project_id, e.user_id);
          IF r.status = 'found' THEN
            rate_id := r.rate_id; rate_amount := r.amount;
            amount := billed_seconds::numeric * r.amount / 3600;
            IF v_line THEN amount := round(amount, 2); END IF;
          ELSE
            issue := CASE WHEN r.status = 'ambiguous' THEN 'rate_ambiguous' ELSE 'rate_missing' END;
          END IF;
        ELSE
          amount := 0;
        END IF;
      END IF;
      RETURN NEXT;
    END LOOP;
    IF c.model = 'package' AND p_kind = 'regular' AND c.params ? 'package_amount' THEN
      source_type := 'package_fee'; source_id := c.id; source_revision := c.version; project_id := NULL; user_id := NULL;
      work_date := p_from; seconds := NULL; billed_seconds := NULL; quantity := 1; unit := 'month'; rate_id := NULL; rate_amount := NULL;
      amount := (c.params->>'package_amount')::numeric; included := true; issue := NULL; description := 'Franquia do pacote';
      detail := jsonb_build_object('included_seconds', (c.params->>'included_seconds')::bigint, 'carry_in_seconds', v_carry);
      RETURN NEXT;
    END IF;
  ELSIF c.model = 'milestone' THEN
    FOR ms IN
      SELECT m.id, m.project_id, m.name, m.billable, m.bill_amount, m.financial_entry_id, (m.completed_at AT TIME ZONE p_tz)::date AS done_on
        FROM public.project_milestones m JOIN public.projects p ON p.id = m.project_id
       WHERE m.workspace_id = c.workspace_id AND p.workspace_id = c.workspace_id AND m.status::text = 'done' AND m.completed_at IS NOT NULL
         AND (m.completed_at AT TIME ZONE p_tz)::date BETWEEN p_from AND p_to
         AND (CASE WHEN c.service_id IS NOT NULL THEN p.service_id = c.service_id ELSE p.contract_id = c.contract_id END)
       ORDER BY m.completed_at, m.id
    LOOP
      source_type := 'milestone'; source_id := ms.id; source_revision := NULL; project_id := ms.project_id; user_id := NULL;
      work_date := ms.done_on; seconds := NULL; billed_seconds := NULL; quantity := 1; unit := 'milestone';
      rate_id := NULL; rate_amount := NULL; amount := NULL; included := false; issue := NULL; description := ms.name;
      detail := jsonb_build_object('bill_amount', ms.bill_amount);
      IF NOT public.hiring_milestone_accepted(c.workspace_id,ms.id) THEN issue := 'excluded:delivery_acceptance_missing';
      ELSIF NOT ms.billable THEN issue := 'excluded:not_billable';
      ELSIF ms.financial_entry_id IS NOT NULL THEN issue := 'excluded:already_billed';
      ELSIF EXISTS (SELECT 1 FROM public.project_measurement_lines l WHERE l.source_type = 'milestone' AND l.source_id = ms.id
                      AND l.active AND l.measurement_id IS DISTINCT FROM p_self) THEN issue := 'excluded:already_measured';
      ELSIF ms.bill_amount IS NULL THEN included := true; issue := 'amount_missing';
      ELSE included := true; amount := ms.bill_amount;
      END IF;
      RETURN NEXT;
    END LOOP;
  ELSIF c.model = 'fixed_recurring' AND p_kind = 'regular' THEN
    source_type := 'service_period'; source_id := coalesce(c.service_id, c.contract_id); source_revision := c.version;
    project_id := NULL; user_id := NULL; work_date := p_from; seconds := NULL; billed_seconds := NULL; quantity := 1; unit := 'month';
    rate_id := NULL; rate_amount := NULL; amount := NULL; included := true; issue := NULL;
    description := coalesce(s.name, k.title, 'Mensalidade');
    v_base := CASE c.params->>'amount_source' WHEN 'service' THEN s.quantity * s.unit_price
                WHEN 'contract_monthly' THEN k.monthly_value ELSE (c.params->>'amount')::numeric END;
    v_start := CASE WHEN c.service_id IS NOT NULL THEN coalesce(s.starts_at, k.starts_at) ELSE k.starts_at END;
    v_end := CASE WHEN c.service_id IS NOT NULL THEN coalesce(s.ends_at, k.ends_at) ELSE k.ends_at END;
    v_days := p_to - p_from + 1;
    v_active := CASE WHEN v_start IS NULL THEN NULL
                     ELSE greatest(0, least(p_to, coalesce(v_end, p_to)) - greatest(p_from, v_start) + 1) END;
    detail := jsonb_build_object('base_amount', v_base, 'period_days', v_days, 'active_days', v_active,
      'proration', c.params->>'proration', 'amount_source', c.params->>'amount_source');
    IF c.service_id IS NOT NULL AND s.status::text IN ('cancelled','paused') THEN issue := 'service_inactive';
    ELSIF c.service_id IS NOT NULL AND s.cadence IS NOT NULL AND s.cadence::text <> 'monthly' THEN issue := 'cadence_unsupported';
    ELSIF v_base IS NULL THEN issue := 'amount_missing';
    ELSIF v_active IS NULL THEN issue := 'start_unknown';
    ELSIF v_active = 0 THEN included := false; issue := 'excluded:inactive_in_period';
    ELSIF c.params->>'proration' = 'calendar_days' THEN
      amount := v_base * v_active / v_days; quantity := round(v_active::numeric / v_days, 6);
    ELSE amount := v_base;
    END IF;
    IF v_line AND amount IS NOT NULL THEN amount := round(amount, 2); END IF;
    RETURN NEXT;
  END IF;
  RETURN;
END $function$
;

CREATE OR REPLACE FUNCTION public.project_measurement_build(p_cfg uuid, p_month date, p_kind text, p_tz text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.project_billing_configs; k public.contracts; v_from date; v_to date; v_id uuid; x public.project_measurements;
BEGIN
  SELECT * INTO c FROM public.project_billing_configs WHERE id = p_cfg;
  PERFORM work_area_authorize('techprojects.measurements','manage');
  IF c.id IS NOT NULL AND NOT work_record_access('techcontracts.contracts',c.contract_id,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Modelo de cobrança não encontrado.'; END IF;
  PERFORM public.project_bill_assert(c.workspace_id, true, 'techprojects.measurements.manage.workspace');
  PERFORM public.hiring_finance_contract_check(c.workspace_id,c.contract_id,date_trunc('month',p_month)::date,(date_trunc('month',p_month)+interval '1 month - 1 day')::date);
  IF p_month IS NULL THEN RAISE EXCEPTION 'Informe a competência.'; END IF;
  v_from := date_trunc('month', p_month)::date; v_to := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  IF c.status <> 'active' OR v_from < c.valid_from OR (c.valid_to IS NOT NULL AND v_from >= c.valid_to) THEN
    RAISE EXCEPTION 'Competência fora da vigência do modelo de cobrança.'; END IF;
  IF v_from > current_date THEN RAISE EXCEPTION 'Competência futura não pode ser medida.'; END IF;
  IF coalesce(p_kind, '') NOT IN ('regular','complement') THEN RAISE EXCEPTION 'Tipo de medição inválido.'; END IF;
  IF p_tz IS NULL OR NOT public.project_time_tz_valid(p_tz) THEN RAISE EXCEPTION 'Fuso horário inválido.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_measurement_cfg:' || p_cfg));
  SELECT * INTO x FROM public.project_measurements WHERE config_id = p_cfg AND period_from = v_from AND kind = 'regular'
     AND status NOT IN ('cancelled','reversed');
  IF p_kind = 'regular' AND x.id IS NOT NULL THEN
    IF x.status = 'draft' THEN RETURN x.id; END IF;
    RAISE EXCEPTION 'Já existe medição desta competência (situação %); use complemento ou estorno.', x.status;
  END IF;
  IF p_kind = 'complement' THEN
    IF x.id IS NULL OR x.status NOT IN ('approved','ready','generated') THEN RAISE EXCEPTION 'Complemento exige medição regular aprovada ou gerada.'; END IF;
    IF c.model IN ('package','fixed_recurring','percent') THEN
      RAISE EXCEPTION 'Complemento deste modelo não é suportado neste ciclo; estorne e refaça a medição.'; END IF;
    IF EXISTS (SELECT 1 FROM public.project_measurements WHERE config_id = p_cfg AND period_from = v_from AND kind = 'complement'
                 AND status IN ('draft','in_review')) THEN RAISE EXCEPTION 'Já existe complemento em andamento nesta competência.'; END IF;
  END IF;
  SELECT * INTO k FROM public.contracts WHERE id = c.contract_id;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  INSERT INTO public.project_measurements (workspace_id, config_id, config_version, contract_id, service_id, company_id, model, currency,
      period_from, period_to, timezone, kind, created_by, rules_snapshot)
  VALUES (c.workspace_id, c.id, c.version, c.contract_id, c.service_id, k.counterparty_company_id, c.model, c.currency,
      v_from, v_to, p_tz, p_kind, auth.uid(),
      jsonb_build_object('policy', 'c4-v1', 'model', c.model, 'params', c.params, 'config_version', c.version, 'currency', c.currency,
        'rate_precedence', jsonb_build_array('monthly_cost', 'exception', 'allocation', 'service', 'person', 'catalog'),
        'imported_locked', 'excluded', 'rounding_scale', 2, 'conversion', 'none'))
  RETURNING id INTO v_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_measurement_fill(v_id);
  PERFORM public.project_measurement_recalc(v_id);
  PERFORM public.project_bill_log(c.workspace_id, 'measurement', v_id, 'created', NULL,
    jsonb_build_object('period', v_from, 'kind', p_kind, 'config_version', c.version));
  RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.project_measurement_generate(p_id uuid, p_hash text, p_due date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m public.project_measurements; k public.contracts; v_fe uuid; v_ref text; v_err text;
BEGIN
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  PERFORM work_area_authorize('techprojects.measurements','view');
  IF m.id IS NOT NULL AND NOT work_record_access('techcontracts.contracts',m.contract_id,'view') THEN RAISE EXCEPTION 'Contrato indisponível.' USING ERRCODE='42501';END IF;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Medição não encontrada.'; END IF;
  IF m.status = 'generated' THEN
    PERFORM public.project_bill_assert(m.workspace_id, false, 'techprojects.measurements.view.workspace');
    RETURN jsonb_build_object('status', 'generated', 'financial_entry_id', m.financial_entry_id, 'idempotent', true);
  END IF;
  m := public.project_measurement_lock(p_id, 'techprojects.measurement_finance.create.workspace', ARRAY['ready','approved','failed','generated']);
  IF m.status = 'generated' THEN
    RETURN jsonb_build_object('status', 'generated', 'financial_entry_id', m.financial_entry_id, 'idempotent', true);
  END IF;
  PERFORM 1 FROM contracts WHERE id=m.contract_id AND workspace_id=m.workspace_id FOR SHARE;
  PERFORM public.hiring_finance_contract_check(m.workspace_id,m.contract_id,m.period_from,m.period_to);
  IF NOT public.user_has_permission(auth.uid(), m.workspace_id, 'techfinance.entries.create.own') THEN
    RAISE EXCEPTION 'Sem permissão para criar títulos no Financeiro.' USING ERRCODE = '42501';
  END IF;
  IF p_due IS NULL THEN RAISE EXCEPTION 'Informe o vencimento.'; END IF;
  PERFORM public.hiring_measurement_source_check(p_id);
  PERFORM public.project_measurement_assert_fresh(m, p_hash);
  IF m.service_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('project_billing_service:' || m.service_id || ':' || to_char(m.period_from, 'YYYY-MM')));
  END IF;
  PERFORM public.project_measurement_recalc(p_id);
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  IF jsonb_array_length(m.blockers) > 0 OR jsonb_array_length(m.gates) > 0 THEN
    RAISE EXCEPTION 'GENERATE_BLOCKED: %', (SELECT string_agg(x->>'code', ', ') FROM jsonb_array_elements(m.blockers || m.gates) x);
  END IF;
  SELECT * INTO k FROM public.contracts WHERE id = m.contract_id;
  v_ref := 'project_measurement:' || m.id || ':' || m.revision;
  PERFORM public.project_measurement_set(p_id, '{"attempt":true}');
  BEGIN
    INSERT INTO public.financial_entries (workspace_id, owner_id, direction, origin_type, origin_id, contract_id, service_id,
        counterparty_company_id, legal_entity_id, description, amount, currency, competence_date, due_date, status, external_ref, metadata, notes)
    VALUES (m.workspace_id, auth.uid(), 'receivable', 'project_measurement', m.id, m.contract_id, m.service_id,
        k.counterparty_company_id, k.contracting_legal_entity_id,
        'Medição ' || to_char(m.period_from, 'MM/YYYY') || ' — ' || coalesce(k.title, k.number, 'Contrato'),
        m.total_amount, m.currency, m.period_from, p_due, 'open', v_ref,
        jsonb_build_object('project_measurement_id', m.id, 'revision', m.revision, 'model', m.model, 'lines_hash', m.lines_hash,
          'period_from', m.period_from, 'period_to', m.period_to),
        'Título interno gerado pela medição. Não é nota fiscal, boleto nem cobrança enviada.')
    ON CONFLICT (workspace_id, external_ref) WHERE external_ref IS NOT NULL DO NOTHING
    RETURNING id INTO v_fe;
    IF v_fe IS NULL THEN
      SELECT id INTO v_fe FROM public.financial_entries WHERE workspace_id = m.workspace_id AND external_ref = v_ref;
    END IF;
    PERFORM set_config('app.project_billing_flow', 'on', true);
    INSERT INTO public.project_measurement_financial_links (workspace_id, measurement_id, financial_entry_id, kind, created_by)
    VALUES (m.workspace_id, m.id, v_fe, 'generated', auth.uid());
    PERFORM set_config('app.project_billing_flow', 'off', true);
    PERFORM public.project_measurement_set(p_id, jsonb_build_object('status', 'generated', 'generated', true, 'financial_entry_id', v_fe));
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    PERFORM public.project_measurement_set(p_id, jsonb_build_object('status', 'failed', 'failure', left(v_err, 500)));
    PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'generate_failed', NULL, jsonb_build_object('error', left(v_err, 500)));
    RETURN jsonb_build_object('status', 'failed', 'error', left(v_err, 500));
  END;
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'generated', NULL,
    jsonb_build_object('financial_entry_id', v_fe, 'amount', m.total_amount, 'due', p_due));
  RETURN jsonb_build_object('status', 'generated', 'financial_entry_id', v_fe);
END $function$
;

CREATE OR REPLACE FUNCTION public.project_billing_config_save(p_ws uuid, p_contract uuid, p_service uuid, p_model text, p_params jsonb, p_valid_from date, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE k public.contracts; s public.services; v_err text; v_prev public.project_billing_configs; v_id uuid; v_legacy int;
BEGIN
 IF NOT work_record_access('techcontracts.contracts',p_contract,'view') OR (p_service IS NOT NULL AND NOT work_record_access('techservice.services',p_service,'view')) THEN RAISE EXCEPTION 'Origem da cobrança indisponível.' USING ERRCODE='42501';END IF;
  PERFORM public.project_bill_assert(p_ws, true, 'techprojects.billing_config.manage.workspace');
  SELECT * INTO k FROM public.contracts WHERE id = p_contract AND workspace_id = p_ws;
  IF k.id IS NULL THEN RAISE EXCEPTION 'Contrato fora do workspace.'; END IF;
  IF k.role::text <> 'provider' THEN RAISE EXCEPTION 'Medição só para contratos em que a empresa presta o serviço.'; END IF;
  IF k.currency IS NULL OR k.currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Contrato sem moeda definida.'; END IF;
  IF p_service IS NOT NULL THEN
    SELECT * INTO s FROM public.services WHERE id = p_service AND workspace_id = p_ws;
    IF s.id IS NULL OR s.contract_id <> p_contract THEN RAISE EXCEPTION 'Serviço não pertence a este contrato.'; END IF;
    IF s.currency IS DISTINCT FROM k.currency THEN RAISE EXCEPTION 'Moeda do serviço difere da do contrato; não há conversão.'; END IF;
  END IF;
  PERFORM public.hiring_finance_contract_check(p_ws,p_contract);
  IF p_model IN('per_hour','package') AND EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=p_ws AND finance_gate_enabled) AND NOT coalesce((p_params->>'require_closed_period')::boolean,true) THEN RAISE EXCEPTION 'Cobrança por horas exige competência fechada.';END IF;
  IF p_model NOT IN ('per_hour','fixed_recurring','package','milestone','percent') THEN RAISE EXCEPTION 'Modelo inválido.'; END IF;
  v_err := public.project_billing_params_check(p_model, coalesce(p_params, '{}'::jsonb));
  IF v_err IS NOT NULL THEN RAISE EXCEPTION '%', v_err; END IF;
  IF p_model = 'fixed_recurring' AND p_params->>'amount_source' = 'service' AND p_service IS NULL THEN RAISE EXCEPTION 'Valor do serviço exige escolher o serviço.'; END IF;
  IF p_model = 'percent' AND p_service IS NULL THEN RAISE EXCEPTION 'Percentual exige o serviço contratado.'; END IF;
  IF p_model = 'percent' AND NOT p_params ? 'percent' AND s.percent IS NULL THEN RAISE EXCEPTION 'Percentual não definido no serviço nem na configuração.'; END IF;
  IF p_valid_from IS NULL OR p_valid_from <> date_trunc('month', p_valid_from)::date THEN RAISE EXCEPTION 'A vigência começa no primeiro dia de um mês.'; END IF;
  IF p_valid_from < date_trunc('month', current_date)::date THEN RAISE EXCEPTION 'Sem retroatividade: a vigência começa no mês corrente ou depois.'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo (mín. 10 caracteres).'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('project_billing_config:' || p_contract));
  -- Uma configuração ativa por escopo e período; configuração do contrato inteiro não convive com a de um serviço dele.
  SELECT * INTO v_prev FROM public.project_billing_configs c WHERE c.contract_id = p_contract AND c.status = 'active'
     AND c.service_id IS NOT DISTINCT FROM p_service AND c.valid_from < p_valid_from AND c.valid_to IS NULL
   ORDER BY c.valid_from DESC LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.project_billing_configs c WHERE c.contract_id = p_contract AND c.status = 'active'
       AND c.id IS DISTINCT FROM v_prev.id
       AND (c.service_id IS NOT DISTINCT FROM p_service OR c.service_id IS NULL OR p_service IS NULL)
       AND daterange(c.valid_from, c.valid_to) && daterange(p_valid_from, NULL)) THEN
    RAISE EXCEPTION 'CONFIG_OVERLAP: já existe modelo de cobrança vigente que cobre este escopo e período.';
  END IF;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  IF v_prev.id IS NOT NULL THEN
    UPDATE public.project_billing_configs SET valid_to = p_valid_from WHERE id = v_prev.id;
  END IF;
  INSERT INTO public.project_billing_configs (workspace_id, contract_id, service_id, model, currency, params, valid_from, version, supersedes_id, reason, created_by)
  VALUES (p_ws, p_contract, p_service, p_model, k.currency, coalesce(p_params, '{}'::jsonb), p_valid_from,
          coalesce(v_prev.version, 0) + 1, v_prev.id, btrim(p_reason), auth.uid())
  RETURNING id INTO v_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  SELECT count(*) INTO v_legacy FROM public.financial_entries fe
   WHERE fe.workspace_id = p_ws AND p_service IS NOT NULL AND fe.service_id = p_service AND fe.competence_date >= p_valid_from
     AND fe.status::text <> 'cancelled';
  PERFORM public.project_bill_log(p_ws, 'billing_config', v_id, 'activated', p_reason,
    jsonb_build_object('model', p_model, 'service_id', p_service, 'valid_from', p_valid_from, 'supersedes', v_prev.id,
      'legacy_service_entries_from_valid_from', v_legacy,
      'legacy_tick_active', s.id IS NOT NULL AND s.status::text = 'active' AND s.type::text = 'recurring' AND s.next_billing_at IS NOT NULL));
  RETURN jsonb_build_object('id', v_id, 'version', coalesce(v_prev.version, 0) + 1, 'legacy_entries', v_legacy);
END $function$
;

CREATE OR REPLACE FUNCTION public.project_measurement_add_success_event(p_id uuid, p_ref_type text, p_ref uuid, p_base numeric, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m public.project_measurements; c public.project_billing_configs; s public.services; v_pct numeric; v_base numeric; v_amt numeric;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurements.manage.workspace', ARRAY['draft']);
  IF m.model <> 'percent' THEN RAISE EXCEPTION 'Evento de sucesso só em modelo percentual.'; END IF;
  SELECT * INTO c FROM public.project_billing_configs WHERE id = m.config_id;
  SELECT * INTO s FROM public.services WHERE id = m.service_id;
  IF EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=m.workspace_id AND finance_gate_enabled) THEN
    IF p_ref_type='ats_offer' THEN SELECT application_id INTO p_ref FROM ats_offers WHERE id=p_ref AND workspace_id=m.workspace_id; p_ref_type:='ats_application';END IF;
    IF p_ref IS NULL OR p_ref_type<>'ats_application' OR NOT EXISTS(
      SELECT 1 FROM ats_applications a JOIN ats_jobs j ON j.id=a.job_id AND j.workspace_id=m.workspace_id JOIN contracts k ON k.id=m.contract_id AND k.workspace_id=m.workspace_id
      WHERE a.id=p_ref AND a.workspace_id=m.workspace_id AND a.status='hired' AND j.deal_id=k.deal_id AND (a.hiring_details->>'model'='hunting' OR coalesce((public.hiring_workflow_recruitment_check(m.workspace_id,a.id)->>'hunting')::boolean,false)) AND coalesce((public.hiring_workflow_recruitment_check(m.workspace_id,a.id)->>'ready')::boolean,false)
      AND EXISTS(SELECT 1 FROM ats_hiring_decisions hd WHERE hd.application_id=a.id AND hd.workspace_id=m.workspace_id AND hd.event='confirmed' AND (hd.created_at AT TIME ZONE m.timezone)::date BETWEEN m.period_from AND m.period_to) AND public.hr_record_access('applications','view',a.id)) THEN RAISE EXCEPTION 'HUNTING_SUCCESS: exige contratação confirmada em candidatura do negócio e acesso à origem.';END IF;
    PERFORM public.hiring_finance_contract_check(m.workspace_id,m.contract_id,m.period_from,m.period_to);
  END IF;
  IF p_ref_type = 'ats_offer' THEN
    IF NOT EXISTS (SELECT 1 FROM public.ats_offers o WHERE o.id = p_ref AND o.workspace_id = m.workspace_id) THEN RAISE EXCEPTION 'Proposta de contratação fora do workspace.'; END IF;
  ELSIF p_ref_type = 'ats_application' THEN
    IF NOT EXISTS (SELECT 1 FROM public.ats_applications a WHERE a.id = p_ref AND a.workspace_id = m.workspace_id) THEN RAISE EXCEPTION 'Candidatura fora do workspace.'; END IF;
  ELSE RAISE EXCEPTION 'Tipo de evento inválido.';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe a evidência do sucesso (mín. 10 caracteres).'; END IF;
  v_pct := coalesce((c.params->>'percent')::numeric, s.percent);
  v_base := CASE WHEN coalesce(c.params->>'base_source', 'service') = 'explicit' THEN p_base ELSE s.percent_base_amount END;
  IF v_pct IS NULL THEN RAISE EXCEPTION 'Percentual não definido.'; END IF;
  IF v_base IS NULL OR v_base <= 0 THEN RAISE EXCEPTION 'Base do percentual não definida (informe no serviço ou de forma explícita).'; END IF;
  v_amt := round(v_base * v_pct / 100, 2);
  PERFORM set_config('app.project_billing_flow', 'on', true);
  INSERT INTO public.project_measurement_lines (workspace_id, measurement_id, line_no, source_type, source_id, amount, included, active,
      description, detail, quantity, unit)
  VALUES (m.workspace_id, p_id, (SELECT coalesce(max(line_no), 0) + 1 FROM public.project_measurement_lines WHERE measurement_id = p_id),
      'success_event', p_ref, v_amt, true, true, 'Sucesso: ' || p_ref_type,
      jsonb_build_object('ref_type', p_ref_type, 'percent', v_pct, 'base', v_base, 'reason', btrim(p_reason)), v_pct, 'percent');
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_measurement_set(p_id, '{"bump":true}');
  PERFORM public.project_measurement_recalc(p_id);
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'success_event_added', p_reason,
    jsonb_build_object('ref_type', p_ref_type, 'ref', p_ref, 'amount', v_amt));
END $function$
;
-- A service worker may check the source, but cannot create premature obligations.
CREATE OR REPLACE FUNCTION public.hiring_workflow_finance_guard(w uuid,p_application uuid,p_actor uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND finance_gate_enabled) THEN RETURN false;END IF;
 IF NOT public.is_workspace_member(w,p_actor) OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND active_workspace_id=w) THEN RAISE EXCEPTION 'Responsável financeiro inativo ou fora do workspace.' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM ats_applications a JOIN ats_jobs j ON j.id=a.job_id AND j.workspace_id=w WHERE a.id=p_application AND a.workspace_id=w AND j.hiring_governed) THEN
 RAISE EXCEPTION 'FINANCE_MONTHLY_FLOW: contratação governada não gera parcelas antecipadas. Use provisão mensal e medição aprovada.';END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.hiring_workflow_finance_guard(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_workflow_finance_guard(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.hiring_financial_entry_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.metadata->>'origin'='workflow_hiring' AND EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=NEW.workspace_id AND finance_gate_enabled)
 AND (EXISTS(SELECT 1 FROM hiring_engagements e WHERE e.workspace_id=NEW.workspace_id AND e.purchase_contract_id=NEW.contract_id)
 OR EXISTS(SELECT 1 FROM ats_applications a JOIN ats_jobs j ON j.id=a.job_id AND j.workspace_id=NEW.workspace_id WHERE a.id::text=NEW.metadata->>'source_id' AND a.workspace_id=NEW.workspace_id AND j.hiring_governed))
 THEN RAISE EXCEPTION 'FINANCE_MONTHLY_FLOW: use provisão e medição; parcelas antecipadas bloqueadas.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hiring_financial_entry_guard BEFORE INSERT ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.hiring_financial_entry_guard();
CREATE OR REPLACE FUNCTION public.hiring_measurement_source_check(p_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.project_measurements;l record;k public.contracts;
BEGIN
 SELECT * INTO m FROM project_measurements WHERE id=p_id;
 IF NOT EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=m.workspace_id AND finance_gate_enabled) THEN RETURN;END IF;
 SELECT * INTO k FROM contracts WHERE id=m.contract_id AND workspace_id=m.workspace_id;
 FOR l IN SELECT * FROM project_measurement_lines WHERE measurement_id=m.id AND included AND active LOOP
  IF l.source_type='success_event' AND NOT EXISTS(SELECT 1 FROM ats_applications a JOIN ats_jobs j ON j.id=a.job_id AND j.workspace_id=m.workspace_id WHERE a.id=l.source_id AND a.workspace_id=m.workspace_id AND a.status='hired' AND j.deal_id=k.deal_id AND EXISTS(SELECT 1 FROM ats_hiring_decisions d WHERE d.application_id=a.id AND d.workspace_id=m.workspace_id AND d.event='confirmed' AND (d.created_at AT TIME ZONE m.timezone)::date BETWEEN m.period_from AND m.period_to)) THEN RAISE EXCEPTION 'HUNTING_SUCCESS: contratação de origem ou competência não é mais válida.';END IF;
  IF l.source_type='milestone' AND NOT public.hiring_milestone_accepted(m.workspace_id,l.source_id) THEN RAISE EXCEPTION 'Aceite do entregável ausente ou alterado.';END IF;
  IF l.source_type='time_entry' AND NOT EXISTS(SELECT 1 FROM project_time_entries t WHERE t.id=l.source_id AND t.workspace_id=m.workspace_id AND t.status::text='approved' AND t.source::text IS DISTINCT FROM 'import' AND t.period_closing_id IS NOT NULL AND t.entry_date>=k.starts_at AND (k.ends_at IS NULL OR t.entry_date<=k.ends_at)) THEN RAISE EXCEPTION 'Horas não aprovadas, não fechadas, importadas ou fora da vigência.';END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.hiring_measurement_source_check(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.project_measurement_approve(p_id uuid, p_hash text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m public.project_measurements; c public.project_billing_configs; v_carry jsonb; v_inc bigint; v_consumed bigint; v_over bigint;
  v_rem bigint; v_out jsonb := '[]'::jsonb; b jsonb; v_take bigint; v_status text;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurements.approve.workspace', ARRAY['in_review']);
  IF auth.uid() = m.created_by OR auth.uid() = m.submitted_by THEN
    RAISE EXCEPTION 'SELF_APPROVAL: quem preparou ou enviou a medição não a aprova.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.hiring_finance_contract_check(m.workspace_id,m.contract_id,m.period_from,m.period_to);
  PERFORM public.hiring_measurement_source_check(p_id);
  PERFORM public.project_measurement_assert_fresh(m, p_hash);
  PERFORM public.project_measurement_recalc(p_id);
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  IF jsonb_array_length(m.blockers) > 0 THEN
    RAISE EXCEPTION 'APPROVE_BLOCKED: %', (SELECT string_agg(x->>'code', ', ') FROM jsonb_array_elements(m.blockers) x);
  END IF;
  IF m.model = 'package' THEN
    SELECT * INTO c FROM public.project_billing_configs WHERE id = m.config_id;
    v_carry := public.project_package_carry_in(c.id, m.period_from);
    v_inc := (c.params->>'included_seconds')::bigint;
    SELECT coalesce(sum((l.detail->>'package_seconds')::bigint), 0), coalesce(sum(l.billed_seconds), 0) INTO v_consumed, v_over
      FROM public.project_measurement_lines l WHERE l.measurement_id = p_id AND l.included AND l.source_type = 'time_entry';
    v_rem := v_consumed;
    FOR b IN SELECT x FROM jsonb_array_elements(v_carry->'buckets') x ORDER BY (x->>'from')::date LOOP
      v_take := least(v_rem, (b->>'seconds')::bigint); v_rem := v_rem - v_take;
      IF (b->>'seconds')::bigint - v_take > 0 THEN
        v_out := v_out || jsonb_build_array(jsonb_build_object('from', b->>'from', 'seconds', (b->>'seconds')::bigint - v_take));
      END IF;
    END LOOP;
    v_take := least(v_rem, v_inc); v_rem := v_rem - v_take;
    IF v_rem <> 0 THEN RAISE EXCEPTION 'Saldo de pacote inconsistente; atualize a medição.'; END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object('from', m.period_from, 'seconds', v_inc - v_take));
    PERFORM set_config('app.project_billing_flow', 'on', true);
    INSERT INTO public.project_package_balances (workspace_id, config_id, measurement_id, period_from, included_seconds, carry_in,
        carry_in_seconds, consumed_seconds, overage_seconds, carry_out)
    VALUES (m.workspace_id, c.id, p_id, m.period_from, v_inc, v_carry->'buckets', (v_carry->>'seconds')::bigint, v_consumed, v_over, v_out);
    PERFORM set_config('app.project_billing_flow', 'off', true);
  END IF;
  v_status := CASE WHEN jsonb_array_length(m.gates) = 0 THEN 'ready' ELSE 'approved' END;
  PERFORM public.project_measurement_set(p_id, jsonb_build_object('status', v_status, 'approved', true));
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'approved', NULL,
    jsonb_build_object('hash', m.lines_hash, 'total', m.total_amount, 'gates', m.gates));
  RETURN v_status;
END $function$
;

NOTIFY pgrst,'reload schema';
