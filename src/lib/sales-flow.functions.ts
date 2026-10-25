import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
import { assertSalesReferences } from "@/lib/access-control/sales-core.server";
import { assertWorkRecord } from "@/lib/access-control/work-core.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Conversões Cotação -> Proposta -> Contrato. Leituras e gravações usam o
// cliente do usuário (RLS aplicada); a lógica fica em sales-flow.server.ts.

export const createProposalFromQuote = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", "create")])
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
    await assertSalesReferences(context.supabase, { quotes: data.quoteId });
    const { proposalFromQuote } = await import("./sales-flow.server");
    const { quoteId, ...overrides } = data;
    return proposalFromQuote(context.supabase, context.userId, quoteId, overrides);
  });

export const getProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", ["create", "update"])])
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
    await assertSalesReferences(context.supabase, {
      quotes: data.quoteId,
      deals: data.dealId,
      proposals: data.proposalId,
    });
    const { buildProposalDraft } = await import("./proposals/proposal-draft.server");
    return buildProposalDraft(context.supabase, data);
  });

export const createContractFromSales = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contracts", "create")])
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
    await assertSalesReferences(context.supabase, {
      quotes: data.quoteId,
      proposals: data.proposalId,
    });
    if (data.mainContractId)
      await assertWorkRecord(
        context.supabase,
        "techcontracts.contracts",
        data.mainContractId,
        "view",
      );
    const { contractFromSales } = await import("./sales-flow.server");
    return contractFromSales(context.supabase, context.userId, data);
  });

export const listActiveContractsForSales = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contracts", "view")])
  .inputValidator((d) =>
    z
      .object({ proposalId: z.string().uuid().optional(), quoteId: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSalesReferences(context.supabase, {
      quotes: data.quoteId,
      proposals: data.proposalId,
    });
    const { activeContractsForSales } = await import("./sales-flow.server");
    return activeContractsForSales(context.supabase, data);
  });

export const listAmendmentSources = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contracts", "view")])
  .inputValidator((d) => z.object({ contractId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertWorkRecord(context.supabase, "techcontracts.contracts", data.contractId, "view");
    const { amendmentSourcesForContract } = await import("./sales-flow.server");
    return amendmentSourcesForContract(context.supabase, data.contractId);
  });
