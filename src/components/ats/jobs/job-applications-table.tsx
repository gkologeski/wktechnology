import { Link } from "@tanstack/react-router";
import { ArrowUpDown, ClipboardCheck, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ScoreBadge } from "@/components/ats/ui";
import { MetaPill } from "@/components/techhire/ui";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import type { App } from "@/components/ats/jobs/job-detail.types";

export function JobApplicationsTable({
  apps,
  sortDir,
  onToggleSortDir,
  scoreSummary,
  onEvaluate,
  stageLabel,
  assigneeFilterActive,
  onClearAssigneeFilter,
  onAddCandidate,
}: {
  apps: App[];
  sortDir: "asc" | "desc";
  onToggleSortDir: () => void;
  scoreSummary: Record<string, { avg: number; count: number }>;
  onEvaluate: (app: App) => void;
  stageLabel: (value: string | null | undefined) => string;
  assigneeFilterActive: boolean;
  onClearAssigneeFilter: () => void;
  onAddCandidate: () => void;
}) {
  if (apps.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhuma candidatura encontrada"
        description={
          assigneeFilterActive
            ? "Nenhuma candidatura para o responsável selecionado. Ajuste o filtro para ver mais registros."
            : "Adicione candidatos manualmente ou compartilhe a página de carreiras para receber aplicações."
        }
        action={
          assigneeFilterActive ? (
            <Button variant="outline" onClick={onClearAssigneeFilter}>
              Limpar filtro
            </Button>
          ) : (
            <Button onClick={onAddCandidate}>
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Adicionar candidato
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1">
      <Table className="min-w-[680px]">
        <TableHeader>
          <TableRow>
            <TableHead>Candidato</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Avaliação</TableHead>
            <TableHead aria-sort={sortDir === "asc" ? "ascending" : "descending"}>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium hover:text-text-primary"
                onClick={onToggleSortDir}
              >
                Responsável
                <ArrowUpDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
                <span className="sr-only">
                  Ordenar por responsável ({sortDir === "asc" ? "crescente" : "decrescente"})
                </span>
              </button>
            </TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.map((a) => (
            <TableRow key={a.id as string}>
              <TableCell>
                <Link
                  to="/candidates/$id"
                  params={{ id: a.candidate_id as string }}
                  className="font-medium text-text-primary hover:underline"
                >
                  {a.candidate?.full_name ?? "Candidato"}
                </Link>
                {a.candidate?.current_position && (
                  <div className="text-xs text-text-tertiary truncate">
                    {a.candidate.current_position}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm text-text-secondary">
                {stageLabel(a.stage_value)}
              </TableCell>
              <TableCell>
                {a.ai_match_score != null ? (
                  <ScoreBadge score={Number(a.ai_match_score)} />
                ) : scoreSummary[a.id] ? (
                  <MetaPill>
                    {scoreSummary[a.id].avg} · {scoreSummary[a.id].count}×
                  </MetaPill>
                ) : (
                  <span className="text-xs text-text-tertiary">—</span>
                )}
              </TableCell>
              <TableCell>
                <AssigneeCell
                  assignedTo={(a as { assigned_to?: string | null }).assigned_to}
                  className="text-sm"
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onEvaluate(a)}
                >
                  <ClipboardCheck className="h-3 w-3 mr-1" aria-hidden />
                  Avaliar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
