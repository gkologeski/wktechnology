import { createFileRoute } from "@tanstack/react-router";
import { renderPdfViaBrowserless, wrapForPrint } from "@/lib/pdf/print-html.server";

// PDF da proposta. Autorização: `public_token` no caminho (mesmo segredo do
// link público). Rascunhos internos não são exportados por este link.

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Route = createFileRoute("/api/public/proposals/$token/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!token || token.length < 16 || token.length > 128)
          return new Response("Link inválido", { status: 400 });
        const browserlessToken = process.env["BROWSERLESS_TOKEN"];
        if (!browserlessToken)
          return new Response("Geração de PDF não configurada.", { status: 503 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { loadProposalDocument } = await import("@/lib/proposals/proposal-document.server");
        let doc;
        try {
          doc = await loadProposalDocument(supabaseAdmin, { token });
        } catch {
          return new Response("Proposta não encontrada", { status: 404 });
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
<div class="doc"><h1>${esc(p.title)}</h1><div class="muted">Versão ${p.version}${doc.agent ? ` · ${esc(doc.agent)}` : ""}</div>
<div class="grid"><div><div class="label">Para</div>${esc(doc.company ?? "")}<br/>${esc(doc.contact ?? "")}</div>
<div><div class="label">Detalhes</div>Emitida em ${date(p.created_at)}${p.expires_at ? `<br/>Válida até ${date(p.expires_at)}` : ""}</div></div>
${rows ? `<table><thead><tr><th>Item</th><th>Cobrança</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
${p.total_amount != null ? `<p class="total">Total: ${fmt(p.total_amount)}</p>` : ""}
<div>${p.body.replace(/<script[\s\S]*?<\/script>/gi, "")}</div></div>`;
        let pdf: ArrayBuffer;
        try {
          pdf = await renderPdfViaBrowserless(wrapForPrint(inner), browserlessToken);
        } catch (e) {
          return new Response(`Falha ao gerar PDF: ${e instanceof Error ? e.message : "erro"}`, {
            status: 502,
          });
        }
        const name =
          String(p.title)
            .replace(/[^A-Za-z0-9_-]+/g, "_")
            .slice(0, 80) || "proposta";
        return new Response(pdf, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="Proposta-${name}.pdf"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
