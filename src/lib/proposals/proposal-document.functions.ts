import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Documento da proposta: ficha interna (RLS do usuário) e link público
// (validado pelo token secreto da proposta).

export const getProposalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { loadProposalDocument } = await import("./proposal-document.server");
    return loadProposalDocument(context.supabase, { id: data.id });
  });

export const getProposalByToken = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(16).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadProposalDocument } = await import("./proposal-document.server");
    const doc = await loadProposalDocument(supabaseAdmin, { token: data.token });
    // Rascunhos e propostas em aprovação interna não ficam visíveis ao cliente.
    if (["draft", "in_review"].includes(doc.proposal.status) && !doc.proposal.sent_at) {
      throw new Error("Proposta ainda não disponível.");
    }
    return doc;
  });

export const respondToProposal = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().min(16).max(128),
        action: z.enum(["accept", "decline"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await supabaseAdmin
      .from("proposals")
      .select("id, status, expires_at")
      .eq("public_token", data.token)
      .maybeSingle();
    if (error || !p) throw new Error("Proposta não encontrada");
    if (p.status !== "sent") throw new Error("Esta proposta não está aguardando resposta.");
    if (p.expires_at && new Date(p.expires_at) < new Date())
      throw new Error("Esta proposta expirou.");
    const { error: uErr } = await supabaseAdmin
      .from("proposals")
      .update({
        status: data.action === "accept" ? "accepted" : "rejected",
        decided_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });
