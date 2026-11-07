import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { pendingEventsVisibleToCaller } from "./pending-events.server";
/** Manual processing is limited to events visible to the caller and workflows that they may manage. Scheduled processing keeps the service entry point. */
export async function tickForWorkflowCaller(
  caller: SupabaseClient,
  userId: string,
  limit = 50,
  eventIds?: string[],
  workflowIds?: string[],
) {
  const workspaceId = await getActiveWorkspaceId(caller, userId);
  const { data: rows, error } = await caller
    .from("workflows")
    .select("id")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  const candidates = (rows ?? [])
    .map((r) => r.id)
    .filter((id) => !workflowIds || workflowIds.includes(id));
  const allowed: string[] = [];
  for (let i = 0; i < candidates.length; i += 500) {
    const caps = await workRpc<Array<{ id: string; can_manage: boolean }>>(
      caller,
      "sales_capabilities",
      { t: "workflows", ids: candidates.slice(i, i + 500) },
    );
    allowed.push(...caps.filter((c) => c.can_manage).map((c) => c.id));
  }
  if (!allowed.length) return { processed: 0, results: [] };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const visibleIds = await pendingEventsVisibleToCaller(caller, supabaseAdmin, {
    workspaceId,
    limit,
    eventIds,
  });
  if (!visibleIds.length) return { processed: 0, results: [] };
  const { tickWorkflows } = await import("./engine-runtime.server");
  return tickWorkflows(supabaseAdmin, limit, {
    workspaceId,
    eventIds: visibleIds,
    workflowIds: allowed,
  });
}
