import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listProposals, createProposal, deleteProposal } from "@/lib/proposals.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImportContractWizard } from "@/components/import-contract-wizard";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useGridSelection } from "@/components/grid/use-grid-selection";
import { GridBulkBar } from "@/components/grid/grid-bulk-bar";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ViewModeToggle } from "@/components/kanban/view-mode-toggle";

export const Route = createFileRoute("/_authenticated/proposals/")({
  validateSearch: (search: Record<string, unknown>): { view?: "table" | "kanban" } => ({
    view: search.view === "kanban" ? "kanban" : "table",
  }),
  component: ProposalsPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Recusada",
  expired: "Expirada",
  canceled: "Cancelada",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  in_review: "secondary",
  approved: "secondary",
  sent: "default",
  accepted: "default",
  rejected: "destructive",
  expired: "outline",
  canceled: "outline",
};

type ProposalRow = {
  id: string;
  title: string;
  version: number;
  status: string;
  currency: string;
  total_amount: number | string | null;
  assigned_to: string | null;
};

function ProposalsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listProposals);
  const create = useServerFn(createProposal);
  const del = useServerFn(deleteProposal);
  const { data } = useQuery({ queryKey: ["proposals"], queryFn: () => list() });
  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const { canAny } = usePermissions();
  const rows = filterRows((data ?? []) as unknown as ProposalRow[]) as ProposalRow[];
  const selection = useGridSelection(rows);
  const selectAllFiltered = () => selection.setSelectedIds(new Set(rows.map((r) => r.id)));
  const refresh = () => qc.invalidateQueries({ queryKey: ["proposals"] });
  const view = Route.useSearch().view ?? "table";
  const navigate = Route.useNavigate();
  const setView = (v: "table" | "kanban") =>
    void navigate({ to: ".", search: (prev) => ({ ...prev, view: v }) });
  const canUpdateProposal = canAny([
    "techcontracts.contracts.update.workspace",
    "techcontracts.contracts.update.team",
    "techcontracts.contracts.update.own",
  ]);

  const createM = useMutation({
    mutationFn: () => create({ data: { title, totalAmount: amount ? Number(amount) : null } }),
    onSuccess: () => {
      toast.success("Contrato criada");
      setOpen(false);
      setTitle("");
      setAmount("");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Contrato removida");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const money = (p: ProposalRow) =>
    p.total_amount
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: p.currency }).format(
          Number(p.total_amount),
        )
      : "sem valor";

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Gere, aprove e envie propostas comerciais com selo de validade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportContractWizard />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo contrato
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo contrato</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Título</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contrato Acme — Setembro"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Valor (BRL)</Label>
                  <CurrencyInput
                    currency="BRL"
                    value={amount === "" ? null : Number(amount)}
                    onValueChange={(n) => setAmount(n === null ? "" : String(n))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createM.mutate()} disabled={!title || createM.isPending}>
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Suas propostas</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <AssigneeFilter value={assignee} onChange={setAssignee} />
            <ViewModeToggle value={view} onChange={setView} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {view === "table" && selection.hasSelection && (
            <GridBulkBar
              table="proposals"
              ids={selection.ids}
              rows={selection.selectedRows}
              entityLabel="proposta(s)"
              onClear={selection.clear}
              onDone={() => void refresh()}
              totalMatching={rows.length}
              onSelectAll={selectAllFiltered}
              canUpdate={canAny([
                "techcontracts.contracts.update.workspace",
                "techcontracts.contracts.update.team",
                "techcontracts.contracts.update.own",
              ])}
              canDelete={canAny([
                "techcontracts.contracts.delete.workspace",
                "techcontracts.contracts.delete.own",
              ])}
              bulkEditFields={[
                {
                  name: "status",
                  label: "Status",
                  type: "select",
                  options: Object.entries(STATUS_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  })),
                },
              ]}
            />
          )}

          {view === "kanban" ? (
            <KanbanBoard
              rows={rows}
              table="proposals"
              stageField="status"
              selectable
              entityLabel="proposta"
              canDelete={canAny(["techcontracts.contracts.delete.workspace","techcontracts.contracts.delete.own"])}
              canUpdate={canUpdateProposal}
              invalidateKeys={[["proposals"]]}
              ariaLabel="Quadro de propostas"
              columns={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
              emptyState={
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nenhuma proposta ainda.</p>
                </div>
              }
              renderCard={(p) => (
                <div className="space-y-1 pr-6">
                  <Link
                    to="/proposals/$id"
                    params={{ id: p.id }}
                    className="block text-sm font-medium leading-snug hover:underline"
                  >
                    {p.title}
                  </Link>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>v{p.version}</span>
                    <span className="tabular-nums">{money(p)}</span>
                  </div>
                  <AssigneeCell assignedTo={p.assigned_to} className="text-xs" />
                </div>
              )}
            />
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma proposta ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Selecionar todas as propostas exibidas"
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
                    <TableHead>Título</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell>
                        <Checkbox
                          aria-label={`Selecionar ${p.title}`}
                          checked={selection.selectedIds.has(p.id)}
                          onCheckedChange={() => selection.toggleOne(p.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <Link
                            to="/proposals/$id"
                            params={{ id: p.id }}
                            className="font-medium hover:underline"
                          >
                            {p.title}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">v{p.version}</TableCell>
                      <TableCell className="text-sm">{money(p)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <AssigneeCell assignedTo={p.assigned_to} className="text-xs" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remover ${p.title}`}
                          onClick={async () => {
                            if (await confirmDialog("Remover proposta?")) delM.mutate(p.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
