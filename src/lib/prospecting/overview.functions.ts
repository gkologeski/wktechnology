import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProspectingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOverview } = await import("./overview.server");
    return loadOverview(context.supabase, context.userId);
  });

export const getProspectingResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadResults } = await import("./overview.server");
    return loadResults(context.supabase, context.userId);
  });
