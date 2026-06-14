import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";

export type BoardStage = { value: string; label: string; color?: string };

export function EntityBoard<T extends { id: string }>({
  rows,
  table,
  stageField,
  stages,
  renderCard,
  detailPath,
}: {
  rows: T[];
  table: string;
  stageField: string;
  stages: BoardStage[];
  renderCard: (row: T) => React.ReactNode;
  detailPath?: (id: string) => string;
}) {
  const qc = useQueryClient();
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
    <KanbanScrollContainer>
      <div className="flex gap-3 pb-4">
        {stages.map((s) => {
          const stageRows = rows.filter(
            (r) => (r as Record<string, unknown>)[stageField] === s.value,
          );
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
              <div className="flex items-center justify-between px-2 py-1 mb-2">
                <span className="text-sm font-medium">{s.label}</span>
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
                    className={`p-3 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${detailPath ? "hover:bg-accent" : ""}`}
                  >
                    {renderCard(r)}
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
  );
}
