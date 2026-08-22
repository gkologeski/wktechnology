import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DollarSign, Download, Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, formatDateTime } from "@/lib/crm";
import { listFinancialEntries } from "@/lib/finance.functions";
import { QuickCreateEntryDialog } from "@/components/finance/quick-create-entry-dialog";
import { RegisterPaymentDialog } from "@/components/finance/register-payment-dialog";
import {
  LegalEntitySelect,
  useLegalEntityFilter,
  useLegalEntityFilterInput,
} from "@/components/finance/legal-entity-select";
import { downloadCsv, toCsv } from "@/lib/csv-export";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { Checkbox } from "@/components/ui/checkbox";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ViewModeToggle } from "@/components/kanban/view-mode-toggle";
import { useViewMode } from "@/components/kanban/use-view-mode";

const STATUS_LABEL: Record<string, string> = {
  open: "Em aberto",
  partial: "Parcial",
  paid: "Pago",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  overdue: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  cancelled: "bg-muted text-muted-foreground",
};

// Dot da coluna do kanban. O status financeiro é derivado dos pagamentos
// (`recalc_financial_entry`), portanto o board é somente leitura.
const STATUS_DOT: Record<string, string> = {
  open: "bg-primary",
  partial: "bg-amber-500",
  paid: "bg-emerald-500",
  overdue: "bg-destructive",
  cancelled: "bg-muted-foreground/40",
};


type Entry = Awaited<ReturnType<typeof listFinancialEntries>>[number];

export function EntriesListPage({
  direction,
  title,
  description,
}: {
  direction: "receivable" | "payable";
  title: string;
  description: string;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listFinancialEntries);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [legalEntityId, setLegalEntityId] = useLegalEntityFilter();
  const [openNew, setOpenNew] = useState(false);
  const [payFor, setPayFor] = useState<Entry | null>(null);
  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  const [view, setView] = useViewMode();

  const filterInput = useLegalEntityFilterInput(legalEntityId);
  const { data: allRows = [], isLoading, error } = useQuery({

    queryKey: [
      "finance-entries",
      direction,
      status,
      search,
      legalEntityId,
      JSON.stringify(filterInput),
    ],
    queryFn: () =>
      list({
        data: {
          direction,
          status:
            status === "all"
              ? undefined
              : (status as "open" | "partial" | "paid" | "overdue" | "cancelled"),
          search: search || undefined,
          ...filterInput,
        },
      }),
  });

  const rows = useMemo(() => filterRows(allRows as Entry[]), [allRows, filterRows]);

  const total = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.amount) - Number(r.paid_amount ?? 0)), 0),
    [rows],
  );

  // Seleção múltipla / ações em massa (padrão de grids).
  const { canAny } = usePermissions();
  const selection = useGridSelection(
    rows as unknown as Array<Record<string, unknown> & { id: string }>,
  );
  const selectAllFiltered = () => selection.setSelectedIds(new Set(rows.map((r) => r.id)));
  const canUpdateEntries = canAny([
    "techfinance.entries.manage.workspace",
    "techfinance.entries.update.workspace",
    "techfinance.entries.update.team",
    "techfinance.entries.update.own",
  ]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["finance-entries", direction] });
    qc.invalidateQueries({ queryKey: ["finance", "dashboard"] });
  };

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title={title}
        description={description}
        count={rows.length}
        countLabel={rows.length === 1 ? "lançamento" : "lançamentos"}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={rows.length === 0}
              onClick={() => {
                const csv = toCsv(rows, [
                  { header: "Descrição", value: (r) => r.description },
                  { header: "Contraparte", value: (r) => r.companies?.name ?? "" },
                  { header: "Categoria", value: (r) => r.financial_categories?.name ?? "" },
                  { header: "Status", value: (r) => STATUS_LABEL[r.status] ?? r.status },
                  { header: "Valor", value: (r) => Number(r.amount).toFixed(2) },
                  {
                    header: "Em aberto",
                    value: (r) => (Number(r.amount) - Number(r.paid_amount ?? 0)).toFixed(2),
                  },
                  { header: "Moeda", value: (r) => r.currency ?? "BRL" },
                  { header: "Vencimento", value: (r) => r.due_date },
                  { header: "Competência", value: (r) => r.competence_date ?? "" },
                ]);
                downloadCsv(
                  `financeiro-${direction}-${new Date().toISOString().slice(0, 10)}`,
                  csv,
                );
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
            <Button onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo lançamento
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52">
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
        <LegalEntitySelect value={legalEntityId} onChange={setLegalEntityId} />
        <AssigneeFilter value={assignee} onChange={setAssignee} />
        <ViewModeToggle value={view} onChange={setView} />
        <div className="ml-auto text-sm text-muted-foreground">
          Total em aberto:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {view === "table" && selection.hasSelection && (

        <GridBulkBar
          table="financial_entries"
          ids={selection.ids}
          rows={selection.selectedRows}
          entityLabel="lançamento(s)"
          onClear={selection.clear}
          onDone={() => {
            selection.clear();
            invalidate();
          }}
          totalMatching={rows.length}
          onSelectAll={selectAllFiltered}
          canUpdate={canUpdateEntries}
          canDelete={canAny([
            "techfinance.entries.manage.workspace",
            "techfinance.entries.delete.workspace",
            "techfinance.entries.delete.own",
          ])}
          bulkEditFields={[
            {
              name: "status",
              label: "Status",
              type: "select",
              options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
            },
            { name: "due_date", label: "Vencimento", type: "date" },
            { name: "competence_date", label: "Competência", type: "date" },
          ]}
        />
      )}

      {view === "kanban" && (
        <KanbanBoard
          rows={rows as Array<Entry & { id: string }>}
          table="financial_entries"
          stageField="status"
          selectable
          entityLabel="lançamento"
          canDelete={canAny(["techfinance.entries.manage.workspace","techfinance.entries.delete.workspace","techfinance.entries.delete.own"])}
          readOnly
          isLoading={isLoading}
          error={error}
          ariaLabel="Quadro de lançamentos por status"
          columns={Object.entries(STATUS_LABEL).map(([value, label]) => ({
            value,
            label,
            tone: STATUS_DOT[value],
          }))}
          emptyState={
            <div className="p-12 text-center">
              <DollarSign className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Nenhum lançamento</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Crie manualmente ou aguarde a geração automática por serviços e contratos.
              </p>
              <Button className="mt-4" onClick={() => setOpenNew(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo lançamento
              </Button>
            </div>
          }
          renderCard={(e) => (
            <div className="space-y-1.5">
              <Link
                to="/finance/entries/$id"
                params={{ id: e.id }}
                className="block pr-6 text-sm font-medium hover:underline"
              >
                {e.description}
              </Link>
              <p className="text-xs text-muted-foreground">{e.companies?.name ?? "—"}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="tabular-nums font-medium text-foreground">
                  {formatCurrency(Number(e.amount), e.currency)}
                </span>
                <span className="text-muted-foreground">
                  {formatDateTime(e.due_date).split(" ")[0]}
                </span>
              </div>
              <Badge variant="outline" className={STATUS_TONE[e.status] ?? ""}>
                {STATUS_LABEL[e.status] ?? e.status}
              </Badge>
            </div>
          )}
        />
      )}

      {view === "table" && (
        <div className="rounded-lg border bg-card">


        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhum lançamento</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Crie manualmente ou aguarde a geração automática por serviços e contratos.
            </p>
            <Button className="mt-4" onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo lançamento
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Selecionar todos os lançamentos exibidos"
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
                <TableHead>Descrição</TableHead>
                <TableHead>Contraparte</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => {
                const outstanding = Number(e.amount) - Number(e.paid_amount ?? 0);
                const paid = e.status === "paid" || e.status === "cancelled";
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Selecionar lançamento ${e.description}`}
                        checked={selection.selectedIds.has(e.id)}
                        onCheckedChange={() => selection.toggleOne(e.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/finance/entries/$id"
                        params={{ id: e.id }}
                        className="font-medium hover:underline"
                      >
                        {e.description}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {e.installment_total && e.installment_total > 1 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {e.installment_number ?? "?"}/{e.installment_total}
                          </Badge>
                        )}
                        {e.contracts && (
                          <span>Contrato {e.contracts.number ?? e.contracts.title}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{e.companies?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{e.financial_categories?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_TONE[e.status] ?? ""}>
                        {STATUS_LABEL[e.status] ?? e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(e.amount), e.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(outstanding, e.currency)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(e.due_date).split(" ")[0]}
                    </TableCell>
                    <TableCell>
                      <AssigneeCell
                        assignedTo={(e as { assigned_to?: string | null }).assigned_to}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {!paid && (
                        <Button size="sm" variant="outline" onClick={() => setPayFor(e)}>
                          Baixar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        </div>
      )}


      <QuickCreateEntryDialog
        open={openNew}
        onOpenChange={setOpenNew}
        defaultDirection={direction}
        onCreated={invalidate}
      />
      <RegisterPaymentDialog
        entry={payFor}
        onOpenChange={(open) => !open && setPayFor(null)}
        onDone={invalidate}
      />
    </div>
  );
}
