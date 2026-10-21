// Peças comuns das visões do painel (apresentação pura).
import type { ComponentType, ReactNode } from "react";
import type { MetricTone } from "@/components/techhire/ui";
import { metricDef, type DashDataset, type MetricDef } from "@/lib/projects/dashboard-views.shared";
import type { DashCountMap } from "@/lib/projects/dashboard-views.types";
import { formatHours } from "@/lib/projects/reconciliation-labels";
import { DashMetric } from "./dash-metric";

export type DrillFn = (dataset: DashDataset, metric: string) => void;

export type ViewCtx = {
  periodLabel: string;
  generatedAt: string;
  onDrill: DrillFn;
};

export const num = (m: DashCountMap | undefined, k: string) => Number(m?.[k]?.n ?? 0);
export const secs = (m: DashCountMap | undefined, k: string) => Number(m?.[k]?.secs ?? 0);
export const int = (v: number) => v.toLocaleString("pt-BR");

/** Variação contra o período anterior (mesma duração). Sem base anterior → sem variação. */
export function deltaOf(cur: number, prev: number | undefined) {
  if (prev === undefined) return undefined;
  if (prev === 0) return cur === 0 ? { value: "igual", direction: "flat" as const } : undefined;
  const pct = ((cur - prev) / prev) * 100;
  return {
    value: `${pct >= 0 ? "+" : ""}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% vs anterior`,
    direction: pct > 0.5 ? ("up" as const) : pct < -0.5 ? ("down" as const) : ("flat" as const),
  };
}

export function Metric({
  ctx,
  dataset,
  metric,
  value,
  hint,
  icon,
  tone,
  delta,
  current,
  missing,
  noDrill,
  def,
}: {
  ctx: ViewCtx;
  def?: MetricDef;
  dataset: DashDataset;
  metric: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: MetricTone;
  delta?: { value: string; direction?: "up" | "down" | "flat" };
  /** Indicador de situação atual (não depende do período). */
  current?: boolean;
  missing?: string;
  noDrill?: boolean;
}) {
  return (
    <DashMetric
      def={def ?? metricDef(dataset, metric)}
      value={value}
      hint={hint}
      icon={icon}
      tone={tone}
      delta={delta}
      periodLabel={current ? "Situação atual (não depende do período)" : ctx.periodLabel}
      generatedAt={ctx.generatedAt}
      missing={missing}
      onOpen={noDrill ? undefined : () => ctx.onDrill(dataset, metric)}
    />
  );
}

export function HoursMetric(props: {
  ctx: ViewCtx;
  map: DashCountMap | undefined;
  prev?: DashCountMap;
  metric: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: MetricTone;
  missing?: string;
}) {
  const s = secs(props.map, props.metric);
  const n = num(props.map, props.metric);
  return (
    <Metric
      ctx={props.ctx}
      dataset="entries"
      metric={props.metric}
      value={formatHours(s)}
      hint={`${int(n)} apontamentos`}
      icon={props.icon}
      tone={props.tone}
      missing={props.missing}
      delta={
        props.prev
          ? deltaOf(s, props.prev[props.metric] ? secs(props.prev, props.metric) : 0)
          : undefined
      }
    />
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
      {children}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-xs text-text-secondary">
      {children}
    </p>
  );
}
