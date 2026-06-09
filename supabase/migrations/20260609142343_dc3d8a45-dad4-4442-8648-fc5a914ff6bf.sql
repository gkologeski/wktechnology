-- 1) Tabela quote_templates
CREATE TABLE public.quote_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  html text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_templates_workspace ON public.quote_templates(workspace_id);
CREATE UNIQUE INDEX uniq_quote_templates_default_per_ws
  ON public.quote_templates(workspace_id) WHERE is_default;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_templates TO authenticated;
GRANT ALL ON public.quote_templates TO service_role;

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select_quote_templates" ON public.quote_templates
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_insert_quote_templates" ON public.quote_templates
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_update_quote_templates" ON public.quote_templates
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_delete_quote_templates" ON public.quote_templates
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));

CREATE TRIGGER trg_quote_templates_updated_at
  BEFORE UPDATE ON public.quote_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Coluna template_id em quotes
ALTER TABLE public.quotes
  ADD COLUMN template_id uuid REFERENCES public.quote_templates(id) ON DELETE SET NULL;

CREATE INDEX idx_quotes_template ON public.quotes(template_id) WHERE template_id IS NOT NULL;

-- 3) Função de seed dos 3 modelos para um workspace
CREATE OR REPLACE FUNCTION public.seed_quote_templates(_workspace uuid, _owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;

-- 4) Trigger ao criar workspace
CREATE OR REPLACE FUNCTION public.seed_quote_templates_on_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_quote_templates(NEW.id, COALESCE(NEW.created_by, NEW.id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_quote_templates_on_workspace
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_quote_templates_on_workspace();

-- 5) Backfill para workspaces existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, COALESCE(created_by, id) AS owner_id FROM public.workspaces LOOP
    PERFORM public.seed_quote_templates(r.id, r.owner_id);
  END LOOP;
END $$;