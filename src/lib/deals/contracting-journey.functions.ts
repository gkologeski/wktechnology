import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { requireWorkPermission } from "@/lib/access-control/work-permission.middleware";
export const getDealContractingJourney = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.deals", "view")])
  .inputValidator(z.object({ dealId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { loadDealContractingJourney } = await import("./contracting-journey.server");
    return loadDealContractingJourney(context.supabase, context.userId, data.dealId);
  });
export const prepareDealContractDraft = createServerFn({ method: "POST" })
  .middleware([requireWorkPermission("techcontracts.contract_drafts", "create")])
  .inputValidator(z.object({ proposalId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    return workRpc<{ draft_id: string; created: boolean }>(
      context.supabase,
      "deal_contract_draft_prepare",
      { p_proposal: data.proposalId },
    );
  });
