import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import {
  Check,
  ChevronDown,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  CheckboxFilter,
  FilterGroup,
  FiltersSidebar,
  HeaderCheckbox,
  InitialsAvatar,
  Pagination,
  Pill,
  RadioFilter,
  Td,
  Th,
  TONES,
  ViewsTabs,
  timeAgo,
  type SortDir,
} from "@/components/crm/hubspot-shell";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";

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

type SortKey = "due_date" | "created_at" | "subject";

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
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<ViewId>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setPage(0);
  }, [activeView, filters, debouncedSearch, sortKey, sortDir, pageSize]);

  const { data: result, isLoading } = useQuery({
    queryKey: [
      "tasks",
      "hubspot-list",
      activeView,
      filters,
      sortKey,
      sortDir,
      debouncedSearch,
      page,
      pageSize,
      user?.id,
    ],
    queryFn: async () => {
      let q = supabase
        .from("activities")
        .select(
          "id, subject, body, type, task_status, task_priority, due_date, completed, owner_id, related_contact_id, related_company_id, related_deal_id, related_lead_id, created_at, updated_at",
          { count: "exact" },
        )
        .eq("type", "task");

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

      if (activeView === "mine_open" && user?.id) {
        q = q.eq("owner_id", user.id).eq("completed", false);
      } else if (activeView === "due_today") {
        q = q
          .eq("completed", false)
          .gte("due_date", startOfDay.toISOString())
          .lt("due_date", endOfDay.toISOString());
      } else if (activeView === "overdue") {
        q = q.eq("completed", false).lt("due_date", startOfDay.toISOString());
      } else if (activeView === "completed") {
        q = q.eq("completed", true);
      }

      if (filters.statuses.length) q = q.in("task_status", filters.statuses);
      if (filters.priorities.length) q = q.in("task_priority", filters.priorities);
      if (filters.duePreset === "today") {
        q = q
          .gte("due_date", startOfDay.toISOString())
          .lt("due_date", endOfDay.toISOString());
      } else if (filters.duePreset === "overdue") {
        q = q.lt("due_date", startOfDay.toISOString()).eq("completed", false);
      } else if (filters.duePreset === "next_7d") {
        q = q
          .gte("due_date", startOfDay.toISOString())
          .lt("due_date", new Date(startOfDay.getTime() + 7 * 86_400_000).toISOString());
      }

      const term = debouncedSearch.trim().replace(/[,()]/g, " ").trim();
      if (term) {
        q = q.or([`subject.ilike.%${term}%`, `body.ilike.%${term}%`].join(","));
      }

      q = q.order(sortKey, { ascending: sortDir === "asc", nullsFirst: false });
      q = q.range(page * pageSize, page * pageSize + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Activity[], count: count ?? 0 };
    },
  });

  const rows = result?.rows ?? [];
  const total = result?.count ?? 0;
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

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const hasActiveFilters =
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.duePreset !== "any";

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
    if (!confirm("Excluir esta tarefa?")) return;
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
    if (!confirm(`Excluir ${ids.length} tarefa(s)?`)) return;
    const { error } = await supabase.from("activities").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} excluída(s)`);
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
        <Th sortable active={sortKey === "due_date"} dir={sortDir} onClick={() => onSort("due_date")}>
          Vencimento
        </Th>
      ),
      render: (t) => {
        const overdue = !t.completed && t.due_date && new Date(t.due_date).getTime() < Date.now();
        return (
          <span className={cn("text-muted-foreground", overdue && "font-medium text-rose-600 dark:text-rose-400")}>
            {formatDateTime(t.due_date)}
          </span>
        );
      },
    },
    {
      key: "owner",
      label: "Responsável",
      render: (t) =>
        t.owner_id ? (
          <InitialsAvatar text={t.owner_id.slice(0, 2).toUpperCase()} seed={t.owner_id} size={6} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "created_at",
      label: "Criado em",
      className: "text-muted-foreground",
      header: (
        <Th sortable active={sortKey === "created_at"} dir={sortDir} onClick={() => onSort("created_at")}>
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
  const DEFAULT_TASK_COLS = ["subject", "status", "priority", "due_date", "owner", "created_at"];
  const { columns: visibleColumns, ColumnsButton, ColumnsEditor } = useGridColumns<TaskRow>({
    gridKey: "tasks",
    columns: taskColumns,
    defaults: DEFAULT_TASK_COLS,
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
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Button size="sm" disabled>
            <Plus className="mr-1.5 h-4 w-4" /> Criar tarefa
          </Button>
        </div>
      </div>

      <ViewsTabs views={VIEWS} active={activeView} onChange={setActiveView} />

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

            {selectedIds.size > 0 ? (
              <div className="flex items-center gap-2 rounded-md border bg-primary/5 px-2 py-1">
                <span className="text-xs font-medium text-primary">
                  {selectedIds.size} selecionada(s)
                </span>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearSelection}
                >
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
                    <DropdownMenuItem disabled>Salvar visualização</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>Exportar CSV</DropdownMenuItem>
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
                  {visibleColumns.map((col) =>
                    col.header ?? <Th key={col.key} className={col.headerClassName}>{col.label}</Th>,
                  )}
                  <th className="w-10 border-b px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-16 text-center text-sm text-muted-foreground"
                    >
                      Carregando tarefas…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-16 text-center text-sm text-muted-foreground"
                    >
                      Nenhuma tarefa encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => {
                    const checked = selectedIds.has(t.id);
                    const statusLbl =
                      TASK_STATUSES.find((s) => s.value === t.task_status)?.label ?? "—";
                    const priorityLbl =
                      TASK_PRIORITIES.find((p) => p.value === t.task_priority)?.label ?? "—";
                    const overdue =
                      !t.completed &&
                      t.due_date &&
                      new Date(t.due_date).getTime() < Date.now();
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
                        <Td>
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
                        </Td>
                        <Td>
                          <Pill
                            tone={STATUS_TONE[t.task_status ?? ""] ?? "slate"}
                            label={statusLbl}
                          />
                        </Td>
                        <Td>
                          <Pill
                            tone={PRIORITY_TONE[t.task_priority ?? ""] ?? "slate"}
                            label={priorityLbl}
                          />
                        </Td>
                        <Td
                          className={cn(
                            "text-muted-foreground",
                            overdue && "font-medium text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {formatDateTime(t.due_date)}
                        </Td>
                        <Td>
                          {t.owner_id ? (
                            <InitialsAvatar
                              text={t.owner_id.slice(0, 2).toUpperCase()}
                              seed={t.owner_id}
                              size={6}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Td>
                        <Td className="text-muted-foreground">{timeAgo(t.created_at)}</Td>
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
                                  navigate({ to: "/tasks/$id", params: { id: t.id } })
                                }
                              >
                                Abrir
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => markComplete(t.id, !t.completed)}
                              >
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

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            setPage={setPage}
            setPageSize={setPageSize}
          />
        </div>
      </div>
    </div>
  );
}
