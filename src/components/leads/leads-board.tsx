// Quadro (Kanban) de Leads: mesmas funcionalidades do quadro de Negócios
// (arrastar entre etapas, seleção de cards e ações em massa), respeitando o
// gate de qualificação — a etapa de qualificação só é atingida pelo
// questionário na tela do lead.
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Headphones, Loader2, Play } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";
import { useBoardSelection } from "@/components/kanban/use-board-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { deriveLeadStatus, findLeadStage, resolveLeadStageValue } from "@/lib/leads/stages";
import type { LeadStage } from "@/lib/leads/stages";
import type { LeadGridRow } from "@/lib/leads/constants";
import { LeadsBoardCard } from "./leads-board-card";

/** Coluna do quadro: cards carregados + total real da etapa no banco. */
export type LeadsBoardColumnData = {
  value: string;
  rows: LeadGridRow[];
  total: number;
};

function LeadsBoardColumn({
  stage,
  loaded,
  total,
  headerExtra,
  children,
}: {
  stage: LeadStage;
  loaded: number;
  total: number;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });
  const color = stage.color || "var(--hs-stage-1)";
  const partial = loaded < total;
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
          <span
            className="text-[11px] text-[var(--hs-text-muted)] tabular-nums"
            title={
              partial
                ? `${loaded} carregados de ${total} leads nesta etapa`
                : `${total} leads nesta etapa`
            }
          >
            ({partial ? `${loaded} de ${total}` : total})
          </span>
        </div>
      </div>
      <div className="p-2 space-y-1.5 flex-1 min-h-[200px]">
        {children}
        {total === 0 && (
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
  columns,
  ownerNames,
  canUpdate = true,
  canDelete = false,
  canProspectingMode = false,
  prospectingBusy = false,
  onOpen,
  onRequestQualification,
  onStartQueue,
  onStartProspecting,
  onFetchStageIds,
}: {
  stages: LeadStage[];
  pipelineId: string | null;
  /** Fallback quando não há consulta por etapa (agrupa no cliente). */
  leads: LeadGridRow[];
  /** Colunas com contagem exata por etapa vinda do banco. */
  columns?: LeadsBoardColumnData[];
  /** owner_id → nome do responsável. */
  ownerNames?: Map<string, string>;
  canUpdate?: boolean;
  canDelete?: boolean;
  canProspectingMode?: boolean;
  prospectingBusy?: boolean;
  onOpen: (id: string) => void;
  /** Chamado quando o usuário tenta mover um lead para a etapa de qualificação. */
  onRequestQualification: (id: string) => void;
  /** Inicia a fila de foco com os leads selecionados no quadro. */
  onStartQueue?: (ids: string[]) => void;
  /** Abre o Modo Prospecção com os leads selecionados no quadro. */
  onStartProspecting?: (ids: string[]) => void;
  /** Todos os ids de uma etapa dentro do filtro atual (seleção da coluna). */
  onFetchStageIds?: (stageValue: string) => Promise<string[]>;
}) {
  const qc = useQueryClient();
  const [loadingStage, setLoadingStage] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, { rows: LeadGridRow[]; total: number }> = {};
    if (columns) {
      for (const c of columns) map[c.value] = { rows: c.rows, total: c.total };
      for (const s of stages) map[s.value] ??= { rows: [], total: 0 };
      return map;
    }
    for (const s of stages) map[s.value] = { rows: [], total: 0 };
    for (const l of leads) {
      const key = resolveLeadStageValue(l, stages);
      const bucket = map[key] ?? map[stages[0]?.value ?? ""];
      bucket?.rows.push(l);
    }
    for (const key of Object.keys(map)) map[key].total = map[key].rows.length;
    return map;
  }, [columns, leads, stages]);

  const allRows = useMemo(
    () => (columns ? columns.flatMap((c) => c.rows) : leads),
    [columns, leads],
  );
  const selection = useBoardSelection(allRows);

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
    const lead = allRows.find((l) => l.id === id);
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
            const l = allRows.find((x) => x.id === leadId);
            return l ? resolveLeadStageValue(l, stages) !== target : false;
          })
        : [id];
    if (!batch.length) return;

    await applyStage(batch, target);
    if (batch.length > 1) selection.clear();
  };

  /** Seleciona/limpa a etapa inteira (todos os leads do filtro, não só os carregados). */
  const toggleStage = async (stageValue: string, visibleIds: string[], allSelected: boolean) => {
    if (allSelected) {
      selection.deselectMany(visibleIds);
      return;
    }
    if (!onFetchStageIds) {
      selection.selectMany(visibleIds);
      return;
    }
    setLoadingStage(stageValue);
    try {
      const ids = await onFetchStageIds(stageValue);
      selection.selectMany(ids.length ? ids : visibleIds);
      if (ids.length > visibleIds.length) {
        toast.success(`${ids.length} leads selecionados nesta etapa`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao selecionar a etapa");
      selection.selectMany(visibleIds);
    } finally {
      setLoadingStage(null);
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <KanbanScrollContainer ariaLabel="Quadro de leads">
          <div className="flex gap-2 pb-4">
            {stages.map((s) => {
              const column = grouped[s.value] ?? { rows: [], total: 0 };
              const rows = column.rows;
              const columnIds = rows.map((l) => l.id);
              const allColumnSelected =
                columnIds.length > 0 && columnIds.every((id) => selection.isSelected(id));
              return (
                <LeadsBoardColumn
                  key={s.value}
                  stage={s}
                  loaded={rows.length}
                  total={column.total}
                  headerExtra={
                    columnIds.length > 0 ? (
                      loadingStage === s.value ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin text-[var(--hs-text-muted)]"
                          aria-label={`Selecionando etapa ${s.label}`}
                        />
                      ) : (
                        <Checkbox
                          checked={allColumnSelected}
                          disabled={loadingStage !== null}
                          aria-label={`Selecionar todos os leads da etapa ${s.label}`}
                          onCheckedChange={() =>
                            void toggleStage(s.value, columnIds, allColumnSelected)
                          }
                        />
                      )
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
          extraActions={
            <>
              {onStartQueue && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStartQueue(selection.ids)}
                  title="Percorrer os leads selecionados um a um"
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" /> Iniciar fila
                </Button>
              )}
              {onStartProspecting && canProspectingMode && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={prospectingBusy}
                  onClick={() => onStartProspecting(selection.ids)}
                  title="Trabalhar os leads selecionados na tela de Prospecção"
                >
                  <Headphones className="mr-1.5 h-3.5 w-3.5" />
                  {prospectingBusy ? "Preparando…" : "Modo Prospecção"}
                </Button>
              )}
            </>
          }
          onDone={() => {
            selection.clear();
            refresh();
          }}
        />
      )}
    </>
  );
}
