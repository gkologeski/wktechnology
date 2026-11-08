// ACEITE-MINUTA Entrega 3: leitura e resposta do cliente pelo link da minuta.
// Exceção pública: o token aleatório (uuid) é o único mecanismo de acesso; as RPCs
// só aceitam minutas enviadas e só são executáveis pelo servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { clientDraftDecisionError, isValidDraftToken } from "@/lib/contracts/contract-draft-public-rules";

export const getPublicContractDraft = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ token: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    if (!isValidDraftToken(data.token)) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await (supabaseAdmin as any).rpc("contract_draft_public_get", {
      p_token: data.token,
    });
    if (error) throw new Error("Não foi possível carregar a minuta.");
    return (doc ?? null) as {
      title: string;
      body_html: string;
      status: string;
      workspace_name: string | null;
      client_decided_at: string | null;
      client_name: string | null;
    } | null;
  });

export const decidePublicContractDraft = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        token: z.string().uuid(),
        decision: z.enum(["accept", "changes"]),
        name: z.string().trim().min(3).max(200),
        note: z.string().max(4000).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await (supabaseAdmin as any).rpc("contract_draft_public_get", {
      p_token: data.token,
    });
    const pre = clientDraftDecisionError({
      token: data.token,
      status: (cur as { status?: string } | null)?.status ?? null,
      decision: data.decision,
      name: data.name,
      note: data.note,
    });
    if (pre) throw new Error(pre);
    const { data: res, error } = await (supabaseAdmin as any).rpc("contract_draft_public_decide", {
      p_token: data.token,
      p_decision: data.decision,
      p_name: data.name,
      p_note: data.note,
    });
    if (error) throw new Error(error.message);
    return res as { status: string; deal_moved: boolean };
  });
