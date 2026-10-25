// Scheduled billing delegates to an atomic, source-tenant checked database action.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { workRpc } from "@/lib/access-control/work-core.server";
export async function tickServicesBilling(admin: SupabaseClient<Database>, batch = 200) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error } = await admin
    .from("services")
    .select("id,workspace_id")
    .eq("status", "active")
    .eq("type", "recurring")
    .not("next_billing_at", "is", null)
    .lte("next_billing_at", today)
    .order("next_billing_at", { ascending: true })
    .limit(batch);
  if (error) throw error;
  let generated = 0,
    skippedDuplicates = 0,
    skippedOwned = 0,
    updateErrors = 0;
  for (const service of due ?? []) {
    try {
      const result = await workRpc<{
        authorized: boolean;
        generated: boolean;
        duplicate: boolean;
        skippedOwned: boolean;
      }>(admin, "service_bill_checked", { p_service: service.id, p_mode: "tick", p_starts: null });
      if (!result.authorized) {
        console.warn("[services-billing] delegated permission denied", {
          service_id: service.id,
          workspace_id: service.workspace_id,
        });
        continue;
      }
      if (result.generated) generated++;
      if (result.duplicate) skippedDuplicates++;
      if (result.skippedOwned) skippedOwned++;
    } catch (error) {
      updateErrors++;
      console.error("[services-billing] transaction failed", {
        service_id: service.id,
        workspace_id: service.workspace_id,
        error: error instanceof Error ? error.message : "billing error",
      });
    }
  }
  return { generated, scanned: due?.length ?? 0, skippedDuplicates, skippedOwned, updateErrors };
}
