import type { ProposalDocumentData } from "@/lib/proposals/proposal-document-types";
import { renderPdfViaBrowserless, wrapForPrint } from "@/lib/pdf/print-html.server";
import { stripLegacyInvestment } from "@/lib/proposals/proposal-items-placement";
import { proposalPdfSections } from "@/lib/proposals/proposal-pdf-rules";
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function renderProposalPdf(doc: ProposalDocumentData, browserlessToken: string) {
  if (doc.visualHtml) {
    const landscape = doc.visualOrientation === "landscape";
    const wMm = landscape ? 297 : 210;
    const hMm = landscape ? 210 : 297;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><style>@page{size:${wMm}mm ${hMm}mm;margin:0}html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.vp-deck{display:block;margin:0;padding:0}.vp-page{page-break-after:always;break-after:page;margin:0}.vp-page:last-child{page-break-after:auto;break-after:auto}*{box-sizing:border-box}</style></head><body>${doc.visualHtml}</body></html>`;
    const url = `https://production-sfo.browserless.io/pdf?token=${encodeURIComponent(browserlessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        options: {
          format: "A4",
          landscape,
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
        },
        viewport: landscape
          ? { width: 1400, height: 900, deviceScaleFactor: 2 }
          : { width: 900, height: 1400, deviceScaleFactor: 2 },
        emulateMediaType: "screen",
        gotoOptions: { waitUntil: "networkidle0", timeout: 30000 },
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`Falha ao gerar PDF visual (HTTP ${res.status}): ${detail}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
  const p = doc.proposal;
  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: p.currency }).format(v);
  const date = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
  const rows = doc.items
    .map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.billing)}</td></tr>`)
    .join("");
  const inner = `<style>
.doc{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;padding:48px 56px;font-size:13px}
h1{font-size:22px;margin:0}.muted{color:#6b7280}.grid{display:flex;gap:40px;margin:24px 0}
.label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:4px}
table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:left;padding:8px;border-top:1px solid #e5e7eb}
th{background:#f9fafb}.total{text-align:right;font-weight:600;font-size:15px}
</style>
<div class="doc" style="padding:48px 56px;box-sizing:border-box">
<h1>${esc(p.title)}</h1><div class="muted">Versão ${p.version}${doc.agent ? ` · ${esc(doc.agent)}` : ""}</div>
<div class="grid"><div><div class="label">Para</div>${esc(doc.company ?? "")}<br/>${esc(doc.contact ?? "")}</div>
<div><div class="label">Detalhes</div>Emitida em ${date(p.created_at)}${p.expires_at ? `<br/>Válida até ${date(p.expires_at)}` : ""}</div></div>
${proposalPdfSections(
  stripLegacyInvestment(p.body).replace(/<script[\s\S]*?<\/script>/gi, ""),
  rows
    ? `<table><thead><tr><th>Item</th><th>Cobrança</th></tr></thead><tbody>${rows}</tbody></table>`
    : "",
  p.total_amount != null ? `<p class="total">Total: ${fmt(p.total_amount)}</p>` : "",
)}</div>`;
  return new Uint8Array(await renderPdfViaBrowserless(wrapForPrint(inner), browserlessToken));
}
