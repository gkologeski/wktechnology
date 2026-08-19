import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Kanban, Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { listProjects } from "@/lib/projects.functions";
import { formatDateTime } from "@/lib/crm";
import { QuickCreateProjectDialog } from "@/components/projects/quick-create-project-dialog";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { Checkbox } from "@/components/ui/checkbox";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ViewModeToggle } from "@/components/kanban/view-mode-toggle";

export const Route = createFileRoute("/_authenticated/projects/")({
  validateSearch: (search: Record<string, unknown>): { view?: "table" | "kanban" } => ({
    view: search.view === "kanban" ? "kanban" : "table",
  }),
  head: () => ({
    meta: [
      { title: "Projetos" },
      {
        name: "description",
        content: "Projetos com marcos billáveis, timesheet e custo × receita.",
      },
    ],
  }),
  component: ProjectsPage,
});

const STATUS_LABEL: Record<string, string> = {
  planning: "Planejamento",
  active: "Ativo",
  on_hold: "Em espera",
  done: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_TONE: Record<string, string> = {
  planning: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  on_hold: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  done: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  cancelled: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

const KANBAN_TONE: Record<string, string> = {
  planning: "bg-muted-foreground/40",
  active: "bg-emerald-500",
  on_hold: "bg-amber-500",
  done: "bg-primary",
  cancelled: "bg-destructive",
};

function ProjectsPage() {
  const list = useServerFn(listProjects);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [openCreate, setOpenCreate] = useState(false);
  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  const view = Route.useSearch().view ?? "table";
  const navigate = Route.useNavigate();
  const setView = (v: "table" | "kanban") =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, view: v }) });



  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["projects", { status, search }],
    queryFn: () =>
      list({
        data: {
          status: status === "all" ? undefined : (status as any),
          search: search || undefined,
        },
      }),
  });

  const rows = filterRows(allRows as any[]);

  // Seleção múltipla / ações em massa (padrão de grids).
  const { canAny } = usePermissions();
  const selection = useGridSelection(rows as Array<{ id: string }>);
  const selectAllFiltered = () =>
    selection.setSelectedIds(new Set(rows.map((r: any) => r.id as string)));

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Projetos"
        description="Entregas com marcos billáveis, apontamento de horas e margem por projeto."
        count={rows.length}
        countLabel={rows.length === 1 ? "projeto" : "projetos"}
        actions={
          <Button onClick={() => setOpenCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" /> Novo projeto
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
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
        <AssigneeFilter value={assignee} onChange={setAssignee} />
        <ViewModeToggle value={view} onChange={setView} />
      </div>

      {view === "table" && selection.hasSelection && (
        <GridBulkBar
          table="projects"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="projeto(s)"
          onClear={selection.clear}
          onDone={() => {
            selection.clear();
            void qc.invalidateQueries({ queryKey: ["projects"] });
          }}
          totalMatching={rows.length}
          onSelectAll={selectAllFiltered}
          canUpdate={canAny([
            "techprojects.projects.update.workspace",
            "techprojects.projects.update.team",
            "techprojects.projects.update.own",
          ])}
          canDelete={canAny([
            "techprojects.projects.delete.workspace",
            "techprojects.projects.delete.own",
          ])}
          bulkEditFields={[
            {
              name: "status",
              label: "Status",
              type: "select",
              options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
            },
            { name: "due_at", label: "Prazo", type: "date" },
          ]}
        />
      )}

      {view === "kanban" ? (
        <KanbanBoard
          rows={rows as Array<{ id: string }>}
          table="projects"
          stageField="status"
          canUpdate={canAny([
            "techprojects.projects.update.workspace",
            "techprojects.projects.update.team",
            "techprojects.projects.update.own",
          ])}
          isLoading={isLoading}
          invalidateKeys={[["projects"]]}
          ariaLabel="Quadro de projetos"
          columns={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value,
            label,
            tone: KANBAN_TONE[value],
          }))}
          emptyState={
            <div className="p-12 text-center">
              <Kanban className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhum projeto ainda</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Crie um projeto avulso ou a partir de um contrato/serviço.
              </p>
            </div>
          }
          renderCard={(row) => {
            const p = row as any;
            return (
              <div className="space-y-1 pr-6">
                <Link
                  to="/projects/$id"
                  params={{ id: p.id }}
                  className="block text-sm font-medium leading-snug hover:underline"
                >
                  {p.name}
                </Link>
                {p.contracts && (
                  <p className="text-xs text-muted-foreground">
                    {p.contracts.number ?? p.contracts.title}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.due_at ? formatDateTime(p.due_at).split(" ")[0] : "sem prazo"}</span>
                  <span className="tabular-nums">{p.progress ?? 0}%</span>
                </div>
                <AssigneeCell assignedTo={p.assigned_to} />
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
            <Kanban className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhum projeto ainda</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Crie um projeto avulso ou a partir de um contrato/serviço.
            </p>
            <Button className="mt-4" size="sm" onClick={() => setOpenCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo projeto
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Selecionar todos os projetos exibidos"
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
                <TableHead>Contrato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Progresso</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Selecionar projeto ${p.name}`}
                      checked={selection.selectedIds.has(p.id)}
                      onCheckedChange={() => selection.toggleOne(p.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/projects/$id"
                      params={{ id: p.id }}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.contracts ? (
                      <Link
                        to="/contracts/$id"
                        params={{ id: p.contracts.id }}
                        className="hover:underline"
                      >
                        {p.contracts.number ?? p.contracts.title}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_TONE[p.status] ?? ""}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.progress ?? 0}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.due_at ? formatDateTime(p.due_at).split(" ")[0] : "—"}
                  </TableCell>
                  <TableCell>
                    <AssigneeCell assignedTo={p.assigned_to} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      )}

      <QuickCreateProjectDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        onCreated={() => qc.invalidateQueries({ queryKey: ["projects"] })}
      />
    </div>
  );
}
