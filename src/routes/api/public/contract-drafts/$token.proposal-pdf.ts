import { createFileRoute } from "@tanstack/react-router";
import { isValidDraftToken } from "@/lib/contracts/contract-draft-public-rules";

// PDF da proposta comercial vinculada a uma minuta enviada.
// Autorização: token UUID da própria minuta (mesmo segredo de /minuta/$token);
// revogar ou cancelar a minuta revoga este download automaticamente.

export const Route = createFileRoute("/api/public/contract-drafts/$token/proposal-pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!isValidDraftToken(token)) return new Response("Link inválido", { status: 400 });
        const browserlessToken = process.env["BROWSERLESS_TOKEN"];
        if (!browserlessToken)
          return new Response("Geração de PDF não configurada.", { status: 503 });

        const { loadPublicContractDraftProposalDoc } =
          await import("@/lib/contracts/contract-draft-public.server");
        let doc;
        try {
          doc = await loadPublicContractDraftProposalDoc(token);
        } catch {
          return new Response("Proposta não encontrada", { status: 404 });
        }
        if (!doc) return new Response("Proposta não encontrada", { status: 404 });

        const { renderProposalPdf } = await import("@/lib/contracts/proposal-pdf.server");
        let pdf: ArrayBuffer;
        try {
          pdf = (await renderProposalPdf(doc, browserlessToken)).buffer as ArrayBuffer;
        } catch (e) {
          return new Response(`Falha ao gerar PDF: ${e instanceof Error ? e.message : "erro"}`, {
            status: 502,
          });
        }
        const name =
          String(doc.proposal.title)
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
