// Engine para refresh de listas dinâmicas (segments).
// Aplica os filtros JSON contra a tabela alvo (leads/contacts/companies/deals)
// usando supabaseAdmin (escopado por owner_id) e regrava segment_members.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { workRpc } from "@/lib/access-control/work-core.server";

/** SQL derives the actor/workspace from the saved list and atomically replaces only visible members. */
export async function refreshDynamicSegment(
  segmentId: string,
): Promise<{ count: number; refreshed_at: string }> {
  return workRpc(supabaseAdmin, "sales_segment_refresh", { p_id: segmentId });
}

export async function tickRefreshDynamicSegments(): Promise<{
  processed: number;
  errors: number;
}> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: segs, error } = await supabaseAdmin
    .from("segments")
    .select("id, refresh_interval_minutes, last_refreshed_at")
    .eq("kind", "dynamic")
    .eq("enabled", true)
    .limit(200);
  if (error) throw error;

  let processed = 0;
  let errors = 0;
  const now = Date.now();
  for (const s of segs ?? []) {
    const lastMs = s.last_refreshed_at ? new Date(s.last_refreshed_at).getTime() : 0;
    const dueMs = lastMs + Math.max(5, s.refresh_interval_minutes ?? 60) * 60_000;
    if (now < dueMs && s.last_refreshed_at && s.last_refreshed_at > cutoff) continue;
    try {
      await refreshDynamicSegment(s.id);
      processed++;
    } catch (e) {
      errors++;
      console.error(`[segments-tick] ${s.id}`, e);
    }
  }
  return { processed, errors };
}
