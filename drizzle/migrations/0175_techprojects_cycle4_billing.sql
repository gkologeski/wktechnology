-- TechProjects Ciclo 4 (itens 10–11): tarifas e custos com vigência, medição por modelo contratual,
-- integração com o Financeiro existente (financial_entries) e rentabilidade.
-- Aditiva: nenhuma linha existente é alterada; nenhuma tarifa, configuração ou medição é criada.
-- Gravação só pelas funções abaixo (flag transacional `app.project_billing_flow`); leitura por RLS + permissão.

ALTER TYPE public.financial_origin_type ADD VALUE IF NOT EXISTS 'project_measurement';

INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
 ('techprojects.rates.view.workspace', 'techprojects', 'rates', 'view', 'workspace',
  'Ver tarifas e custos', 'Exibe custos individuais e preços com vigência, inclusive em exportações.', true),
 ('techprojects.rates.manage.workspace', 'techprojects', 'rates', 'manage', 'workspace',
  'Gerenciar tarifas e custos', 'Cria, divide e encerra vigências de custo e preço, com trilha e prévia de impacto.', true),
 ('techprojects.billing_config.manage.workspace', 'techprojects', 'billing_config', 'manage', 'workspace',
  'Configurar modelo de cobrança', 'Define o modelo de medição do contrato/serviço e assume a cobrança a partir do mês corrente (sem retroatividade).', true),
 ('techprojects.measurements.view.workspace', 'techprojects', 'measurements', 'view', 'workspace',
  'Ver medições', 'Exibe medições, composição, pendências e trilha.', true),
 ('techprojects.measurements.manage.workspace', 'techprojects', 'measurements', 'manage', 'workspace',
  'Preparar medições', 'Cria rascunhos, ajustes e envia medições para revisão.', true),
 ('techprojects.measurements.approve.workspace', 'techprojects', 'measurements', 'approve', 'workspace',
  'Aprovar medições', 'Aprova medição revisada; quem preparou ou enviou não aprova.', true),
 ('techprojects.measurement_finance.create.workspace', 'techprojects', 'measurement_finance', 'create', 'workspace',
  'Gerar medição no Financeiro', 'Gera o título interno a receber da medição aprovada (não emite nota, boleto nem cobra).', true),
 ('techprojects.measurement_reverse.manage.workspace', 'techprojects', 'measurement_reverse', 'manage', 'workspace',
  'Estornar medição', 'Estorna medição gerada sem pagamento ou cobrança bancária, preservando a trilha.', true),
 ('techprojects.profitability.view.workspace', 'techprojects', 'profitability', 'view', 'workspace',
  'Ver rentabilidade', 'Receitas separadas, custo estimado e real, cobertura e margem de projetos e contratos.', true)
ON CONFLICT (key) DO NOTHING;

-- =========================================================== utilitários
CREATE OR REPLACE FUNCTION public.project_bill_assert(p_ws uuid, p_write boolean, p_key text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.project_time_assert_actor(p_ws, p_write);
  IF NOT public.user_has_permission(auth.uid(), p_ws, p_key) THEN
    RAISE EXCEPTION 'Sem permissão (%).', p_key USING ERRCODE = '42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.project_bill_assert(uuid, boolean, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_billing_guard_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.project_billing_flow', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Alteração direta bloqueada: use as ações de Tarifas/Medições.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TABLE public.project_billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('rate','billing_config','measurement')),
  entity_id uuid,
  action text NOT NULL,
  actor uuid,
  reason text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_billing_events_entity_idx ON public.project_billing_events (workspace_id, entity_type, entity_id, created_at DESC);
GRANT SELECT ON public.project_billing_events TO authenticated;
GRANT ALL ON public.project_billing_events TO service_role;
ALTER TABLE public.project_billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY pbe_select ON public.project_billing_events FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND CASE WHEN entity_type = 'rate'
                  THEN public.user_has_permission(auth.uid(), workspace_id, 'techprojects.rates.view.workspace')
                  ELSE public.user_has_permission(auth.uid(), workspace_id, 'techprojects.measurements.view.workspace') END);
CREATE TRIGGER project_billing_events_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_billing_events
  FOR EACH ROW EXECUTE FUNCTION public.project_billing_guard_write();

CREATE OR REPLACE FUNCTION public.project_bill_log(p_ws uuid, p_type text, p_id uuid, p_action text, p_reason text, p_detail jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.project_billing_flow', 'on', true);
  INSERT INTO public.project_billing_events (workspace_id, entity_type, entity_id, action, actor, reason, detail)
  VALUES (p_ws, p_type, p_id, p_action, auth.uid(), p_reason, coalesce(p_detail, '{}'::jsonb));
  PERFORM set_config('app.project_billing_flow', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.project_bill_log(uuid, text, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- =========================================================== 1. tarifas e custos com vigência [início, fim)
CREATE TABLE public.project_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cost','price')),
  scope text NOT NULL CHECK (scope IN ('exception','allocation','service','person','catalog')),
  project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT,
  user_id uuid,
  allocation_id uuid REFERENCES public.people_allocations(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES public.services(id) ON DELETE RESTRICT,
  person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT,
  service_catalog_id uuid REFERENCES public.service_catalog(id) ON DELETE RESTRICT,
  unit text NOT NULL CHECK (unit IN ('hour','month')),
  proration text CHECK (proration IN ('full_month','calendar_days')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount numeric(20,6) NOT NULL CHECK (amount >= 0),
  valid_from date NOT NULL,
  valid_to date,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.project_rates(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  confirmed_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_rates_window CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT project_rates_month_unit CHECK ((unit = 'month') = (proration IS NOT NULL)),
  CONSTRAINT project_rates_month_only_cost CHECK (unit = 'hour' OR (kind = 'cost' AND scope IN ('allocation','person'))),
  CONSTRAINT project_rates_scope_keys CHECK (
    (scope = 'exception' AND project_id IS NOT NULL AND user_id IS NOT NULL AND confirmed_by IS NOT NULL
       AND allocation_id IS NULL AND service_id IS NULL AND person_id IS NULL AND service_catalog_id IS NULL)
    OR (scope = 'allocation' AND allocation_id IS NOT NULL AND project_id IS NULL AND user_id IS NULL AND service_id IS NULL AND person_id IS NULL AND service_catalog_id IS NULL)
    OR (scope = 'service' AND service_id IS NOT NULL AND project_id IS NULL AND user_id IS NULL AND allocation_id IS NULL AND person_id IS NULL AND service_catalog_id IS NULL)
    OR (scope = 'person' AND person_id IS NOT NULL AND project_id IS NULL AND user_id IS NULL AND allocation_id IS NULL AND service_id IS NULL AND service_catalog_id IS NULL)
    OR (scope = 'catalog' AND service_catalog_id IS NOT NULL AND project_id IS NULL AND user_id IS NULL AND allocation_id IS NULL AND service_id IS NULL AND person_id IS NULL))
);
CREATE INDEX project_rates_lookup_idx ON public.project_rates (workspace_id, kind, currency, scope, status);
GRANT SELECT ON public.project_rates TO authenticated;
GRANT ALL ON public.project_rates TO service_role;
ALTER TABLE public.project_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_rates_select ON public.project_rates FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_has_permission(auth.uid(), workspace_id, 'techprojects.rates.view.workspace'));

-- Valor, escopo, moeda e unidade são imutáveis; só a vigência final muda (divisão/encerramento) pelo fluxo.
CREATE OR REPLACE FUNCTION public.project_rates_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.project_billing_flow', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Alteração direta bloqueada: use as ações de Tarifas.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Tarifa não é excluída; encerre a vigência.' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.amount IS DISTINCT FROM OLD.amount OR NEW.currency IS DISTINCT FROM OLD.currency
      OR NEW.unit IS DISTINCT FROM OLD.unit OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.scope IS DISTINCT FROM OLD.scope
      OR NEW.valid_from IS DISTINCT FROM OLD.valid_from OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.allocation_id IS DISTINCT FROM OLD.allocation_id OR NEW.service_id IS DISTINCT FROM OLD.service_id
      OR NEW.person_id IS DISTINCT FROM OLD.person_id OR NEW.service_catalog_id IS DISTINCT FROM OLD.service_catalog_id) THEN
    RAISE EXCEPTION 'Valor e escopo da tarifa são imutáveis; divida a vigência.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER project_rates_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_rates
  FOR EACH ROW EXECUTE FUNCTION public.project_rates_guard();

-- Precedência declarada (testada): custo mensal da alocação/pessoa cobre a hora (sem converter);
-- depois exceção confirmada > alocação > serviço contratado > pessoa > padrão do catálogo.
-- Mais de uma vigência no mesmo nível = ambígua (nunca escolhe a primeira). Ausente = desconhecido (não zero).
CREATE OR REPLACE FUNCTION public.project_rate_pick(p_ws uuid, p_kind text, p_currency text, p_date date, p_project uuid, p_user uuid,
  OUT status text, OUT rate_id uuid, OUT amount numeric, OUT scope text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_service uuid; v_cat uuid; v_n int; v_id uuid; v_amt numeric; v_lvl text;
BEGIN
  status := 'missing';
  IF NOT EXISTS (SELECT 1 FROM public.project_rates r WHERE r.workspace_id = p_ws AND r.kind = p_kind
                    AND r.currency = p_currency AND r.status = 'active') THEN RETURN; END IF;
  SELECT p.service_id, coalesce(li.service_catalog_id, sli.service_catalog_id) INTO v_service, v_cat
    FROM public.projects p
    LEFT JOIN public.deal_line_items li ON li.id = p.source_line_item_id
    LEFT JOIN public.services s ON s.id = p.service_id
    LEFT JOIN public.deal_line_items sli ON sli.id = s.source_deal_line_item_id
   WHERE p.id = p_project AND p.workspace_id = p_ws;
  IF p_kind = 'cost' THEN
    SELECT count(*), min(r.id::text)::uuid, min(r.scope) INTO v_n, v_id, v_lvl FROM public.project_rates r
     WHERE r.workspace_id = p_ws AND r.kind = 'cost' AND r.unit = 'month' AND r.currency = p_currency AND r.status = 'active'
       AND r.valid_from <= p_date AND (r.valid_to IS NULL OR p_date < r.valid_to)
       AND ((r.scope = 'allocation' AND r.allocation_id IN (
              SELECT a.id FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
               WHERE a.workspace_id = p_ws AND pe.profile_id = p_user
                 AND (a.project_id = p_project OR (v_service IS NOT NULL AND a.service_id = v_service))
                 AND a.starts_at <= p_date AND (a.ends_at IS NULL OR a.ends_at >= p_date)))
         OR (r.scope = 'person' AND r.person_id IN (SELECT pe.id FROM public.people pe WHERE pe.workspace_id = p_ws AND pe.profile_id = p_user)));
    IF v_n = 1 THEN status := 'monthly'; rate_id := v_id; scope := v_lvl; RETURN;
    ELSIF v_n > 1 THEN status := 'ambiguous'; scope := 'monthly'; RETURN; END IF;
  END IF;
  FOREACH v_lvl IN ARRAY ARRAY['exception','allocation','service','person','catalog'] LOOP
    SELECT count(*), min(r.id::text)::uuid, min(r.amount) INTO v_n, v_id, v_amt FROM public.project_rates r
     WHERE r.workspace_id = p_ws AND r.kind = p_kind AND r.unit = 'hour' AND r.currency = p_currency
       AND r.status = 'active' AND r.scope = v_lvl
       AND r.valid_from <= p_date AND (r.valid_to IS NULL OR p_date < r.valid_to)
       AND CASE v_lvl
             WHEN 'exception' THEN r.project_id = p_project AND r.user_id = p_user
             WHEN 'allocation' THEN r.allocation_id IN (
               SELECT a.id FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
                WHERE a.workspace_id = p_ws AND pe.profile_id = p_user
                  AND (a.project_id = p_project OR (v_service IS NOT NULL AND a.service_id = v_service))
                  AND a.starts_at <= p_date AND (a.ends_at IS NULL OR a.ends_at >= p_date))
             WHEN 'service' THEN v_service IS NOT NULL AND r.service_id = v_service
             WHEN 'person' THEN r.person_id IN (SELECT pe.id FROM public.people pe WHERE pe.workspace_id = p_ws AND pe.profile_id = p_user)
             ELSE v_cat IS NOT NULL AND r.service_catalog_id = v_cat END;
    IF v_n = 1 THEN status := 'found'; rate_id := v_id; amount := v_amt; scope := v_lvl; RETURN;
    ELSIF v_n > 1 THEN status := 'ambiguous'; scope := v_lvl; RETURN; END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.project_rate_pick(uuid, text, text, date, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Alvo validado no workspace; devolve a chave do escopo (texto) para trava e sobreposição.
CREATE OR REPLACE FUNCTION public.project_rate_target_key(p_ws uuid, p_scope text, p_target jsonb)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; v2 uuid;
BEGIN
  IF p_scope = 'exception' THEN
    v := nullif(p_target->>'project_id', '')::uuid; v2 := nullif(p_target->>'user_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Projeto fora do workspace.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = p_ws AND user_id = v2) THEN RAISE EXCEPTION 'Pessoa fora do workspace.'; END IF;
    IF NOT coalesce((p_target->>'confirm_exception')::boolean, false) THEN RAISE EXCEPTION 'Exceção específica exige confirmação explícita.'; END IF;
    RETURN v::text || ':' || v2::text;
  ELSIF p_scope = 'allocation' THEN
    v := nullif(p_target->>'allocation_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.people_allocations WHERE id = v AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Alocação fora do workspace.'; END IF;
  ELSIF p_scope = 'service' THEN
    v := nullif(p_target->>'service_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.services WHERE id = v AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Serviço fora do workspace.'; END IF;
  ELSIF p_scope = 'person' THEN
    v := nullif(p_target->>'person_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.people WHERE id = v AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Pessoa fora do workspace.'; END IF;
  ELSIF p_scope = 'catalog' THEN
    v := nullif(p_target->>'service_catalog_id', '')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.service_catalog WHERE id = v AND workspace_id = p_ws) THEN RAISE EXCEPTION 'Serviço do catálogo fora do workspace.'; END IF;
  ELSE RAISE EXCEPTION 'Escopo inválido.';
  END IF;
  RETURN v::text;
END $$;
REVOKE ALL ON FUNCTION public.project_rate_target_key(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_rate_key_of(r public.project_rates)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE r.scope WHEN 'exception' THEN r.project_id::text || ':' || r.user_id::text
    WHEN 'allocation' THEN r.allocation_id::text WHEN 'service' THEN r.service_id::text
    WHEN 'person' THEN r.person_id::text ELSE r.service_catalog_id::text END $$;
REVOKE ALL ON FUNCTION public.project_rate_key_of(public.project_rates) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_rate_assert_free(p_ws uuid, p_kind text, p_scope text, p_key text, p_unit text, p_currency text,
  p_from date, p_to date, p_ignore uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('project_rate:' || p_ws || ':' || p_kind || ':' || p_scope || ':' || p_key || ':' || p_unit || ':' || p_currency));
  IF EXISTS (SELECT 1 FROM public.project_rates r WHERE r.workspace_id = p_ws AND r.kind = p_kind AND r.scope = p_scope
               AND public.project_rate_key_of(r) = p_key AND r.unit = p_unit AND r.currency = p_currency AND r.status = 'active'
               AND r.id IS DISTINCT FROM p_ignore
               AND daterange(r.valid_from, r.valid_to) && daterange(p_from, p_to)) THEN
    RAISE EXCEPTION 'RATE_OVERLAP: já existe vigência sobreposta para o mesmo escopo, moeda e unidade; divida ou encerre a vigência atual.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.project_rate_assert_free(uuid, text, text, text, text, text, date, date, uuid) FROM PUBLIC, anon, authenticated;

-- Prévia de impacto (apontamentos e medições não rascunho no intervalo do escopo).
CREATE OR REPLACE FUNCTION public.project_rate_impact(p_ws uuid, p_scope text, p_target jsonb, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_proj uuid := nullif(p_target->>'project_id','')::uuid; v_user uuid := nullif(p_target->>'user_id','')::uuid;
  v_alloc uuid := nullif(p_target->>'allocation_id','')::uuid; v_svc uuid := nullif(p_target->>'service_id','')::uuid;
  v_person uuid := nullif(p_target->>'person_id','')::uuid; v_cat uuid := nullif(p_target->>'service_catalog_id','')::uuid;
BEGIN
  PERFORM public.project_bill_assert(p_ws, false, 'techprojects.rates.view.workspace');
  IF p_from IS NULL THEN RAISE EXCEPTION 'Informe o início.'; END IF;
  WITH e AS (
    SELECT t.id, coalesce(t.duration_seconds, round(public.project_entry_seconds(t.started_at, t.stopped_at, t.duration_minutes, t.hours)))::bigint AS secs
      FROM public.project_time_entries t JOIN public.projects p ON p.id = t.project_id
     WHERE t.workspace_id = p_ws AND t.entry_date >= p_from AND (p_to IS NULL OR t.entry_date < p_to)
       AND CASE p_scope
         WHEN 'exception' THEN t.project_id = v_proj AND t.user_id = v_user
         WHEN 'allocation' THEN EXISTS (SELECT 1 FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
              WHERE a.id = v_alloc AND pe.profile_id = t.user_id AND (a.project_id = t.project_id OR a.service_id = p.service_id)
                AND a.starts_at <= t.entry_date AND (a.ends_at IS NULL OR a.ends_at >= t.entry_date))
         WHEN 'service' THEN p.service_id = v_svc
         WHEN 'person' THEN EXISTS (SELECT 1 FROM public.people pe WHERE pe.id = v_person AND pe.profile_id = t.user_id)
         ELSE EXISTS (SELECT 1 FROM public.deal_line_items li WHERE li.id = p.source_line_item_id AND li.service_catalog_id = v_cat) END)
  SELECT jsonb_build_object(
    'entries', (SELECT count(*) FROM e),
    'seconds', coalesce((SELECT sum(secs) FROM e), 0),
    'measured_non_draft', (SELECT count(DISTINCT l.measurement_id) FROM public.project_measurement_lines l
        JOIN public.project_measurements m ON m.id = l.measurement_id
       WHERE l.active AND l.source_type = 'time_entry' AND l.source_id IN (SELECT id FROM e) AND m.status <> 'draft'),
    'measured_draft', (SELECT count(DISTINCT l.measurement_id) FROM public.project_measurement_lines l
        JOIN public.project_measurements m ON m.id = l.measurement_id
       WHERE l.active AND l.source_type = 'time_entry' AND l.source_id IN (SELECT id FROM e) AND m.status = 'draft'),
    'retroactive', p_from < date_trunc('month', current_date)::date) INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.project_rate_create(p_ws uuid, p_kind text, p_scope text, p_target jsonb, p_unit text,
  p_proration text, p_currency text, p_amount numeric, p_from date, p_to date, p_reason text, p_confirm_retroactive boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_key text; v_cur text := upper(btrim(coalesce(p_currency, '')));
BEGIN
  PERFORM public.project_bill_assert(p_ws, true, 'techprojects.rates.manage.workspace');
  IF p_amount IS NULL THEN RAISE EXCEPTION 'Informe o valor (zero apenas quando explicitamente autorizado).'; END IF;
  IF p_from IS NULL THEN RAISE EXCEPTION 'Informe o início da vigência.'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo (mín. 5 caracteres).'; END IF;
  IF p_from < date_trunc('month', current_date)::date AND NOT coalesce(p_confirm_retroactive, false) THEN
    RAISE EXCEPTION 'RETROACTIVE_CONFIRM: vigência retroativa exige prévia de impacto e confirmação explícita.';
  END IF;
  v_key := public.project_rate_target_key(p_ws, p_scope, p_target);
  PERFORM public.project_rate_assert_free(p_ws, p_kind, p_scope, v_key, p_unit, v_cur, p_from, p_to, NULL);
  PERFORM set_config('app.project_billing_flow', 'on', true);
  INSERT INTO public.project_rates (workspace_id, kind, scope, project_id, user_id, allocation_id, service_id, person_id,
      service_catalog_id, unit, proration, currency, amount, valid_from, valid_to, reason, confirmed_by, created_by)
  VALUES (p_ws, p_kind, p_scope,
      CASE WHEN p_scope = 'exception' THEN nullif(p_target->>'project_id','')::uuid END,
      CASE WHEN p_scope = 'exception' THEN nullif(p_target->>'user_id','')::uuid END,
      CASE WHEN p_scope = 'allocation' THEN nullif(p_target->>'allocation_id','')::uuid END,
      CASE WHEN p_scope = 'service' THEN nullif(p_target->>'service_id','')::uuid END,
      CASE WHEN p_scope = 'person' THEN nullif(p_target->>'person_id','')::uuid END,
      CASE WHEN p_scope = 'catalog' THEN nullif(p_target->>'service_catalog_id','')::uuid END,
      p_unit, p_proration, v_cur, p_amount, p_from, p_to, btrim(p_reason),
      CASE WHEN p_scope = 'exception' THEN auth.uid() END, auth.uid())
  RETURNING id INTO v_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_bill_log(p_ws, 'rate', v_id, 'created', p_reason,
    jsonb_build_object('kind', p_kind, 'scope', p_scope, 'amount', p_amount, 'currency', v_cur, 'unit', p_unit,
      'from', p_from, 'to', p_to, 'retroactive', p_from < date_trunc('month', current_date)::date));
  RETURN v_id;
END $$;

-- Divide a vigência: a anterior termina em p_effective; a nova começa nele (versão +1). Snapshot de medição nunca muda.
CREATE OR REPLACE FUNCTION public.project_rate_split(p_rate uuid, p_effective date, p_amount numeric, p_reason text, p_confirm_retroactive boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.project_rates; v_id uuid;
BEGIN
  SELECT * INTO r FROM public.project_rates WHERE id = p_rate FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Tarifa não encontrada.'; END IF;
  PERFORM public.project_bill_assert(r.workspace_id, true, 'techprojects.rates.manage.workspace');
  IF r.status <> 'active' THEN RAISE EXCEPTION 'Tarifa encerrada.'; END IF;
  IF p_amount IS NULL THEN RAISE EXCEPTION 'Informe o novo valor.'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo (mín. 5 caracteres).'; END IF;
  IF p_effective IS NULL OR p_effective <= r.valid_from OR (r.valid_to IS NOT NULL AND p_effective >= r.valid_to) THEN
    RAISE EXCEPTION 'A data da mudança precisa estar dentro da vigência atual.';
  END IF;
  IF p_effective < date_trunc('month', current_date)::date AND NOT coalesce(p_confirm_retroactive, false) THEN
    RAISE EXCEPTION 'RETROACTIVE_CONFIRM: mudança retroativa exige prévia de impacto e confirmação explícita.';
  END IF;
  PERFORM public.project_rate_assert_free(r.workspace_id, r.kind, r.scope, public.project_rate_key_of(r), r.unit, r.currency,
    p_effective, r.valid_to, r.id);
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_rates SET valid_to = p_effective WHERE id = r.id;
  INSERT INTO public.project_rates (workspace_id, kind, scope, project_id, user_id, allocation_id, service_id, person_id,
      service_catalog_id, unit, proration, currency, amount, valid_from, valid_to, version, supersedes_id, reason, confirmed_by, created_by)
  VALUES (r.workspace_id, r.kind, r.scope, r.project_id, r.user_id, r.allocation_id, r.service_id, r.person_id,
      r.service_catalog_id, r.unit, r.proration, r.currency, p_amount, p_effective, r.valid_to, r.version + 1, r.id, btrim(p_reason),
      CASE WHEN r.scope = 'exception' THEN auth.uid() END, auth.uid())
  RETURNING id INTO v_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_bill_log(r.workspace_id, 'rate', r.id, 'split', p_reason,
    jsonb_build_object('new_rate', v_id, 'effective', p_effective, 'old_amount', r.amount, 'new_amount', p_amount));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.project_rate_end(p_rate uuid, p_end date, p_reason text, p_confirm_retroactive boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.project_rates;
BEGIN
  SELECT * INTO r FROM public.project_rates WHERE id = p_rate FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Tarifa não encontrada.'; END IF;
  PERFORM public.project_bill_assert(r.workspace_id, true, 'techprojects.rates.manage.workspace');
  IF length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo (mín. 5 caracteres).'; END IF;
  IF p_end IS NULL OR p_end <= r.valid_from OR (r.valid_to IS NOT NULL AND p_end >= r.valid_to) THEN
    RAISE EXCEPTION 'O fim precisa estar dentro da vigência atual.';
  END IF;
  IF p_end < date_trunc('month', current_date)::date AND NOT coalesce(p_confirm_retroactive, false) THEN
    RAISE EXCEPTION 'RETROACTIVE_CONFIRM: encerramento retroativo exige prévia de impacto e confirmação explícita.';
  END IF;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_rates SET valid_to = p_end WHERE id = r.id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_bill_log(r.workspace_id, 'rate', r.id, 'ended', p_reason, jsonb_build_object('end', p_end, 'previous_end', r.valid_to));
END $$;

-- Valores legados (somente leitura) para revisão humana: nunca viram tarifa sem unidade, moeda e vigência confirmadas.
CREATE OR REPLACE FUNCTION public.project_rate_legacy_candidates(p_ws uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.project_bill_assert(p_ws, false, 'techprojects.rates.view.workspace');
  SELECT jsonb_build_object(
    'project_members', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id', m.project_id, 'project_name', p.name, 'user_id', m.user_id,
        'user_name', pr.full_name, 'cost_rate_hour', m.cost_rate_hour, 'bill_rate_hour', m.bill_rate_hour) ORDER BY p.name)
      FROM public.project_members m JOIN public.projects p ON p.id = m.project_id LEFT JOIN public.profiles pr ON pr.id = m.user_id
     WHERE m.workspace_id = p_ws AND (m.cost_rate_hour IS NOT NULL OR m.bill_rate_hour IS NOT NULL)), '[]'::jsonb),
    'allocations', coalesce((SELECT jsonb_agg(jsonb_build_object('allocation_id', a.id, 'person_name', pe.full_name, 'project_id', a.project_id,
        'service_id', a.service_id, 'cost_rate', a.cost_rate, 'billable_rate', a.billable_rate, 'currency', a.currency,
        'starts_at', a.starts_at, 'ends_at', a.ends_at) ORDER BY pe.full_name)
      FROM public.people_allocations a JOIN public.people pe ON pe.id = a.person_id
     WHERE a.workspace_id = p_ws AND (a.cost_rate IS NOT NULL OR a.billable_rate IS NOT NULL)), '[]'::jsonb),
    'services', coalesce((SELECT jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'unit', s.unit, 'billing_model', s.billing_model,
        'unit_price', s.unit_price, 'quantity', s.quantity, 'currency', s.currency, 'type', s.type, 'status', s.status) ORDER BY s.name)
      FROM public.services s WHERE s.workspace_id = p_ws), '[]'::jsonb)) INTO v;
  RETURN v;
END $$;

-- =========================================================== 2. modelo de cobrança (dono da cobrança por serviço/período)
CREATE TABLE public.project_billing_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES public.services(id) ON DELETE RESTRICT,
  model text NOT NULL CHECK (model IN ('per_hour','fixed_recurring','package','milestone','percent')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  valid_from date NOT NULL CHECK (valid_from = date_trunc('month', valid_from)::date),
  valid_to date CHECK (valid_to IS NULL OR (valid_to > valid_from AND valid_to = date_trunc('month', valid_to)::date)),
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.project_billing_configs(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  reason text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_billing_configs_contract_idx ON public.project_billing_configs (workspace_id, contract_id, status);
CREATE INDEX project_billing_configs_service_idx ON public.project_billing_configs (service_id) WHERE status = 'active';
GRANT SELECT ON public.project_billing_configs TO authenticated;
GRANT ALL ON public.project_billing_configs TO service_role;
ALTER TABLE public.project_billing_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_billing_configs_select ON public.project_billing_configs FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_has_permission(auth.uid(), workspace_id, 'techprojects.measurements.view.workspace'));
CREATE TRIGGER project_billing_configs_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_billing_configs
  FOR EACH ROW EXECUTE FUNCTION public.project_billing_guard_write();

CREATE OR REPLACE FUNCTION public.project_billing_params_check(p_model text, p jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k text; v_allowed text[] := ARRAY['rounding','require_client_acceptance'];
BEGIN
  IF jsonb_typeof(coalesce(p, '{}'::jsonb)) <> 'object' THEN RETURN 'Parâmetros inválidos.'; END IF;
  v_allowed := v_allowed || CASE p_model
    WHEN 'per_hour' THEN ARRAY['increment_seconds','increment_mode','require_closed_period']
    WHEN 'package' THEN ARRAY['increment_seconds','increment_mode','require_closed_period','included_seconds','carryover_months','package_amount']
    WHEN 'fixed_recurring' THEN ARRAY['amount_source','amount','proration']
    WHEN 'percent' THEN ARRAY['percent','base_source']
    ELSE ARRAY[]::text[] END;
  FOR k IN SELECT jsonb_object_keys(p) LOOP
    IF NOT k = ANY (v_allowed) THEN RETURN format('Regra desconhecida para o modelo: %s.', k); END IF;
  END LOOP;
  IF coalesce(p->>'rounding', 'total') NOT IN ('total','line') THEN RETURN 'Arredondamento deve ser por total ou por linha.'; END IF;
  IF p ? 'require_client_acceptance' AND jsonb_typeof(p->'require_client_acceptance') <> 'boolean' THEN RETURN 'Aceite do cliente deve ser sim/não.'; END IF;
  IF p ? 'require_closed_period' AND jsonb_typeof(p->'require_closed_period') <> 'boolean' THEN RETURN 'Exigir competência fechada deve ser sim/não.'; END IF;
  IF coalesce(p->>'increment_mode', 'none') NOT IN ('none','up','nearest') THEN RETURN 'Modo de incremento inválido.'; END IF;
  IF p ? 'increment_seconds' AND (jsonb_typeof(p->'increment_seconds') <> 'number' OR (p->>'increment_seconds')::numeric NOT BETWEEN 1 AND 3600
      OR (p->>'increment_seconds')::numeric <> round((p->>'increment_seconds')::numeric)) THEN RETURN 'Incremento entre 1 e 3600 segundos.'; END IF;
  IF coalesce(p->>'increment_mode', 'none') <> 'none' AND NOT p ? 'increment_seconds' THEN RETURN 'Informe o incremento em segundos.'; END IF;
  IF p_model = 'package' THEN
    IF NOT p ? 'included_seconds' OR jsonb_typeof(p->'included_seconds') <> 'number' OR (p->>'included_seconds')::numeric <= 0 THEN
      RETURN 'Pacote exige franquia em segundos maior que zero.'; END IF;
    IF p ? 'carryover_months' AND (jsonb_typeof(p->'carryover_months') <> 'number' OR (p->>'carryover_months')::numeric NOT BETWEEN 0 AND 24) THEN
      RETURN 'Carregamento de saldo entre 0 e 24 meses.'; END IF;
    IF p ? 'package_amount' AND (jsonb_typeof(p->'package_amount') <> 'number' OR (p->>'package_amount')::numeric < 0) THEN RETURN 'Valor do pacote inválido.'; END IF;
  ELSIF p_model = 'fixed_recurring' THEN
    IF coalesce(p->>'amount_source', '') NOT IN ('service','contract_monthly','explicit') THEN RETURN 'Informe a origem do valor mensal.'; END IF;
    IF p->>'amount_source' = 'explicit' AND (NOT p ? 'amount' OR jsonb_typeof(p->'amount') <> 'number' OR (p->>'amount')::numeric < 0) THEN
      RETURN 'Informe o valor mensal explícito.'; END IF;
    IF p->>'amount_source' <> 'explicit' AND p ? 'amount' THEN RETURN 'Valor explícito só com origem explícita.'; END IF;
    IF coalesce(p->>'proration', '') NOT IN ('none','calendar_days') THEN
      RETURN 'Pró-rata deve ser explícito: nenhum ou dias corridos (dias úteis não suportado sem calendário).'; END IF;
  ELSIF p_model = 'percent' THEN
    IF p ? 'percent' AND (jsonb_typeof(p->'percent') <> 'number' OR (p->>'percent')::numeric <= 0 OR (p->>'percent')::numeric > 100) THEN
      RETURN 'Percentual entre 0 e 100.'; END IF;
    IF coalesce(p->>'base_source', 'service') NOT IN ('service','explicit') THEN RETURN 'Base do percentual inválida.'; END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.project_billing_service_owned(p_service uuid, p_date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_billing_configs c
    WHERE c.service_id = p_service AND c.status = 'active' AND c.valid_from <= p_date AND (c.valid_to IS NULL OR p_date < c.valid_to)) $$;
REVOKE ALL ON FUNCTION public.project_billing_service_owned(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_billing_service_owned(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.project_billing_config_save(p_ws uuid, p_contract uuid, p_service uuid, p_model text,
  p_params jsonb, p_valid_from date, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.contracts; s public.services; v_err text; v_prev public.project_billing_configs; v_id uuid; v_legacy int;
BEGIN
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
END $$;

CREATE OR REPLACE FUNCTION public.project_billing_config_end(p_id uuid, p_end date, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.project_billing_configs;
BEGIN
  SELECT * INTO c FROM public.project_billing_configs WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Configuração não encontrada.'; END IF;
  PERFORM public.project_bill_assert(c.workspace_id, true, 'techprojects.billing_config.manage.workspace');
  IF p_end IS NULL OR p_end <> date_trunc('month', p_end)::date OR p_end <= c.valid_from OR (c.valid_to IS NOT NULL AND p_end >= c.valid_to) THEN
    RAISE EXCEPTION 'O fim é o primeiro dia de um mês dentro da vigência.'; END IF;
  IF p_end < date_trunc('month', current_date)::date THEN RAISE EXCEPTION 'Sem retroatividade.'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_measurements m WHERE m.config_id = p_id AND m.period_from >= p_end AND m.status NOT IN ('cancelled','reversed')) THEN
    RAISE EXCEPTION 'Há medições após a data; cancele ou estorne antes.'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo (mín. 10 caracteres).'; END IF;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_billing_configs SET valid_to = p_end WHERE id = p_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_bill_log(c.workspace_id, 'billing_config', p_id, 'ended', p_reason, jsonb_build_object('end', p_end));
END $$;

-- =========================================================== 3. medições
CREATE TABLE public.project_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES public.project_billing_configs(id) ON DELETE RESTRICT,
  config_version integer NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES public.services(id) ON DELETE RESTRICT,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  model text NOT NULL,
  currency text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  timezone text NOT NULL,
  kind text NOT NULL DEFAULT 'regular' CHECK (kind IN ('regular','complement')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','ready','generated','failed','reversed','cancelled')),
  revision integer NOT NULL DEFAULT 1,
  auto_hash text,
  lines_hash text NOT NULL DEFAULT '',
  total_amount numeric,
  total_seconds bigint NOT NULL DEFAULT 0,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  gates jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  rules_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid, submitted_at timestamptz,
  approved_by uuid, approved_at timestamptz,
  generated_by uuid, generated_at timestamptz,
  financial_entry_id uuid REFERENCES public.financial_entries(id) ON DELETE RESTRICT,
  attempts integer NOT NULL DEFAULT 0,
  failure_reason text, failed_at timestamptz,
  closed_by uuid, closed_at timestamptz, closed_reason text,
  CONSTRAINT project_measurements_month CHECK (period_from = date_trunc('month', period_from)::date
    AND period_to = (date_trunc('month', period_from) + interval '1 month - 1 day')::date)
);
CREATE UNIQUE INDEX project_measurements_regular_uniq ON public.project_measurements (config_id, period_from)
  WHERE kind = 'regular' AND status NOT IN ('cancelled','reversed');
CREATE INDEX project_measurements_scope_idx ON public.project_measurements (workspace_id, contract_id, period_from DESC);
CREATE INDEX project_measurements_service_idx ON public.project_measurements (service_id, period_from);
GRANT SELECT ON public.project_measurements TO authenticated;
GRANT ALL ON public.project_measurements TO service_role;
ALTER TABLE public.project_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_measurements_select ON public.project_measurements FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_has_permission(auth.uid(), workspace_id, 'techprojects.measurements.view.workspace'));
CREATE TRIGGER project_measurements_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_measurements
  FOR EACH ROW EXECUTE FUNCTION public.project_billing_guard_write();

CREATE TABLE public.project_measurement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  measurement_id uuid NOT NULL REFERENCES public.project_measurements(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('time_entry','milestone','service_period','package_fee','success_event','adjustment')),
  source_id uuid,
  source_revision integer,
  project_id uuid,
  user_id uuid,
  work_date date,
  seconds bigint,
  billed_seconds bigint,
  quantity numeric,
  unit text,
  rate_id uuid REFERENCES public.project_rates(id),
  rate_amount numeric,
  amount numeric,
  included boolean NOT NULL,
  active boolean NOT NULL,
  issue text,
  description text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Mesmo apontamento/marco/evento nunca em duas medições ativas (inclui rascunho: a fonte fica reservada).
CREATE UNIQUE INDEX project_measurement_lines_source_uniq ON public.project_measurement_lines (source_type, source_id)
  WHERE active AND source_type IN ('time_entry','milestone','success_event');
CREATE INDEX project_measurement_lines_m_idx ON public.project_measurement_lines (measurement_id, line_no);
CREATE INDEX project_measurement_lines_project_idx ON public.project_measurement_lines (project_id) WHERE included;
GRANT SELECT ON public.project_measurement_lines TO authenticated;
GRANT ALL ON public.project_measurement_lines TO service_role;
ALTER TABLE public.project_measurement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_measurement_lines_select ON public.project_measurement_lines FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_has_permission(auth.uid(), workspace_id, 'techprojects.measurements.view.workspace'));
CREATE TRIGGER project_measurement_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_measurement_lines
  FOR EACH ROW EXECUTE FUNCTION public.project_billing_guard_write();

CREATE TABLE public.project_measurement_financial_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  measurement_id uuid NOT NULL REFERENCES public.project_measurements(id) ON DELETE RESTRICT,
  financial_entry_id uuid NOT NULL REFERENCES public.financial_entries(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('generated','legacy_linked')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  unlinked_by uuid, unlinked_at timestamptz, unlink_reason text
);
CREATE UNIQUE INDEX project_measurement_fin_links_entry_uniq ON public.project_measurement_financial_links (financial_entry_id) WHERE active;
CREATE INDEX project_measurement_fin_links_m_idx ON public.project_measurement_financial_links (measurement_id);
GRANT SELECT ON public.project_measurement_financial_links TO authenticated;
GRANT ALL ON public.project_measurement_financial_links TO service_role;
ALTER TABLE public.project_measurement_financial_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_measurement_fin_links_select ON public.project_measurement_financial_links FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_has_permission(auth.uid(), workspace_id, 'techprojects.measurements.view.workspace'));
CREATE TRIGGER project_measurement_fin_links_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_measurement_financial_links
  FOR EACH ROW EXECUTE FUNCTION public.project_billing_guard_write();

CREATE TABLE public.project_package_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES public.project_billing_configs(id) ON DELETE RESTRICT,
  measurement_id uuid NOT NULL REFERENCES public.project_measurements(id) ON DELETE RESTRICT,
  period_from date NOT NULL,
  included_seconds bigint NOT NULL,
  carry_in jsonb NOT NULL DEFAULT '[]'::jsonb,
  carry_in_seconds bigint NOT NULL DEFAULT 0,
  consumed_seconds bigint NOT NULL,
  overage_seconds bigint NOT NULL,
  carry_out jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_package_balances_nonneg CHECK (included_seconds >= 0 AND consumed_seconds >= 0 AND overage_seconds >= 0 AND carry_in_seconds >= 0)
);
CREATE UNIQUE INDEX project_package_balances_uniq ON public.project_package_balances (config_id, period_from) WHERE active;
GRANT SELECT ON public.project_package_balances TO authenticated;
GRANT ALL ON public.project_package_balances TO service_role;
ALTER TABLE public.project_package_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_package_balances_select ON public.project_package_balances FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspaces())
         AND public.user_has_permission(auth.uid(), workspace_id, 'techprojects.measurements.view.workspace'));
CREATE TRIGGER project_package_balances_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_package_balances
  FOR EACH ROW EXECUTE FUNCTION public.project_billing_guard_write();

-- Saldo de franquia herdado (FIFO, com validade em meses). Sem medição aprovada do mês anterior => não ok.
CREATE OR REPLACE FUNCTION public.project_package_carry_in(p_cfg uuid, p_from date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.project_billing_configs; v_prev date := (p_from - interval '1 month')::date; b public.project_package_balances;
  v_m int; v_buckets jsonb; v_sec bigint;
BEGIN
  SELECT * INTO c FROM public.project_billing_configs WHERE id = p_cfg;
  v_m := coalesce((c.params->>'carryover_months')::int, 0);
  IF v_m = 0 OR v_prev < c.valid_from THEN RETURN jsonb_build_object('ok', true, 'seconds', 0, 'buckets', '[]'::jsonb); END IF;
  SELECT * INTO b FROM public.project_package_balances WHERE config_id = p_cfg AND period_from = v_prev AND active;
  IF b.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'seconds', 0, 'buckets', '[]'::jsonb); END IF;
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'from')::date), '[]'::jsonb), coalesce(sum((x->>'seconds')::bigint), 0)
    INTO v_buckets, v_sec
    FROM jsonb_array_elements(b.carry_out) x
   WHERE ((x->>'from')::date + make_interval(months => v_m))::date >= p_from AND (x->>'seconds')::bigint > 0;
  RETURN jsonb_build_object('ok', true, 'seconds', v_sec, 'buckets', v_buckets);
END $$;
REVOKE ALL ON FUNCTION public.project_package_carry_in(uuid, date) FROM PUBLIC, anon, authenticated;

-- Composição calculada a partir das fontes atuais (sem gravar). Linhas `excluded:*` explicam a elegibilidade.
CREATE OR REPLACE FUNCTION public.project_measurement_compute(p_cfg uuid, p_from date, p_to date, p_self uuid, p_kind text, p_tz text)
RETURNS TABLE (source_type text, source_id uuid, source_revision integer, project_id uuid, user_id uuid, work_date date,
  seconds bigint, billed_seconds bigint, quantity numeric, unit text, rate_id uuid, rate_amount numeric, amount numeric,
  included boolean, issue text, description text, detail jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  v_closed := coalesce((c.params->>'require_closed_period')::boolean, true);
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
      IF e.status = 'rejected' THEN issue := 'excluded:rejected';
      ELSIF e.source = 'import' OR e.status = 'locked' THEN issue := 'excluded:imported_locked';
      ELSIF NOT coalesce(e.billable, false) THEN issue := 'excluded:not_billable';
      ELSIF e.status IS DISTINCT FROM 'approved' THEN issue := 'excluded:not_approved';
      ELSIF v_closed AND e.period_closing_id IS NULL THEN issue := 'excluded:not_closed';
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
      IF NOT ms.billable THEN issue := 'excluded:not_billable';
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
END $$;
REVOKE ALL ON FUNCTION public.project_measurement_compute(uuid, date, date, uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_measurement_sig(p_type text, p_source uuid, p_rev integer, p_secs bigint, p_billed bigint,
  p_rate uuid, p_rate_amount numeric, p_amount numeric, p_included boolean, p_issue text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT concat_ws('|', p_type, coalesce(p_source::text, '-'), coalesce(p_rev::text, '-'), coalesce(p_secs::text, '-'),
    coalesce(p_billed::text, '-'), coalesce(p_rate::text, '-'), coalesce(p_rate_amount::text, '-'), coalesce(p_amount::text, '-'),
    p_included::text, coalesce(p_issue, '-')) $$;

CREATE OR REPLACE FUNCTION public.project_measurement_live_hash(p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements; v text;
BEGIN
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  SELECT md5(coalesce(string_agg(public.project_measurement_sig(x.source_type, x.source_id, x.source_revision, x.seconds, x.billed_seconds,
           x.rate_id, x.rate_amount, x.amount, x.included, x.issue), ',' ORDER BY x.source_type, x.source_id), ''))
    INTO v FROM public.project_measurement_compute(m.config_id, m.period_from, m.period_to, m.id, m.kind, m.timezone) x;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.project_measurement_live_hash(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_measurement_issues(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  RETURN jsonb_build_object('blockers', v_blk, 'gates', v_gate, 'warnings', v_warn);
END $$;
REVOKE ALL ON FUNCTION public.project_measurement_issues(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_measurement_recalc(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements; c public.project_billing_configs; v_auto text; v_man text; v_total numeric; v_secs bigint;
  v_iss jsonb; v_line boolean;
BEGIN
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  SELECT * INTO c FROM public.project_billing_configs WHERE id = m.config_id;
  v_line := coalesce(c.params->>'rounding', 'total') = 'line';
  SELECT md5(coalesce(string_agg(public.project_measurement_sig(l.source_type, l.source_id, l.source_revision, l.seconds, l.billed_seconds,
           l.rate_id, l.rate_amount, l.amount, l.included, l.issue), ',' ORDER BY l.source_type, l.source_id), ''))
    INTO v_auto FROM public.project_measurement_lines l
   WHERE l.measurement_id = p_id AND l.source_type NOT IN ('adjustment','success_event');
  SELECT md5(coalesce(string_agg(concat_ws('|', l.source_type, coalesce(l.source_id::text, '-'), l.amount::text, coalesce(l.description, '')),
           ',' ORDER BY l.line_no), ''))
    INTO v_man FROM public.project_measurement_lines l
   WHERE l.measurement_id = p_id AND l.source_type IN ('adjustment','success_event');
  SELECT CASE WHEN bool_or(l.included AND l.amount IS NULL) THEN NULL
              WHEN v_line THEN coalesce(sum(round(l.amount, 2)) FILTER (WHERE l.included), 0)
              ELSE round(coalesce(sum(l.amount) FILTER (WHERE l.included), 0), 2) END,
         coalesce(sum(coalesce(l.billed_seconds, 0) + coalesce((l.detail->>'package_seconds')::bigint, 0))
                    FILTER (WHERE l.included AND l.source_type = 'time_entry'), 0)
    INTO v_total, v_secs FROM public.project_measurement_lines l WHERE l.measurement_id = p_id;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_measurements SET auto_hash = v_auto,
    lines_hash = md5(v_auto || ':' || v_man || ':' || m.config_version || ':' || m.currency || ':' || m.revision),
    total_amount = v_total, total_seconds = v_secs, updated_at = now()
   WHERE id = p_id;
  v_iss := public.project_measurement_issues(p_id);
  UPDATE public.project_measurements SET blockers = v_iss->'blockers', gates = v_iss->'gates', warnings = v_iss->'warnings' WHERE id = p_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.project_measurement_recalc(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_measurement_fill(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements; v_base int;
BEGIN
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  SELECT coalesce(max(line_no), 0) INTO v_base FROM public.project_measurement_lines WHERE measurement_id = p_id;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  INSERT INTO public.project_measurement_lines (workspace_id, measurement_id, line_no, source_type, source_id, source_revision, project_id,
      user_id, work_date, seconds, billed_seconds, quantity, unit, rate_id, rate_amount, amount, included, active, issue, description, detail)
  SELECT m.workspace_id, p_id, v_base + row_number() OVER (ORDER BY x.work_date NULLS FIRST, x.source_type, x.source_id),
         x.source_type, x.source_id, x.source_revision, x.project_id, x.user_id, x.work_date, x.seconds, x.billed_seconds, x.quantity,
         x.unit, x.rate_id, x.rate_amount, x.amount, x.included, x.included, x.issue, x.description, x.detail
    FROM public.project_measurement_compute(m.config_id, m.period_from, m.period_to, p_id, m.kind, m.timezone) x;
  PERFORM set_config('app.project_billing_flow', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.project_measurement_fill(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_measurement_set(p_id uuid, p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_measurements m SET
    status = coalesce(p_patch->>'status', m.status),
    revision = CASE WHEN p_patch ? 'bump' THEN m.revision + 1 ELSE m.revision END,
    submitted_by = CASE WHEN p_patch ? 'submitted' THEN auth.uid() WHEN p_patch ? 'clear_review' THEN NULL ELSE m.submitted_by END,
    submitted_at = CASE WHEN p_patch ? 'submitted' THEN now() WHEN p_patch ? 'clear_review' THEN NULL ELSE m.submitted_at END,
    approved_by = CASE WHEN p_patch ? 'approved' THEN auth.uid() WHEN p_patch ? 'clear_review' THEN NULL ELSE m.approved_by END,
    approved_at = CASE WHEN p_patch ? 'approved' THEN now() WHEN p_patch ? 'clear_review' THEN NULL ELSE m.approved_at END,
    generated_by = CASE WHEN p_patch ? 'generated' THEN auth.uid() ELSE m.generated_by END,
    generated_at = CASE WHEN p_patch ? 'generated' THEN now() ELSE m.generated_at END,
    financial_entry_id = CASE WHEN p_patch ? 'financial_entry_id' THEN nullif(p_patch->>'financial_entry_id', '')::uuid ELSE m.financial_entry_id END,
    attempts = CASE WHEN p_patch ? 'attempt' THEN m.attempts + 1 ELSE m.attempts END,
    failure_reason = CASE WHEN p_patch ? 'failure' THEN p_patch->>'failure' WHEN p_patch ? 'generated' THEN NULL ELSE m.failure_reason END,
    failed_at = CASE WHEN p_patch ? 'failure' THEN now() ELSE m.failed_at END,
    closed_by = CASE WHEN p_patch ? 'closed' THEN auth.uid() ELSE m.closed_by END,
    closed_at = CASE WHEN p_patch ? 'closed' THEN now() ELSE m.closed_at END,
    closed_reason = CASE WHEN p_patch ? 'closed' THEN p_patch->>'closed' ELSE m.closed_reason END,
    updated_at = now()
   WHERE m.id = p_id;
  PERFORM set_config('app.project_billing_flow', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.project_measurement_set(uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_measurement_release(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_measurement_lines SET active = false WHERE measurement_id = p_id AND active;
  UPDATE public.project_package_balances SET active = false WHERE measurement_id = p_id AND active;
  PERFORM set_config('app.project_billing_flow', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.project_measurement_release(uuid) FROM PUBLIC, anon, authenticated;

-- Saldo de pacote só pode ser desfeito do mais recente para o mais antigo.
CREATE OR REPLACE FUNCTION public.project_measurement_assert_chain(m public.project_measurements)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF m.model = 'package' AND EXISTS (SELECT 1 FROM public.project_package_balances b
       WHERE b.config_id = m.config_id AND b.active AND b.period_from > m.period_from) THEN
    RAISE EXCEPTION 'CHAIN_BLOCKED: há saldo de pacote de competência posterior; desfaça a mais recente antes.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.project_measurement_assert_chain(public.project_measurements) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_measurement_build(p_cfg uuid, p_month date, p_kind text, p_tz text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.project_billing_configs; k public.contracts; v_from date; v_to date; v_id uuid; x public.project_measurements;
BEGIN
  SELECT * INTO c FROM public.project_billing_configs WHERE id = p_cfg;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Modelo de cobrança não encontrado.'; END IF;
  PERFORM public.project_bill_assert(c.workspace_id, true, 'techprojects.measurements.manage.workspace');
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
END $$;

CREATE OR REPLACE FUNCTION public.project_measurement_lock(p_id uuid, p_key text, p_statuses text[])
RETURNS public.project_measurements LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements;
BEGIN
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Medição não encontrada.'; END IF;
  PERFORM public.project_bill_assert(m.workspace_id, true, p_key);
  PERFORM pg_advisory_xact_lock(hashtext('project_measurement_cfg:' || m.config_id));
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id FOR UPDATE;
  IF p_statuses IS NOT NULL AND NOT m.status = ANY (p_statuses) THEN
    RAISE EXCEPTION 'Ação indisponível na situação atual (%).', m.status;
  END IF;
  RETURN m;
END $$;
REVOKE ALL ON FUNCTION public.project_measurement_lock(uuid, text, text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_measurement_refresh(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurements.manage.workspace', ARRAY['draft']);
  PERFORM set_config('app.project_billing_flow', 'on', true);
  DELETE FROM public.project_measurement_lines WHERE measurement_id = p_id AND source_type NOT IN ('adjustment','success_event');
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_measurement_set(p_id, '{"bump":true}');
  PERFORM public.project_measurement_fill(p_id);
  PERFORM public.project_measurement_recalc(p_id);
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'refreshed', NULL, '{}'::jsonb);
  RETURN (SELECT jsonb_build_object('lines_hash', lines_hash, 'revision', revision) FROM public.project_measurements WHERE id = p_id);
END $$;

CREATE OR REPLACE FUNCTION public.project_measurement_add_adjustment(p_id uuid, p_description text, p_amount numeric, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurements.manage.workspace', ARRAY['draft']);
  IF p_amount IS NULL OR p_amount = 0 OR p_amount <> round(p_amount, 2) THEN RAISE EXCEPTION 'Ajuste com valor diferente de zero e até 2 casas.'; END IF;
  IF length(btrim(coalesce(p_description, ''))) < 3 THEN RAISE EXCEPTION 'Descreva o ajuste (desconto, reajuste, etc.).'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe a justificativa (mín. 10 caracteres).'; END IF;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  INSERT INTO public.project_measurement_lines (workspace_id, measurement_id, line_no, source_type, amount, included, active, description, detail, quantity, unit)
  VALUES (m.workspace_id, p_id, (SELECT coalesce(max(line_no), 0) + 1 FROM public.project_measurement_lines WHERE measurement_id = p_id),
          'adjustment', p_amount, true, false, btrim(p_description), jsonb_build_object('reason', btrim(p_reason)), 1, 'adjustment');
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_measurement_set(p_id, '{"bump":true}');
  PERFORM public.project_measurement_recalc(p_id);
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'adjustment_added', p_reason, jsonb_build_object('amount', p_amount, 'description', p_description));
END $$;

-- Sucesso (Hunting/percentual) só por evento informado e justificado; nunca inferido de horas.
CREATE OR REPLACE FUNCTION public.project_measurement_add_success_event(p_id uuid, p_ref_type text, p_ref uuid, p_base numeric, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements; c public.project_billing_configs; s public.services; v_pct numeric; v_base numeric; v_amt numeric;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurements.manage.workspace', ARRAY['draft']);
  IF m.model <> 'percent' THEN RAISE EXCEPTION 'Evento de sucesso só em modelo percentual.'; END IF;
  SELECT * INTO c FROM public.project_billing_configs WHERE id = m.config_id;
  SELECT * INTO s FROM public.services WHERE id = m.service_id;
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
END $$;

CREATE OR REPLACE FUNCTION public.project_measurement_remove_line(p_line uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.project_measurement_lines; m public.project_measurements;
BEGIN
  SELECT * INTO l FROM public.project_measurement_lines WHERE id = p_line;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Linha não encontrada.'; END IF;
  m := public.project_measurement_lock(l.measurement_id, 'techprojects.measurements.manage.workspace', ARRAY['draft']);
  IF l.source_type NOT IN ('adjustment','success_event') THEN RAISE EXCEPTION 'Só ajustes e eventos manuais são removidos; o restante vem das fontes.'; END IF;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  DELETE FROM public.project_measurement_lines WHERE id = p_line;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_measurement_set(m.id, '{"bump":true}');
  PERFORM public.project_measurement_recalc(m.id);
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', m.id, 'line_removed', p_reason,
    jsonb_build_object('source_type', l.source_type, 'amount', l.amount));
END $$;

CREATE OR REPLACE FUNCTION public.project_measurement_assert_fresh(m public.project_measurements, p_hash text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_hash IS NULL OR p_hash <> m.lines_hash THEN
    RAISE EXCEPTION 'PREVIEW_STALE: a medição mudou desde a sua leitura; recarregue.';
  END IF;
  IF public.project_measurement_live_hash(m.id) IS DISTINCT FROM m.auto_hash THEN
    RAISE EXCEPTION 'PREVIEW_STALE: apontamentos, marcos, tarifas ou contrato mudaram; devolva para rascunho e atualize.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.project_measurement_assert_fresh(public.project_measurements, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.project_measurement_submit(p_id uuid, p_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurements.manage.workspace', ARRAY['draft']);
  PERFORM public.project_measurement_assert_fresh(m, p_hash);
  PERFORM public.project_measurement_recalc(p_id);
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  IF jsonb_array_length(m.blockers) > 0 THEN
    RAISE EXCEPTION 'SUBMIT_BLOCKED: %', (SELECT string_agg(x->>'code', ', ') FROM jsonb_array_elements(m.blockers) x);
  END IF;
  PERFORM public.project_measurement_set(p_id, '{"status":"in_review","submitted":true}');
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'submitted', NULL, jsonb_build_object('hash', m.lines_hash, 'total', m.total_amount));
END $$;

CREATE OR REPLACE FUNCTION public.project_measurement_return(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements;
BEGIN
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Medição não encontrada.'; END IF;
  m := public.project_measurement_lock(p_id,
    CASE WHEN public.user_has_permission(auth.uid(), m.workspace_id, 'techprojects.measurements.approve.workspace')
         THEN 'techprojects.measurements.approve.workspace' ELSE 'techprojects.measurements.manage.workspace' END,
    ARRAY['in_review','approved','ready','failed']);
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo (mín. 10 caracteres).'; END IF;
  PERFORM public.project_measurement_assert_chain(m);
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_package_balances SET active = false WHERE measurement_id = p_id AND active;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_measurement_set(p_id, '{"status":"draft","clear_review":true}');
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'returned', p_reason, jsonb_build_object('from_status', m.status));
END $$;

CREATE OR REPLACE FUNCTION public.project_measurement_approve(p_id uuid, p_hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements; c public.project_billing_configs; v_carry jsonb; v_inc bigint; v_consumed bigint; v_over bigint;
  v_rem bigint; v_out jsonb := '[]'::jsonb; b jsonb; v_take bigint; v_status text;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurements.approve.workspace', ARRAY['in_review']);
  IF auth.uid() = m.created_by OR auth.uid() = m.submitted_by THEN
    RAISE EXCEPTION 'SELF_APPROVAL: quem preparou ou enviou a medição não a aprova.' USING ERRCODE = '42501';
  END IF;
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
END $$;

CREATE OR REPLACE FUNCTION public.project_measurement_recheck(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements; v_status text;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurements.view.workspace', ARRAY['approved','ready','failed']);
  PERFORM public.project_measurement_recalc(p_id);
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  IF m.status IN ('approved','ready') THEN
    v_status := CASE WHEN jsonb_array_length(m.gates) = 0 THEN 'ready' ELSE 'approved' END;
    IF v_status <> m.status THEN PERFORM public.project_measurement_set(p_id, jsonb_build_object('status', v_status)); END IF;
    RETURN v_status;
  END IF;
  RETURN m.status;
END $$;

CREATE OR REPLACE FUNCTION public.project_measurement_generate(p_id uuid, p_hash text, p_due date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements; k public.contracts; v_fe uuid; v_ref text; v_err text;
BEGIN
  SELECT * INTO m FROM public.project_measurements WHERE id = p_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Medição não encontrada.'; END IF;
  IF m.status = 'generated' THEN
    PERFORM public.project_bill_assert(m.workspace_id, false, 'techprojects.measurements.view.workspace');
    RETURN jsonb_build_object('status', 'generated', 'financial_entry_id', m.financial_entry_id, 'idempotent', true);
  END IF;
  m := public.project_measurement_lock(p_id, 'techprojects.measurement_finance.create.workspace', ARRAY['ready','approved','failed','generated']);
  IF m.status = 'generated' THEN
    RETURN jsonb_build_object('status', 'generated', 'financial_entry_id', m.financial_entry_id, 'idempotent', true);
  END IF;
  IF NOT public.user_has_permission(auth.uid(), m.workspace_id, 'techfinance.entries.create.own') THEN
    RAISE EXCEPTION 'Sem permissão para criar títulos no Financeiro.' USING ERRCODE = '42501';
  END IF;
  IF p_due IS NULL THEN RAISE EXCEPTION 'Informe o vencimento.'; END IF;
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
END $$;

-- Vincula título legado já existente (mesmo serviço/competência/moeda/valor) em vez de gerar outro.
CREATE OR REPLACE FUNCTION public.project_measurement_link_legacy(p_id uuid, p_entry uuid, p_hash text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements; fe public.financial_entries; v_other int;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurement_finance.create.workspace', ARRAY['approved','ready','failed']);
  IF m.service_id IS NULL THEN RAISE EXCEPTION 'Vínculo de legado só em medição por serviço.'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo (mín. 10 caracteres).'; END IF;
  PERFORM public.project_measurement_assert_fresh(m, p_hash);
  PERFORM pg_advisory_xact_lock(hashtext('project_billing_service:' || m.service_id || ':' || to_char(m.period_from, 'YYYY-MM')));
  SELECT * INTO fe FROM public.financial_entries WHERE id = p_entry AND workspace_id = m.workspace_id FOR UPDATE;
  IF fe.id IS NULL OR fe.service_id IS DISTINCT FROM m.service_id OR fe.competence_date NOT BETWEEN m.period_from AND m.period_to
     OR fe.status::text = 'cancelled' OR fe.origin_type::text = 'project_measurement' THEN
    RAISE EXCEPTION 'Título não corresponde a este serviço e competência.'; END IF;
  IF EXISTS (SELECT 1 FROM public.project_measurement_financial_links x WHERE x.financial_entry_id = fe.id AND x.active) THEN
    RAISE EXCEPTION 'Título já vinculado a outra medição.'; END IF;
  IF fe.currency <> m.currency THEN RAISE EXCEPTION 'Moeda do título difere da medição.'; END IF;
  IF m.total_amount IS NULL OR fe.amount <> m.total_amount THEN
    RAISE EXCEPTION 'LEGACY_AMOUNT_MISMATCH: título de % difere da medição de %; resolva no Financeiro ou ajuste a medição.', fe.amount, m.total_amount;
  END IF;
  SELECT count(*) INTO v_other FROM public.financial_entries x WHERE x.workspace_id = m.workspace_id AND x.service_id = m.service_id
     AND x.id <> fe.id AND x.competence_date BETWEEN m.period_from AND m.period_to AND x.status::text <> 'cancelled'
     AND x.origin_type::text <> 'project_measurement'
     AND NOT EXISTS (SELECT 1 FROM public.project_measurement_financial_links y WHERE y.financial_entry_id = x.id AND y.active);
  IF v_other > 0 THEN RAISE EXCEPTION 'Há outros % título(s) legado(s) na competência; resolva no Financeiro antes.', v_other; END IF;
  PERFORM public.project_measurement_recalc(p_id);
  IF EXISTS (SELECT 1 FROM public.project_measurements x, jsonb_array_elements(x.blockers || x.gates) g
              WHERE x.id = p_id AND g->>'code' <> 'legacy_entry_exists') THEN
    RAISE EXCEPTION 'GENERATE_BLOCKED: há outras pendências além do título legado.';
  END IF;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  INSERT INTO public.project_measurement_financial_links (workspace_id, measurement_id, financial_entry_id, kind, created_by)
  VALUES (m.workspace_id, m.id, fe.id, 'legacy_linked', auth.uid());
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_measurement_set(p_id, jsonb_build_object('status', 'generated', 'generated', true, 'financial_entry_id', fe.id));
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'legacy_linked', p_reason, jsonb_build_object('financial_entry_id', fe.id));
END $$;

CREATE OR REPLACE FUNCTION public.project_measurement_reverse(p_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements; l record; fe public.financial_entries; v_cancelled int := 0; v_unlinked int := 0;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurement_reverse.manage.workspace', ARRAY['generated']);
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo do estorno (mín. 10 caracteres).'; END IF;
  PERFORM public.project_measurement_assert_chain(m);
  FOR l IN SELECT * FROM public.project_measurement_financial_links WHERE measurement_id = p_id AND active LOOP
    SELECT * INTO fe FROM public.financial_entries WHERE id = l.financial_entry_id FOR UPDATE;
    IF l.kind = 'generated' THEN
      IF fe.status::text IN ('paid','partial') OR coalesce(fe.paid_amount, 0) > 0
         OR EXISTS (SELECT 1 FROM public.financial_payments p WHERE p.entry_id = fe.id)
         OR EXISTS (SELECT 1 FROM public.bank_charges b WHERE b.financial_entry_id = fe.id)
         OR EXISTS (SELECT 1 FROM public.bank_payments b WHERE b.financial_entry_id = fe.id) THEN
        RAISE EXCEPTION 'REVERSE_BLOCKED: o título tem pagamento, cobrança bancária ou baixa; resolva no Financeiro antes do estorno.';
      END IF;
      IF fe.status::text <> 'cancelled' THEN
        UPDATE public.financial_entries SET status = 'cancelled',
          notes = concat_ws(E'\n', notes, 'Estornado pela medição em ' || to_char(now(), 'DD/MM/YYYY') || ': ' || btrim(p_reason))
         WHERE id = fe.id;
        v_cancelled := v_cancelled + 1;
      END IF;
    ELSE
      v_unlinked := v_unlinked + 1;
    END IF;
  END LOOP;
  PERFORM set_config('app.project_billing_flow', 'on', true);
  UPDATE public.project_measurement_financial_links SET active = false, unlinked_by = auth.uid(), unlinked_at = now(), unlink_reason = btrim(p_reason)
   WHERE measurement_id = p_id AND active;
  PERFORM set_config('app.project_billing_flow', 'off', true);
  PERFORM public.project_measurement_release(p_id);
  PERFORM public.project_measurement_set(p_id, jsonb_build_object('status', 'reversed', 'closed', btrim(p_reason)));
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'reversed', p_reason,
    jsonb_build_object('cancelled_entries', v_cancelled, 'unlinked_legacy', v_unlinked));
  RETURN jsonb_build_object('cancelled_entries', v_cancelled, 'unlinked_legacy', v_unlinked);
END $$;

CREATE OR REPLACE FUNCTION public.project_measurement_cancel(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.project_measurements;
BEGIN
  m := public.project_measurement_lock(p_id, 'techprojects.measurements.manage.workspace', ARRAY['draft','in_review','approved','ready','failed']);
  IF length(btrim(coalesce(p_reason, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo (mín. 10 caracteres).'; END IF;
  PERFORM public.project_measurement_assert_chain(m);
  PERFORM public.project_measurement_release(p_id);
  PERFORM public.project_measurement_set(p_id, jsonb_build_object('status', 'cancelled', 'closed', btrim(p_reason)));
  PERFORM public.project_bill_log(m.workspace_id, 'measurement', p_id, 'cancelled', p_reason, jsonb_build_object('from_status', m.status));
END $$;

-- Lista paginada por projeto ou contrato.
CREATE OR REPLACE FUNCTION public.project_measurements_list(p_ws uuid, p_project uuid, p_contract uuid, p_limit int, p_offset int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid; v_pc uuid; v_ps uuid; v jsonb;
BEGIN
  PERFORM public.project_bill_assert(p_ws, false, 'techprojects.measurements.view.workspace');
  IF p_project IS NOT NULL THEN
    SELECT id, contract_id, service_id INTO v_pid, v_pc, v_ps FROM public.projects WHERE id = p_project AND workspace_id = p_ws;
    IF v_pid IS NULL THEN RAISE EXCEPTION 'Projeto fora do workspace.'; END IF;
  ELSIF p_contract IS NULL OR NOT EXISTS (SELECT 1 FROM public.contracts WHERE id = p_contract AND workspace_id = p_ws) THEN
    RAISE EXCEPTION 'Contrato fora do workspace.';
  END IF;
  WITH s AS (
    SELECT m.* FROM public.project_measurements m
     WHERE m.workspace_id = p_ws AND CASE WHEN p_project IS NOT NULL THEN
        (m.service_id IS NOT NULL AND m.service_id = v_ps) OR (m.service_id IS NULL AND m.contract_id = v_pc)
        OR EXISTS (SELECT 1 FROM public.project_measurement_lines l WHERE l.measurement_id = m.id AND l.included AND l.project_id = p_project)
       ELSE m.contract_id = p_contract END)
  SELECT jsonb_build_object('total', (SELECT count(*) FROM s),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.period_from DESC, x.created_at DESC) FROM (
      SELECT s.id, s.config_id, s.contract_id, s.service_id, s.model, s.currency, s.period_from, s.period_to, s.kind, s.status, s.revision,
             s.lines_hash, s.total_amount, s.total_seconds, s.blockers, s.gates, s.warnings, s.financial_entry_id, s.failure_reason,
             s.created_at, s.created_by, s.submitted_by, s.approved_by, s.closed_reason
        FROM s ORDER BY s.period_from DESC, s.created_at DESC
       LIMIT least(greatest(coalesce(p_limit, 20), 1), 100) OFFSET greatest(coalesce(p_offset, 0), 0)) x), '[]'::jsonb)) INTO v;
  RETURN v;
END $$;

-- =========================================================== 4. guardas entre mecanismos
CREATE OR REPLACE FUNCTION public.project_billing_fe_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.origin_type IS NOT DISTINCT FROM OLD.origin_type AND NEW.service_id IS NOT DISTINCT FROM OLD.service_id
     AND NEW.competence_date IS NOT DISTINCT FROM OLD.competence_date AND NEW.origin_id IS NOT DISTINCT FROM OLD.origin_id THEN
    RETURN NEW;
  END IF;
  IF NEW.origin_type::text = 'service' AND NEW.service_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('project_billing_service:' || NEW.service_id || ':' || to_char(NEW.competence_date, 'YYYY-MM')));
    IF public.project_billing_service_owned(NEW.service_id, NEW.competence_date) THEN
      RAISE EXCEPTION 'BILLING_OWNER: a cobrança deste serviço nesta competência é feita pelas Medições do TechProjects.';
    END IF;
  ELSIF NEW.origin_type::text = 'project_milestone' AND NEW.origin_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.project_measurement_lines l WHERE l.source_type = 'milestone' AND l.source_id = NEW.origin_id AND l.active) THEN
      RAISE EXCEPTION 'BILLING_OWNER: este marco já está em uma medição.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_billing_fe_guard BEFORE INSERT OR UPDATE OF origin_type, origin_id, service_id, competence_date
  ON public.financial_entries FOR EACH ROW EXECUTE FUNCTION public.project_billing_fe_guard();

CREATE OR REPLACE FUNCTION public.project_billing_te_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.financial_entry_id IS DISTINCT FROM OLD.financial_entry_id OR NEW.invoiced_at IS DISTINCT FROM OLD.invoiced_at
      OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id)
     AND EXISTS (SELECT 1 FROM public.project_measurement_lines l WHERE l.source_type = 'time_entry' AND l.source_id = OLD.id AND l.active) THEN
    RAISE EXCEPTION 'MEASURED_ENTRY: apontamento reservado por medição; não pode ser faturado por outro mecanismo.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_measurement_lines l JOIN public.project_measurements m ON m.id = l.measurement_id
              WHERE l.source_type = 'time_entry' AND l.source_id = OLD.id AND l.active AND m.status <> 'draft') THEN
    RAISE EXCEPTION 'MEASURED_ENTRY: apontamento em medição revisada, aprovada ou gerada; devolva, cancele ou estorne a medição antes.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER project_billing_te_guard_upd BEFORE UPDATE ON public.project_time_entries FOR EACH ROW
  WHEN (OLD.duration_seconds IS DISTINCT FROM NEW.duration_seconds OR OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
     OR OLD.hours IS DISTINCT FROM NEW.hours OR OLD.billable IS DISTINCT FROM NEW.billable OR OLD.project_id IS DISTINCT FROM NEW.project_id
     OR OLD.user_id IS DISTINCT FROM NEW.user_id OR OLD.entry_date IS DISTINCT FROM NEW.entry_date
     OR OLD.started_at IS DISTINCT FROM NEW.started_at OR OLD.stopped_at IS DISTINCT FROM NEW.stopped_at
     OR OLD.status IS DISTINCT FROM NEW.status OR OLD.revision IS DISTINCT FROM NEW.revision
     OR OLD.period_closing_id IS DISTINCT FROM NEW.period_closing_id OR OLD.client_acceptance_id IS DISTINCT FROM NEW.client_acceptance_id
     OR OLD.financial_entry_id IS DISTINCT FROM NEW.financial_entry_id OR OLD.invoiced_at IS DISTINCT FROM NEW.invoiced_at
     OR OLD.invoice_id IS DISTINCT FROM NEW.invoice_id)
  EXECUTE FUNCTION public.project_billing_te_guard();
CREATE TRIGGER project_billing_te_guard_del BEFORE DELETE ON public.project_time_entries FOR EACH ROW
  EXECUTE FUNCTION public.project_billing_te_guard();

CREATE OR REPLACE FUNCTION public.project_billing_ms_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.financial_entry_id IS DISTINCT FROM OLD.financial_entry_id
     AND EXISTS (SELECT 1 FROM public.project_measurement_lines l WHERE l.source_type = 'milestone' AND l.source_id = OLD.id AND l.active) THEN
    RAISE EXCEPTION 'MEASURED_MILESTONE: marco reservado por medição.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_measurement_lines l JOIN public.project_measurements m ON m.id = l.measurement_id
              WHERE l.source_type = 'milestone' AND l.source_id = OLD.id AND l.active AND m.status <> 'draft') THEN
    RAISE EXCEPTION 'MEASURED_MILESTONE: marco em medição revisada, aprovada ou gerada; devolva, cancele ou estorne antes.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER project_billing_ms_guard_upd BEFORE UPDATE ON public.project_milestones FOR EACH ROW
  WHEN (OLD.bill_amount IS DISTINCT FROM NEW.bill_amount OR OLD.billable IS DISTINCT FROM NEW.billable OR OLD.status IS DISTINCT FROM NEW.status
     OR OLD.financial_entry_id IS DISTINCT FROM NEW.financial_entry_id OR OLD.completed_at IS DISTINCT FROM NEW.completed_at
     OR OLD.project_id IS DISTINCT FROM NEW.project_id)
  EXECUTE FUNCTION public.project_billing_ms_guard();
CREATE TRIGGER project_billing_ms_guard_del BEFORE DELETE ON public.project_milestones FOR EACH ROW
  EXECUTE FUNCTION public.project_billing_ms_guard();

CREATE OR REPLACE FUNCTION public.project_billing_closing_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.project_time_entries t
               JOIN public.project_measurement_lines l ON l.source_type = 'time_entry' AND l.source_id = t.id AND l.active
               JOIN public.project_measurements m ON m.id = l.measurement_id
              WHERE t.period_closing_id = OLD.id AND m.status <> 'draft') THEN
    RAISE EXCEPTION 'MEASURED_PERIOD: competência com horas em medição revisada, aprovada ou gerada; devolva, cancele ou estorne a medição antes de reabrir.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_billing_closing_guard BEFORE UPDATE ON public.project_period_closings FOR EACH ROW
  WHEN (OLD.status = 'closed' AND NEW.status IS DISTINCT FROM 'closed')
  EXECUTE FUNCTION public.project_billing_closing_guard();

-- =========================================================== 5. rentabilidade
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
    cost = CASE WHEN e.cst = 'found' THEN e.secs::numeric * e.camt / 3600 ELSE 0 END;

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

-- Grants das RPCs públicas (todas revalidam ator, membership ativo, permissão e Ver Como).
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'project_rate_impact(uuid, text, jsonb, date, date)',
    'project_rate_create(uuid, text, text, jsonb, text, text, text, numeric, date, date, text, boolean)',
    'project_rate_split(uuid, date, numeric, text, boolean)',
    'project_rate_end(uuid, date, text, boolean)',
    'project_rate_legacy_candidates(uuid)',
    'project_billing_config_save(uuid, uuid, uuid, text, jsonb, date, text)',
    'project_billing_config_end(uuid, date, text)',
    'project_measurement_build(uuid, date, text, text)',
    'project_measurement_refresh(uuid)',
    'project_measurement_add_adjustment(uuid, text, numeric, text)',
    'project_measurement_add_success_event(uuid, text, uuid, numeric, text)',
    'project_measurement_remove_line(uuid, text)',
    'project_measurement_submit(uuid, text)',
    'project_measurement_return(uuid, text)',
    'project_measurement_approve(uuid, text)',
    'project_measurement_recheck(uuid)',
    'project_measurement_generate(uuid, text, date)',
    'project_measurement_link_legacy(uuid, uuid, text, text)',
    'project_measurement_reverse(uuid, text)',
    'project_measurement_cancel(uuid, text)',
    'project_measurements_list(uuid, uuid, uuid, int, int)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.project_billing_params_check(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_billing_params_check(text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.project_measurement_sig(text, uuid, integer, bigint, bigint, uuid, numeric, numeric, boolean, text) FROM PUBLIC, anon;
