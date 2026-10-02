import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Conversões Cotação -> Proposta -> Contrato. Leituras e gravações usam o
// cliente do usuário (RLS aplicada); a lógica fica em sales-flow.server.ts.

export const createProposalFromQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        quoteId: z.string().uuid(),
        title: z.string().max(300).optional(),
        body: z.string().max(500_000).optional(),
        total_amount: z.number().nonnegative().nullable().optional(),
        expires_at: z.string().nullable().optional(),
        assigned_to: z.string().uuid().nullable().optional(),
        proposal_template_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { proposalFromQuote } = await import("./sales-flow.server");
    const { quoteId, ...overrides } = data;
    return proposalFromQuote(context.supabase, context.userId, quoteId, overrides);
  });

export const getProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        quoteId: z.string().uuid().optional(),
        dealId: z.string().uuid().optional(),
        proposalId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { buildProposalDraft } = await import("./proposals/proposal-draft.server");
    return buildProposalDraft(context.supabase, data);
  });

export const createContractFromSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        proposalId: z.string().uuid().optional(),
        quoteId: z.string().uuid().optional(),
        mainContractId: z.string().uuid().nullable().optional(),
      })
      .refine((v) => v.proposalId || v.quoteId, "Informe a proposta ou a cotação")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { contractFromSales } = await import("./sales-flow.server");
    return contractFromSales(context.supabase, context.userId, data);
  });

export const listActiveContractsForSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ proposalId: z.string().uuid().optional(), quoteId: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { activeContractsForSales } = await import("./sales-flow.server");
    return activeContractsForSales(context.supabase, data);
  });

export const listAmendmentSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contractId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { amendmentSourcesForContract } = await import("./sales-flow.server");
    return amendmentSourcesForContract(context.supabase, data.contractId);
  });
