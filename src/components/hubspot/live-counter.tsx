import { Building2, Users, Target, UserPlus, Activity, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { cn } from "@/lib/utils";

type Status = "pending" | "running" | "done" | "failed";

const ICONS = {
  companies: Building2,
  contacts: Users,
  deals: Target,
  leads: UserPlus,
  activities: Activity,
} as const;

const LABELS: Record<keyof typeof ICONS, string> = {
  companies: "Empresas",
  contacts: "Contatos",
  deals: "Negócios",
  leads: "Leads",
  activities: "Atividades",
};

export type CounterStep = keyof typeof ICONS;

export type LiveCounterProps = {
  step: CounterStep;
  status: Status;
  succeeded: number;
  failed: number;
  target?: number; // known denominator (e.g. maxCompanies)
  discovered?: number; // optional discovered total during cascade
};

export function LiveCounter({ step, status, succeeded, failed, target, discovered }: LiveCounterProps) {
  const Icon = ICONS[step];
  const animated = useAnimatedNumber(succeeded);
  const denom = target ?? discovered ?? 0;
  const pct = denom > 0 ? Math.min(100, Math.round((succeeded / denom) * 100)) : status === "done" ? 100 : 0;

  const ring =
    status === "done"
      ? "border-emerald-500/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.0)]"
      : status === "failed"
        ? "border-destructive/60"
        : status === "running"
          ? "border-primary/60 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.6)]"
          : "border-border";

  const StatusIcon =
    status === "running" ? Loader2 : status === "done" ? CheckCircle2 : status === "failed" ? XCircle : Clock;
  const statusColor =
    status === "running"
      ? "text-primary"
      : status === "done"
        ? "text-emerald-500"
        : status === "failed"
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 transition-all",
        ring,
        status === "pending" && "opacity-60",
      )}
    >
      {/* animated gradient bar */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-muted/40">
        <div
          className={cn(
            "h-full transition-[width] duration-700 ease-out",
            status === "failed" ? "bg-destructive" : status === "done" ? "bg-emerald-500" : "bg-primary",
            status === "running" && "animate-pulse",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg bg-muted",
              status === "running" && "bg-primary/10 text-primary",
              status === "done" && "bg-emerald-500/10 text-emerald-600",
              status === "failed" && "bg-destructive/10 text-destructive",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium">{LABELS[step]}</span>
        </div>
        <StatusIcon className={cn("h-4 w-4", statusColor, status === "running" && "animate-spin")} />
      </div>

      <div className="mt-3 flex items-baseline gap-1.5 font-mono tabular-nums">
        <span
          className={cn(
            "text-3xl font-semibold tracking-tight transition-colors",
            status === "running" ? "text-foreground" : status === "done" ? "text-emerald-600" : "text-foreground",
          )}
        >
          {animated.toLocaleString("pt-BR")}
        </span>
        {denom > 0 && (
          <span className="text-sm text-muted-foreground">/ {denom.toLocaleString("pt-BR")}</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {status === "pending" && "aguardando…"}
          {status === "running" && (denom > 0 ? `${pct}% concluído` : "importando…")}
          {status === "done" && "concluído"}
          {status === "failed" && "falhou"}
        </span>
        {failed > 0 && (
          <span className="text-destructive">
            {failed.toLocaleString("pt-BR")} falha{failed === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

export function LiveCountersGrid({
  steps,
}: {
  steps: LiveCounterProps[];
}) {
  if (!steps.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {steps.map((s) => (
        <LiveCounter key={s.step} {...s} />
      ))}
    </div>
  );
}
