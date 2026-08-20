import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Deal } from "@/lib/db-types";
import type { Pipeline } from "@/lib/pipelines";
import { computeDealSignals } from "@/lib/deals/hot-score";
import { DealsBoardColumn } from "./deals-board-column";
import { DealsBoardCard } from "./deals-board-card";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";
import { LostReasonDialog, type LostReasonResult } from "@/components/deals/lost-reason-dialog";

export type DealLookups = {
  companies: Map<string, string>;
  contacts: Map<string, string>;
  owners: Map<string, string>;
};

export function DealsBoard({
  pipeline,
  deals,
  lookups,
  nextActivities,
  focusMode,
  onOpen,
}: {
  pipeline: Pipeline;
  deals: Deal[];
  lookups: DealLookups;
  nextActivities?: Map<string, string>;
  focusMode?: boolean;
  onOpen: (d: Deal) => void;
}) {
  const qc = useQueryClient();

  const signals = useMemo(
    () => computeDealSignals(deals, pipeline, nextActivities),
    [deals, pipeline, nextActivities],
  );

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

  const [lostTarget, setLostTarget] = useState<
    { id: string; name: string | null; stageId: string } | null
  >(null);

  const applyStageUpdate = async (id: string, newStage: string, extra?: Record<string, unknown>) => {
    const legacyEnum = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
    const stageType = pipeline.stages.find((s) => s.value === newStage)?.type;
    const payload: Record<string, unknown> = { stage_id: newStage, ...(extra ?? {}) };
    if (legacyEnum.includes(newStage)) payload.stage = newStage;
    else if (stageType === "lost") payload.stage = "lost";
    else if (stageType === "won") payload.stage = "won";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("deals").update(payload).eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["deals"] });
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const newStage = e.over?.id as string | undefined;
    if (!newStage) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;
    const currentKey = deal.stage_id || (deal.stage as string);
    if (currentKey === newStage) return;

    const stageType = pipeline.stages.find((s) => s.value === newStage)?.type;
    if (stageType === "lost") {
      setLostTarget({ id, name: deal.name ?? null, stageId: newStage });
      return;
    }

    qc.setQueriesData<Deal[]>({ queryKey: ["deals", "list"] }, (old = []) =>
      old.map((d) =>
        d.id === id ? { ...d, stage: newStage as Deal["stage"], stage_id: newStage } : d,
      ),
    );

    await applyStageUpdate(id, newStage);
  };

  const confirmLost = async (result: LostReasonResult) => {
    if (!lostTarget) return;
    const notes = result.notes ? `${result.reasonLabel} — ${result.notes}` : result.reasonLabel;
    qc.setQueriesData<Deal[]>({ queryKey: ["deals", "list"] }, (old = []) =>
      old.map((d) =>
        d.id === lostTarget.id
          ? { ...d, stage: "lost" as Deal["stage"], stage_id: lostTarget.stageId }
          : d,
      ),
    );
    await applyStageUpdate(lostTarget.id, lostTarget.stageId, { closed_lost_reason: notes });
    toast.success("Marcado como perdido");
    qc.invalidateQueries({ queryKey: ["deals"] });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <KanbanScrollContainer ariaLabel="Quadro de negócios">
          <div className="flex gap-2 pb-4">
            {pipeline.stages.map((s) => {
              const raw = grouped[s.value] ?? [];
              const rows = focusMode
                ? [...raw].sort((a, b) => {
                    const sa = signals.get(a.id)?.score ?? 0;
                    const sb = signals.get(b.id)?.score ?? 0;
                    if (sb !== sa) return sb - sa;
                    return Number(b.value ?? 0) - Number(a.value ?? 0);
                  })
                : raw;
              const total = rows.reduce((sum, d) => sum + Number(d.value || 0), 0);
              const weighted = rows.reduce(
                (sum, d) => sum + Number(d.value || 0) * ((s.probability ?? 0) / 100),
                0,
              );
              const hotCount = rows.reduce(
                (n, d) => n + (signals.get(d.id)?.isHot ? 1 : 0),
                0,
              );
              return (
                <DealsBoardColumn
                  key={s.value}
                  stage={s}
                  total={total}
                  weighted={weighted}
                  count={rows.length}
                  hotCount={hotCount}
                >
                  {rows.map((d) => {
                    const sig = signals.get(d.id);
                    return (
                      <DealsBoardCard
                        key={d.id}
                        deal={d}
                        columnId={s.value}
                        companyName={d.company_id ? lookups.companies.get(d.company_id) : undefined}
                        contactName={
                          d.primary_contact_id ? lookups.contacts.get(d.primary_contact_id) : undefined
                        }
                        ownerName={lookups.owners.get(d.owner_id) ?? "—"}
                        fields={pipeline.config?.card_fields}
                        nextActivityDate={nextActivities?.get(d.id) ?? null}
                        signals={sig}
                        dimmed={focusMode && sig?.klass === "cold"}
                        onClick={() => onOpen(d)}
                      />
                    );
                  })}
                </DealsBoardColumn>
              );
            })}
          </div>
        </KanbanScrollContainer>
      </DndContext>

      <LostReasonDialog
        open={!!lostTarget}
        onOpenChange={(b) => !b && setLostTarget(null)}
        dealName={lostTarget?.name ?? null}
        onConfirm={confirmLost}
      />
    </>
  );
}
