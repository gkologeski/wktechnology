import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { listServices } from "@/lib/services.functions";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import { useGridColumns, type GridColumnDef } from "@/hooks/use-grid-columns";
import { useGridSelection, idQueryFor } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ViewModeToggle } from "@/components/kanban/view-mode-toggle";

export const Route = createFileRoute("/_authenticated/services/")({
  validateSearch: (search: Record<string, unknown>): { view?: "table" | "kanban" } => ({
    view: search.view === "kanban" ? "kanban" : "table",
  }),
  head: () => ({
    meta: [
      { title: "Serviços em execução" },
      {
        name: "description",
        content:
          "Serviços em execução vinculados a contratos, com cadência de faturamento e entrega.",
      },
    ],
  }),
  component: ServicesPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  active: "Ativo",
  paused: "Pausado",
  cancelled: "Cancelado",
  completed: "Concluído",
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  paused: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  cancelled: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  completed: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

// Tokens semânticos do "dot" das colunas do kanban.
const KANBAN_TONE: Record<string, string> = {
  pending: "bg-muted-foreground/40",
  active: "bg-emerald-500",
  paused: "bg-amber-500",
  cancelled: "bg-rose-500",
  completed: "bg-blue-500",
};

const TYPE_LABEL: Record<string, string> = {
  recurring: "Recorrente",
  one_time: "Único",
  milestone: "Por marco",
  usage_based: "Por uso",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceRow = { id: string; assigned_to?: string | null } & Record<string, any>;

function ServicesPage() {
  const list = useServerFn(listServices);
  const qc = useQueryClient();
  const { canAny } = usePermissions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const { assignee, setAssignee, filterRows } = useAssigneeFilter();

  const view = Route.useSearch().view ?? "table";
  const navigate = Route.useNavigate();
  const setView = (v: "table" | "kanban") =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, view: v }) });

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["services", { status, type, search }],
    queryFn: () =>
      list({
        data: {
          status: status === "all" ? undefined : (status as any),
          type: type === "all" ? undefined : (type as any),
          search: search || undefined,
        },
      }),
  });

  const rows = filterRows(allRows as ServiceRow[]) as ServiceRow[];

  const allColumns: GridColumnDef<ServiceRow>[] = [
    {
      key: "name",
      label: "Nome",
      render: (s) => (
        <Link to="/services/$id" params={{ id: s.id }} className="font-medium hover:underline">
          {s.name}
        </Link>
      ),
    },
    {
      key: "contract",
      label: "Contrato",
      className: "text-xs text-muted-foreground",
      render: (s) =>
        s.contracts ? (
          <Link to="/contracts/$id" params={{ id: s.contracts.id }} className="hover:underline">
            {s.contracts.number ?? s.contracts.title}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "type",
      label: "Tipo",
      className: "text-sm",
      render: (s) => TYPE_LABEL[s.type] ?? s.type,
    },
    {
      key: "status",
      label: "Status",
      render: (s) => (
        <Badge variant="outline" className={STATUS_TONE[s.status] ?? ""}>
          {STATUS_LABEL[s.status] ?? s.status}
        </Badge>
      ),
    },
    {
      key: "amount",
      label: "Valor",
      className: "text-right tabular-nums",
      headerClassName: "text-right",
      render: (s) => formatCurrency(Number(s.quantity) * Number(s.unit_price), s.currency),
    },
    {
      key: "next_billing_at",
      label: "Próxima cobrança",
      className: "text-xs text-muted-foreground",
      render: (s) =>
        s.next_billing_at ? formatDateTime(s.next_billing_at as string).split(" ")[0] : "—",
    },
    {
      key: "assigned_to",
      label: "Responsável",
      render: (s) => <AssigneeCell assignedTo={s.assigned_to} />,
    },
  ];

  const grid = useGridColumns<ServiceRow>({
    gridKey: "services",
    columns: allColumns,
    defaults: ["name", "contract", "type", "status", "amount", "next_billing_at", "assigned_to"],
  });

  const selection = useGridSelection(rows, {
    buildIdQuery: idQueryFor("services", (q) =>
      status === "all" ? q : (q as any).eq("status", status),
    ),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["services"] });

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Serviços em execução"
        description="Visão operacional dos serviços vinculados a contratos, com cadência de faturamento e entrega. Novos serviços nascem dentro de um contrato."
        count={rows.length}
        countLabel={rows.length === 1 ? "serviço" : "serviços"}
        actions={
          <div className="flex items-center gap-2">
            <ViewModeToggle value={view} onChange={setView} />
            <grid.ColumnsButton />
          </div>
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
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
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
        <AssigneeFilter value={assignee} onChange={setAssignee} />
      </div>

      {view === "table" && selection.hasSelection && (
        <GridBulkBar
          table="services"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="serviço(s)"
          onClear={selection.clear}
          onDone={refresh}
          totalMatching={rows.length}
          onSelectAll={selection.selectAllMatching}
          isSelectingAll={selection.isSelectingAll}
          canUpdate={canAny([
            "techservice.services.update.workspace",
            "techservice.services.update.own",
            "techsales.catalog.services.update.workspace",
          ])}
          canDelete={canAny([
            "techservice.services.delete.workspace",
            "techservice.services.delete.own",
            "techsales.catalog.services.delete.workspace",
          ])}
          bulkEditFields={[
            {
              name: "status",
              label: "Status",
              type: "select",
              options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
            },
            {
              name: "type",
              label: "Tipo",
              type: "select",
              options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })),
            },
            { name: "next_billing_at", label: "Próxima cobrança", type: "date" },
          ]}
        />
      )}

      {view === "kanban" && (
        <KanbanBoard
          rows={rows}
          table="services"
          stageField="status"
          selectable
          entityLabel="serviço"
          canDelete={canAny(["techservice.services.delete.workspace","techservice.services.delete.own","techsales.catalog.services.delete.workspace"])}
          canUpdate={canAny([
            "techservice.services.update.workspace",
            "techservice.services.update.own",
            "techsales.catalog.services.update.workspace",
          ])}
          isLoading={isLoading}
          invalidateKeys={[["services"]]}
          ariaLabel="Quadro de serviços"
          columns={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value,
            label,
            tone: KANBAN_TONE[value],
          }))}
          emptyState={
            <div className="p-12 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhum serviço ainda</h3>
            </div>
          }
          renderCard={(s) => (
            <div className="space-y-1 pr-6">
              <Link
                to="/services/$id"
                params={{ id: s.id }}
                className="text-sm font-medium hover:underline"
              >
                {s.name}
              </Link>
              <p className="text-xs text-muted-foreground">{TYPE_LABEL[s.type] ?? s.type}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(Number(s.quantity) * Number(s.unit_price), s.currency)}
                </span>
                <AssigneeCell assignedTo={s.assigned_to} />
              </div>
            </div>
          )}
        />
      )}

      <div className={`rounded-lg border bg-card ${view === "kanban" ? "hidden" : ""}`}>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhum serviço ainda</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Crie serviços dentro de um contrato. O motor de billing gera automaticamente as contas
              conforme a cadência.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Selecionar todos da página"
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
                {grid.columns.map((c) => (
                  <TableHead key={c.key} className={c.headerClassName}>
                    {c.header ?? c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow
                  key={s.id}
                  data-state={selection.isSelected(s.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      aria-label="Selecionar serviço"
                      checked={selection.isSelected(s.id)}
                      onCheckedChange={() => selection.toggleOne(s.id)}
                    />
                  </TableCell>
                  {grid.columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.render(s)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <grid.ColumnsEditor />
    </div>
  );
}
