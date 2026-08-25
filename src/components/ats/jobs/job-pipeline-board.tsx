import { Link } from "@tanstack/react-router";
import { ClipboardCheck, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ScoreBadge } from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { AssigneeCell } from "@/components/entity/assignee-cell";
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
}) {
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
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-3 min-w-max pb-2">
        {stages.map((s) => {
          const items = byStage[s.value] ?? [];
          return (
            <div
              key={s.value}
              className="w-72 flex-shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropStage(s.value)}
            >
              <div className="rounded-lg border border-border-subtle bg-surface-sunken h-full flex flex-col">
                <div className="px-3 py-2.5 border-b border-border-subtle flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                    {s.label}
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
                        )}
                      >
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
                            {a.candidate.current_company && ` @ ${a.candidate.current_company}`}
                          </div>
                        )}
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
  );
}
