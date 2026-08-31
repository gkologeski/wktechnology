import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Deal } from "@/lib/db-types";
import type { Pipeline, PipelineStage } from "@/lib/pipelines";

/** Valor sintético da coluna que agrupa etapas fora do pipeline atual. */
const ORPHAN_STAGE_VALUE = "__sem_etapa__";
import { computeDealSignals } from "@/lib/deals/hot-score";
import { DealsBoardColumn } from "./deals-board-column";
import { DealsBoardCard } from "./deals-board-card";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";
import { LostReasonDialog, type LostReasonResult } from "@/components/deals/lost-reason-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { startFocusQueue } from "@/lib/focus-queue";
import { useBoardSelection } from "@/components/kanban/use-board-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";

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
  selectable = false,
  canUpdate = true,
  canDelete = false,
  onOpen,
}: {
  pipeline: Pipeline;
  deals: Deal[];
  lookups: DealLookups;
  nextActivities?: Map<string, string>;
  focusMode?: boolean;
  /** Habilita seleção de cards + ações em massa (mesma barra dos grids). */
  selectable?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  onOpen: (d: Deal) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const selection = useBoardSelection(deals);

  const signals = useMemo(
    () => computeDealSignals(deals, pipeline, nextActivities),
    [deals, pipeline, nextActivities],
  );

  const { grouped, orphans } = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const s of pipeline.stages) map[s.value] = [];
    const unknown: Deal[] = [];
    for (const d of deals) {
      const key = d.stage_id || (d.stage as string);
      if (map[key]) map[key].push(d);
      // Etapa que não existe neste pipeline (ex.: id legado após troca de
      // pipeline): fica numa coluna "Sem etapa" em vez de sumir do quadro.
      else unknown.push(d);
    }
    return { grouped: map, orphans: unknown };
  }, [deals, pipeline]);

  /** Coluna extra para negócios com etapa desconhecida (só quando houver). */
  const boardStages = useMemo<PipelineStage[]>(
    () =>
      orphans.length
        ? [...pipeline.stages, { value: ORPHAN_STAGE_VALUE, label: "Sem etapa", type: "open" }]
        : pipeline.stages,
    [orphans.length, pipeline.stages],
  );

  const [lostTarget, setLostTarget] = useState<{
    ids: string[];
    name: string | null;
    stageId: string;
  } | null>(null);

  /** Payload de etapa (mantém a coluna legada `stage` em sincronia). */
  const stagePayload = (newStage: string, extra?: Record<string, unknown>) => {
    const legacyEnum = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
    const stageType = pipeline.stages.find((s) => s.value === newStage)?.type;
    const payload: Record<string, unknown> = { stage_id: newStage, ...(extra ?? {}) };
    if (legacyEnum.includes(newStage)) payload.stage = newStage;
    else if (stageType === "lost") payload.stage = "lost";
    else if (stageType === "won") payload.stage = "won";
    return payload;
  };

  /**
   * Aplica a etapa em um ou mais negócios. Usa `.select("id")` para detectar
   * bloqueio silencioso da RLS e avisar quando parte da seleção não mudou.
   */
  const applyStageUpdate = async (
    ids: string[],
    newStage: string,
    extra?: Record<string, unknown>,
  ) => {
    if (!ids.length) return;
    const payload = stagePayload(newStage, extra);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("deals")
      .update(payload)
      .in("id", ids)
      .select("id");
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["deals"] });
      return;
    }
    const updated = ((data ?? []) as { id: string }[]).length;
    if (updated === 0) {
      toast.error("Nenhum negócio foi movido: sua permissão não alcança estes registros.");
    } else if (updated < ids.length) {
      toast.warning(
        `${updated} de ${ids.length} negócios movidos. Os demais estão fora do seu acesso.`,
      );
    } else if (ids.length > 1) {
      toast.success(`${updated} negócios movidos`);
    }
    qc.invalidateQueries({ queryKey: ["deals"] });
  };

  /** Ids afetados por um arrasto: o lote selecionado ou apenas o card movido. */
  const dragBatch = (id: string) =>
    selection.isSelected(id) && selection.ids.length > 1 ? selection.ids : [id];

  const onDragEnd = async (e: DragEndEvent) => {
    if (!canUpdate) return;
    const id = String(e.active.id);
    const newStage = e.over?.id as string | undefined;
    // "Sem etapa" é apenas um agrupamento de leitura: não recebe cards.
    if (!newStage || newStage === ORPHAN_STAGE_VALUE) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;
    const currentKey = deal.stage_id || (deal.stage as string);
    if (currentKey === newStage) return;

    const batch = dragBatch(id).filter((dealId) => {
      const d = deals.find((x) => x.id === dealId);
      return d ? (d.stage_id || (d.stage as string)) !== newStage : false;
    });
    if (!batch.length) return;

    const stageType = pipeline.stages.find((s) => s.value === newStage)?.type;
    if (stageType === "lost") {
      setLostTarget({
        ids: batch,
        name: batch.length === 1 ? (deal.name ?? null) : null,
        stageId: newStage,
      });
      return;
    }

    qc.setQueriesData<Deal[]>({ queryKey: ["deals", "list"] }, (old = []) =>
      old.map((d) =>
        batch.includes(d.id) ? { ...d, stage: newStage as Deal["stage"], stage_id: newStage } : d,
      ),
    );

    await applyStageUpdate(batch, newStage);
    if (batch.length > 1) selection.clear();
  };

  const confirmLost = async (result: LostReasonResult) => {
    if (!lostTarget) return;
    const notes = result.notes ? `${result.reasonLabel} — ${result.notes}` : result.reasonLabel;
    const ids = lostTarget.ids;
    qc.setQueriesData<Deal[]>({ queryKey: ["deals", "list"] }, (old = []) =>
      old.map((d) =>
        ids.includes(d.id)
          ? { ...d, stage: "lost" as Deal["stage"], stage_id: lostTarget.stageId }
          : d,
      ),
    );
    await applyStageUpdate(ids, lostTarget.stageId, { closed_lost_reason: notes });
    toast.success(
      ids.length > 1 ? `${ids.length} negócios marcados como perdidos` : "Marcado como perdido",
    );
    if (ids.length > 1) selection.clear();
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <KanbanScrollContainer ariaLabel="Quadro de negócios">
          <div className="flex gap-2 pb-4">
            {boardStages.map((s) => {
              const raw = s.value === ORPHAN_STAGE_VALUE ? orphans : (grouped[s.value] ?? []);
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
              const hotCount = rows.reduce((n, d) => n + (signals.get(d.id)?.isHot ? 1 : 0), 0);
              const columnIds = rows.map((d) => d.id);
              const allColumnSelected =
                columnIds.length > 0 && columnIds.every((id) => selection.isSelected(id));
              return (
                <DealsBoardColumn
                  key={s.value}
                  stage={s}
                  total={total}
                  weighted={weighted}
                  count={rows.length}
                  hotCount={hotCount}
                  headerExtra={
                    selectable && columnIds.length > 0 ? (
                      <Checkbox
                        checked={allColumnSelected}
                        aria-label={`Selecionar coluna ${s.label}`}
                        onCheckedChange={() => selection.toggleMany(columnIds)}
                      />
                    ) : undefined
                  }
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
                          d.primary_contact_id
                            ? lookups.contacts.get(d.primary_contact_id)
                            : undefined
                        }
                        ownerName={lookups.owners.get(d.owner_id) ?? "—"}
                        fields={pipeline.config?.card_fields}
                        nextActivityDate={nextActivities?.get(d.id) ?? null}
                        signals={sig}
                        dimmed={focusMode && sig?.klass === "cold"}
                        selectable={selectable}
                        selected={selection.isSelected(d.id)}
                        pipelineId={pipeline.id}
                        canUpdateSubstatus={canUpdate}
                        onSubstatusChanged={() =>
                          void qc.invalidateQueries({ queryKey: ["deals"] })
                        }
                        onToggleSelect={(shift) => selection.toggle(d.id, { columnIds, shift })}
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

      {selectable && selection.hasSelection && (
        <GridBulkBar
          table="deals"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="negócio"
          activityEntity="deals"
          canUpdate={canUpdate}
          canDelete={canDelete}
          onClear={selection.clear}
          onDone={() => void qc.invalidateQueries({ queryKey: ["deals"] })}
          extraActions={
            <Button
              variant="outline"
              size="sm"
              title="Percorrer os negócios selecionados, um a um"
              onClick={() => {
                const ids = selection.ids;
                if (!ids.length) return toast.error("Nenhum negócio selecionado.");
                startFocusQueue("deals", ids, `Negócios · ${ids.length.toLocaleString("pt-BR")}`);
                toast.success(`Fila iniciada com ${ids.length} negócio(s)`);
                void navigate({ to: "/deals/$id", params: { id: ids[0] } });
              }}
            >
              <Play className="mr-1 h-4 w-4" /> Iniciar fila
            </Button>
          }
        />
      )}

      <LostReasonDialog
        open={!!lostTarget}
        onOpenChange={(b) => !b && setLostTarget(null)}
        dealName={lostTarget?.name ?? null}
        onConfirm={confirmLost}
      />
    </>
  );
}
