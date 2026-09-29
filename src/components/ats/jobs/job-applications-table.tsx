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
import { useMemo } from "react";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";
import { SortableColumnHeader, SortableColumns } from "@/components/grid/sortable-columns";

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
  const columns = useMemo<GridColumnDef<App>[]>(
    () => [
      {
        key: "candidate",
        label: "Candidato",
        render: (app) => (
          <>
            <Link
              to="/candidates/$id"
              params={{ id: app.candidate_id as string }}
              className="font-medium text-text-primary hover:underline"
            >
              {app.candidate?.full_name ?? "Candidato"}
            </Link>
            {app.candidate?.current_position ? (
              <div className="truncate text-xs text-text-tertiary">
                {app.candidate.current_position}
              </div>
            ) : null}
          </>
        ),
      },
      {
        key: "stage",
        label: "Etapa",
        className: "text-sm text-text-secondary",
        render: (app) => stageLabel(app.stage_value),
      },
      {
        key: "score",
        label: "Avaliação",
        render: (app) =>
          app.ai_match_score != null ? (
            <ScoreBadge score={Number(app.ai_match_score)} />
          ) : scoreSummary[app.id] ? (
            <MetaPill>
              {scoreSummary[app.id].avg} · {scoreSummary[app.id].count}×
            </MetaPill>
          ) : (
            <span className="text-xs text-text-tertiary">—</span>
          ),
      },
      {
        key: "assignee",
        label: "Responsável",
        header: (
          <TableHead aria-sort={sortDir === "asc" ? "ascending" : "descending"}>
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium hover:text-text-primary"
              onClick={onToggleSortDir}
            >
              Responsável
              <ArrowUpDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </button>
          </TableHead>
        ),
        render: (app) => (
          <AssigneeCell
            assignedTo={(app as { assigned_to?: string | null }).assigned_to}
            className="text-sm"
          />
        ),
      },
    ],
    [onToggleSortDir, scoreSummary, sortDir, stageLabel],
  );
  const grid = useGridColumns<App>({
    gridKey: "ats-job-applications",
    columns,
    defaults: ["candidate", "stage", "score", "assignee"],
  });

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
    <div className="space-y-2">
      <div className="flex justify-end">
        <grid.ColumnsButton />
      </div>
      <div className="rounded-lg border border-border-subtle bg-surface-1">
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow>
              <SortableColumns keys={grid.columnKeys} onReorder={grid.reorderColumns}>
                {grid.columns.map((column) => (
                  <SortableColumnHeader
                    key={column.key}
                    columnKey={column.key}
                    label={column.label}
                  >
                    {column.header ?? <TableHead>{column.label}</TableHead>}
                  </SortableColumnHeader>
                ))}
              </SortableColumns>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((a) => (
              <TableRow key={a.id as string}>
                {grid.columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render(a)}
                  </TableCell>
                ))}
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
      <grid.ColumnsEditor />
    </div>
  );
}
