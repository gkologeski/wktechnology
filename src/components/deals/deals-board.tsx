import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Deal } from "@/lib/db-types";
import type { Pipeline } from "@/lib/pipelines";
import { DealsBoardColumn } from "./deals-board-column";
import { DealsBoardCard } from "./deals-board-card";

export type DealLookups = {
  companies: Map<string, string>;
  contacts: Map<string, string>;
  owners: Map<string, string>;
};

export function DealsBoard({
  pipeline,
  deals,
  lookups,
  onOpen,
}: {
  pipeline: Pipeline;
  deals: Deal[];
  lookups: DealLookups;
  onOpen: (d: Deal) => void;
}) {
  const qc = useQueryClient();

  const grouped = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const s of pipeline.stages) map[s.value] = [];
    for (const d of deals) {
      const key = d.stage_id || (d.stage as string);
      if (map[key]) map[key].push(d);
      else if (map[pipeline.stages[0]?.value]) map[pipeline.stages[0].value].push(d);
    }
    return map;
  }, [deals, pipeline]);

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const newStage = e.over?.id as string | undefined;
    if (!newStage) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;
    const currentKey = deal.stage_id || (deal.stage as string);
    if (currentKey === newStage) return;

    qc.setQueryData<Deal[]>(["deals", "list"], (old = []) =>
      old.map((d) => (d.id === id ? { ...d, stage: newStage as Deal["stage"], stage_id: newStage } : d)),
    );

    // Update both stage_id and (when valid) the legacy enum, so existing queries keep working.
    const legacyEnum = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
    const payload: Record<string, unknown> = { stage_id: newStage };
    if (legacyEnum.includes(newStage)) payload.stage = newStage;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("deals").update(payload).eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["deals"] });
    }
  };

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="flex gap-2 overflow-x-auto pb-4">
        {pipeline.stages.map((s) => {
          const rows = grouped[s.value] ?? [];
          const total = rows.reduce((sum, d) => sum + Number(d.value || 0), 0);
          const weighted = rows.reduce(
            (sum, d) => sum + Number(d.value || 0) * ((s.probability ?? 0) / 100),
            0,
          );
          return (
            <DealsBoardColumn key={s.value} stage={s} total={total} weighted={weighted} count={rows.length}>
              {rows.map((d) => (
                <DealsBoardCard
                  key={d.id}
                  deal={d}
                  companyName={d.company_id ? lookups.companies.get(d.company_id) : undefined}
                  contactName={d.primary_contact_id ? lookups.contacts.get(d.primary_contact_id) : undefined}
                  ownerName={lookups.owners.get(d.owner_id) ?? "—"}
                  onClick={() => onOpen(d)}
                />
              ))}
            </DealsBoardColumn>
          );
        })}
      </div>
    </DndContext>
  );
}
