import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, MoveRight, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ScoreBadge } from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { BoardCardCheckbox } from "@/components/kanban/board-card-checkbox";
import { useBoardSelection } from "@/components/kanban/use-board-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { cn } from "@/lib/utils";
import type { AtsStage } from "@/lib/ats/stages";
import type { App } from "@/components/ats/jobs/job-detail.types";

export function JobPipelineBoard({
  totalApps,
  stages,
  byStage,
  scoreSummary,
  onEvaluate,
  onAddCandidate,
  onDragStart,
  onDragEnd,
  onDropStage,
  onBulkMoveStage,
  onBulkDone,
  canDelete = false,
}: {
  totalApps: number;
  stages: AtsStage[];
  byStage: Record<string, App[]>;
  scoreSummary: Record<string, { avg: number; count: number }>;
  onEvaluate: (app: App) => void;
  onAddCandidate: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropStage: (stageValue: string) => void;
  /** Move várias candidaturas de etapa de uma vez. */
  onBulkMoveStage?: (ids: string[], stageValue: string) => Promise<void> | void;
  /** Chamado após qualquer ação em massa (recarrega os dados da vaga). */
  onBulkDone?: () => void;
  canDelete?: boolean;
}) {
  const allApps = useMemo(() => stages.flatMap((s) => byStage[s.value] ?? []), [stages, byStage]);
  const selection = useBoardSelection(allApps);

  if (totalApps === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum candidato nesta vaga"
        description="Adicione candidatos manualmente ou compartilhe a página de carreiras para receber aplicações."
        action={
          <Button onClick={onAddCandidate}>
            <Plus className="h-4 w-4 mr-2" aria-hidden />
            Adicionar candidato
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-3 min-w-max pb-2">
          {stages.map((s) => {
            const items = byStage[s.value] ?? [];
            const columnIds = items.map((a) => a.id);
            const allColumnSelected =
              columnIds.length > 0 && columnIds.every((id) => selection.isSelected(id));
            return (
              <div
                key={s.value}
                className="w-72 flex-shrink-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropStage(s.value)}
              >
                <div className="rounded-lg border border-border-subtle bg-surface-sunken h-full flex flex-col">
                  <div className="px-3 py-2.5 border-b border-border-subtle flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {columnIds.length > 0 && (
                        <Checkbox
                          checked={allColumnSelected}
                          aria-label={`Selecionar etapa ${s.label}`}
                          onCheckedChange={() => selection.toggleMany(columnIds)}
                        />
                      )}
                      <span className="truncate text-xs font-semibold text-text-primary uppercase tracking-wide">
                        {s.label}
                      </span>
                    </span>
                    <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-md bg-surface-1 border border-border-subtle text-[11px] font-medium text-text-secondary tabular-nums">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-2 p-2 min-h-[200px] flex-1">
                    {items.length === 0 ? (
                      <div className="h-full min-h-[180px] flex items-center justify-center text-[11px] text-text-tertiary">
                        Solte aqui
                      </div>
                    ) : (
                      items.map((a) => (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={() => onDragStart(a.id)}
                          onDragEnd={onDragEnd}
                          className={cn(
                            "bg-surface-1 border border-border-subtle rounded-md p-3 text-sm",
                            "cursor-grab active:cursor-grabbing",
                            "hover:border-border-strong hover:shadow-xs transition-all",
                            selection.isSelected(a.id) && "ring-2 ring-ring",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <BoardCardCheckbox
                              selected={selection.isSelected(a.id)}
                              label={`Selecionar ${a.candidate?.full_name ?? "candidatura"}`}
                              onToggle={(shift) => selection.toggle(a.id, { columnIds, shift })}
                            />
                            <div className="min-w-0 flex-1">
                              <Link
                                to="/candidates/$id"
                                params={{ id: a.candidate_id as string }}
                                onClick={(e) => e.stopPropagation()}
                                draggable={false}
                                onDragStart={(e) => e.stopPropagation()}
                                className="font-medium text-text-primary truncate hover:underline block"
                              >
                                {a.candidate?.full_name ?? "Candidato"}
                              </Link>
                              {a.candidate?.current_position && (
                                <div className="text-xs text-text-tertiary truncate mt-0.5">
                                  {a.candidate.current_position}
                                  {a.candidate.current_company &&
                                    ` @ ${a.candidate.current_company}`}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {a.ai_match_score != null && (
                              <ScoreBadge score={Number(a.ai_match_score)} />
                            )}
                            {scoreSummary[a.id] && (
                              <MetaPill>
                                Avaliação {scoreSummary[a.id].avg} · {scoreSummary[a.id].count}×
                              </MetaPill>
                            )}
                          </div>
                          <AssigneeCell
                            assignedTo={(a as { assigned_to?: string | null }).assigned_to}
                            className="mt-2 text-xs"
                          />
                          <div className="mt-2 flex justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEvaluate(a);
                              }}
                              draggable={false}
                              onDragStart={(e) => e.stopPropagation()}
                            >
                              <ClipboardCheck className="h-3 w-3 mr-1" aria-hidden />
                              Avaliar
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selection.hasSelection && (
        <GridBulkBar
          table="ats_applications"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="candidatura"
          canDelete={canDelete}
          onClear={selection.clear}
          onDone={() => onBulkDone?.()}
          extraActions={
            onBulkMoveStage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoveRight className="mr-1 h-4 w-4" aria-hidden /> Mover para etapa
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                  {stages.map((s) => (
                    <DropdownMenuItem
                      key={s.value}
                      onSelect={async () => {
                        await onBulkMoveStage(selection.ids, s.value);
                        selection.clear();
                        onBulkDone?.();
                      }}
                    >
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null
          }
        />
      )}
    </>
  );
}
