import type { PipelineStage } from "@/lib/pipelines";

export type DealDashboardAggregates = {
  open_count: number;
  pipeline_value: number;
  forecast_count: number;
  forecast_value: number;
  won_month_count: number;
  won_month_value: number;
  won_period_count: number;
  won_period_value: number;
  lost_period_count: number;
  won_prev_count: number;
  won_prev_value: number;
  lost_prev_count: number;
  stages: Record<string, { count: number; value: number }>;
};

export function parseDealDashboardAggregates(value: unknown): DealDashboardAggregates | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const number = (key: string) => {
    const parsed = Number(raw[key]);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const stages: DealDashboardAggregates["stages"] = {};
  if (raw.stages && typeof raw.stages === "object" && !Array.isArray(raw.stages)) {
    for (const [key, stageValue] of Object.entries(raw.stages as Record<string, unknown>)) {
      if (!stageValue || typeof stageValue !== "object") continue;
      const stage = stageValue as Record<string, unknown>;
      stages[key] = { count: Number(stage.count ?? 0), value: Number(stage.value ?? 0) };
    }
  }
  return {
    open_count: number("open_count"),
    pipeline_value: number("pipeline_value"),
    forecast_count: number("forecast_count"),
    forecast_value: number("forecast_value"),
    won_month_count: number("won_month_count"),
    won_month_value: number("won_month_value"),
    won_period_count: number("won_period_count"),
    won_period_value: number("won_period_value"),
    lost_period_count: number("lost_period_count"),
    won_prev_count: number("won_prev_count"),
    won_prev_value: number("won_prev_value"),
    lost_prev_count: number("lost_prev_count"),
    stages,
  };
}

export function dashboardStageParameters(stages: PipelineStage[]) {
  const values = (type: "open" | "won" | "lost") =>
    stages.filter((stage) => stage.type === type).map((stage) => stage.value);
  return {
    open: values("open"),
    won: values("won"),
    lost: values("lost"),
    probabilities: Object.fromEntries(
      stages.map((stage) => [stage.value, Number(stage.probability ?? 0)]),
    ),
  };
}
