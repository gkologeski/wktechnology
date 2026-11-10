import { AlertCircle, ArrowRight, Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CONTRACT_STAGES,
  type NextStep,
  type NextStepAction,
} from "@/lib/contracts/contract-next-step";

export function ContractStageStepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Etapas do contrato">
      {CONTRACT_STAGES.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={now ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                now && "border-primary bg-primary/10 text-primary",
                done && "border-border bg-muted text-foreground",
                !now && !done && "border-border text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Circle className="h-3 w-3" aria-hidden />
              )}
              {label}
              {done && <span className="sr-only"> — concluída</span>}
            </span>
            {i < CONTRACT_STAGES.length - 1 && (
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ContractNextStepCard({
  step,
  onAction,
}: {
  step: NextStep;
  onAction: (a: NextStepAction) => void;
}) {
  const btn = (a: NextStepAction, primary: boolean) => (
    <Button
      key={a.label}
      size="sm"
      variant={primary ? "default" : "outline"}
      disabled={!!a.disabledReason}
      title={a.disabledReason}
      onClick={() => onAction(a)}
    >
      {a.label}
    </Button>
  );
  return (
    <section
      aria-labelledby="contract-next-step"
      className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Próximo passo</p>
          <h2 id="contract-next-step" className="text-lg font-semibold text-foreground mt-1">
            {step.headline}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{step.explanation}</p>
          {step.primary?.disabledReason && (
            <p className="text-xs text-muted-foreground mt-1" role="note">
              {step.primary.disabledReason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {step.secondary.map((a) => btn(a, false))}
          {step.primary && btn(step.primary, true)}
        </div>
      </div>
      {step.checklist.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-3 text-sm">
          {step.checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              {c.done ? (
                <Check className="h-4 w-4 text-primary" aria-hidden />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
              )}
              <span className={c.done ? "text-foreground" : "text-destructive"}>
                {c.label}
                <span className="sr-only">{c.done ? " — concluído" : " — pendente"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
