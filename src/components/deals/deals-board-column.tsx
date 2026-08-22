import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/crm";
import type { PipelineStage } from "@/lib/pipelines";

export function DealsBoardColumn({
  stage,
  total,
  weighted,
  count,
  hotCount,
  headerExtra,
  children,
}: {
  stage: PipelineStage;
  total: number;
  weighted: number;
  count: number;
  hotCount?: number;
  /** Slot no cabeçalho (ex.: checkbox de seleção da coluna). */
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });
  const ratio = total > 0 ? Math.max(0.04, Math.min(1, weighted / total)) : 0;
  const color = stage.color || "var(--hs-stage-1)";

  return (
    <div
      ref={setNodeRef}
      data-kanban-column-root={stage.value}
      className={`flex flex-col w-[280px] shrink-0 rounded-md bg-[var(--hs-surface)] border border-[var(--hs-divider)] ${
        isOver ? "ring-2 ring-[var(--hs-orange)]" : ""
      }`}
    >
      <div className="px-3 pt-2.5 pb-2 border-b border-[var(--hs-divider)] sticky top-0 bg-[var(--hs-surface)] z-10 rounded-t-md">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {headerExtra}
            <span
              className="inline-block h-2 w-2 rounded-sm shrink-0"
              style={{ background: color }}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground truncate">
              {stage.label}
            </span>
            <span className="text-[11px] text-[var(--hs-text-muted)] tabular-nums">({count})</span>
            {hotCount && hotCount > 0 ? (
              <span
                className="text-[10px] tabular-nums inline-flex items-center gap-0.5"
                style={{ color: "var(--hs-orange)" }}
                title={`${hotCount} negócio(s) com alto score de fechamento`}
              >
                · {hotCount} quente{hotCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          {typeof stage.probability === "number" && (
            <span className="text-[10px] text-[var(--hs-text-muted)] tabular-nums">
              {stage.probability}%
            </span>
          )}
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold tabular-nums">{formatCurrency(total)}</span>
          <span className="text-[10px] text-[var(--hs-text-muted)] tabular-nums">
            pond. {formatCurrency(weighted)}
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${ratio * 100}%`, background: color }}
          />
        </div>
      </div>
      <div className="p-2 space-y-1.5 flex-1 min-h-[200px]">
        {children}
        {count === 0 && (
          <p className="text-xs text-[var(--hs-text-muted)] text-center py-6">Sem negócios</p>
        )}
      </div>
    </div>
  );
}
