import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
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

/**
 * Pendentes visíveis ao usuário, em duas etapas: (1) ids pendentes do
 * workspace pelo índice parcial (cliente de serviço, já após os gates de
 * workspace/can_manage); (2) releitura desses ids com o cliente do usuário,
 * para a RLS decidir só sobre essas linhas (pela chave primária).
 * Por quê: as funções da RLS não são leakproof e, numa consulta única, eram
 * avaliadas em centenas de milhares de eventos antes do filtro de pendentes.
 */
export async function pendingEventsVisibleToCaller(
  caller: SupabaseClient,
  service: SupabaseClient,
  opts: { workspaceId: string; limit: number; eventIds?: string[]; now?: string },
): Promise<string[]> {
  let pending = service
    .from("workflow_events")
    .select("id")
    .eq("workspace_id", opts.workspaceId)
    .is("processed_at", null)
    .lte("run_at", opts.now ?? new Date().toISOString())
    .order("created_at")
    .limit(opts.limit);
  if (opts.eventIds) pending = pending.in("id", opts.eventIds);
  const { data: pendingRows, error: pendingErr } = await pending;
  if (pendingErr) throw new Error(pendingErr.message);
  const ids = (pendingRows ?? []).map((r: { id: string }) => r.id);
  if (!ids.length) return [];
  const { data: visible, error: visErr } = await caller
    .from("workflow_events")
    .select("id")
    .eq("workspace_id", opts.workspaceId)
    .in("id", ids);
  if (visErr) throw new Error(visErr.message);
  const allowed = new Set((visible ?? []).map((r: { id: string }) => r.id));
  return ids.filter((id) => allowed.has(id));
}
