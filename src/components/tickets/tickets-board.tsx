import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Pipeline, PipelineStage } from "@/lib/pipelines";
import { TicketCard } from "./ticket-card";
import { notifyTicketStatusChange } from "@/lib/tickets-notify.functions";
import type { TicketRow, TicketStatus } from "./types";
import { KanbanScrollContainer } from "@/components/kanban/kanban-scroll-container";
import { computeTicketSignals } from "@/lib/kanban/tickets-signals";
import { Flame } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useBoardSelection } from "@/components/kanban/use-board-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";

function Column({
  stage,
  count,
  hotCount,
  headerExtra,
  children,
}: {
  stage: PipelineStage;
  count: number;
  hotCount?: number;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });
  const color = stage.color || "var(--hs-stage-1)";
  return (
    <div
      ref={setNodeRef}
      data-kanban-column-root={stage.value}
      className={`flex flex-col w-[300px] shrink-0 rounded-md bg-[var(--hs-surface)] border border-[var(--hs-divider)] ${
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
          <span className="text-[11px] font-semibold uppercase tracking-wide truncate">
            {stage.label}
          </span>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-[var(--hs-text-muted)] tabular-nums">
            {hotCount !== undefined && hotCount > 0 ? (
              <span
                className="inline-flex items-center gap-0.5"
                title={`${hotCount} urgente(s)`}
                style={{ color: "var(--hs-orange)" }}
              >
                <Flame className="h-3 w-3" aria-hidden />
                {hotCount}
              </span>
            ) : null}
            <span>{count}</span>
          </span>
        </div>
      </div>

      <div className="p-2 space-y-1.5 flex-1 min-h-[200px] overflow-y-auto max-h-[calc(100vh-260px)]">
        {children}
        {count === 0 && (
          <p className="text-xs text-[var(--hs-text-muted)] text-center py-6">Vazio</p>
        )}
      </div>
    </div>
  );
}

const VALID_STATUSES: TicketStatus[] = ["new", "open", "waiting", "resolved", "closed"];

export function TicketsBoard({
  pipeline,
  tickets,
  lookups,
  focusMode,
  selectable = false,
  canUpdate = true,
  canDelete = false,
  onOpen,
}: {
  pipeline: Pipeline;
  tickets: TicketRow[];
  lookups: {
    contacts: Map<string, string>;
    companies: Map<string, string>;
    owners: Map<string, string>;
  };
  focusMode?: boolean;
  /** Habilita seleção de cards + ações em massa (mesma barra dos grids). */
  selectable?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  onOpen: (t: TicketRow) => void;
}) {
  const qc = useQueryClient();
  const selection = useBoardSelection(tickets);
  const notifyStatus = useServerFn(notifyTicketStatusChange);

  const signals = useMemo(
    () => computeTicketSignals(tickets, pipeline),
    [tickets, pipeline],
  );


  const grouped = useMemo(() => {
    const map: Record<string, TicketRow[]> = {};
    for (const s of pipeline.stages) map[s.value] = [];
    const stageValues = new Set(pipeline.stages.map((s) => s.value));
    const firstStage = pipeline.stages[0]?.value;
    for (const t of tickets) {
      let key: string | undefined;
      // Fonte de verdade: coluna `stage`.
      if (t.stage && stageValues.has(t.stage)) key = t.stage;
      // Compat: fallback ao stage HubSpot legado ou status quando `stage` não bate com o pipeline atual.
      if (!key) {
        const hsStage = (t.external_ids as { hs_pipeline_stage?: string } | null | undefined)
          ?.hs_pipeline_stage;
        if (hsStage && stageValues.has(hsStage)) key = hsStage;
      }
      if (!key && stageValues.has(t.status)) key = t.status;
      if (!key) key = firstStage;
      if (key && map[key]) map[key].push(t);
    }
    return map;
  }, [tickets, pipeline]);

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const t = tickets.find((x) => x.id === id);
    if (!t) return;
    const newStage = pipeline.stages.find((s) => s.value === overId);
    if (!newStage) return;

    const isBuiltInStatusStage = (VALID_STATUSES as string[]).includes(overId);
    const nextStatus: TicketStatus = isBuiltInStatusStage
      ? (overId as TicketStatus)
      : newStage.type === "won" || newStage.type === "lost"
        ? "closed"
        : "open";

    if (t.stage === overId && t.status === nextStatus && t.pipeline_id === pipeline.id) return;

    qc.setQueryData<TicketRow[]>(["tickets"], (old = []) =>
      old.map((x) =>
        x.id === id
          ? { ...x, stage: overId, status: nextStatus, pipeline_id: pipeline.id }
          : x,
      ),
    );

    const patch: Record<string, unknown> = {
      stage: overId,
      status: nextStatus,
      pipeline_id: pipeline.id,
    };
    if (nextStatus === "resolved" || nextStatus === "closed") {
      patch.resolved_at = t.resolved_at ?? new Date().toISOString();
    } else {
      patch.resolved_at = null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("tickets").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["tickets"] });
      return;
    }
    if (t.status !== nextStatus) {
      notifyStatus({ data: { ticket_id: id, new_status: nextStatus } }).catch(() => {});
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <KanbanScrollContainer ariaLabel="Quadro de chamados">
        <div className="flex gap-2 pb-4">
          {pipeline.stages.map((s) => {
            const raw = grouped[s.value] ?? [];
            const rows = focusMode
              ? [...raw].sort((a, b) => {
                  const sa = signals.get(a.id)?.score ?? 0;
                  const sb = signals.get(b.id)?.score ?? 0;
                  return sb - sa;
                })
              : raw;
            const hotCount = rows.reduce(
              (n, t) => n + (signals.get(t.id)?.isHot ? 1 : 0),
              0,
            );
            const columnIds = rows.map((t) => t.id);
            const allColumnSelected =
              columnIds.length > 0 && columnIds.every((id) => selection.isSelected(id));
            return (
              <Column
                key={s.value}
                stage={s}
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
                {rows.map((t) => {
                  const sig = signals.get(t.id);
                  return (
                    <TicketCard
                      key={t.id}
                      ticket={t}
                      columnId={s.value}
                      contactName={t.contact_id ? lookups.contacts.get(t.contact_id) : undefined}
                      companyName={t.company_id ? lookups.companies.get(t.company_id) : undefined}
                      ownerName={t.assignee_id ? lookups.owners.get(t.assignee_id) : undefined}
                      signals={sig}
                      dimmed={focusMode && sig?.klass === "cold"}
                      selectable={selectable}
                      selected={selection.isSelected(t.id)}
                      onToggleSelect={(shift) => selection.toggle(t.id, { columnIds, shift })}
                      onClick={() => onOpen(t)}
                    />
                  );
                })}
              </Column>
            );
          })}
        </div>
      </KanbanScrollContainer>

      {selectable && selection.hasSelection && (
        <GridBulkBar
          table="tickets"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="chamado"
          assignColumn="assignee_id"
          canUpdate={canUpdate}
          canDelete={canDelete}
          onClear={selection.clear}
          onDone={() => void qc.invalidateQueries({ queryKey: ["tickets"] })}
        />
      )}
    </DndContext>
  );
}

