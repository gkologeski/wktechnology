import type { ComponentType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricTone = "neutral" | "positive" | "warning" | "negative" | "ai";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { value: string; direction?: "up" | "down" | "flat" };
  icon?: ComponentType<{ className?: string }>;
  tone?: MetricTone;
  className?: string;
  loading?: boolean;
}

const toneIcon: Record<MetricTone, string> = {
  neutral: "text-text-tertiary",
  positive: "text-status-open",
  warning: "text-status-onhold",
  negative: "text-destructive",
  ai: "text-ai",
};

const toneAccent: Record<MetricTone, string> = {
  neutral: "bg-border-subtle",
  positive: "bg-status-open",
  warning: "bg-status-onhold",
  negative: "bg-destructive",
  ai: "bg-ai",
};

export function MetricCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = "neutral",
  className,
  loading = false,
}: MetricCardProps) {
  const deltaColor =
    delta?.direction === "down"
      ? "text-destructive"
      : delta?.direction === "up"
        ? "text-status-open"
        : "text-text-tertiary";
  const DeltaIcon =
    delta?.direction === "down" ? ArrowDownRight : delta?.direction === "up" ? ArrowUpRight : null;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border-subtle bg-surface-2",
        "px-4 py-4 shadow-xs transition-colors hover:border-border-default",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-0.5 opacity-60", toneAccent[tone])}
      />
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </span>
        {Icon ? <Icon className={cn("h-4 w-4 shrink-0", toneIcon[tone])} /> : null}
      </div>
      <div className="mt-2 flex min-w-0 items-baseline gap-2">
        {loading ? (
          <div className="h-7 w-20 animate-pulse rounded bg-surface-sunken" />
        ) : (
          <span className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-text-primary tabular-nums">
            {value}
          </span>
        )}
        {delta ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium",
              deltaColor,
            )}
          >
            {DeltaIcon ? <DeltaIcon className="h-3 w-3" /> : null}
            {delta.value}
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-1 truncate text-xs text-text-secondary">{hint}</div> : null}
    </div>
  );
}
