import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

export type BoardStage = { value: string; label: string; color?: string };

export function EntityBoard<T extends { id: string }>({
  rows, table, stageField, stages, renderCard, detailPath,
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
    const { error } = await (supabase as any).from(table).update({ [stageField]: newStage }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: [table] });
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map((s) => {
        const stageRows = rows.filter((r) => (r as Record<string, unknown>)[stageField] === s.value);
        return (
          <div key={s.value}
               className="min-w-[260px] w-[260px] flex-shrink-0 rounded-lg border bg-muted/30 p-2"
               onDragOver={(e) => e.preventDefault()}
               onDrop={(e) => { e.preventDefault(); if (draggingId) moveTo(draggingId, s.value); setDraggingId(null); }}>
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-xs text-muted-foreground">{stageRows.length}</span>
            </div>
            <div className="space-y-2">
              {stageRows.map((r) => (
                <Card key={r.id}
                      draggable
                      onDragStart={() => setDraggingId(r.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => detailPath && (window.location.href = detailPath(r.id))}
                      className={`p-3 cursor-grab active:cursor-grabbing ${detailPath ? "hover:bg-accent" : ""}`}>
                  {renderCard(r)}
                </Card>
              ))}
              {stageRows.length === 0 && <p className="text-xs text-muted-foreground px-2 py-4 text-center">Vazio</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
