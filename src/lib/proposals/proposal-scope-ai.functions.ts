import { assertSalesAnyArea, assertSalesReferences } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ProposalScopeBriefSchema } from "./proposal-scope-forms";

export const generateProposalScope = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.proposals", ["create", "update"])])
  .inputValidator((d) =>
    z
      .object({
        proposalId: z.string().uuid().optional(),
        quoteId: z.string().uuid().optional(),
        dealId: z.string().uuid().optional(),
        brief: ProposalScopeBriefSchema,
        context: z.object({
          title: z.string().max(300).default(""),
          companyName: z.string().max(300).nullable().optional(),
          providerName: z.string().max(300).nullable().optional(),
          totalFormatted: z.string().max(80).nullable().optional(),
          paymentTermsSummary: z.string().max(600).nullable().optional(),
          items: z
            .array(z.object({ name: z.string().max(300), billing: z.string().max(300) }))
            .max(50)
            .optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSalesAnyArea(context.supabase, "techsales.proposals", ["create", "update"]);
    await assertSalesReferences(context.supabase, {
      proposals: data.proposalId,
      quotes: data.quoteId,
      deals: data.dealId,
    });
    const { generateProposalScopeServer } = await import("./proposal-scope-ai.server");
    return generateProposalScopeServer({
      supabase: context.supabase,
      userId: context.userId,
      ...(data.proposalId ? { proposalId: data.proposalId } : {}),
      ...(data.quoteId ? { quoteId: data.quoteId } : {}),
      ...(data.dealId ? { dealId: data.dealId } : {}),
      brief: data.brief,
      context: data.context,
    });
  });
