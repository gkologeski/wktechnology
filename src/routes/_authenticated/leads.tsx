import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useServerFn } from "@tanstack/react-start";
import { listQueues, upsertQueue } from "@/lib/prospecting/queues.functions";
import { QUEUE_CREATE, QUEUE_UPDATE, QUEUE_VIEW } from "@/lib/prospecting/permission-keys";

import { useAuth } from "@/lib/auth";
import { useAutoCreateParam } from "@/hooks/use-auto-create-param";
import { useEnsureDefaultPipeline } from "@/lib/pipelines";
import { toast } from "sonner";
import { useLeadStages } from "@/lib/leads/stages";
import { stageOrExpr, stagesOrExpr } from "@/lib/leads/stage-query";

import { usePipelineSubstatuses } from "@/lib/pipelines/substatuses";

import type { Lead } from "@/lib/db-types";
import { BulkEditFieldsDialog } from "@/components/grid/bulk-edit-fields-dialog";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useHubspotOwners } from "@/hooks/use-hubspot-owners";
import { useGridProjection } from "@/hooks/use-grid-projection";
import { buildGridSelect } from "@/lib/grid/dynamic-select";

import { getDateRange, type CustomRange, type DatePreset } from "@/lib/date-presets";

import { convertLead } from "@/lib/lead-convert";
import { exportRowsToCsv } from "@/lib/csv-export";
import { deleteLeadsByIds } from "@/lib/lead-delete";
import { useSavedViews } from "@/lib/saved-views";
import { TablePagination } from "@/components/table-pagination";
import { startFocusQueue } from "@/lib/focus-queue";
import { confirmDialog } from "@/components/ui/confirm-dialog";

import {
  DECLARED_SORT_KEYS,
  BASE_LEAD_KEYS,
  DEFAULT_FILTERS,
  PROSPECTING_MODE_LIMIT,
  PROSPECTING_MODE_QUEUE_NAME,
  type Filters,
  type LeadGridRow,
  type SortDir,
  type SortKey,
  type ViewId,
} from "@/lib/leads/constants";
import { LeadsTopBar } from "@/components/leads/leads-top-bar";
import { LeadsViewTabs } from "@/components/leads/leads-view-tabs";
import { LeadsFiltersSidebar } from "@/components/leads/leads-filters-sidebar";
import { LeadsToolbar } from "@/components/leads/leads-toolbar";
import { LeadsTable } from "@/components/leads/leads-table";
import { LeadsBoard } from "@/components/leads/leads-board";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { LeadsDialogs, type PendingAction } from "@/components/leads/leads-dialogs";
import { useLeadColumns } from "@/components/leads/use-lead-columns";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function LeadsPage() {
  const location = useLocation();
  if (location.pathname !== "/leads") return <Outlet />;
  return <LeadsHubspotView />;
}

function LeadsHubspotView() {
  const { user } = useAuth();
  const { canAny: canAnyPermission } = usePermissions();
  const canProspectingMode =
    canAnyPermission([...QUEUE_VIEW]) && canAnyPermission([...QUEUE_CREATE, ...QUEUE_UPDATE]);
  /** RBAC de leads — a RLS continua sendo a fonte de verdade na escrita. */
  const canUpdateLeads = canAnyPermission([
    "techsales.leads.update.own",
    "techsales.leads.update.workspace",
  ]);
  const canDeleteLeads = canAnyPermission([
    "techsales.leads.delete.own",
    "techsales.leads.delete.workspace",
  ]);

  const listProspectingQueues = useServerFn(listQueues);
  const upsertProspectingQueue = useServerFn(upsertQueue);
  const [prospectingBusy, setProspectingBusy] = useState(false);
  const { nameFor, initialsFor } = useWorkspaceMembers();

  const hsOwners = useHubspotOwners().data ?? { list: [], byId: new Map() };

  const qc = useQueryClient();
  useRealtimeInvalidate([{ table: "leads", queryKeys: [["leads"]] }]);
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<ViewId>("all");
  const LEADS_VIEW_KEY = "leads:view";
  const [viewMode, setViewMode] = useState<"table" | "board">(() => {
    if (typeof window === "undefined") return "table";
    try {
      return localStorage.getItem(LEADS_VIEW_KEY) === "board" ? "board" : "table";
    } catch {
      return "table";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(LEADS_VIEW_KEY, viewMode);
    } catch {
      /* storage indisponível */
    }
  }, [viewMode]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const projection = useGridProjection({
    gridKey: "leads",
    entity: "leads",
    declaredSortKeys: DECLARED_SORT_KEYS,
  });
  // Reaplica a ordenação salva do usuário na primeira carga da preferência.
  const sortHydrated = useRef(false);
  useEffect(() => {
    if (sortHydrated.current || !projection.sortKey) return;
    sortHydrated.current = true;
    setSortKey(projection.sortKey);
    setSortDir(projection.sortDir ?? "asc");
  }, [projection.sortKey, projection.sortDir]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Seleção feita no Quadro (Kanban) — usada pelas ações do topo nesse modo. */
  const [boardSelectedIds, setBoardSelectedIds] = useState<string[]>([]);

  const [enrichIds, setEnrichIds] = useState<string[] | null>(null);
  const [prospectingIds, setProspectingIds] = useState<string[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  useAutoCreateParam(() => setCreateOpen(true));
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEnsureDefaultPipeline("lead");
  const { stages, pipelineId } = useLeadStages();
  const stagesKey = stages.map((s) => s.value).join(",");
  const { data: substatuses = [] } = usePipelineSubstatuses(pipelineId);

  const savedViews = useSavedViews("leads");
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);

  const applySavedView = (sv: { id: string; filters: unknown }) => {
    const f = sv.filters as {
      kind?: string;
      activeView?: ViewId;
      filters?: Filters;
      sortKey?: SortKey;
      sortDir?: SortDir;
    } | null;
    if (f?.activeView) setActiveView(f.activeView);
    if (f?.filters) setFilters({ ...DEFAULT_FILTERS, ...f.filters });
    if (f?.sortKey) setSortKey(f.sortKey);
    if (f?.sortDir) setSortDir(f.sortDir);
    setActiveSavedId(sv.id);
  };

  const saveCurrentView = () => {
    const name = window.prompt("Nome da nova visualização");
    if (!name || !name.trim()) return;
    savedViews.create.mutate(
      {
        name: name.trim(),
        is_shared: false,
        is_default: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filters: { kind: "leads-v1", activeView, filters, sortKey, sortDir } as any,
        quick_filters: [],
        column_order: null,
        sort_by: sortKey,
        sort_dir: sortDir,
      },
      {
        onSuccess: (sv) => {
          setActiveSavedId(sv.id);
          toast.success("Visualização salva");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
      },
    );
  };

  const deleteSavedView = async (id: string) => {
    if (!(await confirmDialog("Excluir esta visualização?"))) return;
    savedViews.remove.mutate(id, {
      onSuccess: () => {
        if (activeSavedId === id) setActiveSavedId(null);
        toast.success("Visualização excluída");
      },
    });
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [activeView, filters, debouncedSearch, sortKey, sortDir, pageSize]);

  // Fetch sources list once for filter (top values)
  const { data: sourceOptions } = useQuery({
    queryKey: ["leads", "sources"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leads_source_facets", {
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? [])
        .map((r: { value: string; count: number }) => ({
          value: r.value,
          count: Number(r.count),
        }))
        .slice(0, 20);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (q: any) => {
    // View
    if (activeView === "mine" && user?.id) q = q.eq("owner_id", user.id);
    if (activeView === "unassigned") q = q.is("owner_id", null);
    if (activeView === "open") q = q.not("status", "in", "(qualified,disqualified)");
    if (activeView === "new_week") {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      q = q.gte("created_at", since);
    }
    if (filters.status.length > 0) {
      q = q.or(stagesOrExpr(stages, filters.status));
    }

    if (filters.source.length > 0) q = q.in("source", filters.source);
    if (filters.substatusIds.length > 0) q = q.in("stage_substatus_id", filters.substatusIds);
    if (filters.scoreMin > 0) q = q.gte("score", filters.scoreMin);
    if (filters.scoreMax < 100) q = q.lte("score", filters.scoreMax);
    if (filters.createdPreset !== "any") {
      const { start, end } = getDateRange(filters.createdPreset, new Date(), filters.createdCustom);
      if (start) q = q.gte("created_at", start.toISOString());
      if (end) q = q.lt("created_at", end.toISOString());
    }
    {
      const userIds: string[] = [];
      const hsIds: string[] = [];
      for (const id of filters.ownerIds) {
        if (id.startsWith("hs:")) hsIds.push(id.slice(3));
        else userIds.push(id);
      }
      const parts: string[] = [];
      if (userIds.length > 0) parts.push(`owner_id.in.(${userIds.join(",")})`);
      if (hsIds.length > 0) parts.push(`hubspot_owner_id.in.(${hsIds.join(",")})`);
      if (filters.includeUnassigned) parts.push(`owner_id.is.null`);
      if (
        parts.length === 1 &&
        filters.includeUnassigned &&
        userIds.length === 0 &&
        hsIds.length === 0
      ) {
        q = q.is("owner_id", null);
      } else if (parts.length > 0) {
        q = q.or(parts.join(","));
      }
    }
    const term = debouncedSearch.trim().replace(/[,()]/g, " ").trim();
    if (term) {
      q = q.or(
        [
          `first_name.ilike.%${term}%`,
          `last_name.ilike.%${term}%`,
          `email.ilike.%${term}%`,
          `company_name.ilike.%${term}%`,
          `phone.ilike.%${term}%`,
        ].join(","),
      );
    }
    return q;
  };

  /**
   * IDs dos leads do filtro/ordenação atuais (usado por "Iniciar fila" e
   * "Modo Prospecção"). Pagina em blocos de 1.000 porque a API corta a
   * resposta nesse tamanho — sem isso a fila era truncada silenciosamente.
   */
  const fetchFilteredLeadIds = async (limit: number, stageValue?: string) => {
    const CHUNK = 1000;
    const ids: string[] = [];
    for (let offset = 0; offset < limit; offset += CHUNK) {
      const size = Math.min(CHUNK, limit - offset);
      let q = supabase.from("leads").select("id");
      q = applyFilters(q);
      if (stageValue) q = q.or(stageOrExpr(stages, stageValue));
      q = q.order(sortKey, { ascending: sortDir === "asc" }).range(offset, offset + size - 1);
      const { data, error } = await q;
      if (error) throw error;
      const batch = (data ?? []) as { id: string }[];
      for (const r of batch) ids.push(r.id);
      if (batch.length < size) break;
    }
    return ids;
  };

  /** IDs de todos os leads de uma etapa dentro do filtro atual. */
  const fetchStageLeadIds = (stageValue: string) => fetchFilteredLeadIds(5000, stageValue);

  /**
   * Carrega os leads na fila manual reutilizável "Modo Prospecção (rápida)" e
   * abre a tela de execução da Suíte de Prospecção.
   */
  const startProspectingMode = async (ids: string[]) => {
    if (!ids.length) {
      toast.error("Nenhum lead para prospectar.");
      return;
    }
    setProspectingBusy(true);
    try {
      const queues = await listProspectingQueues();
      const existing = (queues ?? []).find(
        (q) =>
          q.name === PROSPECTING_MODE_QUEUE_NAME &&
          q.entity === "lead" &&
          q.kind === "manual" &&
          (!user?.id || q.owner_id === user.id),
      );
      const saved = await upsertProspectingQueue({
        data: {
          ...(existing ? { id: existing.id } : {}),
          name: PROSPECTING_MODE_QUEUE_NAME,
          entity: "lead" as const,
          kind: "manual" as const,
          item_ids: ids,
          is_shared: false,
        },
      });
      await qc.invalidateQueries({ queryKey: ["prospecting"] });
      navigate({
        to: "/prospecting/queues/$queueId/play",
        params: { queueId: saved.id },
      });
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível abrir o Modo Prospecção.");
    } finally {
      setProspectingBusy(false);
    }
  };

  const {
    data: result,
    isLoading,
    isError,
    error: listError,
    refetch,
  } = useQuery({
    queryKey: [
      "leads",
      "hubspot-list",
      activeView,
      filters,
      sortKey,
      sortDir,
      debouncedSearch,
      page,
      pageSize,
      user?.id,
      stagesKey,
      projection.selectSignature,
      projection.needsCustomFields,
      projection.knownColumns.length,
    ],
    queryFn: async () => {
      let q = supabase
        .from("leads")
        // Projeção dinâmica: colunas base + colunas escolhidas no editor,
        // sempre validadas contra o catálogo real da entidade.
        .select(
          buildGridSelect(BASE_LEAD_KEYS, projection.selectKeys, {
            customFields: projection.needsCustomFields,
            allowed: projection.knownColumns,
          }),
          { count: "exact" },
        );

      q = applyFilters(q);
      q = q.order(sortKey, { ascending: sortDir === "asc" });
      q = q.range(page * pageSize, page * pageSize + pageSize - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as LeadGridRow[], count: count ?? 0 };
    },
  });

  const rows = result?.rows ?? [];
  const total = result?.count ?? 0;

  /**
   * Quadro (Kanban): consulta própria por etapa, com contagem exata no banco.
   * Sem isso o cabeçalho da coluna exibia apenas os cards da página atual,
   * divergindo do total mostrado pelo filtro lateral.
   */
  const BOARD_PER_STAGE = 100;
  const { data: boardColumns, isLoading: boardLoading } = useQuery({
    enabled: viewMode === "board" && stages.length > 0,
    queryKey: [
      "leads",
      "board",
      activeView,
      filters,
      sortKey,
      sortDir,
      debouncedSearch,
      user?.id,
      stagesKey,
    ],
    queryFn: async () => {
      return await Promise.all(
        stages.map(async (s) => {
          let q = supabase
            .from("leads")
            .select(buildGridSelect(BASE_LEAD_KEYS, [], {}), { count: "exact" });
          q = applyFilters(q);
          q = q.or(stageOrExpr(stages, s.value));
          q = q.order(sortKey, { ascending: sortDir === "asc" }).range(0, BOARD_PER_STAGE - 1);
          const { data, error, count } = await q;
          if (error) throw error;
          return {
            value: s.value,
            rows: (data ?? []) as unknown as LeadGridRow[],
            total: count ?? 0,
          };
        }),
      );
    },
  });

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));

  const exportCsv = () => {
    if (!rows.length) return toast.error("Nenhum registro para exportar");
    exportRowsToCsv("leads", rows as unknown as Record<string, unknown>[], [
      { key: "first_name", label: "Nome" },
      { key: "last_name", label: "Sobrenome" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Telefone" },
      { key: "mobile_phone", label: "Celular" },
      { key: "company", label: "Empresa" },

      { key: "status", label: "Status" },
      { key: "source", label: "Origem" },
      { key: "score", label: "Score" },
      { key: "created_at", label: "Criado em" },
      { key: "updated_at", label: "Atualizado em" },
    ]);
  };

  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) for (const r of rows) next.delete(r.id);
      else for (const r of rows) next.add(r.id);
      return next;
    });
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const selectAllMatching = async () => {
    try {
      setIsSelectingAll(true);
      const ids: string[] = [];
      const CHUNK = 1000;
      for (let offset = 0; ; offset += CHUNK) {
        let q = supabase.from("leads").select("id");
        q = applyFilters(q);
        const { data, error } = await q.range(offset, offset + CHUNK - 1);
        if (error) throw error;
        const batch = (data ?? []) as { id: string }[];
        for (const r of batch) ids.push(r.id);
        if (batch.length < CHUNK) break;
        if (ids.length >= 100_000) break;
      }
      setSelectedIds(new Set(ids));
      toast.success(`${ids.length} registros selecionados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao selecionar todos");
    } finally {
      setIsSelectingAll(false);
    }
  };

  const onSort = (key: SortKey) => {
    const nextDir: SortDir = sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortKey(key);
    setSortDir(nextDir);
    persistSort(key, nextDir);
  };

  // ----- Columns ----------------------------------------------------------
  const {
    columns: visibleColumns,
    ColumnsButton,
    ColumnsEditor,
    persistSort,
  } = useLeadColumns({
    sortKey,
    sortDir,
    onSort,
    stages,
    nameFor,
    initialsFor,
    hsOwners,
  });

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.substatusIds.length > 0 ||
    filters.source.length > 0 ||
    filters.scoreMin > 0 ||
    filters.scoreMax < 100 ||
    filters.createdPreset !== "any";

  const convert = (lead: Lead) => {
    if (!user) return;
    setPendingAction({
      title: "Converter lead",
      description:
        `Será criado um Contato${lead.company_name ? " vinculado à empresa correspondente (reutilizada se já existir)" : ""} e um Negócio em estágio Qualificado para "${lead.first_name ?? ""} ${lead.last_name ?? ""}".`.trim(),
      confirmLabel: "Converter",
      run: async () => {
        const res = await convertLead(lead, user.id);
        toast.success(res.reusedCompany ? "Convertido (empresa reutilizada)" : "Lead convertido!");
        qc.invalidateQueries();
      },
    });
  };

  /** Nomes dos responsáveis exibidos nos cards do quadro. */
  const ownerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const id = (r as { owner_id?: string | null }).owner_id;
      if (id && !map.has(id)) map.set(id, nameFor(id) ?? "—");
    }
    return map;
  }, [rows, nameFor]);

  const refreshLeads = async () => {
    await qc.refetchQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "leads",
      type: "all",
    });
  };

  const removeDeletedFromCache = (ids: string[]) => {
    const set = new Set(ids);
    qc.getQueriesData<{ rows: Lead[]; count: number }>({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "leads" && q.queryKey[1] === "hubspot-list",
    }).forEach(([key, data]) => {
      if (!data?.rows) return;
      const filtered = data.rows.filter((r) => !set.has(r.id));
      const removed = data.rows.length - filtered.length;
      if (removed === 0) return;
      qc.setQueryData(key, {
        rows: filtered,
        count: Math.max(0, (data.count ?? 0) - removed),
      });
    });
  };

  const removeOne = (id: string) => {
    setPendingAction({
      title: "Excluir lead",
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      run: async () => {
        await deleteLeadsByIds(supabase, [id]);
        toast.success("Removido");
        setSelectedIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        removeDeletedFromCache([id]);
        await refreshLeads();
      },
    });
  };

  const bulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setPendingAction({
      title: `Excluir ${ids.length} lead(s)`,
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      destructive: true,
      run: async () => {
        const n = await deleteLeadsByIds(supabase, ids);
        toast.success(`${n} excluído(s)`);
        clearSelection();
        removeDeletedFromCache(ids);
        await refreshLeads();
      },
    });
  };

  const runPendingAction = async () => {
    if (!pendingAction) return;
    setActionBusy(true);
    try {
      await pendingAction.run();
      setPendingAction(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao executar");
    } finally {
      setActionBusy(false);
    }
  };

  /** Seleção ativa conforme o modo de visualização (quadro ou tabela). */
  const effectiveSelectedIds = viewMode === "board" ? boardSelectedIds : Array.from(selectedIds);

  /** Teto de segurança da fila quando não há seleção. */
  const QUEUE_LIMIT = 5000;

  const startQueueWithIds = (ids: string[], truncated = false) => {
    if (!ids.length) {
      toast.error("Nenhum lead para percorrer.");
      return;
    }
    startFocusQueue("leads", ids, `Leads · ${ids.length.toLocaleString("pt-BR")}`);
    toast.success(
      truncated
        ? `Fila iniciada com ${ids.length} lead(s) — limite máximo atingido`
        : `Fila iniciada com ${ids.length} lead(s)`,
    );
    navigate({ to: "/leads/$id", params: { id: ids[0] } });
  };

  return (
    <div className="flex h-full flex-col">
      <LeadsTopBar
        isLoading={isLoading}
        total={total}
        selectedCount={effectiveSelectedIds.length}
        onExportCsv={exportCsv}
        onStartQueue={async () => {
          try {
            if (effectiveSelectedIds.length) {
              startQueueWithIds(effectiveSelectedIds);
              return;
            }
            const ids = await fetchFilteredLeadIds(QUEUE_LIMIT);
            startQueueWithIds(ids, ids.length >= QUEUE_LIMIT);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
        canProspectingMode={canProspectingMode}
        prospectingBusy={prospectingBusy}
        onStartProspectingMode={async () => {
          try {
            const ids = effectiveSelectedIds.length
              ? effectiveSelectedIds.slice(0, PROSPECTING_MODE_LIMIT)
              : await fetchFilteredLeadIds(PROSPECTING_MODE_LIMIT);
            await startProspectingMode(ids);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
        onCreateLead={() => setCreateOpen(true)}
      />

      <LeadsViewTabs
        activeView={activeView}
        setActiveView={setActiveView}
        activeSavedId={activeSavedId}
        setActiveSavedId={setActiveSavedId}
        savedViews={savedViews}
        applySavedView={applySavedView}
        deleteSavedView={deleteSavedView}
        saveCurrentView={saveCurrentView}
      />

      {/* ─── Body: sidebar + table ─── */}
      <div className="flex min-h-0 flex-1">
        <LeadsFiltersSidebar
          filters={filters}
          setFilters={setFilters}
          stages={stages}
          sourceOptions={sourceOptions}
          hasActiveFilters={hasActiveFilters}
          substatusOptions={substatuses}
        />

        {/* Main panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          <LeadsToolbar
            search={search}
            setSearch={setSearch}
            ColumnsButton={ColumnsButton}

            onExportCsv={exportCsv}
            ViewToggle={
              <div
                className="flex items-center gap-1"
                role="group"
                aria-label="Modo de visualização"
              >
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2 text-xs"
                  aria-pressed={viewMode === "table"}
                  onClick={() => setViewMode("table")}
                >
                  <TableIcon className="h-3.5 w-3.5 mr-1" /> Tabela
                </Button>
                <Button
                  variant={viewMode === "board" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2 text-xs"
                  aria-pressed={viewMode === "board"}
                  onClick={() => setViewMode("board")}
                >
                  <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Quadro
                </Button>
              </div>
            }
          />

          {viewMode === "board" ? (
            <div className="min-h-0 flex-1 overflow-hidden p-3">
              {boardLoading && !boardColumns ? (
                <p className="text-sm text-muted-foreground">Carregando leads…</p>
              ) : (
                <LeadsBoard
                  stages={stages}
                  pipelineId={pipelineId}
                  leads={rows}
                  columns={boardColumns}
                  ownerNames={ownerNameMap}
                  canUpdate={canUpdateLeads}
                  canDelete={canDeleteLeads}

                  canProspectingMode={canProspectingMode}
                  prospectingBusy={prospectingBusy}
                  onFetchStageIds={fetchStageLeadIds}
                  onSelectionChange={setBoardSelectedIds}
                  onStartQueue={(ids) => {
                    if (!ids.length) {
                      toast.error("Selecione ao menos um lead.");
                      return;
                    }
                    startQueueWithIds(ids);
                  }}
                  onStartProspecting={(ids) =>
                    void startProspectingMode(ids.slice(0, PROSPECTING_MODE_LIMIT))
                  }
                  onOpen={(id) => navigate({ to: "/leads/$id", params: { id } })}
                  onRequestQualification={(id) => navigate({ to: "/leads/$id", params: { id } })}
                />
              )}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <LeadsTable
                visibleColumns={visibleColumns}
                rows={rows}
                isLoading={isLoading}
                isError={isError}
                listError={listError}
                refetch={refetch}
                allSelected={allSelected}
                someSelected={someSelected}
                selectedIds={selectedIds}
                toggleAll={toggleAll}
                toggleOne={toggleOne}
                onOpenLead={(id) => navigate({ to: "/leads/$id", params: { id } })}
                onConvertLead={convert}
                onRemoveLead={removeOne}
              />
            </div>
          )}

          {/* Paginação vale apenas para o modo Tabela: o Quadro traz cada etapa
              com contagem própria e não usa páginas. */}
          {viewMode === "table" && (
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              entityLabel="leads"
            />
          )}
        </div>
      </div>

      {/* Ações em massa do modo Tabela: barra flutuante padrão do sistema. */}
      {viewMode === "table" && (
        <LeadsBulkBar
          selectedCount={selectedIds.size}
          total={total}
          isSelectingAll={isSelectingAll}
          onSelectAllMatching={() => void selectAllMatching()}
          onStartQueueFromSelection={() => {
            const ids = Array.from(selectedIds);
            if (!ids.length) return;
            startFocusQueue("leads", ids, `Leads · ${ids.length.toLocaleString("pt-BR")}`);
            toast.success(`Fila iniciada com ${ids.length} lead(s)`);
            navigate({ to: "/leads/$id", params: { id: ids[0] } });
          }}
          canProspectingMode={canProspectingMode}
          prospectingBusy={prospectingBusy}
          onProspectingFromSelection={() =>
            void startProspectingMode(Array.from(selectedIds).slice(0, PROSPECTING_MODE_LIMIT))
          }
          onEnrichSelection={() => setEnrichIds(Array.from(selectedIds))}
          onAddToProspectingSelection={() => setProspectingIds(Array.from(selectedIds))}
          onBulkDelete={bulkDelete}
          onBulkEdit={() => setBulkEditOpen(true)}
          onClearSelection={clearSelection}
        />
      )}

      <ColumnsEditor />


      <LeadsDialogs
        bulkEditOpen={bulkEditOpen}
        setBulkEditOpen={setBulkEditOpen}
        selectedIds={selectedIds}
        onBulkEditDone={() => {
          clearSelection();
          qc.invalidateQueries({ queryKey: ["leads"] });
        }}
        enrichIds={enrichIds}
        setEnrichIds={setEnrichIds}
        onEnrichDone={() => qc.invalidateQueries({ queryKey: ["leads"] })}
        prospectingIds={prospectingIds}
        setProspectingIds={setProspectingIds}
        createOpen={createOpen}
        setCreateOpen={setCreateOpen}
        onLeadCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["leads"] });
          navigate({ to: "/leads/$id", params: { id } });
        }}
        pendingAction={pendingAction}
        actionBusy={actionBusy}
        onOpenChangePendingAction={(v) => !actionBusy && !v && setPendingAction(null)}
        onRunPendingAction={runPendingAction}
      />
    </div>
  );
}
