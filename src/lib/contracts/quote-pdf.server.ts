import type { SupabaseClient } from "@supabase/supabase-js";
import { renderQuoteTemplate, type QuoteRenderContext } from "@/lib/quote-template-renderer";
import { formatLineItemIdentity } from "@/lib/line-item-display";
import { renderPdfViaBrowserless, wrapForPrint } from "@/lib/pdf/print-html.server";
import { resolveCompanyLogoUrl, resolveProviderLogoUrl } from "@/lib/sales/company-logo-token";
function formatCurrencyBRL(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${currency || ""} ${value.toFixed(2)}`;
  }
}

function formatDateTimeBR(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function buildFallbackHtml(ctx: {
  title: string;
  number: string;
  createdAt: string;
  validUntil: string;
  company: string;
  contact: string;
  contactEmail: string;
  agent: string;
  agentEmail: string;
  currency: string;
  items: Array<{
    name: string;
    item_title?: string;
    display_name: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount_pct: number;
    tax_rate: number;
    line_total: number;
  }>;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  notes: string;
  terms: string;
}): string {
  const fmt = (n: number) => formatCurrencyBRL(n, ctx.currency);
  const rows = ctx.items
    .map(
      (li) => `<tr>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb">
          <div style="font-weight:500">${escape(li.display_name)}</div>
          ${li.description ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${escape(li.description)}</div>` : ""}
        </td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;text-align:right">${li.quantity}</td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;text-align:right">${fmt(li.unit_price)}</td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;text-align:right">${li.discount_pct}%</td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;text-align:right">${li.tax_rate}%</td>
        <td style="padding:10px 12px;border-top:1px solid #e5e7eb;text-align:right;font-weight:500">${fmt(li.line_total)}</td>
      </tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escape(ctx.title)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm }
  * { box-sizing: border-box }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0 }
  h1 { font-size: 22px; margin: 0 }
  .muted { color: #6b7280 }
  table { width: 100%; border-collapse: collapse; font-size: 13px }
  th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-weight: 600 }
  th.num, td.num { text-align: right }
  .totals { margin-top: 16px; margin-left: auto; width: 320px; font-size: 14px }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; color: #475569 }
  .totals .grand { border-top: 1px solid #e5e7eb; margin-top: 6px; padding-top: 8px; font-weight: 700; color: #0f172a; font-size: 16px }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 16px 0 24px }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin-bottom: 4px }
  .section { margin-top: 20px; font-size: 13px }
</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:8px">
    <div>
      <h1>${escape(ctx.title)}</h1>
      <div class="muted" style="margin-top:4px;font-size:13px">Nº ${escape(ctx.number)}</div>
    </div>
    <div style="text-align:right;font-size:13px">
      ${ctx.agent ? `<div style="font-weight:500">${escape(ctx.agent)}</div>` : ""}
      ${ctx.agentEmail ? `<div class="muted">${escape(ctx.agentEmail)}</div>` : ""}
    </div>
  </div>
  <div class="grid">
    <div>
      <div class="label">Para</div>
      ${ctx.company ? `<div style="font-weight:500">${escape(ctx.company)}</div>` : ""}
      ${ctx.contact ? `<div>${escape(ctx.contact)}</div>` : ""}
      ${ctx.contactEmail ? `<div class="muted">${escape(ctx.contactEmail)}</div>` : ""}
    </div>
    <div>
      <div class="label">Detalhes</div>
      <div>Emitida em ${escape(ctx.createdAt)}</div>
      ${ctx.validUntil ? `<div>Válida até ${escape(ctx.validUntil)}</div>` : ""}
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Item</th>
      <th class="num" style="width:80px">Qtd</th>
      <th class="num" style="width:110px">Preço</th>
      <th class="num" style="width:80px">Desc</th>
      <th class="num" style="width:80px">Imp</th>
      <th class="num" style="width:130px">Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${fmt(ctx.subtotal)}</span></div>
    <div class="row"><span>Descontos</span><span>− ${fmt(ctx.discount_total)}</span></div>
    <div class="row"><span>Impostos</span><span>+ ${fmt(ctx.tax_total)}</span></div>
    <div class="row grand"><span>Total</span><span>${fmt(ctx.total)}</span></div>
  </div>
  ${ctx.notes ? `<div class="section"><div class="label">Observações</div><p style="white-space:pre-wrap;margin:0">${escape(ctx.notes)}</p></div>` : ""}
  ${ctx.terms ? `<div class="section"><div class="label">Termos</div><p style="white-space:pre-wrap;margin:0">${escape(ctx.terms)}</p></div>` : ""}
</body></html>`;
}

function escape(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Caller supplies its authenticated/RLS client, or a public-token authorized client.
export async function renderQuotePdf(sb: SupabaseClient, id: string, browserlessToken: string) {
  const { data: quote, error } = await sb.from("quotes").select("*").eq("id", id).single();
  if (error || !quote) throw new Error("Cotação indisponível.");
  const { data: items, error: itemsError } = await sb
    .from("quote_line_items")
    .select("*, service:service_catalog(name), preset:contracting_presets(name)")
    .eq("quote_id", quote.id)
    .eq("workspace_id", quote.workspace_id)
    .order("position");

  if (itemsError) throw new Error("Não foi possível carregar os itens da cotação.");
  let company: {
    name: string | null;
    website: string | null;
    domain: string | null;
    logo_url: string | null;
    logo_source: string | null;
  } | null = null;
  if (quote.company_id) {
    const r = await sb
      .from("companies")
      .select("name, website, domain, logo_url, logo_source")
      .eq("id", quote.company_id)
      .eq("workspace_id", quote.workspace_id)
      .maybeSingle();
    if (r.error || !r.data) throw new Error("Empresa da cotação indisponível.");
    company = r.data;
  }
  const [entityRes, brandingRes] = await Promise.all([
    quote.legal_entity_id
      ? sb
          .from("legal_entities")
          .select("name, trade_name, logo_url")
          .eq("id", quote.legal_entity_id)
          .eq("workspace_id", quote.workspace_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    sb
      .from("workspace_branding")
      .select("brand_name, logo_url")
      .eq("workspace_id", quote.workspace_id)
      .maybeSingle(),
  ]);
  const entityRow = entityRes.data as {
    name?: string | null;
    trade_name?: string | null;
    logo_url?: string | null;
  } | null;
  const brandingRow = brandingRes.data as {
    brand_name?: string | null;
    logo_url?: string | null;
  } | null;
  const providerName = entityRow?.trade_name || entityRow?.name || brandingRow?.brand_name || "";
  const providerLogo = resolveProviderLogoUrl(entityRow?.logo_url, brandingRow?.logo_url);
  let contact: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null = null;
  if (quote.contact_id) {
    const r = await sb
      .from("contacts")
      .select("first_name, last_name, email")
      .eq("id", quote.contact_id)
      .eq("workspace_id", quote.workspace_id)
      .maybeSingle();
    if (r.error || !r.data) throw new Error("Contato da cotação indisponível.");
    contact = r.data;
  }
  let agent: { full_name: string | null } | null = null;
  if (quote.owner_id) {
    const r = await sb.from("profiles").select("full_name").eq("id", quote.owner_id).maybeSingle();
    if (r.error) throw new Error("Responsável da cotação indisponível.");
    agent = r.data;
  }
  let template: { html: string } | null = null;
  if (quote.template_id) {
    const r = await sb
      .from("quote_templates")
      .select("html")
      .eq("id", quote.template_id)
      .eq("workspace_id", quote.workspace_id)
      .maybeSingle();
    if (r.error || !r.data) throw new Error("Modelo da cotação indisponível.");
    template = r.data;
  }

  const currency = String(quote.currency || "BRL");
  const fmt = (n: unknown) => formatCurrencyBRL(Number(n) || 0, currency);
  const itemsCtx = (items ?? []).map((li) => {
    const total =
      Number(li.quantity) *
      Number(li.unit_price) *
      (1 - Number(li.discount_pct ?? 0) / 100) *
      (1 + Number(li.tax_rate ?? 0) / 100);
    const displayName = formatLineItemIdentity({
      name: li.name,
      quantity: li.quantity,
      service_name: li.service?.name,
      preset_name: li.preset?.name,
    });
    return {
      // `name` carrega o rótulo padronizado; título cru em `item_title`.
      name: displayName,
      item_title: li.name ?? "",
      display_name: displayName,
      description: li.description ?? "",
      quantity: Number(li.quantity ?? 0),
      unit_price: Number(li.unit_price ?? 0),
      discount_pct: Number(li.discount_pct ?? 0),
      tax_rate: Number(li.tax_rate ?? 0),
      line_total: total,
    };
  });

  const ctx: QuoteRenderContext = {
    quote: {
      number: quote.number,
      title: quote.title ?? "Cotação",
      created_at: formatDateTimeBR(quote.created_at),
      valid_until: quote.valid_until ? formatDateTimeBR(quote.valid_until) : "",
      subtotal: fmt(quote.subtotal),
      discount_total: fmt(quote.discount_total),
      tax_total: fmt(quote.tax_total),
      total: fmt(quote.total),
      notes: quote.notes ?? "",
      terms: quote.terms ?? "",
    },
    company: {
      name: company?.name ?? "",
      domain: company?.website ?? "",
      logo: resolveCompanyLogoUrl(company),
    },
    provider: { name: providerName, logo: providerLogo },
    contact: {
      name: contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "",
      email: contact?.email ?? "",
    },
    agent: { name: agent?.full_name ?? "", email: "" },
    items: itemsCtx.map((li) => ({
      name: li.name,
      item_title: li.item_title,
      display_name: li.display_name,
      description: li.description,
      quantity: li.quantity,
      unit_price: fmt(li.unit_price),
      discount_pct: li.discount_pct,
      tax_rate: li.tax_rate,
      line_total: fmt(li.line_total),
    })),
  };

  let html: string;
  if (template?.html) {
    const rendered = renderQuoteTemplate(template.html, ctx);
    // Remove marcador de ações (não aplicável no PDF).
    html = wrapForPrint(rendered.replace(/\{\{#actions\/\}\}/g, ""));
  } else {
    html = wrapForPrint(
      buildFallbackHtml({
        title: String(quote.title ?? "Cotação"),
        number: String(quote.number ?? ""),
        createdAt: formatDateTimeBR(quote.created_at),
        validUntil: quote.valid_until ? formatDateTimeBR(quote.valid_until) : "",
        company: company?.name ?? "",
        contact: contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "",
        contactEmail: contact?.email ?? "",
        agent: agent?.full_name ?? "",
        agentEmail: "",
        currency,
        items: itemsCtx,
        subtotal: Number(quote.subtotal ?? 0),
        discount_total: Number(quote.discount_total ?? 0),
        tax_total: Number(quote.tax_total ?? 0),
        total: Number(quote.total ?? 0),
        notes: String(quote.notes ?? ""),
        terms: String(quote.terms ?? ""),
      }),
    );
  }

  return new Uint8Array(await renderPdfViaBrowserless(html, browserlessToken));
}
