import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  Plus,
  Loader2,
  Copy,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  listInvoices,
  createInvoice,
  generateCharge,
  updateInvoiceStatus,
  deleteInvoice,
} from "@/lib/invoices.functions";
import { issueNfse } from "@/lib/nfse.functions";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ViewModeToggle } from "@/components/kanban/view-mode-toggle";

const INVOICE_STATUSES = [
  "draft",
  "open",
  "paid",
  "overdue",
  "cancelled",
  "refunded",
] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  open: "Em aberto",
  paid: "Paga",
  overdue: "Vencida",
  cancelled: "Cancelada",
  refunded: "Reembolsada",
};

// Status vem do gateway de pagamento — quadro somente leitura (sem "Mover para").
const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  open: "bg-primary",
  paid: "bg-emerald-500",
  overdue: "bg-destructive",
  cancelled: "bg-muted-foreground/40",
  refunded: "bg-amber-500",
};

export const Route = createFileRoute("/_authenticated/invoices")({
  validateSearch: (search: Record<string, unknown>): { view: "table" | "kanban" } => ({
    view: search.view === "kanban" ? "kanban" : "table",
  }),
  component: InvoicesPage,
});

const statusColor: Record<string, string> = {
  draft: "secondary",
  open: "default",
  paid: "default",
  overdue: "destructive",
  cancelled: "outline",
  refunded: "outline",
};

function InvoicesPage() {
  const list = useServerFn(listInvoices);
  const create = useServerFn(createInvoice);
  const charge = useServerFn(generateCharge);
  const updateStatus = useServerFn(updateInvoiceStatus);
  const del = useServerFn(deleteInvoice);
  const nfse = useServerFn(issueNfse);

  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    "all" | "draft" | "open" | "paid" | "overdue" | "cancelled" | "refunded"
  >("all");
  const [openCreate, setOpenCreate] = useState(false);

  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoices", status, search],
    queryFn: () =>
      list({ data: { status, search: search || undefined, limit: 200, gateway: "all" } }),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["invoices"] });
  }

  async function onGenerate(id: string, method: "pix" | "boleto") {
    try {
      const { sandbox } = await charge({ data: { invoice_id: id, method } });
      toast.success(sandbox ? "Cobrança gerada (sandbox)" : "Cobrança gerada");
      invalidate();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao gerar cobrança";
      toast.error(message);
    }
  }

  async function onPaid(id: string) {
    try {
      await updateStatus({ data: { id, status: "paid" } });
      toast.success("Marcada como paga");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function onDelete(id: string) {
    if (!(await confirmDialog("Excluir fatura?"))) return;
    try {
      await del({ data: { id } });
      toast.success("Excluída");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }
  async function onIssueNfse(id: string) {
    try {
      await nfse({ data: { invoice_id: id } });
      toast.success("Emissão de NFS-e iniciada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao emitir NFS-e");
    }
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Faturas"
        description="Cobrança de clientes via Pix, boleto e cartão (Asaas/Pagar.me/Mercado Pago)."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova fatura
              </Button>
            </DialogTrigger>
            <CreateInvoiceDialog
              onCreated={() => {
                setOpenCreate(false);
                invalidate();
              }}
              create={create}
            />
          </Dialog>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por número ou descrição"
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="open">Em aberto</SelectItem>
                <SelectItem value="paid">Pagas</SelectItem>
                <SelectItem value="overdue">Vencidas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="refunded">Reembolsadas</SelectItem>
              </SelectContent>
            </Select>
            <ViewModeToggle
              value={view}
              onChange={(v) => void navigate({ to: ".", search: (prev) => ({ ...prev, view: v }) })}
            />
          </div>
        </CardHeader>
        <CardContent>
          {view === "kanban" ? (
            <KanbanBoard
              rows={data?.invoices ?? []}
              table="customer_invoices"
              stageField="status"
              readOnly
              isLoading={isLoading}
              error={error}
              ariaLabel="Quadro de faturas por status"
              columns={INVOICE_STATUSES.map((s) => ({
                value: s,
                label: STATUS_LABEL[s] ?? s,
                tone: STATUS_DOT[s],
              }))}
              emptyState={
                <p className="p-12 text-center text-sm text-muted-foreground">
                  Nenhuma fatura encontrada.
                </p>
              }
              renderCard={(inv) => (
                <div className="space-y-1.5">
                  <p className="pr-6 text-sm font-medium">{inv.invoice_number}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="tabular-nums font-medium text-foreground">
                      {Number(inv.amount).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: inv.currency || "BRL",
                      })}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDateTime(inv.due_date).split(" ")[0]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{inv.gateway ?? "—"}</p>
                </div>
              )}
            />
          ) : (
            <>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.invoices?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma fatura encontrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          (statusColor[inv.status] ?? "secondary") as
                            | "default"
                            | "secondary"
                            | "destructive"
                            | "outline"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {Number(inv.amount).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: inv.currency || "BRL",
                      })}
                    </TableCell>
                    <TableCell>{formatDateTime(inv.due_date)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.gateway ?? "—"}{" "}
                      {inv.gateway_mode === "sandbox" && (
                        <Badge variant="outline" className="ml-1">
                          sandbox
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {inv.payment_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              navigator.clipboard.writeText(inv.payment_url!);
                              toast.success("Link copiado");
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {inv.payment_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(inv.payment_url!, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {!inv.payment_url && inv.status !== "paid" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onGenerate(inv.id, "pix")}
                            >
                              Pix
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onGenerate(inv.id, "boleto")}
                            >
                              Boleto
                            </Button>
                          </>
                        )}
                        {inv.status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onPaid(inv.id)}
                            title="Marcar como paga"
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {inv.status === "paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onIssueNfse(inv.id)}
                            title="Emitir NFS-e"
                          >
                            NFS-e
                          </Button>
                        )}

                        <Button variant="ghost" size="icon" onClick={() => onDelete(inv.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateInvoiceDialog({
  create,
  onCreated,
}: {
  create: ReturnType<typeof useServerFn<typeof createInvoice>>;
  onCreated: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("100");
  const [due, setDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await create({
        data: {
          description: description || undefined,
          amount: Number(amount),
          due_date: due,
          currency: "BRL",
          gateway: "manual",
          payment_method: "manual",
        },
      });
      toast.success("Fatura criada");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nova fatura</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="desc">Descrição</Label>
          <Input
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Serviço prestado..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (BRL)</Label>
            <CurrencyInput
              id="amount"
              currency="BRL"
              value={amount === "" ? null : Number(amount)}
              onValueChange={(n) => setAmount(n === null ? "" : String(n))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due">Vencimento</Label>
            <Input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={loading || !amount || !due}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Criar fatura
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
