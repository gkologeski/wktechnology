import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAGE_ORDER = ["new", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const STAGE_LABEL: Record<string, string> = {
  new: "Novo",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

const RangeInput = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  pipelineId: z.string().uuid().nullable().optional(),
});

type DealRow = {
  id: string;
  value: number | null;
  stage: string;
  created_at: string;
  updated_at: string;
  pipeline_id: string | null;
};

async function fetchDeals(supabase: any, input: z.infer<typeof RangeInput>): Promise<DealRow[]> {
  let q = supabase
    .from("deals")
    .select("id,value,stage,created_at,updated_at,pipeline_id")
    .limit(10000);
  if (input.dateFrom) q = q.gte("created_at", input.dateFrom);
  if (input.dateTo) q = q.lte("created_at", input.dateTo);
  if (input.pipelineId) q = q.eq("pipeline_id", input.pipelineId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as DealRow[];
}

// ---------- FUNNEL ----------
export const getFunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RangeInput.parse(d))
  .handler(async ({ data, context }) => {
    const deals = await fetchDeals(context.supabase, data);
    const total = deals.length;
    const byStage = new Map<string, { count: number; value: number }>();
    for (const s of STAGE_ORDER) byStage.set(s, { count: 0, value: 0 });
    for (const d of deals) {
      const b = byStage.get(d.stage) ?? { count: 0, value: 0 };
      b.count += 1;
      b.value += Number(d.value ?? 0);
      byStage.set(d.stage, b);
    }
    // Cumulative — leads at "qualified" stage means they passed "new"
    const stages = STAGE_ORDER.filter((s) => s !== "lost").map((s) => ({
      stage: s,
      label: STAGE_LABEL[s],
      ...byStage.get(s)!,
    }));
    let cum = 0;
    for (let i = stages.length - 1; i >= 0; i--) {
      cum += stages[i].count;
      stages[i] = { ...stages[i], cumulative: cum } as any;
    }
    // Conversion stage-to-stage
    const enriched = stages.map((s, i) => {
      const cumulative = (s as any).cumulative as number;
      const prev = i === 0 ? null : ((stages[i - 1] as any).cumulative as number);
      const conv = prev ? (cumulative / prev) * 100 : 100;
      return { ...s, cumulative, conversion_pct: conv };
    });
    return {
      total,
      lost: byStage.get("lost")!,
      stages: enriched,
      overall_conversion: total ? (byStage.get("won")!.count / total) * 100 : 0,
    };
  });

// ---------- SALES VELOCITY ----------
export const getSalesVelocity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RangeInput.parse(d))
  .handler(async ({ data, context }) => {
    const deals = await fetchDeals(context.supabase, data);
    const closed = deals.filter((d) => d.stage === "won" || d.stage === "lost");
    const won = deals.filter((d) => d.stage === "won");
    const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const winRate = closed.length ? won.length / closed.length : 0;
    const avgWonValue = won.length
      ? won.reduce((s, d) => s + Number(d.value ?? 0), 0) / won.length
      : 0;

    // Avg sales cycle in days for won deals (updated_at - created_at as fallback)
    const cycles = won.map((d) => {
      const c = new Date(d.created_at).getTime();
      const u = new Date(d.updated_at).getTime();
      return Math.max(0, (u - c) / 86400000);
    });
    const avgCycleDays = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : 0;

    const opportunities = open.length + won.length;
    const velocity = avgCycleDays > 0 ? (opportunities * avgWonValue * winRate) / avgCycleDays : 0;

    return {
      opportunities,
      won_count: won.length,
      lost_count: closed.length - won.length,
      open_count: open.length,
      win_rate_pct: winRate * 100,
      avg_won_value: avgWonValue,
      avg_cycle_days: avgCycleDays,
      velocity_per_day: velocity,
      pipeline_value: open.reduce((s, d) => s + Number(d.value ?? 0), 0),
      won_value: won.reduce((s, d) => s + Number(d.value ?? 0), 0),
    };
  });

// ---------- COHORT ----------
// Created month -> conversion at 30/60/90 days (and total won so far)
export const getCohort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RangeInput.parse(d))
  .handler(async ({ data, context }) => {
    const deals = await fetchDeals(context.supabase, data);
    const cohorts = new Map<
      string,
      {
        month: string;
        created: number;
        won: number;
        w30: number;
        w60: number;
        w90: number;
        revenue: number;
      }
    >();
    for (const d of deals) {
      const created = new Date(d.created_at);
      const month = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, "0")}`;
      const c = cohorts.get(month) ?? {
        month,
        created: 0,
        won: 0,
        w30: 0,
        w60: 0,
        w90: 0,
        revenue: 0,
      };
      c.created += 1;
      if (d.stage === "won") {
        c.won += 1;
        c.revenue += Number(d.value ?? 0);
        const ageDays = (new Date(d.updated_at).getTime() - created.getTime()) / 86400000;
        if (ageDays <= 30) c.w30 += 1;
        if (ageDays <= 60) c.w60 += 1;
        if (ageDays <= 90) c.w90 += 1;
      }
      cohorts.set(month, c);
    }
    const rows = Array.from(cohorts.values()).sort((a, b) => a.month.localeCompare(b.month));
    return { rows };
  });

export const listPipelinesForFunnel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pipelines")
      .select("id,name,entity")
      .in("entity", ["deal", "deals"])
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; name: string; entity: string }>;
  });
