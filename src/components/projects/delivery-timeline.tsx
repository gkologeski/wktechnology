// Timeline macro de entrega (somente apresentação).
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, CircleDot } from "lucide-react";
import type { ProjectUpdateRow } from "@/lib/projects/delivery.functions";
import {
  HEALTH_VARIANT,
  KIND_LABELS,
  VISIBILITY_LABELS,
  formatDeliveryDate,
  healthLabel,
  type DeliveryHealth,
  type DeliveryUpdateKind,
  type DeliveryVisibility,
} from "@/lib/projects/delivery-labels";

export function DeliveryTimeline({
  updates,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
}: {
  updates: ProjectUpdateRow[];
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: (update: ProjectUpdateRow) => void;
  onDelete?: (update: ProjectUpdateRow) => void;
}) {
  if (updates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-sm font-medium">Nenhum acompanhamento publicado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Assim que a equipe de projetos registrar a evolução, os checkpoints aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {updates.map((u) => (
        <li key={u.id} className="relative">
          <CircleDot
            className="absolute -left-[27px] top-1 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium break-words">{u.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(u.published_at).toLocaleString("pt-BR")} ·{" "}
                {KIND_LABELS[u.kind as DeliveryUpdateKind] ?? u.kind}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {u.health && (
                <Badge variant={HEALTH_VARIANT[u.health as DeliveryHealth] ?? "outline"}>
                  {healthLabel(u.health)}
                </Badge>
              )}
              {u.visibility === "internal" && (
                <Badge variant="outline">
                  {VISIBILITY_LABELS[u.visibility as DeliveryVisibility]}
                </Badge>
              )}
              {canEdit && onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`Editar acompanhamento ${u.title}`}
                  onClick={() => onEdit(u)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {canDelete && onDelete && u.kind === "checkpoint" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Excluir acompanhamento ${u.title}`}
                  onClick={() => onDelete(u)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          {u.summary && (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {u.summary}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground tabular-nums">
            {typeof u.progress_pct === "number" && <span>Evolução: {u.progress_pct}%</span>}
            <span>Previsão: {formatDeliveryDate(u.expected_delivery_date)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
