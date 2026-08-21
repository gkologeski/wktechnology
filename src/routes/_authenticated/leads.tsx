import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Can, usePermissions } from "@/lib/access-control/use-permissions";
import { useServerFn } from "@tanstack/react-start";
import { listQueues, upsertQueue } from "@/lib/prospecting/queues.functions";
import { QUEUE_CREATE, QUEUE_UPDATE, QUEUE_VIEW } from "@/lib/prospecting/permission-keys";

/** Fila manual reutilizável usada pelo atalho "Modo Prospecção" a partir de /leads. */
const PROSPECTING_MODE_QUEUE_NAME = "Modo Prospecção (rápida)";
const PROSPECTING_MODE_LIMIT = 500;

import { useAuth } from "@/lib/auth";
import { useEnsureDefaultPipeline } from "@/lib/pipelines";
import { toast } from "sonner";
import {
  useLeadStages,
  resolveLeadStageValue,
  deriveLeadStatus,
  findLeadStage,
  LEGACY_STATUS_LABELS,
  type LeadStage,
} from "@/lib/leads/stages";

import type { Lead } from "@/lib/db-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BulkEditFieldsDialog } from "@/components/grid/bulk-edit-fields-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BulkEnrichDialog } from "@/components/enrichment/bulk-enrich-dialog";
import { AddToProspectingDialog } from "@/components/prospecting/add-to-prospecting-dialog";
import { useMyTools } from "@/lib/use-my-tools";
import { CreateLeadDialog } from "@/components/leads/create-lead-dialog";
import { useAutoCreateParam } from "@/hooks/use-auto-create-param";
import { OwnerFilter, type OwnerFilterValue } from "@/components/owner-filter";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useHubspotOwners } from "@/hooks/use-hubspot-owners";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";
import { useGridProjection } from "@/hooks/use-grid-projection";
import { buildGridSelect } from "@/lib/grid/dynamic-select";

import { getDateRange, type CustomRange, type DatePreset } from "@/lib/date-presets";
import { DateFilter } from "@/components/date-filter";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { convertLead } from "@/lib/lead-convert";
import { exportRowsToCsv } from "@/lib/csv-export";
import { deleteLeadsByIds } from "@/lib/lead-delete";
import { toE164 } from "@/lib/validators";
import { useSavedViews } from "@/lib/saved-views";
import { TablePagination } from "@/components/table-pagination";
import { startFocusQueue } from "@/lib/focus-queue";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { translateFieldValue } from "@/lib/i18n/hubspot-values";
import {
  ArrowRightLeft,
  ChevronDown,
  Headphones,
  Play,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<string, { dot: string; bg: string; text: string }> = {
  new: { dot: "bg-sky-500", bg: "bg-sky-500/10", text: "text-sky-700 dark:text-sky-300" },
  contacted: {
    dot: "bg-violet-500",
    bg: "bg-violet-500/10",
    text: "text-violet-700 dark:text-violet-300",
  },
  qualified: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  disqualified: {
    dot: "bg-rose-500",
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
  },
};

type ViewId = "all" | "open" | "mine" | "unassigned" | "new_week";
const VIEWS: { id: ViewId; label: string }[] = [
  { id: "all", label: "Todos os leads" },
  { id: "open", label: "Abertos" },
  { id: "mine", label: "Meus leads" },
  { id: "unassigned", label: "Sem responsável" },
  { id: "new_week", label: "Novos esta semana" },
];

/** Colunas fixas ordenáveis do grid; colunas do catálogo entram como string. */
type SortKey = string;
const DECLARED_SORT_KEYS = ["first_name", "created_at", "score"] as const;
/** Colunas sempre projetadas (ações, filtros, seleção e células fixas). */
const BASE_LEAD_KEYS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "company_name",
  "company_id",
  "status",
  "stage_id",
  "source",
  "score",

  "label",
  "owner_id",
  "assigned_to",
  "assigned_user_id",
  "hubspot_owner_id",
  "created_at",
  "updated_at",
] as const;
type SortDir = "asc" | "desc";

type Filters = {
  status: string[];
  source: string[];
  scoreMin: number;
  scoreMax: number;
  createdPreset: DatePreset;
  createdCustom: CustomRange;
  ownerIds: string[];
  includeUnassigned: boolean;
};

const DEFAULT_FILTERS: Filters = {
  status: [],
  source: [],
  scoreMin: 0,
  scoreMax: 100,
  createdPreset: "any",
  createdCustom: {},
  ownerIds: [],
  includeUnassigned: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.round(mo / 12)}a`;
}

function initialsOf(lead: Lead) {
  const a = (lead.first_name ?? "").trim()[0] ?? "";
  const b = (lead.last_name ?? "").trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

function colorFromString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 70% 45%)`;
}

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
  const { can } = useMyTools();
  const { canAny: canAnyPermission } = usePermissions();
  const canProspectingMode =
    canAnyPermission([...QUEUE_VIEW]) && canAnyPermission([...QUEUE_CREATE, ...QUEUE_UPDATE]);
  const listProspectingQueues = useServerFn(listQueues);
  const upsertProspectingQueue = useServerFn(upsertQueue);
  const [prospectingBusy, setProspectingBusy] = useState(false);
  const { nameFor, initialsFor } = useWorkspaceMembers();

  const hsOwners = useHubspotOwners().data ?? { list: [], byId: new Map() };

  const qc = useQueryClient();
  useRealtimeInvalidate([{ table: "leads", queryKeys: [["leads"]] }]);
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<ViewId>("all");
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
  const [enrichIds, setEnrichIds] = useState<string[] | null>(null);
  const [prospectingIds, setProspectingIds] = useState<string[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  useAutoCreateParam(() => setCreateOpen(true));
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    run: () => Promise<void>;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEnsureDefaultPipeline("lead");
  const { stages } = useLeadStages();
  const stagesKey = stages.map((s) => s.value).join(",");

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
      const stageVals = filters.status;
      const derived = Array.from(
        new Set(stageVals.map((v) => deriveLeadStatus(findLeadStage(stages, v)))),
      );
      q = q.or(
        `stage_id.in.(${stageVals.join(",")}),and(stage_id.is.null,status.in.(${derived.join(",")}))`,
      );
    }

    if (filters.source.length > 0) q = q.in("source", filters.source);
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

  /** IDs dos leads do filtro/ordenação atuais (usado por "Iniciar fila" e "Modo Prospecção"). */
  const fetchFilteredLeadIds = async (limit: number) => {
    let q = supabase.from("leads").select("id");
    q = applyFilters(q);
    q = q.order(sortKey, { ascending: sortDir === "asc" }).limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => r.id as string);
  };

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
      return { rows: (data ?? []) as unknown as Lead[], count: count ?? 0 };
    },
  });

  const rows = result?.rows ?? [];
  const total = result?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));

  const exportCsv = () => {
    if (!rows.length) return toast.error("Nenhum registro para exportar");
    exportRowsToCsv("leads", rows as unknown as Record<string, unknown>[], [
      { key: "first_name", label: "Nome" },
      { key: "last_name", label: "Sobrenome" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Telefone" },
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

  /** Cabeçalho ordenável para as colunas do catálogo dinâmico ("Outros campos"). */
  const autoSortHeader = useCallback(
    (col: { key: string; label: string }) => (
      <Th sortable active={sortKey === col.key} dir={sortDir} onClick={() => onSort(col.key)}>
        {col.label}
      </Th>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortKey, sortDir],
  );

  // ----- Columns ----------------------------------------------------------
  type LeadRow = (typeof rows)[number];
  const leadColumns = useMemo<GridColumnDef<LeadRow>[]>(
    () => [
      {
        key: "name",
        label: "Nome",
        header: (
          <Th
            sortable
            active={sortKey === "first_name"}
            dir={sortDir}
            onClick={() => onSort("first_name")}
          >
            Nome
          </Th>
        ),
        render: (lead) => {
          const full = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Sem nome";
          return (
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: colorFromString(lead.id) }}
              >
                {initialsOf(lead as Lead)}
              </span>
              <Link
                to="/leads/$id"
                params={{ id: lead.id }}
                className="truncate font-medium text-primary hover:underline"
              >
                {full}
              </Link>
            </div>
          );
        },
      },
      {
        key: "email",
        label: "E-mail",
        className: "text-muted-foreground",
        render: (lead) => (lead.email ? <span className="truncate">{lead.email}</span> : "—"),
      },
      {
        key: "phone",
        label: "Telefone",
        className: "text-muted-foreground",
        render: (lead) => (lead.phone ? (toE164(lead.phone) ?? lead.phone) : "—"),
      },
      {
        key: "company",
        label: "Empresa",
        render: (lead) =>
          lead.company_name ? (
            <span className="truncate">{lead.company_name}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "status",
        label: "Etapa do lead",
        render: (lead) => {
          const v = resolveLeadStageValue(
            lead as unknown as { stage_id?: string | null; status?: string | null },
            stages,
          );
          return <StagePill stage={findLeadStage(stages, v)} value={v} />;
        },
      },

      {
        key: "score",
        label: "Score",
        header: (
          <Th sortable active={sortKey === "score"} dir={sortDir} onClick={() => onSort("score")}>
            Score
          </Th>
        ),
        render: (lead) => <ScoreCell score={lead.score ?? 0} />,
      },
      {
        key: "owner",
        label: "Responsável",
        render: (lead) => {
          const assigned = lead.assigned_user_id as string | null | undefined;
          const ownerUserId = (lead as unknown as { owner_id?: string | null }).owner_id;
          const hsId = (lead as unknown as { hubspot_owner_id?: string | null }).hubspot_owner_id;
          // Prioriza o usuário responsável (assigned ou owner) sobre o owner do HubSpot,
          // que muitas vezes guarda apenas o histórico do registro importado.
          const userId = assigned || ownerUserId || null;
          if (userId) {
            return (
              <div className="flex items-center gap-2" title={nameFor(userId)}>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ background: colorFromString(userId) }}
                >
                  {initialsFor(userId)}
                </span>
                <span className="truncate text-sm">{nameFor(userId)}</span>
              </div>
            );
          }
          if (hsId) {
            const o = hsOwners.byId?.get(hsId);
            const name = o
              ? `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || o.email || hsId
              : hsId;
            return (
              <div className="flex items-center gap-2" title={`${name} (HubSpot)`}>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ background: colorFromString(hsId) }}
                >
                  {(name?.slice(0, 2) ?? "HS").toUpperCase()}
                </span>
                <span className="truncate text-sm">{name}</span>
                <span className="rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">
                  HS
                </span>
              </div>
            );
          }
          return <span className="text-muted-foreground">—</span>;
        },
      },
      {
        key: "created_at",
        label: "Criado em",
        className: "text-muted-foreground",
        header: (
          <Th
            sortable
            active={sortKey === "created_at"}
            dir={sortDir}
            onClick={() => onSort("created_at")}
          >
            Criado em
          </Th>
        ),
        render: (lead) => timeAgo(lead.created_at),
      },
      {
        key: "updated_at",
        label: "Atualizado em",
        className: "text-muted-foreground",
        render: (lead) => timeAgo(lead.updated_at),
      },
      {
        key: "source",
        label: "Origem",
        className: "text-muted-foreground",
        render: (lead) => translateFieldValue("source", lead.source) || "—",
      },
      {
        key: "label",
        label: "Rótulo",
        render: (lead) =>
          lead.label ? (
            <Badge variant="secondary" className="font-normal">
              {lead.label}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortKey, sortDir, nameFor, initialsFor],
  );

  const DEFAULT_LEAD_COLS = [
    "name",
    "email",
    "phone",
    "company",
    "status",
    "score",
    "owner",
    "created_at",
  ];

  const {
    columns: visibleColumns,
    ColumnsButton,
    ColumnsEditor,
    persistSort,
  } = useGridColumns<LeadRow>({
    gridKey: "leads",
    columns: leadColumns,
    defaults: DEFAULT_LEAD_COLS,
    customEntity: "leads",
    catalogEntity: "leads",
    sortHeader: autoSortHeader,
  });

  const hasActiveFilters =
    filters.status.length > 0 ||
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

  return (
    <div className="flex h-full flex-col">
      {/* ─── Top bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${total.toLocaleString("pt-BR")} registros`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("import") && (
            <Can permission="techsales.leads.create.own">
              <Button variant="outline" size="sm" asChild>
                <Link to="/leads/import-hubspot">
                  <Upload className="mr-1.5 h-4 w-4" /> Importar HubSpot
                </Link>
              </Button>
            </Can>
          )}
          {can("export") && (
            <Can permission="techsales.leads.export.workspace">
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="mr-1.5 h-4 w-4" /> Exportar
              </Button>
            </Can>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const ids = await fetchFilteredLeadIds(5000);
                if (!ids.length) return toast.error("Nenhum lead para percorrer.");
                startFocusQueue("leads", ids, `Leads · ${ids.length.toLocaleString("pt-BR")}`);
                toast.success(`Fila iniciada com ${ids.length} lead(s)`);
                navigate({ to: "/leads/$id", params: { id: ids[0] } });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            disabled={isLoading || total === 0}
            title="Percorrer todos os leads do filtro atual, um a um"
          >
            <Play className="mr-1.5 h-4 w-4" /> Iniciar fila
          </Button>
          {canProspectingMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const ids = await fetchFilteredLeadIds(PROSPECTING_MODE_LIMIT);
                  await startProspectingMode(ids);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              disabled={isLoading || total === 0 || prospectingBusy}
              title="Trabalhar os leads do filtro atual na tela de Prospecção (questionário, qualificação e timeline)"
            >
              <Headphones className="mr-1.5 h-4 w-4" />
              {prospectingBusy ? "Preparando…" : "Modo Prospecção"}
            </Button>
          )}

          <Can permission="techsales.leads.create.own">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Criar lead
            </Button>
          </Can>
        </div>
      </div>

      {/* ─── Views tabs ─── */}
      <div className="flex items-center gap-1 border-b px-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setActiveView(v.id);
              setActiveSavedId(null);
            }}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              activeView === v.id && !activeSavedId
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
            {activeView === v.id && !activeSavedId && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
        {(savedViews.data ?? []).map((sv) => {
          const isActive = activeSavedId === sv.id;
          return (
            <div
              key={sv.id}
              className={cn(
                "group relative flex items-center gap-1 px-3 py-2 text-sm font-medium whitespace-nowrap",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <button type="button" onClick={() => applySavedView(sv)}>
                {sv.name}
              </button>
              <button
                type="button"
                onClick={() => deleteSavedView(sv.id)}
                className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-muted"
                aria-label="Excluir visualização"
              >
                <X className="h-3 w-3" />
              </button>
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="ml-2 text-muted-foreground"
          onClick={saveCurrentView}
          disabled={savedViews.create.isPending}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {savedViews.create.isPending ? "Salvando…" : "Adicionar visualização"}
        </Button>
      </div>

      {/* ─── Body: sidebar + table ─── */}
      <div className="flex min-h-0 flex-1">
        {/* Filters sidebar */}
        <aside className="hidden w-64 shrink-0 border-r bg-card/30 lg:flex lg:flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filtros
            </h2>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-primary"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                Limpar tudo
              </Button>
            )}
          </div>
          <Separator />
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <FilterGroup title="Etapa do lead" defaultOpen>
              {stages.map((s) => {
                const checked = filters.status.includes(s.value);
                return (
                  <label
                    key={s.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        setFilters((f) => ({
                          ...f,
                          status: v
                            ? [...f.status, s.value]
                            : f.status.filter((x) => x !== s.value),
                        }))
                      }
                    />
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        s.color ? undefined : (STATUS_TONE[s.value]?.dot ?? "bg-muted-foreground"),
                      )}
                      style={s.color ? { backgroundColor: s.color } : undefined}
                    />

                    <span>{s.label}</span>
                  </label>
                );
              })}
            </FilterGroup>

            <FilterGroup title="Responsável" defaultOpen>
              <OwnerFilter
                value={{ ownerIds: filters.ownerIds, includeUnassigned: filters.includeUnassigned }}
                onChange={(v: OwnerFilterValue) =>
                  setFilters((f) => ({
                    ...f,
                    ownerIds: v.ownerIds,
                    includeUnassigned: v.includeUnassigned,
                  }))
                }
              />
            </FilterGroup>

            <FilterGroup title="Origem">
              {(sourceOptions ?? []).length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">Sem fontes ainda</p>
              ) : (
                (sourceOptions ?? []).map((s) => {
                  const checked = filters.source.includes(s.value);
                  return (
                    <label
                      key={s.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setFilters((f) => ({
                            ...f,
                            source: v
                              ? [...f.source, s.value]
                              : f.source.filter((x) => x !== s.value),
                          }))
                        }
                      />
                      <span className="flex-1 truncate">
                        {translateFieldValue("source", s.value) || s.value}
                      </span>
                      <span className="text-xs text-muted-foreground">{s.count}</span>
                    </label>
                  );
                })
              )}
            </FilterGroup>

            <FilterGroup title="Score">
              <div className="px-2 py-2">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{filters.scoreMin}</span>
                  <span>{filters.scoreMax}</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[filters.scoreMin, filters.scoreMax]}
                  onValueChange={([min, max]) =>
                    setFilters((f) => ({ ...f, scoreMin: min, scoreMax: max }))
                  }
                />
              </div>
            </FilterGroup>

            <FilterGroup title="Data de criação">
              <DateFilter
                name="leads-created"
                value={filters.createdPreset}
                custom={filters.createdCustom}
                onChange={({ value, custom }) =>
                  setFilters((f) => ({ ...f, createdPreset: value, createdCustom: custom }))
                }
              />
            </FilterGroup>
          </div>
        </aside>

        {/* Main panel */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, email, empresa…"
                className="h-9 pl-8"
              />
            </div>

            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-2 rounded-md border bg-primary/5 px-2 py-1">
                <span className="text-xs font-medium text-primary">
                  {selectedIds.size.toLocaleString("pt-BR")} selecionado(s)
                </span>
                {selectedIds.size < total && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-7 px-1 text-xs"
                    disabled={isSelectingAll}
                    onClick={selectAllMatching}
                  >
                    {isSelectingAll
                      ? "Selecionando…"
                      : `Selecionar todos os ${total.toLocaleString("pt-BR")} registros`}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    const ids = Array.from(selectedIds);
                    if (!ids.length) return;
                    startFocusQueue("leads", ids, `Leads · ${ids.length.toLocaleString("pt-BR")}`);
                    toast.success(`Fila iniciada com ${ids.length} lead(s)`);
                    navigate({ to: "/leads/$id", params: { id: ids[0] } });
                  }}
                >
                  <Play className="mr-1 h-3.5 w-3.5" /> Iniciar fila
                </Button>
                {canProspectingMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    disabled={prospectingBusy}
                    onClick={() =>
                      void startProspectingMode(
                        Array.from(selectedIds).slice(0, PROSPECTING_MODE_LIMIT),
                      )
                    }
                    title="Trabalhar os leads selecionados na tela de Prospecção"
                  >
                    <Headphones className="mr-1 h-3.5 w-3.5" />
                    {prospectingBusy ? "Preparando…" : "Modo Prospecção"}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setEnrichIds(Array.from(selectedIds))}
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> Enriquecer
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setProspectingIds(Array.from(selectedIds))}
                >
                  <Play className="mr-1 h-3.5 w-3.5" /> Adicionar à prospecção
                </Button>
                <Can any={["techsales.leads.delete.own", "techsales.leads.delete.workspace"]}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive"
                    onClick={bulkDelete}
                  >
                    Excluir
                  </Button>
                </Can>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setBulkEditOpen(true)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar em massa
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSelection}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <ColumnsButton />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Ações <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={exportCsv}>Exportar CSV</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 border-b px-3 py-2.5">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el && "indeterminate" in el)
                          (el as unknown as { indeterminate: boolean }).indeterminate =
                            !allSelected && someSelected;
                      }}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  {visibleColumns.map((col) => (
                    <Fragment key={col.key}>
                      {col.header ?? <Th className={col.headerClassName}>{col.label}</Th>}
                    </Fragment>
                  ))}
                  <th className="w-10 border-b px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 2}
                      className="px-3 py-16 text-center text-sm text-muted-foreground"
                    >
                      Carregando leads…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 2} className="px-3 py-16 text-center">
                      <p className="text-sm font-medium text-foreground">
                        Não foi possível carregar os leads.
                      </p>
                      <p
                        className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground"
                        aria-live="polite"
                      >
                        {listError instanceof Error ? listError.message : "Erro inesperado."}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => void refetch()}
                      >
                        Tentar novamente
                      </Button>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 2}
                      className="px-3 py-16 text-center text-sm text-muted-foreground"
                    >
                      Nenhum lead encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  rows.map((lead) => {
                    const checked = selectedIds.has(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        className={cn(
                          "group h-12 border-b transition-colors hover:bg-primary/5",
                          checked && "bg-primary/5",
                        )}
                      >
                        <Td className="w-10">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleOne(lead.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Td>
                        {visibleColumns.map((col) => (
                          <Td key={col.key} className={col.className}>
                            {col.render(lead)}
                          </Td>
                        ))}
                        <Td className="w-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate({ to: "/leads/$id", params: { id: lead.id } })
                                }
                              >
                                Abrir
                              </DropdownMenuItem>
                              {lead.status !== "qualified" && lead.status !== "disqualified" && (
                                <DropdownMenuItem onClick={() => convert(lead as unknown as Lead)}>
                                  <ArrowRightLeft className="mr-2 h-3.5 w-3.5" /> Converter
                                </DropdownMenuItem>
                              )}
                              <Can
                                any={[
                                  "techsales.leads.delete.own",
                                  "techsales.leads.delete.workspace",
                                ]}
                              >
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => removeOne(lead.id)}
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </Can>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            entityLabel="leads"
          />
        </div>
      </div>

      <ColumnsEditor />

      <BulkEditFieldsDialog
        open={bulkEditOpen}
        setOpen={setBulkEditOpen}
        entity="leads"
        ids={Array.from(selectedIds)}
        entityLabel="lead(s)"
        onDone={() => {
          clearSelection();
          qc.invalidateQueries({ queryKey: ["leads"] });
        }}
      />

      <BulkEnrichDialog
        open={!!enrichIds}
        onOpenChange={(o) => !o && setEnrichIds(null)}
        ids={enrichIds ?? []}
        entity="lead"
        onDone={() => qc.invalidateQueries({ queryKey: ["leads"] })}
      />

      <AddToProspectingDialog
        open={!!prospectingIds}
        onOpenChange={(o) => !o && setProspectingIds(null)}
        ids={prospectingIds ?? []}
      />

      <CreateLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["leads"] });
          navigate({ to: "/leads/$id", params: { id } });
        }}
      />

      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(v) => !actionBusy && !v && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={runPendingAction}
              disabled={actionBusy}
              className={
                pendingAction?.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {actionBusy ? "Processando…" : (pendingAction?.confirmLabel ?? "Confirmar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterGroup({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="py-1">
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted">
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">
        <div className="space-y-0.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Th({
  children,
  sortable,
  active,
  dir,
  onClick,
  className,
}: {
  children: React.ReactNode;
  sortable?: boolean;
  active?: boolean;
  dir?: SortDir;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b px-3 py-2.5 font-semibold",
        sortable && "cursor-pointer select-none hover:text-foreground",
        active && "text-foreground",
        className,
      )}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <ChevronsUpDown
            className={cn(
              "h-3 w-3 opacity-50",
              active && dir === "asc" && "rotate-180 opacity-100",
              active && dir === "desc" && "opacity-100",
            )}
          />
        )}
      </span>
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("max-w-[260px] truncate border-b px-3 py-2 align-middle", className)}>
      {children}
    </td>
  );
}

function StagePill({ stage, value }: { stage?: LeadStage; value: string }) {
  const tone = STATUS_TONE[value] ?? STATUS_TONE[stage?.type === "won" ? "qualified" : "new"];
  const label = stage?.label ?? LEGACY_STATUS_LABELS[value] ?? value;
  const color = stage?.color;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        color ? "bg-muted text-foreground" : tone.bg,
        color ? undefined : tone.text,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", color ? undefined : tone.dot)}
        style={color ? { backgroundColor: color } : undefined}
      />
      {label}
    </span>
  );
}

function ScoreCell({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone =
    clamped >= 75
      ? "from-emerald-500 to-emerald-400"
      : clamped >= 40
        ? "from-amber-500 to-amber-400"
        : "from-rose-500 to-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full bg-gradient-to-r", tone)} style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-medium tabular-nums">{clamped}</span>
    </div>
  );
}
