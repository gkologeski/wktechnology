import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";
import { BoardCardCheckbox } from "@/components/kanban/board-card-checkbox";
import { useBoardSelection } from "@/components/kanban/use-board-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import type { BulkField } from "@/components/bulk-edit-dialog";

export type BoardStage = { value: string; label: string; color?: string };

export function EntityBoard<T extends { id: string }>({
  rows,
  table,
  stageField,
  stages,
  renderCard,
  detailPath,
  selectable = false,
  entityLabel = "registro",
  assignColumn = "assigned_to",
  activityEntity,
  canUpdate = true,
  canDelete = false,
  bulkEditFields,
}: {
  rows: T[];
  table: string;
  stageField: string;
  stages: BoardStage[];
  renderCard: (row: T) => React.ReactNode;
  detailPath?: (id: string) => string;
  /** Habilita seleção de cards + ações em massa (mesma barra dos grids). */
  selectable?: boolean;
  entityLabel?: string;
  assignColumn?: string | null;
  activityEntity?: "leads" | "contacts" | "deals" | "companies";
  canUpdate?: boolean;
  canDelete?: boolean;
  /** Campos fixos de edição em massa (tabelas fora do catálogo dinâmico). */
  bulkEditFields?: BulkField[];
}) {
  const qc = useQueryClient();
  const selection = useBoardSelection(rows);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const moveTo = async (id: string, newStage: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(table)
      .update({ [stageField]: newStage })
      .eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: [table] });
  };

  return (
    <>
      <KanbanScrollContainer>
        <div className="flex gap-3 pb-4">
          {stages.map((s) => {
            const stageRows = rows.filter(
              (r) => (r as Record<string, unknown>)[stageField] === s.value,
            );
            const columnIds = stageRows.map((r) => r.id);
            const allColumnSelected =
              columnIds.length > 0 && columnIds.every((id) => selection.isSelected(id));
            return (
              <div
                key={s.value}
                data-kanban-column-root={s.value}
                className="min-w-[260px] w-[260px] flex-shrink-0 rounded-lg border bg-muted/30 p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggingId) moveTo(draggingId, s.value);
                  setDraggingId(null);
                }}
              >
                <div className="flex items-center justify-between gap-2 px-2 py-1 mb-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    {selectable && columnIds.length > 0 && (
                      <Checkbox
                        checked={allColumnSelected}
                        aria-label={`Selecionar coluna ${s.label}`}
                        onCheckedChange={() => selection.toggleMany(columnIds)}
                      />
                    )}
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{stageRows.length}</span>
                </div>
                <div className="space-y-2">
                  {stageRows.map((r) => (
                    <Card
                      key={r.id}
                      draggable
                      tabIndex={0}
                      data-kanban-card
                      data-kanban-column={s.value}
                      onDragStart={() => setDraggingId(r.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => detailPath && (window.location.href = detailPath(r.id))}
                      onKeyDown={(e) => {
                        if (detailPath && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          window.location.href = detailPath(r.id);
                        }
                      }}
                      className={`group p-3 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${detailPath ? "hover:bg-accent" : ""} ${
                        selection.isSelected(r.id) ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      {selectable ? (
                        <div className="flex items-start gap-2">
                          <BoardCardCheckbox
                            selected={selection.isSelected(r.id)}
                            label={`Selecionar ${entityLabel}`}
                            onToggle={(shift) => selection.toggle(r.id, { columnIds, shift })}
                          />
                          <div className="min-w-0 flex-1">{renderCard(r)}</div>
                        </div>
                      ) : (
                        renderCard(r)
                      )}
                    </Card>
                  ))}
                  {stageRows.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-4 text-center">Vazio</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </KanbanScrollContainer>

      {selectable && selection.hasSelection && (
        <GridBulkBar
          table={table}
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel={entityLabel}
          assignColumn={assignColumn}
          activityEntity={activityEntity}
          canUpdate={canUpdate}
          canDelete={canDelete}
          bulkEditFields={bulkEditFields}
          onClear={selection.clear}
          onDone={() => void qc.invalidateQueries({ queryKey: [table] })}
        />
      )}
    </>
  );
}
