import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProspectingOverview = createServerFn({ method: "POST" })
  .middleware([
    requireSalesPermission(
      [
        "techsales.prospecting_queue",
        "techsales.prospecting_cadences",
        "techsales.prospecting_search",
        "techsales.marketing.campaigns",
      ],
      "view",
    ),
  ])
  .handler(async ({ context }) => {
    const { loadOverview } = await import("./overview.server");
    return loadOverview(context.supabase, context.userId);
  });

export const getProspectingResults = createServerFn({ method: "POST" })
  .middleware([
    requireSalesPermission(
      [
        "techsales.prospecting_queue",
        "techsales.prospecting_cadences",
        "techsales.prospecting_search",
        "techsales.marketing.campaigns",
      ],
      "view",
    ),
  ])
  .handler(async ({ context }) => {
    const { loadResults } = await import("./overview.server");
    return loadResults(context.supabase, context.userId);
  });
