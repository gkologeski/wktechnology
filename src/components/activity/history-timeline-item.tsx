// Card de histórico na timeline: agrupa alterações de propriedade de um mesmo
// evento e destaca movimentações (etapa, pipeline, substatus, responsável).
import { useState } from "react";
import { ArrowRight, ChevronDown, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/crm";
import { MOVEMENT_PROPERTIES, labelProperty, labelValue } from "@/lib/timeline/property-labels";
import type { HistoryGroup, PropertyChangeRow } from "@/lib/timeline/history-groups";

const COLLAPSED_COUNT = 3;

export function HistoryTimelineItem({
  group,
  resolveValue,
  resolveActor,
}: {
  group: HistoryGroup;
  resolveValue: (property: string, value: unknown) => string | null;
  resolveActor: (id: string | null) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const actor = resolveActor(group.changed_by);
  const total = group.changes.length;
  const visible = expanded ? group.changes : group.changes.slice(0, COLLAPSED_COUNT);
  const hidden = total - visible.length;

  const display = (c: PropertyChangeRow, which: "old" | "new") => {
    const raw = which === "old" ? c.old_value : c.new_value;
    return resolveValue(c.property, raw) ?? labelValue(raw);
  };

  const headline =
    total === 1
      ? `${actor} alterou ${labelProperty(group.changes[0].property)}`
      : `${actor} atualizou ${total} propriedades`;

  return (
    <li className="relative pl-10">
      <div className="absolute left-[11px] top-8 bottom-[-1.25rem] w-[2px] bg-border/60 last:hidden" />
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-muted border-4 border-background flex items-center justify-center text-muted-foreground z-10">
        <History className="h-3.5 w-3.5" />
      </div>
      <div className="bg-card/60 rounded-2xl px-5 py-4 border border-border/60">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h4 className="text-sm font-medium text-foreground">{headline}</h4>
            {group.hasMovement && (
              <Badge variant="secondary" className="text-[10px]">
                Movimentação
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(group.changed_at)}
          </span>
        </div>

        <ul className="mt-2 space-y-1">
          {visible.map((c) => (
            <li
              key={c.id}
              className={`text-xs flex items-center gap-1.5 flex-wrap ${
                MOVEMENT_PROPERTIES.has(c.property) ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="font-medium">{labelProperty(c.property)}:</span>
              <span className="line-through text-muted-foreground">{display(c, "old")}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-foreground font-medium">{display(c, "new")}</span>
            </li>
          ))}
        </ul>

        {hidden > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2 text-xs"
            onClick={() => setExpanded(true)}
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            Ver mais {hidden} {hidden === 1 ? "alteração" : "alterações"}
          </Button>
        )}
        {expanded && total > COLLAPSED_COUNT && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2 text-xs"
            onClick={() => setExpanded(false)}
          >
            Mostrar menos
          </Button>
        )}
      </div>
    </li>
  );
}
