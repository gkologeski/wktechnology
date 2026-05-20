// Engine para refresh de listas dinâmicas (segments).
// Aplica os filtros JSON contra a tabela alvo (leads/contacts/companies/deals)
// usando supabaseAdmin (escopado por owner_id) e regrava segment_members.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { applyFilters, type FilterGroup, type FilterNode } from "@/lib/filters";

const ENTITY_TABLE: Record<string, "leads" | "contacts" | "companies" | "deals"> = {
  leads: "leads",
  contacts: "contacts",
  companies: "companies",
  deals: "deals",
};

function normalizeFilters(raw: unknown): FilterGroup {
  if (!raw || typeof raw !== "object") return { type: "group", op: "and", conditions: [] };
  const r = raw as Record<string, unknown>;
  if (r.type === "group" || r.type === "condition") return raw as FilterGroup;
  if (Array.isArray(r.conditions)) {
    return {
      type: "group",
      op: (r.op as "and" | "or") ?? "and",
      conditions: (r.conditions as unknown[]).map((c) => {
        const cc = c as Record<string, unknown>;
        if (cc.type) return cc as unknown as FilterNode;
        if (Array.isArray(cc.conditions)) {
          return normalizeFilters(cc);
        }
        return { type: "condition", ...(cc as object) } as FilterNode;
      }),
    };
  }
  return { type: "group", op: "and", conditions: [] };
}

export async function refreshDynamicSegment(segmentId: string): Promise<{
  count: number;
  refreshed_at: string;
}> {
  const { data: seg, error: segErr } = await supabaseAdmin
    .from("segments")
    .select("id, owner_id, entity, kind, filters, enabled")
    .eq("id", segmentId)
    .single();
  if (segErr || !seg) throw new Error(segErr?.message ?? "Lista não encontrada");
  if (seg.kind !== "dynamic") throw new Error("Apenas listas dinâmicas podem ser atualizadas");

  const table = ENTITY_TABLE[seg.entity];
  if (!table) throw new Error(`Entidade inválida: ${seg.entity}`);

  const filters = normalizeFilters(seg.filters);
  let q = supabaseAdmin.from(table).select("id").eq("owner_id", seg.owner_id).limit(50000);
  q = applyFilters(q, filters);
  const { data: rows, error: qErr } = await q;
  if (qErr) throw qErr;
  const ids = (rows ?? []).map((r: { id: string }) => r.id);

  // Replace members
  await supabaseAdmin.from("segment_members").delete().eq("segment_id", segmentId);
  if (ids.length > 0) {
    const chunkSize = 1000;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize).map((eid) => ({
        segment_id: segmentId,
        entity_id: eid,
      }));
      const { error: insErr } = await supabaseAdmin.from("segment_members").insert(chunk);
      if (insErr) throw insErr;
    }
  }

  const refreshed_at = new Date().toISOString();
  await supabaseAdmin
    .from("segments")
    .update({ last_refreshed_at: refreshed_at, member_count: ids.length })
    .eq("id", segmentId);

  return { count: ids.length, refreshed_at };
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
