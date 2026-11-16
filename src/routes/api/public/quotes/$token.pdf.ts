import { isValidProposalToken } from "@/lib/proposals/proposal-pdf-rules";
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/quotes/$token/pdf")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!isValidProposalToken(token)) return new Response("Invalid token", { status: 400 });
        const browserlessToken = process.env.BROWSERLESS_TOKEN;
        if (!browserlessToken) return new Response("PDF service not configured", { status: 503 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: quote, error } = await supabaseAdmin
          .from("quotes")
          .select("id,number,status")
          .eq("public_token", token)
          .maybeSingle();
        if (error || !quote) return new Response("Cotação não encontrada", { status: 404 });
        if (!["published", "sent", "accepted", "declined", "expired"].includes(quote.status))
          return new Response("Cotação em rascunho não pode ser baixada", { status: 403 });
        try {
          const { renderQuotePdf } = await import("@/lib/contracts/quote-pdf.server");
          const pdf = await renderQuotePdf(supabaseAdmin, quote.id, browserlessToken);
          const name =
            String(quote.number ?? token)
              .replace(/[^A-Za-z0-9_-]+/g, "_")
              .slice(0, 100) || "cotacao";
          return new Response(pdf as BodyInit, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="Proposta-${name}.pdf"`,
              "Cache-Control": "private, no-store",
            },
          });
        } catch {
          return new Response("Falha ao gerar PDF", { status: 502 });
        }
      },
    },
  },
});
