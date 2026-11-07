import type { SupabaseClient } from "@supabase/supabase-js";

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
