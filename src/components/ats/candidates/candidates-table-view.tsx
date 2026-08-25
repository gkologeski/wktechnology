import { Link } from "@tanstack/react-router";
import { Trash2, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { SourceBadge } from "@/components/ats/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import type { useGridSelection } from "@/components/grid/use-grid-selection";
import type { DerivedCandidateStatus } from "@/lib/ats/candidate-status.functions";
import { CandidateStatusPill } from "./candidate-status-pill";
import type { Cand } from "./types";

export function CandidatesTableView({
  visibleRows,
  statuses,
  selection,
  refresh,
  canAny,
  onDelete,
}: {
  visibleRows: Cand[];
  statuses: Record<string, DerivedCandidateStatus>;
  selection: ReturnType<typeof useGridSelection<Cand & { id: string }>>;
  refresh: () => void;
  canAny: (perms: string[]) => boolean;
  onDelete: (id: string) => void;
}) {
  const selectAllFiltered = () =>
    selection.setSelectedIds(new Set(visibleRows.map((r) => r.id as string)));

  return (
    <>
      {selection.hasSelection && (
        <GridBulkBar
          table="ats_candidates"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="candidato(s)"
          onClear={selection.clear}
          onDone={refresh}
          totalMatching={visibleRows.length}
          onSelectAll={selectAllFiltered}
          canUpdate={canAny(["techhire.candidates.update.workspace"])}
          canDelete={canAny(["techhire.candidates.delete.workspace"])}
          bulkEditFields={[
            { name: "location", label: "Localização", type: "text" },
            { name: "current_position", label: "Cargo atual", type: "text" },
            { name: "current_company", label: "Empresa atual", type: "text" },
            { name: "source", label: "Origem", type: "text" },
          ]}
        />
      )}
      <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Selecionar todos os candidatos exibidos"
                  checked={
                    selection.allOnPageSelected
                      ? true
                      : selection.someOnPageSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={selection.toggleAllOnPage}
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((c) => {
              const status = statuses[c.id as string] ?? "new";
              return (
                <TableRow
                  key={c.id as string}
                  className="group"
                  data-state={selection.isSelected(c.id as string) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      aria-label={`Selecionar candidato ${c.full_name}`}
                      checked={selection.isSelected(c.id as string)}
                      onCheckedChange={() => selection.toggleOne(c.id as string)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      to="/candidates/$id"
                      params={{ id: c.id as string }}
                      className="text-text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {c.full_name as string}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60" aria-hidden />
                    </Link>
                    {c.email ? (
                      <div className="text-xs text-text-tertiary truncate max-w-[240px]">
                        {c.email as string}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {c.current_position ? (
                      <span className="text-sm">
                        {c.current_position}
                        {c.current_company ? (
                          <span className="text-text-tertiary"> @ {c.current_company}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {c.location ? (c.location as string) : <span className="text-text-tertiary">—</span>}
                  </TableCell>
                  <TableCell>
                    <CandidateStatusPill status={status} />
                  </TableCell>
                  <TableCell>
                    <AssigneeCell assignedTo={(c as { assigned_to?: string | null }).assigned_to} />
                  </TableCell>
                  <TableCell>
                    {c.source ? (
                      <SourceBadge source={c.source as string} />
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      aria-label={`Excluir candidato ${c.full_name}`}
                      onClick={() => onDelete(c.id as string)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
