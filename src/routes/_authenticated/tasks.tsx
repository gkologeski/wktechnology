import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { Activity } from "@/lib/db-types";
import { TASK_PRIORITIES, TASK_STATUSES, formatDateTime } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, Download, MoreHorizontal, Plus, Search, X } from "lucide-react";
import {
  CheckboxFilter,
  FilterGroup,
  FiltersSidebar,
  HeaderCheckbox,
  InitialsAvatar,
  Pill,
  RadioFilter,
  Td,
  Th,
  TONES,
  timeAgo,
  type SortDir,
} from "@/components/crm/hubspot-shell";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";
import { useGridProjection } from "@/hooks/use-grid-projection";
import { buildGridSelect } from "@/lib/grid/dynamic-select";
import { QuickCreateTaskDialog } from "@/components/record/quick-create-dialogs";
import { useAutoCreateParam } from "@/hooks/use-auto-create-param";
import { exportRowsToCsv } from "@/lib/csv-export";
import { useSavedViews } from "@/lib/saved-views";
import {
  AssigneeFilter,
  ASSIGNEE_ALL,
  ASSIGNEE_ME,
  ASSIGNEE_NONE,
  type AssigneeFilterValue,
} from "@/components/entity/assignee-filter";
import { useResourceScope } from "@/lib/access-control/use-resource-scope";
import { TablePagination } from "@/components/table-pagination";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { deleteRowGuarded, deleteRowsGuarded, partialDeleteMessage } from "@/lib/delete-guard";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

type ViewId = "all" | "mine_open" | "due_today" | "overdue" | "completed";
const VIEWS = [
  { id: "all" as const, label: "Todas as tarefas" },
  { id: "mine_open" as const, label: "Minhas tarefas abertas" },
  { id: "due_today" as const, label: "Vencem hoje" },
  { id: "overdue" as const, label: "Atrasadas" },
  { id: "completed" as const, label: "Concluídas" },
];

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  NOT_STARTED: "slate",
  IN_PROGRESS: "sky",
  WAITING: "amber",
  COMPLETED: "emerald",
  DEFERRED: "violet",
};
const PRIORITY_TONE: Record<string, keyof typeof TONES> = {
  LOW: "slate",
  MEDIUM: "sky",
  HIGH: "rose",
};

type SortKey = string;
const DECLARED_SORT_KEYS = ["due_date", "created_at", "subject"] as const;

/** Colunas sempre necessárias no grid de tarefas (células, filtros e ações). */
const BASE_TASK_KEYS = [
  "id",
  "subject",
  "body",
  "type",
  "task_status",
  "task_priority",
  "due_date",
  "completed",
  "owner_id",
  "assigned_to",
  "hubspot_owner_id",
  "related_contact_id",
  "related_company_id",
  "related_deal_id",
  "related_lead_id",
  "related_ticket_id",
  "created_at",
  "updated_at",
] as const;

type Filters = {
  statuses: string[];
  priorities: string[];
  duePreset: "any" | "today" | "overdue" | "next_7d";
};
const DEFAULT_FILTERS: Filters = {
  statuses: [],
  priorities: [],
  duePreset: "any",
};

function TasksPage() {
  const location = useLocation();
  if (location.pathname !== "/tasks") return <Outlet />;
  return <TasksHubspotView />;
}

function TasksHubspotView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeInvalidate([{ table: "activities", queryKeys: [["tasks"]] }]);
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<ViewId>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const activityScope = useResourceScope("techsales.activities", "view");
  const [assignee, setAssignee] = useState<AssigneeFilterValue>(ASSIGNEE_ALL);
  // Escopo limitado (own/team): "Todos os responsáveis" não se aplica.
  useEffect(() => {
    if (!activityScope.isWorkspaceWide && assignee === ASSIGNEE_ALL) setAssignee(ASSIGNEE_ME);
  }, [activityScope.isWorkspaceWide, assignee]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const projection = useGridProjection({
    gridKey: "tasks",
    entity: "activities",
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
  const [createOpen, setCreateOpen] = useState(false);
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  useAutoCreateParam(() => setCreateOpen(true));

  const savedViews = useSavedViews("tasks");
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
        filters: { kind: "tasks-v1", activeView, filters, sortKey, sortDir } as any,
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

  const exportCsv = () => {
    if (!rows.length) return toast.error("Nenhum registro para exportar");
    exportRowsToCsv("tarefas", rows as unknown as Record<string, unknown>[], [
      { key: "subject", label: "Assunto" },
      { key: "task_status", label: "Status" },
      { key: "task_priority", label: "Prioridade" },
      { key: "due_date", label: "Vencimento" },
      { key: "completed", label: "Concluída" },
      { key: "created_at", label: "Criado em" },
      { key: "updated_at", label: "Atualizado em" },
    ]);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setPage(0);
  }, [activeView, filters, debouncedSearch, assignee, sortKey, sortDir, pageSize]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyTaskFilters = (q: any) => {
    q = q.eq("type", "task").is("deleted_at", null);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

    if (activeView === "mine_open" && user?.id) {
      q = q.eq("owner_id", user.id).eq("completed", false).neq("task_status", "COMPLETED");
    } else if (activeView === "due_today") {
      q = q
        .eq("completed", false)
        .neq("task_status", "COMPLETED")
        .gte("due_date", startOfDay.toISOString())
        .lt("due_date", endOfDay.toISOString());
    } else if (activeView === "overdue") {
      q = q
        .eq("completed", false)
        .neq("task_status", "COMPLETED")
        .lt("due_date", startOfDay.toISOString());
    } else if (activeView === "completed") {
      q = q.or("completed.eq.true,task_status.eq.COMPLETED");
    }

    if (filters.statuses.length) q = q.in("task_status", filters.statuses);
    if (filters.priorities.length) q = q.in("task_priority", filters.priorities);
    if (filters.duePreset === "today") {
      q = q.gte("due_date", startOfDay.toISOString()).lt("due_date", endOfDay.toISOString());
    } else if (filters.duePreset === "overdue") {
      q = q.lt("due_date", startOfDay.toISOString()).eq("completed", false);
    } else if (filters.duePreset === "next_7d") {
      q = q
        .gte("due_date", startOfDay.toISOString())
        .lt("due_date", new Date(startOfDay.getTime() + 7 * 86_400_000).toISOString());
    }

    // Responsável (owner_id em activities), respeitando o escopo efetivo.
    if (assignee === ASSIGNEE_ME && user?.id) q = q.eq("owner_id", user.id);
    else if (assignee === ASSIGNEE_NONE) q = q.is("owner_id", null);
    else if (assignee !== ASSIGNEE_ALL) q = q.eq("owner_id", assignee);

    const term = debouncedSearch.trim().replace(/[,()]/g, " ").trim();
    if (term) {
      q = q.or([`subject.ilike.%${term}%`, `body.ilike.%${term}%`].join(","));
    }
    return q;
  };

  const {
    data: result,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "tasks",
      "hubspot-list",
      activeView,
      filters,
      sortKey,
      sortDir,
      debouncedSearch,
      assignee,
      page,
      pageSize,
      user?.id,
      projection.selectSignature,
      projection.needsCustomFields,
    ],
    enabled: !projection.isLoading,
    queryFn: async () => {
      let q = supabase.from("activities").select(
        // Projeção sob demanda: colunas base + colunas visíveis do catálogo.
        buildGridSelect(BASE_TASK_KEYS, projection.selectKeys, {
          customFields: projection.needsCustomFields,
          allowed: projection.knownColumns,
        }),
        { count: "exact" },
      );
      q = applyTaskFilters(q);
      q =
        sortKey === "created_at"
          ? q.order(sortKey, { ascending: sortDir === "asc" })
          : q.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
      q = q.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Activity[], count: count ?? 0 };
    },
  });

  const rows = result?.rows ?? [];
  const total = result?.count ?? 0;

  const { data: relatedMap } = useQuery({
    queryKey: ["tasks", "related", rows.map((r) => r.id).join(",")],
    enabled: rows.length > 0,
    queryFn: async () => {
      const contactIds = [
        ...new Set(rows.map((r) => r.related_contact_id).filter(Boolean) as string[]),
      ];
      const companyIds = [
        ...new Set(rows.map((r) => r.related_company_id).filter(Boolean) as string[]),
      ];
      const dealIds = [...new Set(rows.map((r) => r.related_deal_id).filter(Boolean) as string[])];
      const leadIds = [...new Set(rows.map((r) => r.related_lead_id).filter(Boolean) as string[])];
      const [c, co, d, l] = await Promise.all([
        contactIds.length
          ? supabase.from("contacts").select("id, first_name, last_name").in("id", contactIds)
          : Promise.resolve({
              data: [] as { id: string; first_name: string | null; last_name: string | null }[],
            }),
        companyIds.length
          ? supabase.from("companies").select("id, name").in("id", companyIds)
          : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
        dealIds.length
          ? supabase.from("deals").select("id, name").in("id", dealIds)
          : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
        leadIds.length
          ? supabase
              .from("leads")
              .select("id, first_name, last_name, company_name")
              .in("id", leadIds)
          : Promise.resolve({
              data: [] as {
                id: string;
                first_name: string | null;
                last_name: string | null;
                company_name: string | null;
              }[],
            }),
      ]);
      return {
        contacts: Object.fromEntries((c.data ?? []).map((x) => [x.id, x])),
        companies: Object.fromEntries((co.data ?? []).map((x) => [x.id, x])),
        deals: Object.fromEntries((d.data ?? []).map((x) => [x.id, x])),
        leads: Object.fromEntries((l.data ?? []).map((x) => [x.id, x])),
      };
    },
  });

  const { data: ownersMap = {} } = useQuery({
    queryKey: [
      "tasks",
      "owners",
      rows
        .map((r) => r.owner_id)
        .filter(Boolean)
        .join(","),
    ],
    enabled: rows.length > 0,
    queryFn: async () => {
      const ids = [...new Set(rows.map((r) => r.owner_id).filter(Boolean) as string[])];
      if (!ids.length) return {} as Record<string, string>;
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name ?? ""])) as Record<
        string,
        string
      >;
    },
  });

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));

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

  const selectAllMatching = async () => {
    try {
      setIsSelectingAll(true);
      const ids: string[] = [];
      const CHUNK = 1000;
      for (let offset = 0; ; offset += CHUNK) {
        let q = supabase.from("activities").select("id");
        q = applyTaskFilters(q);
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

  const onSort = (k: SortKey) => {
    const nextDir: SortDir = sortKey === k ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortKey(k);
    setSortDir(nextDir);
    persistSort(k, nextDir);
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

  const hasActiveFilters =
    filters.statuses.length > 0 || filters.priorities.length > 0 || filters.duePreset !== "any";

  const markComplete = async (id: string, complete: boolean) => {
    const { error } = await supabase
      .from("activities")
      .update({
        completed: complete,
        task_status: complete ? "COMPLETED" : "NOT_STARTED",
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(complete ? "Concluída" : "Reaberta");
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };
  const removeOne = async (id: string) => {
    if (!(await confirmDialog("Excluir esta tarefa?"))) return;
    const res = await deleteRowGuarded("activities", id);
    if (!res.ok) return toast.error(res.message);
    toast.success("Removida");
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };
  const bulkComplete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const { error } = await supabase
      .from("activities")
      .update({ completed: true, task_status: "COMPLETED" })
      .in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} concluída(s)`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };
  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!(await confirmDialog(`Excluir ${ids.length} tarefa(s)?`))) return;
    const res = await deleteRowsGuarded("activities", ids);
    if (!res.ok) return toast.error(res.message);
    if (res.deleted < res.requested)
      toast.warning(partialDeleteMessage(res.deleted, res.requested));
    else toast.success(`${res.deleted} excluída(s)`);
    clearSelection();
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  type TaskRow = Activity;
  const taskColumns: GridColumnDef<TaskRow>[] = [
    {
      key: "subject",
      label: "Título",
      header: (
        <Th sortable active={sortKey === "subject"} dir={sortDir} onClick={() => onSort("subject")}>
          Título
        </Th>
      ),
      render: (t) => (
        <Link
          to="/tasks/$id"
          params={{ id: t.id }}
          className={cn(
            "truncate font-medium text-primary hover:underline",
            t.completed && "line-through",
          )}
        >
          {t.subject || "(sem assunto)"}
        </Link>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (t) => (
        <Pill
          tone={STATUS_TONE[t.task_status ?? ""] ?? "slate"}
          label={TASK_STATUSES.find((s) => s.value === t.task_status)?.label ?? "—"}
        />
      ),
    },
    {
      key: "priority",
      label: "Prioridade",
      render: (t) => (
        <Pill
          tone={PRIORITY_TONE[t.task_priority ?? ""] ?? "slate"}
          label={TASK_PRIORITIES.find((p) => p.value === t.task_priority)?.label ?? "—"}
        />
      ),
    },
    {
      key: "due_date",
      label: "Vencimento",
      header: (
        <Th
          sortable
          active={sortKey === "due_date"}
          dir={sortDir}
          onClick={() => onSort("due_date")}
        >
          Vencimento
        </Th>
      ),
      render: (t) => {
        const overdue = !t.completed && t.due_date && new Date(t.due_date).getTime() < Date.now();
        return (
          <span
            className={cn(
              "text-muted-foreground",
              overdue && "font-medium text-rose-600 dark:text-rose-400",
            )}
          >
            {formatDateTime(t.due_date)}
          </span>
        );
      },
    },
    {
      key: "related",
      label: "Associado",
      render: (t) => {
        const items: { label: string; to: string; params: Record<string, string> }[] = [];
        if (t.related_contact_id) {
          const c = relatedMap?.contacts?.[t.related_contact_id];
          const name = c ? [c.first_name, c.last_name].filter(Boolean).join(" ").trim() : "";
          items.push({
            label: `Contato: ${name || "—"}`,
            to: "/contacts/$id",
            params: { id: t.related_contact_id },
          });
        }
        if (t.related_company_id) {
          const c = relatedMap?.companies?.[t.related_company_id];
          items.push({
            label: `Empresa: ${c?.name ?? "—"}`,
            to: "/companies/$id",
            params: { id: t.related_company_id },
          });
        }
        if (t.related_deal_id) {
          const d = relatedMap?.deals?.[t.related_deal_id];
          items.push({
            label: `Negócio: ${d?.name ?? "—"}`,
            to: "/deals/$id",
            params: { id: t.related_deal_id },
          });
        }
        if (t.related_lead_id) {
          const l = relatedMap?.leads?.[t.related_lead_id];
          const name = l ? [l.first_name, l.last_name].filter(Boolean).join(" ").trim() : "";
          items.push({
            label: `Lead: ${name || l?.company_name || "—"}`,
            to: "/leads/$id",
            params: { id: t.related_lead_id },
          });
        }
        if (items.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col gap-0.5">
            {items.map((it, idx) => (
              <Link
                key={idx}
                to={it.to}
                params={it.params}
                className="truncate text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {it.label}
              </Link>
            ))}
          </div>
        );
      },
    },
    {
      key: "owner",
      label: "Responsável",
      render: (t) => {
        if (!t.owner_id) return <span className="text-muted-foreground">—</span>;
        const name = ownersMap[t.owner_id] || "—";
        const initials =
          name && name !== "—"
            ? name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join("")
            : t.owner_id.slice(0, 2).toUpperCase();
        return (
          <div className="flex items-center gap-2" title={name}>
            <InitialsAvatar text={initials} seed={t.owner_id} size={6} />
            <span className="truncate text-sm">{name}</span>
          </div>
        );
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
      render: (t) => timeAgo(t.created_at),
    },
    {
      key: "updated_at",
      label: "Atualizado em",
      className: "text-muted-foreground",
      render: (t) => timeAgo(t.updated_at),
    },
    {
      key: "type",
      label: "Tipo",
      className: "text-muted-foreground",
      render: (t) => t.type ?? "—",
    },
  ];
  const DEFAULT_TASK_COLS = [
    "subject",
    "status",
    "priority",
    "due_date",
    "related",
    "owner",
    "created_at",
  ];
  const {
    columns: visibleColumns,
    ColumnsButton,
    ColumnsEditor,
    persistSort,
  } = useGridColumns<TaskRow>({
    gridKey: "tasks",
    columns: taskColumns,
    defaults: DEFAULT_TASK_COLS,
    customEntity: "activities",
    catalogEntity: "activities",
    sortHeader: autoSortHeader,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Carregando…" : `${total.toLocaleString("pt-BR")} registros`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tasks/queues">Queues</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Criar tarefa
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b px-1 overflow-x-auto">
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

      <div className="flex min-h-0 flex-1">
        <FiltersSidebar
          hasActiveFilters={hasActiveFilters}
          onClear={() => setFilters(DEFAULT_FILTERS)}
        >
          <FilterGroup title="Status" defaultOpen>
            {TASK_STATUSES.map((s) => (
              <CheckboxFilter
                key={s.value}
                label={s.label}
                dotClass={TONES[STATUS_TONE[s.value] ?? "slate"]?.dot}
                checked={filters.statuses.includes(s.value)}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    statuses: v
                      ? [...f.statuses, s.value]
                      : f.statuses.filter((x) => x !== s.value),
                  }))
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Priority" defaultOpen>
            {TASK_PRIORITIES.map((p) => (
              <CheckboxFilter
                key={p.value}
                label={p.label}
                dotClass={TONES[PRIORITY_TONE[p.value] ?? "slate"]?.dot}
                checked={filters.priorities.includes(p.value)}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    priorities: v
                      ? [...f.priorities, p.value]
                      : f.priorities.filter((x) => x !== p.value),
                  }))
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Due date">
            <RadioFilter
              name="tasks-due"
              options={
                [
                  ["any", "Qualquer data"],
                  ["today", "Hoje"],
                  ["overdue", "Atrasadas"],
                  ["next_7d", "Próximos 7 dias"],
                ] as const
              }
              value={filters.duePreset}
              onChange={(v) => setFilters((f) => ({ ...f, duePreset: v }))}
            />
          </FilterGroup>
        </FiltersSidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar assunto, descrição…"
                className="h-9 pl-8"
              />
            </div>

            <AssigneeFilter
              value={assignee}
              onChange={setAssignee}
              className="h-9 w-52"
              allowedUserIds={activityScope.ownerIds}
              allowAll={activityScope.isWorkspaceWide}
            />

            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-2 rounded-md border bg-primary/5 px-2 py-1">
                <span className="text-xs font-medium text-primary">
                  {selectedIds.size.toLocaleString("pt-BR")} selecionada(s)
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
                      : `Selecionar todas as ${total.toLocaleString("pt-BR")} tarefas`}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7" onClick={bulkComplete}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Concluir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-destructive hover:text-destructive"
                  onClick={bulkDelete}
                >
                  Excluir
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

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 border-b px-3 py-2.5">
                    <HeaderCheckbox
                      allSelected={allSelected}
                      someSelected={someSelected}
                      onToggle={toggleAll}
                    />
                  </th>
                  <th className="w-10 border-b px-3 py-2.5" />
                  {visibleColumns.map(
                    (col) =>
                      col.header ?? (
                        <Th key={col.key} className={col.headerClassName}>
                          {col.label}
                        </Th>
                      ),
                  )}
                  <th className="w-10 border-b px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 3}
                      className="px-3 py-16 text-center text-sm text-muted-foreground"
                    >
                      Carregando tarefas…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 2}
                      className="px-3 py-16 text-center text-sm"
                    >
                      <p className="text-muted-foreground">Não foi possível carregar as tarefas.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => void refetch()}
                      >
                        Tentar novamente
                      </Button>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 3}
                      className="px-3 py-16 text-center text-sm text-muted-foreground"
                    >
                      {activityScope.hasNoAccess
                        ? "Você não possui permissão para visualizar atividades neste workspace."
                        : activityScope.isWorkspaceWide
                          ? "Nenhuma tarefa encontrada com os filtros atuais."
                          : activityScope.isTeam
                            ? "Nenhuma tarefa da sua equipe encontrada com os filtros atuais."
                            : "Nenhuma tarefa sua encontrada com os filtros atuais."}
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => {
                    const checked = selectedIds.has(t.id);
                    return (
                      <tr
                        key={t.id}
                        className={cn(
                          "group h-12 border-b transition-colors hover:bg-primary/5",
                          checked && "bg-primary/5",
                          t.completed && "opacity-60",
                        )}
                      >
                        <Td className="w-10">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleOne(t.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Td>
                        <Td className="w-10">
                          <Checkbox
                            checked={t.completed}
                            onCheckedChange={(v) => markComplete(t.id, !!v)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Td>
                        {visibleColumns.map((col) => (
                          <Td key={col.key} className={col.className}>
                            {col.render(t)}
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
                                onClick={() => navigate({ to: "/tasks/$id", params: { id: t.id } })}
                              >
                                Abrir
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => markComplete(t.id, !t.completed)}>
                                {t.completed ? "Reabrir" : "Marcar concluída"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => removeOne(t.id)}
                              >
                                Excluir
                              </DropdownMenuItem>
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

          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            entityLabel="tarefas"
          />
        </div>
      </div>
      <ColumnsEditor />
      <QuickCreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["tasks"] })}
      />
    </div>
  );
}
