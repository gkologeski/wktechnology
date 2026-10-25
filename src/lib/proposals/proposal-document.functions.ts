import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Documento da proposta: ficha interna (RLS do usuário) e link público
// (validado pelo token secreto da proposta).

export const getProposalDocument = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "view")])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "proposals", data.id, "view");

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
    if (
      !["sent", "accepted", "rejected"].includes(doc.proposal.status) ||
      !doc.proposal.sent_at ||
      !doc.proposal.locked
    ) {
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
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ ok: boolean }>(supabaseAdmin, "sales_public_decision", {
      p_kind: "proposals",
      p_token: data.token,
      p_action: data.action,
      p_signature: null,
    });
  });
