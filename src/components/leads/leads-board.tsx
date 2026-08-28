// Quadro (Kanban) de Leads: mesmas funcionalidades do quadro de Negócios
// (arrastar entre etapas, seleção de cards e ações em massa), respeitando o
// gate de qualificação — a etapa de qualificação só é atingida pelo
// questionário na tela do lead.
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";
import { useBoardSelection } from "@/components/kanban/use-board-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { deriveLeadStatus, findLeadStage, resolveLeadStageValue } from "@/lib/leads/stages";
import type { LeadStage } from "@/lib/leads/stages";
import type { LeadGridRow } from "@/lib/leads/constants";
import { LeadsBoardCard } from "./leads-board-card";

function LeadsBoardColumn({
  stage,
  count,
  headerExtra,
  children,
}: {
  stage: LeadStage;
  count: number;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });
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
        </div>
      </div>
      <div className="p-2 space-y-1.5 flex-1 min-h-[200px]">
        {children}
        {count === 0 && (
          <p className="text-xs text-[var(--hs-text-muted)] text-center py-6">Sem leads</p>
        )}
      </div>
    </div>
  );
}

export function LeadsBoard({
  stages,
  pipelineId,
  leads,
  ownerNames,
  canUpdate = true,
  canDelete = false,
  onOpen,
  onRequestQualification,
}: {
  stages: LeadStage[];
  pipelineId: string | null;
  leads: LeadGridRow[];
  /** owner_id → nome do responsável. */
  ownerNames?: Map<string, string>;
  canUpdate?: boolean;
  canDelete?: boolean;
  onOpen: (id: string) => void;
  /** Chamado quando o usuário tenta mover um lead para a etapa de qualificação. */
  onRequestQualification: (id: string) => void;
}) {
  const qc = useQueryClient();
  const selection = useBoardSelection(leads);

  const grouped = useMemo(() => {
    const map: Record<string, LeadGridRow[]> = {};
    for (const s of stages) map[s.value] = [];
    for (const l of leads) {
      const key = resolveLeadStageValue(l, stages);
      (map[key] ?? map[stages[0]?.value])?.push(l);
    }
    return map;
  }, [leads, stages]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["leads"] });

  const applyStage = async (ids: string[], stageValue: string) => {
    const stage = findLeadStage(stages, stageValue);
    const payload = {
      stage_id: stageValue,
      status: deriveLeadStatus(stage),
      stage_substatus_id: null,
    };
    const { data, error } = await supabase.from("leads").update(payload).in("id", ids).select("id");
    if (error) {
      toast.error(error.message);
      refresh();
      return;
    }
    const updated = (data ?? []).length;
    if (updated === 0) {
      toast.error("Nenhum lead foi movido: sua permissão não alcança estes registros.");
    } else if (updated < ids.length) {
      toast.warning(
        `${updated} de ${ids.length} leads movidos. Os demais estão fora do seu acesso.`,
      );
    } else if (ids.length > 1) {
      toast.success(`${updated} leads movidos`);
    }
    refresh();
  };

  const onDragEnd = async (e: DragEndEvent) => {
    if (!canUpdate) return;
    const id = String(e.active.id);
    const target = e.over?.id as string | undefined;
    if (!target) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    if (resolveLeadStageValue(lead, stages) === target) return;

    // Gate de qualificação: a etapa "qualificado" exige o questionário.
    const targetIsQualification =
      target === "qualifying" || deriveLeadStatus(findLeadStage(stages, target)) === "qualified";
    if (targetIsQualification) {
      toast.info("Qualificação exige o questionário. Abrindo o lead…");
      onRequestQualification(id);
      return;
    }

    const batch =
      selection.isSelected(id) && selection.ids.length > 1
        ? selection.ids.filter((leadId) => {
            const l = leads.find((x) => x.id === leadId);
            return l ? resolveLeadStageValue(l, stages) !== target : false;
          })
        : [id];
    if (!batch.length) return;

    await applyStage(batch, target);
    if (batch.length > 1) selection.clear();
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <KanbanScrollContainer ariaLabel="Quadro de leads">
          <div className="flex gap-2 pb-4">
            {stages.map((s) => {
              const rows = grouped[s.value] ?? [];
              const columnIds = rows.map((l) => l.id);
              const allColumnSelected =
                columnIds.length > 0 && columnIds.every((id) => selection.isSelected(id));
              return (
                <LeadsBoardColumn
                  key={s.value}
                  stage={s}
                  count={rows.length}
                  headerExtra={
                    columnIds.length > 0 ? (
                      <Checkbox
                        checked={allColumnSelected}
                        aria-label={`Selecionar coluna ${s.label}`}
                        onCheckedChange={() => selection.toggleMany(columnIds)}
                      />
                    ) : undefined
                  }
                >
                  {rows.map((l) => (
                    <LeadsBoardCard
                      key={l.id}
                      lead={l}
                      columnId={s.value}
                      ownerName={l.owner_id ? ownerNames?.get(l.owner_id) : undefined}
                      pipelineId={pipelineId}
                      selectable
                      selected={selection.isSelected(l.id)}
                      canUpdate={canUpdate}
                      onSubstatusChanged={refresh}
                      onToggleSelect={(shift) => selection.toggle(l.id, { columnIds, shift })}
                      onClick={() => onOpen(l.id)}
                    />
                  ))}
                </LeadsBoardColumn>
              );
            })}
          </div>
        </KanbanScrollContainer>
      </DndContext>

      {selection.hasSelection && (
        <GridBulkBar
          table="leads"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="lead"
          assignColumn="owner_id"
          activityEntity="leads"
          canUpdate={canUpdate}
          canDelete={canDelete}
          onClear={selection.clear}
          onDone={() => {
            selection.clear();
            refresh();
          }}
        />
      )}
    </>
  );
}
