// TechProjects — listagem cross-project de `project_tasks`.
// Desacopla o menu de "Tarefas" do domínio de Sales (`activities` em /tasks).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { listAllProjectTasks, listProjects } from "@/lib/projects.functions";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";


export const Route = createFileRoute("/_authenticated/projects/tasks")({
  head: () => ({
    meta: [
      { title: "Tarefas de projetos" },
      {
        name: "description",
        content: "Tarefas de todos os projetos ativos com filtros por status, projeto e responsável.",
      },
    ],
  }),
  component: ProjectTasksPage,
});

const STATUS_LABEL: Record<string, string> = {
  todo: "A fazer",
  doing: "Em execução",
  review: "Em revisão",
  done: "Concluída",
};

const STATUS_TONE: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  doing: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  review: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

type StatusFilter = "all" | "todo" | "doing" | "review" | "done";
type OwnerFilter = "all" | "mine";

function ProjectTasksPage() {
  const qc = useQueryClient();
  const listTasksFn = useServerFn(listAllProjectTasks);
  const listProjectsFn = useServerFn(listProjects);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [projectId, setProjectId] = useState<string>("all");
  const [owner, setOwner] = useState<OwnerFilter>("all");

  const projectsQ = useQuery({
    queryKey: ["projects", "picker"],
    queryFn: () => listProjectsFn({ data: {} }),
    staleTime: 60_000,
  });

  const tasksKey = ["project_tasks", "all", { status, projectId, owner, search }] as const;
  const { data: rows = [], isLoading } = useQuery({
    queryKey: tasksKey,
    queryFn: () =>
      listTasksFn({
        data: {
          status: status === "all" ? undefined : status,
          projectId: projectId === "all" ? undefined : projectId,
          mineOnly: owner === "mine" ? true : undefined,
          search: search || undefined,
        },
      }),
  });

  const projectOptions = useMemo(
    () =>
      (projectsQ.data ?? []).map((p: { id: string; name: string }) => ({
        id: p.id,
        name: p.name,
      })),
    [projectsQ.data],
  );

  // Seleção múltipla / ações em massa (padrão de grids — Fase 4).
  const { canAny } = usePermissions();
  const selection = useGridSelection(rows as Array<(typeof rows)[number] & { id: string }>);
  const selectAllFiltered = () => selection.setSelectedIds(new Set(rows.map((t) => t.id)));
  const canUpdate = canAny([
    "techprojects.tasks.update.workspace",
    "techprojects.tasks.update.team",
    "techprojects.tasks.update.own",
  ]);
  const canDelete = canAny([
    "techprojects.tasks.delete.workspace",
    "techprojects.tasks.delete.own",
  ]);


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
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projectOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={(v) => setOwner(v as OwnerFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="mine">Minhas tarefas</SelectItem>
          </SelectContent>
        </Select>
      </div>


      {selection.hasSelection && (
        <GridBulkBar
          table="project_tasks"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="tarefa(s)"
          onClear={selection.clear}
          onDone={() => void qc.invalidateQueries({ queryKey: ["project_tasks"] })}
          totalMatching={rows.length}
          onSelectAll={selectAllFiltered}
          assignColumn={canUpdate ? "assignee_id" : null}
          canUpdate={canUpdate}
          canDelete={canDelete}
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
                <TableHead>Título</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Horas est.</TableHead>
                <TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => {
                const project = (t as { projects?: { id: string; name: string } }).projects;
                return (
                  <TableRow key={t.id} data-state={selection.isSelected(t.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selection.isSelected(t.id)}
                        onCheckedChange={() => selection.toggleOne(t.id)}
                        aria-label={`Selecionar tarefa ${t.title}`}
                      />
                    </TableCell>
                    <TableCell>

                      {project ? (
                        <Link
                          to="/projects/$id"
                          params={{ id: project.id }}
                          className="font-medium hover:underline"
                        >
                          {t.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{t.title}</span>
                      )}
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
        )}
      </div>
    </div>
  );
}
