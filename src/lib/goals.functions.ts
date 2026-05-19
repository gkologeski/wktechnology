// Server functions para Goals (metas por usuário/time/workspace).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const GOAL_METRICS = [
  "deals_won_count",
  "deals_won_value",
  "deals_created",
  "activities_count",
  "calls_count",
  "emails_sent",
  "tasks_completed",
] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  deals_won_count: "Negócios ganhos (qtd)",
  deals_won_value: "Receita ganha (R$)",
  deals_created: "Negócios criados (qtd)",
  activities_count: "Atividades registradas",
  calls_count: "Ligações",
  emails_sent: "Emails enviados",
  tasks_completed: "Tarefas concluídas",
};

export const GOAL_PERIODS = ["month", "quarter", "year", "custom"] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];
export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  month: "Mês",
  quarter: "Trimestre",
  year: "Ano",
  custom: "Personalizado",
};

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  metric: z.enum(GOAL_METRICS),
  period: z.enum(GOAL_PERIODS),
  period_start: z.string(),
  period_end: z.string(),
  target_value: z.number().min(0),
  target_user_id: z.string().uuid().nullable().optional(),
  pipeline_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .order("period_start", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      ...data,
      owner_id: userId,
      target_user_id: data.target_user_id || null,
      pipeline_id: data.pipeline_id || null,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabase.from("goals").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("goals")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Calcula o progresso atual de cada meta consultando os dados do workspace.
 * Observação: como leads/deals/activities não têm campo de "atribuído a",
 * progresso é agregado no nível do workspace (mesmo quando target_user_id está setado),
 * servindo como referência de meta individual/equipe baseada na operação total.
 */
export const computeGoalsProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: goals, error } = await supabase
      .from("goals")
      .select("*")
      .order("period_start", { ascending: false });
    if (error) throw new Error(error.message);

    const results: Array<{ goal_id: string; current: number }> = [];
    for (const g of goals ?? []) {
      const start = `${g.period_start}T00:00:00.000Z`;
      const endDate = new Date(g.period_end as string);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const end = endDate.toISOString();
      let current = 0;

      try {
        switch (g.metric as GoalMetric) {
          case "deals_won_count": {
            let q = supabase
              .from("deals")
              .select("id", { count: "exact", head: true })
              .eq("stage", "won")
              .gte("updated_at", start)
              .lt("updated_at", end);
            if (g.pipeline_id) q = q.eq("pipeline_id", g.pipeline_id);
            const { count } = await q;
            current = count ?? 0;
            break;
          }
          case "deals_won_value": {
            let q = supabase
              .from("deals")
              .select("value")
              .eq("stage", "won")
              .gte("updated_at", start)
              .lt("updated_at", end);
            if (g.pipeline_id) q = q.eq("pipeline_id", g.pipeline_id);
            const { data } = await q;
            current = (data ?? []).reduce((s, r: any) => s + Number(r.value ?? 0), 0);
            break;
          }
          case "deals_created": {
            let q = supabase
              .from("deals")
              .select("id", { count: "exact", head: true })
              .gte("created_at", start)
              .lt("created_at", end);
            if (g.pipeline_id) q = q.eq("pipeline_id", g.pipeline_id);
            const { count } = await q;
            current = count ?? 0;
            break;
          }
          case "activities_count": {
            const { count } = await supabase
              .from("activities")
              .select("id", { count: "exact", head: true })
              .gte("created_at", start)
              .lt("created_at", end);
            current = count ?? 0;
            break;
          }
          case "calls_count": {
            const { count } = await supabase
              .from("activities")
              .select("id", { count: "exact", head: true })
              .eq("type", "call")
              .gte("created_at", start)
              .lt("created_at", end);
            current = count ?? 0;
            break;
          }
          case "emails_sent": {
            const { count } = await supabase
              .from("activities")
              .select("id", { count: "exact", head: true })
              .eq("type", "email")
              .gte("created_at", start)
              .lt("created_at", end);
            current = count ?? 0;
            break;
          }
          case "tasks_completed": {
            const { count } = await supabase
              .from("activities")
              .select("id", { count: "exact", head: true })
              .eq("type", "task")
              .eq("completed", true)
              .gte("updated_at", start)
              .lt("updated_at", end);
            current = count ?? 0;
            break;
          }
        }
      } catch {
        current = 0;
      }
      results.push({ goal_id: g.id as string, current });
    }
    return results;
  });
