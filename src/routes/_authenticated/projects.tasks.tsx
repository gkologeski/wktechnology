import { useWorkCapabilities } from "@/lib/access-control/use-work-capabilities";
import { WorkScreenAccess } from "@/components/work-access";
// TechProjects — listagem cross-project de `project_tasks`.
// Desacopla o menu de "Tarefas" do domínio de Sales (`activities` em /tasks).
import { createFileRoute, Link } from "@tanstack/react-router";
import { GridListToolbar } from "@/components/grid/grid-list-toolbar";
import { GridListShell } from "@/components/grid/grid-list-shell";
import { useGridFilters } from "@/hooks/use-grid-filters";
import type { GridFilterField } from "@/lib/grid-filters";
import { SortableTableHead } from "@/components/grid/sortable-table-head";
import { useClientSort } from "@/lib/grid-client-sort";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ListTodo, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/crm";
import { formatCompactDateTime } from "@/lib/format/compact-date";
import { listAllProjectTaskIds, listAllProjectTasks } from "@/lib/projects.functions";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { TaskDetailsSheet } from "@/components/projects/task-details-sheet";
import { TASK_STATUS_LABEL } from "@/components/projects/task-core-fields";
import { ViewModeToggle } from "@/components/kanban/view-mode-toggle";

export const Route = createFileRoute("/_authenticated/projects/tasks")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { view?: "table" | "kanban"; taskId?: string } => ({
    view: search.view === "kanban" ? "kanban" : "table",
    taskId: typeof search.taskId === "string" && search.taskId ? search.taskId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tarefas de projetos" },
      {
        name: "description",
        content:
          "Tarefas de todos os projetos ativos com filtros por status, projeto e responsável.",
      },
    ],
  }),
  component: () => (
    <WorkScreenAccess resources={["techprojects.tasks"]}>
      <ProjectTasksPage />
    </WorkScreenAccess>
  ),
});

const STATUS_LABEL = TASK_STATUS_LABEL;

const STATUS_TONE: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  doing: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  review: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

// Tom dos "dots" das colunas do kanban (tokens semânticos).
const KANBAN_TONE: Record<string, string> = {
  todo: "bg-muted-foreground/40",
  doing: "bg-primary",
  review: "bg-amber-500",
  done: "bg-emerald-500",
};

type StatusFilter = "all" | "todo" | "doing" | "review" | "done";
type OwnerFilter = "all" | "mine";
const PAGE_SIZE = 100;

function ProjectTasksPage() {
  const qc = useQueryClient();
  const listTasksFn = useServerFn(listAllProjectTasks);
  const listTaskIdsFn = useServerFn(listAllProjectTaskIds);
  const [search, setSearch] = useState("");
  // Status e projeto agora são filtrados pelo painel lateral.
  const status: StatusFilter = "all";
  const projectId: string = "all";
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [page, setPage] = useState(0);

  const tasksKey = ["project_tasks", "all", { status, projectId, owner, search, page }] as const;
  const {
    data: pageRows = [],
    isLoading,
    isError,
    error: loadError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: tasksKey,
    // Uma nova tentativa só: com o banco lento, o aviso de erro aparece antes.
    retry: 1,
    placeholderData: (prev) => prev,
    queryFn: () =>
      listTasksFn({
        data: {
          status: status === "all" ? undefined : status,
          projectId: projectId === "all" ? undefined : projectId,
          mineOnly: owner === "mine" ? true : undefined,
          search: search || undefined,
          // Busca uma a mais só para saber se existe próxima página.
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE + 1,
        },
      }),
  });
  const hasNext = pageRows.length > PAGE_SIZE;
  const rows = hasNext ? pageRows.slice(0, PAGE_SIZE) : pageRows;

  // Seleção múltipla / ações em massa (padrão de grids — Fase 4).
  const { canAny } = usePermissions();
  const selection = useGridSelection(rows as Array<(typeof rows)[number] & { id: string }>, {
    loadAllIds: () =>
      listTaskIdsFn({
        data: {
          status: status === "all" ? undefined : status,
          projectId: projectId === "all" ? undefined : projectId,
          mineOnly: owner === "mine" ? true : undefined,
          search: search || undefined,
        },
      }),
  });
  const canUpdate = canAny([
    "techprojects.tasks.update.workspace",
    "techprojects.tasks.update.team",
    "techprojects.tasks.update.own",
  ]);
  const canDelete = canAny([
    "techprojects.tasks.delete.workspace",
    "techprojects.tasks.delete.own",
  ]);

  // Painel lateral padronizado (filtros no cliente sobre as tarefas carregadas).
  const gridFilters = useGridFilters(
    "project_tasks",
    rows as any[],
    [
      {
        key: "project",
        label: "Projeto",
        type: "multi",
        searchable: true,
        get: (t) => t.project_id,
        optionLabel: (_v, t) => t.projects?.name ?? "Projeto",
      },
      {
        key: "status",
        label: "Status",
        type: "multi",
        get: (t) => t.status,
        options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
      },
      {
        key: "priority",
        label: "Prioridade",
        type: "multi",
        get: (t) => t.priority,
        options: [
          { value: "low", label: "Baixa" },
          { value: "normal", label: "Normal" },
          { value: "high", label: "Alta" },
          { value: "urgent", label: "Urgente" },
        ],
      },
      { key: "owner", label: "Responsável", type: "owner", get: (t) => t.assignee_id },
      { key: "due", label: "Prazo entre", type: "date", get: (t) => t.due_at },
    ] as GridFilterField<any>[],
  );

  const { view = "table", taskId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setView = (v: "table" | "kanban") =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, view: v }) });
  // Painel de detalhes: a tarefa aberta fica na URL (?taskId=) para links diretos.
  const openTask = (id: string) =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, taskId: id }) });
  const closeTask = () =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, taskId: undefined }), replace: true });
  const selectedTask = taskId ? (rows.find((t) => t.id === taskId) ?? null) : null;
  const taskMissing = !!taskId && !isLoading && !isError && !selectedTask;
  // Falha de carga (ex.: tempo esgotado no banco) não pode parecer lista vazia.
  const errorState = (
    <div role="alert" className="p-12 text-center">
      <ListTodo className="mx-auto h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-medium">Não foi possível carregar as tarefas</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {loadError instanceof Error && loadError.message
          ? loadError.message
          : "O servidor demorou a responder."}{" "}
        Tente novamente em instantes.
      </p>
      <Button
        className="mt-4"
        size="sm"
        variant="outline"
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        {isFetching ? "Tentando…" : "Tentar novamente"}
      </Button>
    </div>
  );

  const {
    sorted: sortedRows,
    sort,
    toggle,
    grid: sortGrid,
  } = useClientSort(gridFilters.filtered, {
    title: (t) => t.title,
    status: (t) => STATUS_LABEL[t.status] ?? t.status,
    hours: (t) => (t.estimated_hours == null ? null : Number(t.estimated_hours)),
    due: (t) => t.due_at,
  });

  const workAccess = useWorkCapabilities(
    "techprojects.tasks",
    rows.map((row) => row.id),
  );
  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Tarefas de projetos"
        description="Todas as tarefas dos projetos ativos, com filtros por status, projeto e responsável."
        count={rows.length}
        countLabel={rows.length === 1 ? "tarefa" : "tarefas"}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-8"
          />
        </div>
        <Select
          value={owner}
          onValueChange={(v) => {
            setOwner(v as OwnerFilter);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="mine">Minhas tarefas</SelectItem>
          </SelectContent>
        </Select>
        <ViewModeToggle value={view} onChange={setView} />
      </div>

      {view === "table" && selection.hasSelection && (
        <GridBulkBar
          table="project_tasks"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="tarefa(s)"
          onClear={selection.clear}
          onDone={() => void qc.invalidateQueries({ queryKey: ["project_tasks"] })}
          onSelectAll={selection.selectAllMatching}
          isSelectingAll={selection.isSelectingAll}
          assignColumn={canUpdate ? "assignee_id" : null}
          canUpdate={canUpdate && selection.ids.every((id) => workAccess.for(id).can_update)}
          canDelete={canDelete && selection.ids.every((id) => workAccess.for(id).can_delete)}
          bulkEditFields={[
            {
              name: "status",
              label: "Status",
              type: "select",
              options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
            },
            {
              name: "priority",
              label: "Prioridade",
              type: "select",
              options: [
                { value: "low", label: "Baixa" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "Alta" },
                { value: "urgent", label: "Urgente" },
              ],
            },
            { name: "due_at", label: "Prazo", type: "date" },
          ]}
        />
      )}

      {isError ? (
        <div className="rounded-lg border bg-card">{errorState}</div>
      ) : view === "kanban" ? (
        <KanbanBoard
          rows={gridFilters.filtered as Array<(typeof rows)[number] & { id: string }>}
          canUpdateRecord={(id) => workAccess.for(id).can_update}
          canDeleteRecord={(id) => workAccess.for(id).can_delete}
          table="project_tasks"
          stageField="status"
          selectable
          entityLabel="tarefa"
          assignColumn={"assignee_id"}
          canDelete={canDelete}
          canUpdate={canUpdate}
          isLoading={isLoading}
          invalidateKeys={[["project_tasks"]]}
          ariaLabel="Quadro de tarefas de projetos"
          columns={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value,
            label,
            tone: KANBAN_TONE[value],
          }))}
          emptyState={
            <div className="p-12 text-center">
              <ListTodo className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma tarefa encontrada</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Crie tarefas dentro de um projeto para vê-las aqui.
              </p>
            </div>
          }
          renderCard={(t) => {
            const project = (t as { projects?: { id: string; name: string } }).projects;
            return (
              <div className="space-y-1 pr-6">
                <button
                  type="button"
                  onClick={() => openTask(t.id)}
                  className="block w-full text-left text-sm font-medium leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  aria-label={`Abrir detalhes da tarefa ${t.title}`}
                >
                  {t.title}
                </button>
                {project && (
                  <Link
                    to="/projects/$id"
                    params={{ id: project.id }}
                    className="block text-xs text-muted-foreground hover:underline"
                  >
                    {project.name}
                  </Link>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t.due_at ? formatCompactDateTime(t.due_at) : "sem prazo"}</span>
                  <span className="tabular-nums">
                    {t.estimated_hours ? `${t.estimated_hours}h` : ""}
                  </span>
                </div>
              </div>
            );
          }}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <ListTodo className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhuma tarefa encontrada</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Crie tarefas dentro de um projeto para vê-las aqui.
              </p>
              <Button asChild className="mt-4" size="sm" variant="outline">
                <Link to="/projects">Ir para projetos</Link>
              </Button>
            </div>
          ) : (
            <GridListShell filters={gridFilters}>
              <GridListToolbar
                filters={gridFilters}
                grid={sortGrid}
                filename="tarefas-projetos"
                labels={{ title: "Título", status: "Status", hours: "Horas est.", due: "Prazo" }}
                search={false}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          selection.allOnPageSelected
                            ? true
                            : selection.someOnPageSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={() => selection.toggleAllOnPage()}
                        aria-label="Selecionar todas as tarefas da página"
                      />
                    </TableHead>
                    <SortableTableHead
                      label="Título"
                      active={sort?.key === "title"}
                      dir={sort?.dir}
                      onSort={() => toggle("title")}
                    />
                    <TableHead>Projeto</TableHead>
                    <SortableTableHead
                      label="Status"
                      active={sort?.key === "status"}
                      dir={sort?.dir}
                      onSort={() => toggle("status")}
                    />
                    <SortableTableHead
                      label="Horas est."
                      active={sort?.key === "hours"}
                      dir={sort?.dir}
                      onSort={() => toggle("hours")}
                      className="text-right"
                      align="right"
                    />
                    <SortableTableHead
                      label="Prazo"
                      active={sort?.key === "due"}
                      dir={sort?.dir}
                      onSort={() => toggle("due")}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((t) => {
                    const project = (t as { projects?: { id: string; name: string } }).projects;
                    return (
                      <TableRow
                        key={t.id}
                        data-state={selection.isSelected(t.id) ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={(e) => {
                          // Checkbox e link do projeto mantêm a própria ação.
                          if ((e.target as HTMLElement).closest("a,button,[role=checkbox]")) return;
                          openTask(t.id);
                        }}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selection.isSelected(t.id)}
                            onCheckedChange={() => selection.toggleOne(t.id)}
                            aria-label={`Selecionar tarefa ${t.title}`}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => openTask(t.id)}
                            className="text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                            aria-label={`Abrir detalhes da tarefa ${t.title}`}
                          >
                            {t.title}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {project ? (
                            <Link
                              to="/projects/$id"
                              params={{ id: project.id }}
                              className="hover:underline"
                            >
                              {project.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_TONE[t.status] ?? ""}>
                            {STATUS_LABEL[t.status] ?? t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t.estimated_hours ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.due_at ? formatDateTime(t.due_at).split(" ")[0] : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </GridListShell>
          )}
        </div>
      )}

      {!isLoading && !isError && (page > 0 || hasNext) && (
        <nav
          aria-label="Paginação de tarefas"
          className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
        >
          <span aria-live="polite">
            Página {page + 1} · tarefas {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + rows.length}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasNext || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </nav>
      )}

      {taskMissing && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
        >
          <span className="text-muted-foreground">
            A tarefa do link não está entre as tarefas carregadas ou você não tem acesso a ela.
          </span>
          <Button size="sm" variant="ghost" onClick={closeTask}>
            Fechar aviso
          </Button>
        </div>
      )}

      <TaskDetailsSheet
        task={
          selectedTask
            ? {
                ...selectedTask,
                custom_field_values: selectedTask.custom_field_values as Record<
                  string,
                  unknown
                > | null,
              }
            : null
        }
        open={!!selectedTask}
        showCoreFields
        onOpenChange={(v) => {
          if (!v) closeTask();
        }}
      />
    </div>
  );
}
