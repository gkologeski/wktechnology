import { createFileRoute } from "@tanstack/react-router";
import { isValidProposalToken } from "@/lib/proposals/proposal-pdf-rules";

// PDF da proposta. Autorização: `public_token` no caminho (mesmo segredo do
// link público). Rascunhos internos não são exportados por este link.

export const Route = createFileRoute("/api/public/proposals/$token/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!isValidProposalToken(token)) return new Response("Link inválido", { status: 400 });
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
        const { renderProposalPdf } = await import("@/lib/contracts/proposal-pdf.server");
        const p = doc.proposal;
        let pdf: ArrayBuffer;
        try {
          pdf = (await renderProposalPdf(doc, browserlessToken)).buffer as ArrayBuffer;
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
