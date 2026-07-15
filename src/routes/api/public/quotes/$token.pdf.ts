import { createFileRoute } from "@tanstack/react-router";
import { renderQuoteTemplate, type QuoteRenderContext } from "@/lib/quote-template-renderer";

// Renderiza o PDF de uma cotação pública via Chromium headless (Browserless).
// Autorização: `public_token` no path (mesmo segredo usado pela página pública).

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

function safeFilename(input: string): string {
  return String(input).replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 100) || "cotacao";
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
          <div style="font-weight:500">${escape(li.name)}</div>
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

function wrapForPrint(inner: string): string {
  // Envolve o HTML do template em um documento completo, injetando @page para
  // que o Chromium respeite A4 paisagem sem margens (o template desenha os
  // próprios fundos).
  //
  // Também injeta CSS de override no FIM do <head> para:
  //  - Neutralizar animações CSS `fadeUp/fadeIn/scaleIn` (com `both`) que deixariam
  //    blocos em opacity:0 se o snapshot ocorresse antes da animação completar.
  //  - Desligar `min-height:100vh` do `.stage` que, no viewport de print (~794px),
  //    empurra o conteúdo para uma segunda página em branco.
  //  - Permitir que a tabela quebre de forma limpa entre páginas.
  const hasHtmlTag = /<html[\s>]/i.test(inner);
  const pageStyle = `<style>@page { size: A4 landscape; margin: 0 } html, body { width: 297mm; height: 210mm; margin: 0; padding: 0; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>`;
  const overrideStyle = `<style id="__pdf_overrides__">
@page { size: A4 landscape; margin: 0; }
*, *::before, *::after { animation: none !important; transition: none !important; }
html, body { width: 1122px !important; height: 794px !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
body.__pdf_single_page_ready { width: 1122px !important; height: 794px !important; overflow: hidden !important; }
#__pdf_page__ { width: 1122px !important; height: 794px !important; overflow: hidden !important; position: relative !important; margin: 0 !important; padding: 0 !important; background: transparent !important; }
#__pdf_scale__ { transform-origin: top left !important; margin: 0 !important; padding: 0 !important; }
.stage { min-height: 0 !important; padding: 24px 16px !important; }
</style>`;
  const fitScript = `<script id="__pdf_single_page_fit__">
(function () {
  var PAGE_WIDTH = 1122;
  var PAGE_HEIGHT = 794;
  var SOURCE_WIDTH = 1400;
  var MAX_ATTEMPTS = 3;

  function moveBodyIntoScale() {
    if (document.getElementById('__pdf_page__')) return document.getElementById('__pdf_scale__');

    var page = document.createElement('div');
    page.id = '__pdf_page__';
    var scale = document.createElement('div');
    scale.id = '__pdf_scale__';
    scale.style.width = SOURCE_WIDTH + 'px';

    while (document.body.firstChild) {
      scale.appendChild(document.body.firstChild);
    }

    page.appendChild(scale);
    document.body.appendChild(page);
    document.body.classList.add('__pdf_single_page_ready');
    return scale;
  }

  function measureContent(scale) {
    var rect = scale.getBoundingClientRect();
    var width = Math.max(scale.scrollWidth, rect.width, SOURCE_WIDTH);
    var height = Math.max(scale.scrollHeight, rect.height, 1);
    var nodes = scale.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i += 1) {
      var style = window.getComputedStyle(nodes[i]);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      var box = nodes[i].getBoundingClientRect();
      width = Math.max(width, box.right - rect.left);
      height = Math.max(height, box.bottom - rect.top);
    }
    return { width: width, height: height };
  }

  function fitToSinglePage() {
    var scale = moveBodyIntoScale();
    if (!scale) return;

    scale.style.transform = 'none';
    scale.style.width = SOURCE_WIDTH + 'px';

    for (var i = 0; i < MAX_ATTEMPTS; i += 1) {
      var size = measureContent(scale);
      var ratio = Math.min(PAGE_WIDTH / size.width, PAGE_HEIGHT / size.height, 1);
      scale.style.transform = 'scale(' + ratio.toFixed(4) + ')';
      scale.style.width = SOURCE_WIDTH + 'px';
      scale.style.height = Math.ceil(size.height) + 'px';
    }

    var finalSize = measureContent(scale);
    var finalRatio = Math.min(PAGE_WIDTH / finalSize.width, PAGE_HEIGHT / finalSize.height, 1);
    scale.style.transform = 'scale(' + finalRatio.toFixed(4) + ')';
    document.documentElement.style.width = PAGE_WIDTH + 'px';
    document.documentElement.style.height = PAGE_HEIGHT + 'px';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.width = PAGE_WIDTH + 'px';
    document.body.style.height = PAGE_HEIGHT + 'px';
    document.body.style.overflow = 'hidden';
  }

  if (document.readyState === 'complete') {
    fitToSinglePage();
  } else {
    window.addEventListener('load', fitToSinglePage, { once: true });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitToSinglePage).catch(function () {});
  }

  window.__fitQuotePdfToSinglePage = fitToSinglePage;
})();
</script>`;
  if (hasHtmlTag) {
    // pageStyle logo após <head>; overrideStyle imediatamente antes de </head>
    // para vencer especificidade de qualquer <style> do template.
    let out = inner.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${pageStyle}`);
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${overrideStyle}</head>`);
    } else {
      out = out.replace(/<body(\s[^>]*)?>/i, (m) => `${overrideStyle}${m}`);
    }
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${fitScript}</body>`);
    } else {
      out = `${out}${fitScript}`;
    }
    return out;
  }
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">${pageStyle}${overrideStyle}</head><body>${inner}${fitScript}</body></html>`;
}

async function renderPdfViaBrowserless(html: string, token: string): Promise<ArrayBuffer> {
  const url = `https://production-sfo.browserless.io/pdf?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      options: {
        format: "A4",
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      },
      // Viewport desktop: templates são desenhados para telas largas; sem isso o
      // Chromium usa o viewport de print (~794px) e o grid de cards colapsa.
      viewport: { width: 1400, height: 900, deviceScaleFactor: 2 },
      // Mantém o layout de tela (o template não define @media print).
      emulateMediaType: "screen",
      gotoOptions: { waitUntil: "networkidle0", timeout: 30000 },
      // Cinto e suspensórios: as animações já foram zeradas via CSS acima; este
      // timeout garante que fontes externas (Google Fonts Inter) carreguem.
      waitForTimeout: 1200,
      waitForFunction: "window.__fitQuotePdfToSinglePage && document.body.classList.contains('__pdf_single_page_ready')",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Browserless ${res.status}: ${body.slice(0, 300)}`);
  }
  return await res.arrayBuffer();
}

export const Route = createFileRoute("/api/public/quotes/$token/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 8 || token.length > 128) {
          return new Response("Invalid token", { status: 400 });
        }

        const browserlessToken = process.env.BROWSERLESS_TOKEN;
        if (!browserlessToken) {
          return new Response("PDF service not configured", { status: 503 });
        }

        // Import supabaseAdmin dentro do handler (server-only leaf).
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: quote, error } = await supabaseAdmin
          .from("quotes")
          .select("*")
          .eq("public_token", token)
          .maybeSingle();
        if (error || !quote) {
          return new Response("Cotação não encontrada", { status: 404 });
        }
        if (quote.status === "draft") {
          return new Response("Cotação em rascunho não pode ser baixada", { status: 403 });
        }

        const { data: items } = await supabaseAdmin
          .from("quote_line_items")
          .select("*")
          .eq("quote_id", quote.id)
          .order("position");

        let company: { name: string | null; website: string | null } | null = null;
        if (quote.company_id) {
          const r = await supabaseAdmin
            .from("companies")
            .select("name, website")
            .eq("id", quote.company_id)
            .maybeSingle();
          company = r.data;
        }
        let contact: {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        } | null = null;
        if (quote.contact_id) {
          const r = await supabaseAdmin
            .from("contacts")
            .select("first_name, last_name, email")
            .eq("id", quote.contact_id)
            .maybeSingle();
          contact = r.data;
        }
        let agent: { full_name: string | null } | null = null;
        if (quote.owner_id) {
          const r = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("id", quote.owner_id)
            .maybeSingle();
          agent = r.data;
        }
        let template: { html: string } | null = null;
        if (quote.template_id) {
          const r = await supabaseAdmin
            .from("quote_templates")
            .select("html")
            .eq("id", quote.template_id)
            .maybeSingle();
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
          return {
            name: li.name ?? "",
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
          company: { name: company?.name ?? "", domain: company?.website ?? "" },
          contact: {
            name: contact
              ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
              : "",
            email: contact?.email ?? "",
          },
          agent: { name: agent?.full_name ?? "", email: "" },
          items: itemsCtx.map((li) => ({
            name: li.name,
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
              contact: contact
                ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
                : "",
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

        let pdf: ArrayBuffer;
        try {
          pdf = await renderPdfViaBrowserless(html, browserlessToken);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          return new Response(`Falha ao gerar PDF: ${msg}`, { status: 502 });
        }

        const filename = `Proposta-${safeFilename(String(quote.number ?? token))}.pdf`;
        return new Response(pdf, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
