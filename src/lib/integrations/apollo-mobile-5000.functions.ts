import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";

export const previewApolloMobileCampaign = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("techsales.prospecting_enrichment", "manage")])
  .handler(async ({ context }) => {
    const mod = await import("./apollo-mobile-5000.server");
    return mod.mobileCampaignPreview(context);
  });

export const runApolloMobileCampaign = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.prospecting_enrichment", "manage")])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        mode: z.enum(["dispatch", "reconcile"]),
        confirm: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const mod = await import("./apollo-mobile-5000.server");
    return data.mode === "dispatch"
      ? mod.dispatchMobileCampaign(context, data.id)
      : mod.reconcileMobileCampaign(context, data.id);
  });
