// Server functions for advanced SLA reports.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const filterSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).partial();

export const getSlaSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => filterSchema.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("tickets")
      .select("id, created_at, resolved_at, sla_first_response_at, sla_first_response_due_at, sla_resolution_due_at, sla_first_response_breached, sla_resolution_breached, assignee_id, pipeline_id")
      .is("deleted_at", null)
      .not("sla_policy_id", "is", null);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q.limit(5000);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const total = list.length;
    const withFr = list.filter((t) => t.sla_first_response_at);
    const frBreached = list.filter((t) => t.sla_first_response_breached).length;
    const resolved = list.filter((t) => t.resolved_at);
    const resBreached = list.filter((t) => t.sla_resolution_breached).length;
    let avgFrMin = 0;
    for (const t of withFr) {
      const d = (new Date(t.sla_first_response_at!).getTime() - new Date(t.created_at).getTime()) / 60000;
      avgFrMin += d;
    }
    avgFrMin = withFr.length ? avgFrMin / withFr.length : 0;
    let avgResMin = 0;
    for (const t of resolved) {
      const d = (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 60000;
      avgResMin += d;
    }
    avgResMin = resolved.length ? avgResMin / resolved.length : 0;
    return {
      total,
      fr_total: withFr.length,
      fr_compliance_pct: total ? Math.round(((total - frBreached) / total) * 1000) / 10 : 0,
      fr_breached: frBreached,
      avg_fr_minutes: Math.round(avgFrMin),
      res_total: resolved.length,
      res_compliance_pct: total ? Math.round(((total - resBreached) / total) * 1000) / 10 : 0,
      res_breached: resBreached,
      avg_res_minutes: Math.round(avgResMin),
    };
  });

export const getSlaOffenders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => filterSchema.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("tickets")
      .select("assignee_id, pipeline_id, sla_first_response_breached, sla_resolution_breached")
      .is("deleted_at", null)
      .not("sla_policy_id", "is", null);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q.limit(5000);
    if (error) throw new Error(error.message);
    const byAgent = new Map<string, { total: number; breached: number }>();
    const byPipe = new Map<string, { total: number; breached: number }>();
    for (const r of rows ?? []) {
      const isBreached = r.sla_first_response_breached || r.sla_resolution_breached;
      const aKey = r.assignee_id ?? "—";
      const pKey = r.pipeline_id ?? "—";
      const a = byAgent.get(aKey) ?? { total: 0, breached: 0 };
      a.total++; if (isBreached) a.breached++; byAgent.set(aKey, a);
      const p = byPipe.get(pKey) ?? { total: 0, breached: 0 };
      p.total++; if (isBreached) p.breached++; byPipe.set(pKey, p);
    }
    const agents = [...byAgent.entries()].map(([k, v]) => ({ key: k, ...v, pct: v.total ? (v.breached / v.total) * 100 : 0 }))
      .sort((a, b) => b.breached - a.breached).slice(0, 10);
    const pipelines = [...byPipe.entries()].map(([k, v]) => ({ key: k, ...v, pct: v.total ? (v.breached / v.total) * 100 : 0 }))
      .sort((a, b) => b.breached - a.breached).slice(0, 10);

    // Resolve labels
    const agentIds = agents.map((a) => a.key).filter((k) => k !== "—");
    const pipeIds = pipelines.map((p) => p.key).filter((k) => k !== "—");
    const [agentsData, pipesData] = await Promise.all([
      agentIds.length ? supabase.from("profiles").select("id, full_name").in("id", agentIds) : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
      pipeIds.length ? supabase.from("pipelines").select("id, name").in("id", pipeIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);
    const aMap = new Map((agentsData.data ?? []).map((a) => [a.id, a.full_name ?? "Sem nome"]));
    const pMap = new Map((pipesData.data ?? []).map((p) => [p.id, p.name]));
    return {
      agents: agents.map((a) => ({ ...a, label: a.key === "—" ? "Sem responsável" : (aMap.get(a.key) ?? a.key.slice(0, 8)) })),
      pipelines: pipelines.map((p) => ({ ...p, label: p.key === "—" ? "Sem fila" : (pMap.get(p.key) ?? p.key.slice(0, 8)) })),
    };
  });
