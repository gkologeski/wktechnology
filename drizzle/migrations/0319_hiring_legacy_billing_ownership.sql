-- Legacy hiring workers must yield when a configured measurement owns their deal.
CREATE OR REPLACE FUNCTION public.hiring_workflow_finance_guard(w uuid,p_application uuid,p_actor uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=w AND finance_gate_enabled) THEN RETURN false;END IF;
 IF NOT public.is_workspace_member(w,p_actor) OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND active_workspace_id=w) THEN RAISE EXCEPTION 'Responsável financeiro inativo ou fora do workspace.' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM ats_applications a JOIN ats_jobs j ON j.id=a.job_id AND j.workspace_id=w WHERE a.id=p_application AND a.workspace_id=w AND
 (j.hiring_governed OR EXISTS(SELECT 1 FROM project_billing_configs cfg JOIN contracts k ON k.id=cfg.contract_id AND k.workspace_id=w
 WHERE cfg.workspace_id=w AND cfg.status='active' AND k.deal_id=j.deal_id AND cfg.valid_from<=date_trunc('month',current_date)::date AND (cfg.valid_to IS NULL OR cfg.valid_to>date_trunc('month',current_date)::date))))
 THEN RAISE EXCEPTION 'FINANCE_MONTHLY_FLOW: use provisão mensal e medição; a contratação é governada ou a cobrança já tem dono.';END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.hiring_workflow_finance_guard(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_workflow_finance_guard(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.hiring_financial_entry_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.metadata->>'origin'='workflow_hiring' AND EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=NEW.workspace_id AND finance_gate_enabled)
 AND (EXISTS(SELECT 1 FROM hiring_engagements e WHERE e.workspace_id=NEW.workspace_id AND e.purchase_contract_id=NEW.contract_id)
 OR EXISTS(SELECT 1 FROM ats_applications a JOIN ats_jobs j ON j.id=a.job_id AND j.workspace_id=NEW.workspace_id
 WHERE a.id::text=NEW.metadata->>'source_id' AND a.workspace_id=NEW.workspace_id AND (j.hiring_governed OR EXISTS(
 SELECT 1 FROM project_billing_configs cfg JOIN contracts k ON k.id=cfg.contract_id AND k.workspace_id=NEW.workspace_id
 WHERE cfg.workspace_id=NEW.workspace_id AND cfg.status='active' AND k.deal_id=j.deal_id AND NEW.competence_date>=cfg.valid_from AND (cfg.valid_to IS NULL OR NEW.competence_date<cfg.valid_to)))))
 THEN RAISE EXCEPTION 'FINANCE_MONTHLY_FLOW: título de contratação deve passar pelo fechamento e dono da cobrança.';END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.project_measurement_issues(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m public.project_measurements; c public.project_billing_configs; v_blk jsonb; v_gate jsonb := '[]'::jsonb; v_warn jsonb;
  v_n int; v_ids jsonb; v_inc int;
BEGIN
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  SELECT * INTO c FROM public.project_billing_configs WHERE id = m.config_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('code', x.issue, 'count', x.n) ORDER BY x.issue), '[]'::jsonb) INTO v_blk
    FROM (SELECT l.issue, count(*) n FROM public.project_measurement_lines l
           WHERE l.measurement_id = p_id AND l.included AND l.issue IS NOT NULL GROUP BY l.issue) x;
  SELECT coalesce(jsonb_agg(jsonb_build_object('code', substr(x.issue, 10), 'count', x.n, 'seconds', x.secs) ORDER BY x.issue), '[]'::jsonb) INTO v_warn
    FROM (SELECT l.issue, count(*) n, coalesce(sum(l.seconds), 0) secs FROM public.project_measurement_lines l
           WHERE l.measurement_id = p_id AND NOT l.included AND l.issue LIKE 'excluded:%' GROUP BY l.issue) x;
  SELECT count(*) INTO v_inc FROM public.project_measurement_lines l WHERE l.measurement_id = p_id AND l.included;
  IF v_inc = 0 THEN v_blk := v_blk || jsonb_build_array(jsonb_build_object('code', 'no_included_lines', 'count', 0)); END IF;
  IF c.model = 'package' AND NOT coalesce((public.project_package_carry_in(c.id, m.period_from)->>'ok')::boolean, false) THEN
    v_blk := v_blk || jsonb_build_array(jsonb_build_object('code', 'previous_period_unmeasured', 'count', 1));
  END IF;
  IF (SELECT k.role::text FROM public.contracts k WHERE k.id = m.contract_id) <> 'provider' THEN
    v_blk := v_blk || jsonb_build_array(jsonb_build_object('code', 'contract_not_provider', 'count', 1));
  END IF;
  IF m.service_id IS NOT NULL THEN
    SELECT count(*), coalesce(jsonb_agg(fe.id), '[]'::jsonb) INTO v_n, v_ids FROM public.financial_entries fe
     WHERE fe.workspace_id = m.workspace_id AND fe.service_id = m.service_id
       AND fe.competence_date BETWEEN m.period_from AND m.period_to AND fe.status::text <> 'cancelled'
       AND fe.origin_type::text <> 'project_measurement'
       AND NOT EXISTS (SELECT 1 FROM public.project_measurement_financial_links x WHERE x.financial_entry_id = fe.id AND x.active);
    IF v_n > 0 THEN v_gate := v_gate || jsonb_build_array(jsonb_build_object('code', 'legacy_entry_exists', 'count', v_n, 'entries', v_ids)); END IF;
  ELSE
    SELECT count(*) INTO v_n FROM public.financial_entries fe JOIN public.projects p ON p.id = fe.project_id
     WHERE fe.workspace_id = m.workspace_id AND p.contract_id = m.contract_id AND fe.status::text <> 'cancelled'
       AND fe.origin_type::text IN ('service','project_milestone') AND fe.competence_date BETWEEN m.period_from AND m.period_to;
    IF v_n > 0 THEN v_warn := v_warn || jsonb_build_array(jsonb_build_object('code', 'legacy_project_entries', 'count', v_n)); END IF;
  END IF;
  IF coalesce((c.params->>'require_client_acceptance')::boolean, false) THEN
    SELECT count(*) INTO v_n FROM public.project_measurement_lines l JOIN public.project_time_entries t ON t.id = l.source_id
     WHERE l.measurement_id = p_id AND l.included AND l.source_type = 'time_entry' AND t.client_acceptance_id IS NULL;
    IF v_n > 0 THEN v_gate := v_gate || jsonb_build_array(jsonb_build_object('code', 'client_acceptance_missing', 'count', v_n)); END IF;
  END IF;
  IF m.total_amount IS NOT NULL AND m.total_amount <= 0 THEN
    v_gate := v_gate || jsonb_build_array(jsonb_build_object('code', 'zero_total', 'count', 1));
  END IF;
  IF m.model='percent' AND EXISTS(SELECT 1 FROM hiring_workspace_settings WHERE workspace_id=m.workspace_id AND finance_gate_enabled) THEN
    SELECT count(DISTINCT fe.id) INTO v_n FROM project_measurement_lines l JOIN financial_entries fe
    ON fe.workspace_id=m.workspace_id AND fe.metadata->>'origin'='workflow_hiring' AND fe.metadata->>'source_id'=l.source_id::text
    WHERE l.measurement_id=m.id AND l.source_type='success_event' AND l.included AND fe.status::text<>'cancelled'
    AND NOT EXISTS(SELECT 1 FROM project_measurement_financial_links fl WHERE fl.measurement_id=m.id AND fl.financial_entry_id=fe.id AND fl.active);
    IF v_n>0 THEN v_gate:=v_gate||jsonb_build_array(jsonb_build_object('code','hiring_legacy_success_exists','count',v_n));END IF;
  END IF;
  RETURN jsonb_build_object('blockers', v_blk, 'gates', v_gate, 'warnings', v_warn);
END $function$
;
NOTIFY pgrst,'reload schema';

