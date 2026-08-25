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
  return (
    String(input)
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .slice(0, 100) || "cotacao"
  );
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

// --- Conversão oklch/oklab/color-mix → rgb ---------------------------------
// PDFium (Chrome) renderiza como transparente cores em espaços modernos que o
// Chromium escreve como DeviceN no PDF. Achatar para rgb() antes de imprimir.

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  // https://bottosson.github.io/posts/oklab/
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const toSRGB = (v: number) => {
    v = clamp01(v);
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };
  r = Math.round(toSRGB(r) * 255);
  g = Math.round(toSRGB(g) * 255);
  bl = Math.round(toSRGB(bl) * 255);
  return [r, g, bl];
}

function parseNumberMaybePct(tok: string, base = 1): number {
  const t = tok.trim();
  if (t.endsWith("%")) return (parseFloat(t) / 100) * base;
  return parseFloat(t);
}

function replaceOklch(html: string): string {
  // oklch( L[%] C H [/ A] ) e oklab( L[%] a b [/ A] )
  const oklchRe = /oklch\(\s*([^)]+)\s*\)/gi;
  const oklabRe = /oklab\(\s*([^)]+)\s*\)/gi;
  html = html.replace(oklchRe, (_m, inner: string) => {
    try {
      const [main, alpha] = inner.split("/").map((s) => s.trim());
      const parts = main.split(/\s+/);
      if (parts.length < 3) return "rgb(0,0,0)";
      const L = parseNumberMaybePct(parts[0]);
      const C = parseFloat(parts[1]);
      const H = (parseFloat(parts[2]) * Math.PI) / 180;
      const a = Math.cos(H) * C;
      const b = Math.sin(H) * C;
      const [r, g, bl] = oklabToRgb(L, a, b);
      const A = alpha ? parseNumberMaybePct(alpha) : 1;
      return A < 1 ? `rgba(${r},${g},${bl},${A})` : `rgb(${r},${g},${bl})`;
    } catch {
      return "rgb(0,0,0)";
    }
  });
  html = html.replace(oklabRe, (_m, inner: string) => {
    try {
      const [main, alpha] = inner.split("/").map((s) => s.trim());
      const parts = main.split(/\s+/);
      if (parts.length < 3) return "rgb(0,0,0)";
      const L = parseNumberMaybePct(parts[0]);
      const a = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      const [r, g, bl] = oklabToRgb(L, a, b);
      const A = alpha ? parseNumberMaybePct(alpha) : 1;
      return A < 1 ? `rgba(${r},${g},${bl},${A})` : `rgb(${r},${g},${bl})`;
    } catch {
      return "rgb(0,0,0)";
    }
  });
  // color-mix(...) — fallback simples: usa a primeira cor citada quando possível.
  html = html.replace(/color-mix\(\s*[^)]*\)/gi, (m) => {
    const inner = m.slice(m.indexOf("(") + 1, -1);
    const hexMatch = inner.match(/#[0-9a-fA-F]{3,8}/);
    if (hexMatch) return hexMatch[0];
    const rgbMatch = inner.match(/rgba?\([^)]+\)/i);
    if (rgbMatch) return rgbMatch[0];
    return "rgb(128,128,128)";
  });
  return html;
}

function wrapForPrint(inner: string): string {
  // Envolve o HTML do template em um documento completo, injetando @page para
  // que o Chromium respeite A4 paisagem sem margens.
  //
  // Estratégia (Chrome/PDFium-safe):
  //  - NADA de `transform: scale()` no wrapper (gera Form XObject que PDFium
  //    clipa fora do MediaBox).
  //  - Usar `zoom` (via document.body.style.zoom) como fallback quando o
  //    conteúdo estourar 1 página. Zoom faz reflow antes da impressão e
  //    não gera Form XObject.
  //  - Achatar CSS que gera transparency groups/soft masks no PDF
  //    (mix-blend-mode, backdrop-filter, filter, mask) — esses recursos
  //    fazem o Chrome renderizar como página em branco.
  //  - Sem `overflow:hidden` no body para não clipar fora do MediaBox.
  inner = replaceOklch(inner);
  const hasHtmlTag = /<html[\s>]/i.test(inner);
  const pageStyle = `<style>@page { size: A4 landscape; margin: 0 } html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>`;
  const overrideStyle = `<style id="__pdf_overrides__">
@page { size: A4 landscape; margin: 0; }
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
  mix-blend-mode: normal !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
  mask: none !important;
  -webkit-mask: none !important;
  mask-image: none !important;
  -webkit-mask-image: none !important;
}
html, body { margin: 0 !important; padding: 0 !important; background: #fff; }
.stage { min-height: 0 !important; padding: 24px 16px !important; }
table { page-break-inside: auto; }
tr, td, th { page-break-inside: avoid; }
</style>`;
  const fitScript = `<script id="__pdf_single_page_fit__">
(function () {
  var PAGE_WIDTH = 1122;   // 297mm @ 96dpi
  var PAGE_HEIGHT = 794;   // 210mm @ 96dpi

  function measure() {
    var doc = document.documentElement;
    var body = document.body;
    return {
      w: Math.max(doc.scrollWidth, body.scrollWidth),
      h: Math.max(doc.scrollHeight, body.scrollHeight),
    };
  }

  function fit() {
    // Reset possíveis zooms anteriores
    document.body.style.zoom = "1";
    var size = measure();
    var ratio = Math.min(PAGE_WIDTH / size.w, PAGE_HEIGHT / size.h, 1);
    if (ratio < 1) {
      // 'zoom' faz reflow antes da impressão e não gera Form XObject no PDF.
      // Chromium suporta em contexto de impressão.
      document.body.style.zoom = String(ratio);
    }
    window.__pdfReady = true;
  }

  function schedule() {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fit).catch(fit);
    } else {
      fit();
    }
  }

  if (document.readyState === "complete") {
    schedule();
  } else {
    window.addEventListener("load", schedule, { once: true });
  }
})();
</script>`;
  if (hasHtmlTag) {
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
      viewport: { width: 1400, height: 900, deviceScaleFactor: 2 },
      emulateMediaType: "screen",
      gotoOptions: { waitUntil: "networkidle0", timeout: 30000 },
      // Aguarda o script de fit setar a flag; se demorar, o timeout do
      // Browserless (30s) protege contra travas.
      waitForFunction: {
        fn: "() => window.__pdfReady === true",
        timeout: 5000,
      },
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
            name: contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "",
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
