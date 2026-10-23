-- Synthetic catalog fixture for RPC boundaries; no production data.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'wk_head_rh_permission_test' THEN RAISE EXCEPTION 'isolated fixture required'; END IF; END $$;
CREATE ROLE techerp_api_subject NOLOGIN IN ROLE authenticated;
CREATE TYPE public.financial_entry_status AS ENUM ('open','partial','paid','overdue','cancelled');
CREATE TYPE public.rpc_test_stage AS ENUM ('new','qualified');
CREATE TABLE leads(id uuid DEFAULT gen_random_uuid(),owner_id uuid,workspace_id uuid,name text,email text,stage rpc_test_stage,active boolean DEFAULT true);
CREATE TABLE deals(id uuid PRIMARY KEY,owner_id uuid,workspace_id uuid,value numeric);
CREATE TABLE deal_line_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),deal_id uuid REFERENCES deals(id),quantity numeric,unit_price numeric,discount_pct numeric DEFAULT 0,tax_rate numeric DEFAULT 0,billing_model text DEFAULT 'unit',percent_base_amount numeric,percent numeric,discount_type text DEFAULT 'pct',discount_amount numeric DEFAULT 0);
CREATE TABLE financial_entries(id uuid PRIMARY KEY,owner_id uuid,workspace_id uuid,amount numeric,due_date date,status financial_entry_status DEFAULT 'open',paid_amount numeric DEFAULT 0);
CREATE TABLE financial_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entry_id uuid REFERENCES financial_entries(id),amount numeric);
CREATE TABLE quote_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid,workspace_id uuid,name text,description text,html text,is_default boolean,is_system boolean);
CREATE TABLE ats_talent_pools(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid,name text,description text,type text,system_key text,color text,created_by uuid);
CREATE TABLE ats_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid,workspace_id uuid,candidate_id uuid,status text,stage_value text);
CREATE TABLE ats_talent_pool_members(pool_id uuid,candidate_id uuid,owner_id uuid,added_by uuid,source text,UNIQUE(pool_id,candidate_id));
CREATE TABLE ats_candidates(id uuid PRIMARY KEY,owner_id uuid,workspace_id uuid,full_name text,email text,phone text,linkedin_url text,location text,current_position text,current_company text,cv_url text,cv_parsed jsonb,notes text,tags text[],lgpd_redacted_at timestamptz,updated_at timestamptz);
CREATE TABLE ats_candidate_consents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid REFERENCES ats_candidates(id),granted boolean,revoked_at timestamptz);
CREATE TABLE access_audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid,actor_id uuid,action text,entity_type text,entity_id uuid,details jsonb);
GRANT SELECT ON leads,deals,deal_line_items,financial_entries,financial_payments,quote_templates,ats_talent_pools,ats_candidates,ats_candidate_consents,ats_applications,ats_talent_pool_members TO authenticated,service_role;
GRANT INSERT,UPDATE,DELETE ON deal_line_items,financial_payments,ats_applications TO authenticated;
CREATE OR REPLACE FUNCTION public.anonymize_ats_candidate(_candidate_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner UUID;
BEGIN
  SELECT owner_id INTO v_owner FROM public.ats_candidates WHERE id = _candidate_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'candidate_not_found'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.ats_candidates SET
    full_name = '[REDACTED]',
    email = NULL,
    phone = NULL,
    linkedin_url = NULL,
    location = NULL,
    current_position = NULL,
    current_company = NULL,
    cv_url = NULL,
    cv_parsed = NULL,
    notes = NULL,
    tags = ARRAY[]::TEXT[],
    lgpd_redacted_at = now(),
    updated_at = now()
  WHERE id = _candidate_id;

  -- Revoke active consents
  UPDATE public.ats_candidate_consents
  SET granted = false, revoked_at = now()
  WHERE candidate_id = _candidate_id AND granted = true AND revoked_at IS NULL;
END;
$function$
;
GRANT EXECUTE ON FUNCTION public.anonymize_ats_candidate(uuid) TO authenticated,anon,service_role;
CREATE OR REPLACE FUNCTION public.ensure_silver_medalist_pool(_owner uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pool_id uuid;
BEGIN
  SELECT id INTO pool_id
  FROM public.ats_talent_pools
  WHERE owner_id = _owner AND system_key = 'silver_medalists'
  LIMIT 1;

  IF pool_id IS NULL THEN
    INSERT INTO public.ats_talent_pools(owner_id, name, description, type, system_key, color, created_by)
    VALUES (_owner, 'Silver Medalists',
            'Candidatos rejeitados em estágios avançados — re-engajar em futuras vagas.',
            'static', 'silver_medalists', '#94a3b8', _owner)
    RETURNING id INTO pool_id;
  END IF;

  RETURN pool_id;
END;
$function$
;
GRANT EXECUTE ON FUNCTION public.ensure_silver_medalist_pool(uuid) TO authenticated,anon,service_role;
CREATE OR REPLACE FUNCTION public.get_entity_field_catalog(p_table text, p_owner_id uuid)
 RETURNS TABLE(column_name text, data_type text, distinct_values text[], distinct_count integer, is_nullable text, has_default boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  vals text[];
  cnt int;
BEGIN
  IF p_table NOT IN (
    'leads','contacts','companies','deals','tickets','activities',
    'ats_jobs','ats_candidates','ats_applications','ats_interviews','ats_offers',
    'projects','project_tasks','project_milestones',
    'contracts','financial_entries','bank_payments',
    'quotes','proposals','products','services',
    'recurring_plans','subscription_invoices','customer_invoices'
  ) THEN
    RAISE EXCEPTION 'invalid table: %', p_table;
  END IF;

  -- Amostra única de até 2.000 linhas do dono, reutilizada por todas as colunas.
  -- Evita varrer a tabela inteira em colunas quase sempre vazias.
  EXECUTE format(
    'CREATE TEMP TABLE IF NOT EXISTS _efc_sample ON COMMIT DROP AS
       SELECT * FROM public.%I WHERE owner_id = $1 LIMIT 2000', p_table
  ) USING p_owner_id;

  FOR r IN
    SELECT c.column_name, c.data_type, c.is_nullable, (c.column_default IS NOT NULL) AS has_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = p_table
    ORDER BY c.ordinal_position
  LOOP
    column_name := r.column_name;
    data_type := r.data_type;
    is_nullable := r.is_nullable;
    has_default := r.has_default;
    distinct_values := NULL;
    distinct_count := NULL;

    IF r.data_type IN ('text','character varying','USER-DEFINED','boolean')
       AND r.column_name NOT IN ('id','owner_id','workspace_id','portal_token','hs_object_id')
    THEN
      BEGIN
        EXECUTE format(
          'SELECT array_agg(v ORDER BY c DESC), COUNT(*)::int
             FROM (
               SELECT %I::text AS v, COUNT(*) AS c
               FROM _efc_sample
               WHERE %I IS NOT NULL
               GROUP BY 1
               ORDER BY COUNT(*) DESC
               LIMIT 21
             ) t',
          r.column_name, r.column_name
        ) INTO vals, cnt;
        distinct_values := vals;
        distinct_count := cnt;
      EXCEPTION WHEN OTHERS THEN
        distinct_values := NULL;
        distinct_count := NULL;
      END;
    END IF;

    RETURN NEXT;
  END LOOP;

  DROP TABLE IF EXISTS _efc_sample;
END
$function$
;
GRANT EXECUTE ON FUNCTION public.get_entity_field_catalog(text,uuid) TO authenticated,anon,service_role;
CREATE OR REPLACE FUNCTION public.recalc_deal_value(_deal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sum numeric;
  v_current numeric;
BEGIN
  IF _deal_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(
    COALESCE(quantity,0)
    * COALESCE(unit_price,0)
    * (1 - COALESCE(discount_pct,0) / 100.0)
    * (1 + COALESCE(tax_rate,0) / 100.0)
  ), NULL)
  INTO v_sum
  FROM public.deal_line_items
  WHERE deal_id = _deal_id;

  -- Sem itens: preserva valor manual
  IF v_sum IS NULL THEN RETURN; END IF;

  SELECT value INTO v_current FROM public.deals WHERE id = _deal_id;

  IF v_current IS DISTINCT FROM v_sum THEN
    UPDATE public.deals SET value = v_sum WHERE id = _deal_id;
  END IF;
END;
$function$
;
GRANT EXECUTE ON FUNCTION public.recalc_deal_value(uuid) TO authenticated,anon,service_role;
CREATE OR REPLACE FUNCTION public.recalc_financial_entry(_entry_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total NUMERIC(14,2);
  v_amount NUMERIC(14,2);
  v_due DATE;
  v_status public.financial_entry_status;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total FROM public.financial_payments WHERE entry_id = _entry_id;
  SELECT amount, due_date, status INTO v_amount, v_due, v_status FROM public.financial_entries WHERE id = _entry_id;
  IF v_amount IS NULL THEN RETURN; END IF;

  IF v_status = 'cancelled' THEN
    UPDATE public.financial_entries SET paid_amount = v_total WHERE id = _entry_id;
    RETURN;
  END IF;

  IF v_total >= v_amount THEN
    UPDATE public.financial_entries SET paid_amount = v_total, status = 'paid' WHERE id = _entry_id;
  ELSIF v_total > 0 THEN
    UPDATE public.financial_entries SET paid_amount = v_total, status = 'partial' WHERE id = _entry_id;
  ELSIF v_due < CURRENT_DATE THEN
    UPDATE public.financial_entries SET paid_amount = 0, status = 'overdue' WHERE id = _entry_id;
  ELSE
    UPDATE public.financial_entries SET paid_amount = 0, status = 'open' WHERE id = _entry_id;
  END IF;
END;
$function$
;
GRANT EXECUTE ON FUNCTION public.recalc_financial_entry(uuid) TO authenticated,anon,service_role;
CREATE OR REPLACE FUNCTION public.recompute_deal_value(_deal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sum numeric;
  v_current numeric;
BEGIN
  IF _deal_id IS NULL THEN RETURN; END IF;

  WITH gross AS (
    SELECT
      CASE
        WHEN billing_model = 'fixed' THEN COALESCE(unit_price, 0)
        WHEN billing_model = 'percent_of_base'
          THEN COALESCE(quantity, 0) * COALESCE(percent_base_amount, 0) * COALESCE(percent, 0) / 100.0
        ELSE COALESCE(quantity, 0) * COALESCE(unit_price, 0)
      END AS g,
      COALESCE(discount_type, 'pct') AS dtype,
      COALESCE(discount_amount, 0) AS damount,
      COALESCE(discount_pct, 0) AS dpct,
      COALESCE(tax_rate, 0) AS tax
    FROM public.deal_line_items
    WHERE deal_id = _deal_id
  )
  SELECT COALESCE(SUM(
    (g - LEAST(GREATEST(
        CASE WHEN dtype = 'amount' THEN damount ELSE g * dpct / 100.0 END, 0), g))
    * (1 + tax / 100.0)
  ), NULL)
  INTO v_sum
  FROM gross;

  -- Sem itens: preserva valor manual
  IF v_sum IS NULL THEN RETURN; END IF;

  SELECT value INTO v_current FROM public.deals WHERE id = _deal_id;

  IF v_current IS DISTINCT FROM v_sum THEN
    UPDATE public.deals SET value = v_sum WHERE id = _deal_id;
  END IF;
END;
$function$
;
GRANT EXECUTE ON FUNCTION public.recompute_deal_value(uuid) TO authenticated,anon,service_role;
CREATE OR REPLACE FUNCTION public.seed_quote_templates(_workspace uuid, _owner uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_classic text;
  v_modern text;
  v_compact text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.quote_templates WHERE workspace_id = _workspace AND is_system) THEN
    RETURN;
  END IF;

  v_classic := $html$<!doctype html>
<html><head><meta charset="utf-8"><title>{{quote.title}}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#1f2937;background:#fff;margin:0;padding:40px;}
  .page{max-width:780px;margin:0 auto;}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111827;padding-bottom:16px;margin-bottom:24px;}
  h1{margin:0 0 4px;font-size:26px;}
  .muted{color:#6b7280;font-size:13px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;font-size:14px;}
  table{width:100%;border-collapse:collapse;font-size:14px;}
  th{background:#f3f4f6;text-align:left;padding:10px;border-bottom:2px solid #d1d5db;}
  td{padding:10px;border-bottom:1px solid #e5e7eb;}
  .right{text-align:right;}
  .totals{margin-top:16px;float:right;width:260px;font-size:14px;}
  .totals .row{display:flex;justify-content:space-between;padding:4px 0;color:#4b5563;}
  .totals .grand{border-top:2px solid #111827;margin-top:6px;padding-top:8px;font-weight:700;color:#111827;font-size:16px;}
  .notes{clear:both;margin-top:32px;font-size:13px;}
  .label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:4px;}
  .actions{margin-top:32px;}
</style></head>
<body><div class="page">
  <div class="head">
    <div><h1>{{quote.title}}</h1><div class="muted">Nº {{quote.number}}</div></div>
    <div class="right"><div><strong>{{agent.name}}</strong></div><div class="muted">{{agent.email}}</div></div>
  </div>
  <div class="grid">
    <div><div class="label">Para</div><div><strong>{{company.name}}</strong></div><div>{{contact.name}}</div><div class="muted">{{contact.email}}</div></div>
    <div><div class="label">Detalhes</div><div>Emitida em {{quote.created_at}}</div>{{#if quote.valid_until}}<div>Válida até {{quote.valid_until}}</div>{{/if}}</div>
  </div>
  <table>
    <thead><tr><th>Item</th><th class="right">Qtd</th><th class="right">Preço</th><th class="right">Total</th></tr></thead>
    <tbody>
    {{#each items}}
      <tr><td><strong>{{name}}</strong><div class="muted">{{description}}</div></td><td class="right">{{quantity}}</td><td class="right">{{unit_price}}</td><td class="right">{{line_total}}</td></tr>
    {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>{{quote.subtotal}}</span></div>
    <div class="row"><span>Descontos</span><span>− {{quote.discount_total}}</span></div>
    <div class="row"><span>Impostos</span><span>+ {{quote.tax_total}}</span></div>
    <div class="row grand"><span>Total</span><span>{{quote.total}}</span></div>
  </div>
  {{#if quote.notes}}<div class="notes"><div class="label">Observações</div>{{quote.notes}}</div>{{/if}}
  {{#if quote.terms}}<div class="notes"><div class="label">Termos e Condições</div>{{quote.terms}}</div>{{/if}}
  <div class="actions">{{#actions/}}</div>
</div></body></html>$html$;

  v_modern := $html$<!doctype html>
<html><head><meta charset="utf-8"><title>{{quote.title}}</title>
<style>
  body{font-family:'Inter','Helvetica Neue',Arial,sans-serif;background:#f8fafc;margin:0;padding:32px;color:#0f172a;}
  .page{max-width:820px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 18px 40px -24px rgba(15,23,42,.25);}
  .hero{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:40px;}
  .hero h1{margin:0;font-size:30px;font-weight:700;}
  .hero .num{opacity:.85;margin-top:6px;font-size:14px;}
  .hero .agent{margin-top:18px;font-size:14px;opacity:.9;}
  .body{padding:32px 40px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;}
  .card{background:#f1f5f9;border-radius:12px;padding:16px;font-size:14px;}
  .label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:8px;}
  table{width:100%;border-collapse:separate;border-spacing:0;font-size:14px;}
  th{text-align:left;padding:12px;color:#475569;font-weight:600;border-bottom:1px solid #e2e8f0;}
  td{padding:14px 12px;border-bottom:1px solid #f1f5f9;}
  .right{text-align:right;}
  .totals{margin-top:24px;background:#f8fafc;border-radius:12px;padding:18px;}
  .totals .row{display:flex;justify-content:space-between;padding:4px 0;color:#475569;font-size:14px;}
  .totals .grand{margin-top:8px;padding-top:10px;border-top:1px solid #cbd5e1;font-size:18px;font-weight:700;color:#0f172a;}
  .notes{margin-top:24px;font-size:13px;color:#334155;}
  .actions{margin-top:28px;}
</style></head>
<body><div class="page">
  <div class="hero">
    <h1>{{quote.title}}</h1>
    <div class="num">Cotação Nº {{quote.number}}</div>
    <div class="agent"><strong>{{agent.name}}</strong> · {{agent.email}}</div>
  </div>
  <div class="body">
    <div class="grid">
      <div class="card"><div class="label">Para</div><div><strong>{{company.name}}</strong></div><div>{{contact.name}}</div><div style="color:#64748b">{{contact.email}}</div></div>
      <div class="card"><div class="label">Detalhes</div><div>Emitida em {{quote.created_at}}</div>{{#if quote.valid_until}}<div>Válida até <strong>{{quote.valid_until}}</strong></div>{{/if}}</div>
    </div>
    <table>
      <thead><tr><th>Item</th><th class="right">Qtd</th><th class="right">Preço</th><th class="right">Desc</th><th class="right">Imp</th><th class="right">Total</th></tr></thead>
      <tbody>
      {{#each items}}
        <tr><td><strong>{{name}}</strong><div style="color:#64748b;font-size:12px">{{description}}</div></td><td class="right">{{quantity}}</td><td class="right">{{unit_price}}</td><td class="right">{{discount_pct}}%</td><td class="right">{{tax_rate}}%</td><td class="right"><strong>{{line_total}}</strong></td></tr>
      {{/each}}
      </tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>{{quote.subtotal}}</span></div>
      <div class="row"><span>Descontos</span><span>− {{quote.discount_total}}</span></div>
      <div class="row"><span>Impostos</span><span>+ {{quote.tax_total}}</span></div>
      <div class="row grand"><span>Total</span><span>{{quote.total}}</span></div>
    </div>
    {{#if quote.notes}}<div class="notes"><div class="label">Observações</div>{{quote.notes}}</div>{{/if}}
    {{#if quote.terms}}<div class="notes"><div class="label">Termos</div>{{quote.terms}}</div>{{/if}}
    <div class="actions">{{#actions/}}</div>
  </div>
</div></body></html>$html$;

  v_compact := $html$<!doctype html>
<html><head><meta charset="utf-8"><title>{{quote.title}}</title>
<style>
  body{font-family:'Inter',system-ui,sans-serif;color:#111;background:#fff;margin:0;padding:24px;}
  .page{max-width:620px;margin:0 auto;}
  .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
  h1{font-size:20px;margin:0;}
  .muted{color:#666;font-size:12px;}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;}
  th,td{padding:8px 6px;border-bottom:1px solid #eee;text-align:left;}
  .right{text-align:right;}
  .total{margin-top:14px;display:flex;justify-content:space-between;align-items:center;background:#111;color:#fff;padding:14px 18px;border-radius:10px;font-size:18px;font-weight:600;}
  .notes{margin-top:16px;font-size:12px;color:#444;}
  .actions{margin-top:18px;}
</style></head>
<body><div class="page">
  <div class="head"><div><h1>{{quote.title}}</h1><div class="muted">{{quote.number}} · {{company.name}}</div></div><div class="muted right">{{agent.name}}</div></div>
  <table>
    <thead><tr><th>Item</th><th class="right">Qtd</th><th class="right">Total</th></tr></thead>
    <tbody>
    {{#each items}}
      <tr><td>{{name}}</td><td class="right">{{quantity}}</td><td class="right">{{line_total}}</td></tr>
    {{/each}}
    </tbody>
  </table>
  <div class="total"><span>Total</span><span>{{quote.total}}</span></div>
  {{#if quote.valid_until}}<div class="muted" style="margin-top:8px">Válida até {{quote.valid_until}}</div>{{/if}}
  {{#if quote.notes}}<div class="notes">{{quote.notes}}</div>{{/if}}
  <div class="actions">{{#actions/}}</div>
</div></body></html>$html$;

  INSERT INTO public.quote_templates (owner_id, workspace_id, name, description, html, is_default, is_system)
  VALUES
    (_owner, _workspace, 'Clássico', 'Layout sóbrio com tabela tradicional, ideal para cotações formais.', v_classic, true, true),
    (_owner, _workspace, 'Moderno', 'Cabeçalho colorido, blocos em cards e tipografia maior.', v_modern, false, true),
    (_owner, _workspace, 'Compacto', 'Uma página enxuta, foco no total e no aceite.', v_compact, false, true);
END;
$function$
;
GRANT EXECUTE ON FUNCTION public.seed_quote_templates(uuid,uuid) TO authenticated,anon,service_role;
CREATE OR REPLACE FUNCTION public.ats_handle_silver_medalist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pool_id uuid;
BEGIN
  IF NEW.status = 'rejected'
     AND COALESCE(OLD.status, '') <> 'rejected'
     AND NEW.stage_value IN ('interview', 'onsite', 'offer')
     AND NEW.candidate_id IS NOT NULL THEN
    pool_id := public.ensure_silver_medalist_pool(NEW.owner_id);

    INSERT INTO public.ats_talent_pool_members(pool_id, candidate_id, owner_id, added_by, source)
    VALUES (pool_id, NEW.candidate_id, NEW.owner_id, NEW.owner_id, 'silver_medalist')
    ON CONFLICT (pool_id, candidate_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.financial_payments_after_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_financial_entry(OLD.entry_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_financial_entry(NEW.entry_id);
    RETURN NEW;
  END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.trg_deal_line_items_recalc_value()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_deal_value(OLD.deal_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalc_deal_value(NEW.deal_id);
    IF NEW.deal_id IS DISTINCT FROM OLD.deal_id THEN
      PERFORM public.recalc_deal_value(OLD.deal_id);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.recalc_deal_value(NEW.deal_id);
    RETURN NEW;
  END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.seed_quote_templates_on_workspace()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.seed_quote_templates(NEW.id, COALESCE(NEW.created_by, NEW.id));
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.deal_line_items_sync_deal_value()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_deal_value(OLD.deal_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.deal_id IS DISTINCT FROM OLD.deal_id THEN
    PERFORM public.recompute_deal_value(OLD.deal_id);
    PERFORM public.recompute_deal_value(NEW.deal_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_deal_value(NEW.deal_id);
    RETURN NEW;
  END IF;
END;
$function$
;
CREATE TRIGGER line_items_recalc AFTER INSERT OR UPDATE OR DELETE ON deal_line_items FOR EACH ROW EXECUTE FUNCTION trg_deal_line_items_recalc_value();
CREATE TRIGGER line_items_recompute AFTER INSERT OR UPDATE OR DELETE ON deal_line_items FOR EACH ROW EXECUTE FUNCTION deal_line_items_sync_deal_value();
CREATE TRIGGER payments_recalc AFTER INSERT OR UPDATE OR DELETE ON financial_payments FOR EACH ROW EXECUTE FUNCTION financial_payments_after_change();
CREATE TRIGGER workspace_seed AFTER INSERT ON workspaces FOR EACH ROW EXECUTE FUNCTION seed_quote_templates_on_workspace();
CREATE TRIGGER silver_pool AFTER UPDATE ON ats_applications FOR EACH ROW EXECUTE FUNCTION ats_handle_silver_medalist();
INSERT INTO leads(owner_id,workspace_id,name,email,stage) VALUES ('90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d','Synthetic secret','secret@example.test','new');
INSERT INTO deals VALUES ('92000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d',0); INSERT INTO financial_entries(id,owner_id,workspace_id,amount,due_date) VALUES ('93000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d',100,current_date-1);
INSERT INTO ats_candidates(id,owner_id,workspace_id,full_name,email,tags) VALUES ('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000004','184b9435-0a9b-4334-9e89-8854dc883f5d','Synthetic foreign owner','foreign@example.test',ARRAY['private']),('91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d','Synthetic own','own@example.test',ARRAY['private']),('91000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','Other tenant','other@example.test',ARRAY['private']);
INSERT INTO ats_candidate_consents(candidate_id,granted) VALUES ('91000000-0000-4000-8000-000000000001',true),('91000000-0000-4000-8000-000000000002',true);
INSERT INTO ats_applications(owner_id,workspace_id,candidate_id,status,stage_value) VALUES ('90000000-0000-4000-8000-000000000003','184b9435-0a9b-4334-9e89-8854dc883f5d','91000000-0000-4000-8000-000000000001','active','interview');
INSERT INTO permissions(key,module) VALUES ('techhire.compliance.delete.workspace','techhire'),('techhire.candidates.update.workspace','techhire'),('techhire.candidates.update.own','techhire');
INSERT INTO job_role_permission_overrides(workspace_id,role_id,permission_key,effect,created_by) SELECT '184b9435-0a9b-4334-9e89-8854dc883f5d','aaaaaaaa-0000-4000-8000-000000000004',key,'grant','90000000-0000-4000-8000-000000000003' FROM permissions WHERE module='techhire' ON CONFLICT DO NOTHING;
ALTER TABLE deal_line_items ENABLE ROW LEVEL SECURITY; CREATE POLICY synthetic_scoped ON deal_line_items TO authenticated USING (EXISTS(SELECT 1 FROM deals p WHERE p.id=deal_line_items.deal_id AND p.workspace_id IN (SELECT current_user_workspaces()) AND is_workspace_member(p.workspace_id,auth.uid()))) WITH CHECK (EXISTS(SELECT 1 FROM deals p WHERE p.id=deal_line_items.deal_id AND p.workspace_id IN (SELECT current_user_workspaces()) AND is_workspace_member(p.workspace_id,auth.uid())));
ALTER TABLE financial_payments ENABLE ROW LEVEL SECURITY; CREATE POLICY synthetic_scoped ON financial_payments TO authenticated USING (EXISTS(SELECT 1 FROM financial_entries p WHERE p.id=financial_payments.entry_id AND p.workspace_id IN (SELECT current_user_workspaces()) AND is_workspace_member(p.workspace_id,auth.uid()))) WITH CHECK (EXISTS(SELECT 1 FROM financial_entries p WHERE p.id=financial_payments.entry_id AND p.workspace_id IN (SELECT current_user_workspaces()) AND is_workspace_member(p.workspace_id,auth.uid())));
