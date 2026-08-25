import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { Plus, Download, Users } from "lucide-react";

import { toast } from "sonner";
import { useAssigneeFilter } from "@/components/entity/assignee-filter";
import { Button } from "@/components/ui/button";
import {
  listAtsCandidates,
  saveAtsCandidate,
  deleteAtsCandidate,
  setCandidateArchived,
} from "@/lib/ats/ats.functions";
import { AssociateCandidateJobDialog } from "@/components/ats/associate-candidate-job-dialog";

import { parseCv } from "@/lib/ats/cv-parse.functions";
import { parseCvFromPdf } from "@/lib/ats/cv-parse-pdf.functions";
import { previewLinkedinProfile } from "@/lib/ats/candidates-linkedin-preview.functions";
import { exportAtsCandidatesCsv } from "@/lib/ats/export.functions";
import {
  getCandidateStatuses,
  type DerivedCandidateStatus,
} from "@/lib/ats/candidate-status.functions";
import { AtsPageHeader, EmptyState } from "@/components/ats/ui";
import { computeCandidateSignals } from "@/lib/kanban/candidates-signals";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { CreateCandidateDialog } from "@/components/ats/candidates/create-candidate-dialog";
import { CandidatesFilterBar } from "@/components/ats/candidates/candidates-filter-bar";
import { CandidatesGridSkeleton } from "@/components/ats/candidates/candidates-grid-skeleton";
import { CandidatesCardsView } from "@/components/ats/candidates/candidates-cards-view";
import { CandidatesTableView } from "@/components/ats/candidates/candidates-table-view";
import { CandidatesKanbanView } from "@/components/ats/candidates/candidates-kanban-view";
import type { Cand } from "@/components/ats/candidates/types";

export const Route = createFileRoute("/_authenticated/(ats)/candidates/")({
  component: CandidatesPage,
});

function CandidatesPage() {
  const list = useServerFn(listAtsCandidates);
  const save = useServerFn(saveAtsCandidate);
  const del = useServerFn(deleteAtsCandidate);
  const parse = useServerFn(parseCv);
  const parsePdf = useServerFn(parseCvFromPdf);
  const previewLinkedin = useServerFn(previewLinkedinProfile);
  const exportCsv = useServerFn(exportAtsCandidatesCsv);
  const getStatuses = useServerFn(getCandidateStatuses);
  const archiveCandidate = useServerFn(setCandidateArchived);
  const queryClient = useQueryClient();
  useRealtimeInvalidate([{ table: "ats_candidates", queryKeys: [["ats-candidates"]] }]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<DerivedCandidateStatus | null>(null);
  const [associateState, setAssociateState] = useState<{
    open: boolean;
    candidateId?: string;
    candidateName?: string;
  }>({ open: false });

  const [view, setView] = useState<"cards" | "table" | "kanban">(() =>
    typeof window !== "undefined"
      ? ((localStorage.getItem("candidates:view") as "cards" | "table" | "kanban") ?? "cards")
      : "cards",
  );

  const [statusFilter, setStatusFilter] = useState<DerivedCandidateStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ["ats-candidates", debouncedSearch],
    queryFn: () => list({ data: { search: debouncedSearch } }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const rows: Cand[] = q.data ?? [];

  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  const loading = q.isLoading;
  const error = q.error ? (q.error instanceof Error ? q.error.message : "Falha ao listar") : null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ats-candidates"] });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("candidates:view", view);
  }, [view]);

  const ids = useMemo(() => rows.map((r) => r.id as string), [rows]);
  const idsKey = ids.join(",");
  const statusQ = useQuery({
    queryKey: ["ats-candidate-statuses", idsKey],
    queryFn: () => getStatuses({ data: { ids } }),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
  const statuses: Record<string, DerivedCandidateStatus> = statusQ.data ?? {};

  const byStatusRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => (statuses[r.id as string] ?? "new") === statusFilter);
  }, [rows, statuses, statusFilter]);
  const visibleRows = filterRows(byStatusRows);

  const { canAny } = usePermissions();
  const selection = useGridSelection(visibleRows as Array<Cand & { id: string }>);

  const statusCounts = useMemo(() => {
    const c: Record<DerivedCandidateStatus, number> = {
      new: 0,
      in_process: 0,
      interview: 0,
      offer: 0,
      hired: 0,
      archived: 0,
    };
    for (const r of rows) c[statuses[r.id as string] ?? "new"]++;
    return c;
  }, [rows, statuses]);

  const CAND_FOCUS_KEY = "candidates:focusMode";
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(CAND_FOCUS_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CAND_FOCUS_KEY, focusMode ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [focusMode]);

  const candSignals = useMemo(
    () =>
      computeCandidateSignals(
        rows.map((r) => ({
          id: r.id as string,
          updated_at: (r as { updated_at?: string | null }).updated_at ?? null,
          created_at: (r as { created_at?: string | null }).created_at ?? null,
        })),
        (c) => statuses[c.id] ?? "new",
      ),
    [rows, statuses],
  );

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog("Excluir este candidato?"))) return;
    try {
      await del({ data: { id } });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  const handleExport = async () => {
    try {
      const r = await exportCsv();
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    }
  };

  const total = rows.length;
  const descriptionText = loading
    ? "Carregando candidatos…"
    : `${total} ${total === 1 ? "candidato" : "candidatos"}`;

  return (
    <div className="flex flex-col gap-6">
      <AtsPageHeader
        eyebrow="Talentos"
        title="Candidatos"
        description={descriptionText}
        descriptionLive
        secondaryActions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            CSV
          </Button>
        }
        primaryAction={
          <CreateCandidateDialog
            open={open}
            onOpenChange={setOpen}
            save={save}
            parse={parse}
            parsePdf={parsePdf}
            previewLinkedin={previewLinkedin}
            onSaved={refresh}
          />
        }
      />

      <CandidatesFilterBar
        search={search}
        onSearchChange={setSearch}
        rows={rows}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusCounts={statusCounts}
        assignee={assignee}
        onAssigneeChange={setAssignee}
        view={view}
        onViewChange={setView}
      />

      {loading ? (
        <CandidatesGridSkeleton />
      ) : error ? (
        <EmptyState
          icon={Users}
          title="Não foi possível carregar os candidatos"
          description={error}
          action={<Button onClick={refresh}>Tentar novamente</Button>}
        />
      ) : visibleRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            search || statusFilter !== "all"
              ? "Nenhum candidato encontrado"
              : "Nenhum candidato cadastrado"
          }
          description={
            search || statusFilter !== "all"
              ? "Tente outros termos ou limpe o filtro."
              : "Cadastre um candidato manualmente ou use o parsing de CV (IA) para importar a partir de um currículo."
          }
          action={
            search || statusFilter !== "all" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Novo candidato
              </Button>
            )
          }
        />
      ) : view === "cards" ? (
        <CandidatesCardsView
          visibleRows={visibleRows}
          statuses={statuses}
          onDelete={handleDelete}
        />
      ) : view === "table" ? (
        <CandidatesTableView
          visibleRows={visibleRows}
          statuses={statuses}
          selection={selection}
          refresh={refresh}
          canAny={canAny}
          onDelete={handleDelete}
        />
      ) : (
        <CandidatesKanbanView
          rows={rows}
          statuses={statuses}
          focusMode={focusMode}
          onFocusModeChange={setFocusMode}
          candSignals={candSignals}
          draggingId={draggingId}
          setDraggingId={setDraggingId}
          dragOverCol={dragOverCol}
          setDragOverCol={setDragOverCol}
          archiveCandidate={archiveCandidate}
          queryClient={queryClient}
          onNeedsAssociation={(candidateId, candidateName) =>
            setAssociateState({ open: true, candidateId, candidateName })
          }
        />
      )}

      <AssociateCandidateJobDialog
        open={associateState.open}
        onOpenChange={(v) => setAssociateState((s) => ({ ...s, open: v }))}
        presetCandidateId={associateState.candidateId}
        presetCandidateName={associateState.candidateName}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["ats-candidate-statuses"] });
          void queryClient.invalidateQueries({ queryKey: ["ats-candidates"] });
        }}
      />
    </div>
  );
}
