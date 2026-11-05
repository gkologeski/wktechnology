-- A confirmed hiring event is historical billing evidence, not authorization to recruit again.
-- Current contract/signature, record permission, hired status, event period and financial approval still apply.
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
      WHERE a.id=p_ref AND a.workspace_id=m.workspace_id AND a.status='hired' AND j.deal_id=k.deal_id AND (a.hiring_details->>'model'='hunting' OR coalesce((public.hiring_workflow_recruitment_check(m.workspace_id,a.id)->>'hunting')::boolean,false))
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
END $function$;
NOTIFY pgrst,'reload schema';
