// Indicador visual compartilhado por cards de kanban (borda esquerda + chip de ícones + tooltip).
// Usado por deals, tickets e candidatos para manter linguagem visual consistente.

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame, Gem } from "lucide-react";
import type { CSSProperties } from "react";
import type { KanbanSignals } from "@/lib/kanban/signals";

/** Estilo de borda esquerda a aplicar no card. Aplica no atributo `style` do container. */
export function kanbanBorderStyle(signals?: KanbanSignals | null): CSSProperties {
  if (!signals) return {};
  const { isHot, isHighValue } = signals;
  if (isHot && isHighValue) {
    return {
      borderLeft: "2px solid transparent",
      borderImage: "linear-gradient(180deg, var(--hs-orange), var(--hs-stage-4)) 1",
    };
  }
  if (isHot) {
    return { borderLeftWidth: "2px", borderLeftColor: "var(--hs-orange)" };
  }
  if (isHighValue) {
    return { borderLeftWidth: "2px", borderLeftColor: "var(--hs-stage-4)" };
  }
  return {};
}

/** Ícones (flame/gem) + tooltip com `signals.reason`. */
export function KanbanSignalIcons({ signals }: { signals?: KanbanSignals | null }) {
  if (!signals) return null;
  const { isHot, isHighValue, reason } = signals;
  if (!isHot && !isHighValue) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="flex items-center gap-0.5"
            aria-label={isHot ? "Item quente" : "Alta prioridade"}
          >
            {isHot && (
              <Flame className="h-3.5 w-3.5" style={{ color: "var(--hs-orange)" }} aria-hidden />
            )}
            {isHighValue && (
              <Gem className="h-3.5 w-3.5" style={{ color: "var(--hs-stage-4)" }} aria-hidden />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {reason ?? (isHot ? "Requer atenção" : "Alta prioridade")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
