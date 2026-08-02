import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import {
  cancelFinancialEntry,
  deletePayment,
  getFinancialEntry,
  listInstallmentSiblings,
  deleteInstallmentGroup,
} from "@/lib/finance.functions";
import { RegisterPaymentDialog } from "@/components/finance/register-payment-dialog";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/finance/entries/$id")({
  component: EntryDetailsPage,
});

const STATUS_LABEL: Record<string, string> = {
  open: "Em aberto",
  partial: "Parcial",
  paid: "Pago",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

function EntryDetailsPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const get = useServerFn(getFinancialEntry);
  const cancelFn = useServerFn(cancelFinancialEntry);
  const delPayment = useServerFn(deletePayment);
  const listSiblings = useServerFn(listInstallmentSiblings);
  const delGroup = useServerFn(deleteInstallmentGroup);

  const [payOpen, setPayOpen] = useState(false);

  const { data: entry, isLoading, refetch } = useQuery({
    queryKey: ["finance-entry", id],
    queryFn: () => get({ data: { id } }),
  });

  const isInstallment =
    !!(entry && (entry.parent_entry_id || (entry.installment_total && entry.installment_total > 1)));
  const parentId = entry?.parent_entry_id ?? entry?.id ?? null;

  const { data: siblings } = useQuery({
    queryKey: ["finance-entry-siblings", id],
    queryFn: () => listSiblings({ data: { entry_id: id } }),
    enabled: isInstallment,
  });

  const invalidate = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["finance-entries"] });
    qc.invalidateQueries({ queryKey: ["finance-entry-siblings"] });
    qc.invalidateQueries({ queryKey: ["finance", "dashboard"] });
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!entry) {
    return (
      <div className="p-6 space-y-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/finance">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Lançamento não encontrado.</p>
      </div>
    );
  }

  const outstanding = Number(entry.amount) - Number(entry.paid_amount ?? 0);
  const canPay = entry.status !== "paid" && entry.status !== "cancelled";

  return (
    <div className="p-6 space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link
          to={entry.direction === "receivable" ? "/finance/receivable" : "/finance/payable"}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>
      </Button>

      <PageHeader
        title={entry.description}
        description={
          entry.direction === "receivable" ? "Conta a receber" : "Conta a pagar"
        }
        actions={
          <div className="flex gap-2">
            {canPay && (
              <Button onClick={() => setPayOpen(true)}>
                {entry.direction === "receivable" ? "Registrar recebimento" : "Registrar pagamento"}
              </Button>
            )}
            {entry.status !== "cancelled" && entry.status !== "paid" && (
              <Button
                variant="outline"
                onClick={async () => {
                  await cancelFn({ data: { id: entry.id } });
                  toast.success("Lançamento cancelado");
                  invalidate();
                }}
              >
                <Ban className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Valor total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatCurrency(Number(entry.amount), entry.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Em aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatCurrency(outstanding, entry.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-sm">
              {STATUS_LABEL[entry.status] ?? entry.status}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <Row label="Contraparte" value={entry.companies?.name ?? "—"} />
          <Row label="Categoria" value={entry.financial_categories?.name ?? "—"} />
          <Row label="Competência" value={formatDateTime(entry.competence_date).split(" ")[0]} />
          <Row label="Vencimento" value={formatDateTime(entry.due_date).split(" ")[0]} />
          <Row label="Origem" value={entry.origin_type} />
          <Row
            label="Contrato / Serviço"
            value={
              entry.contracts
                ? `Contrato ${entry.contracts.number ?? entry.contracts.title}`
                : entry.services
                  ? `Serviço ${entry.services.name}`
                  : "—"
            }
          />
          {entry.notes && (
            <div className="sm:col-span-2">
              <div className="text-muted-foreground text-xs">Notas</div>
              <div className="mt-1 whitespace-pre-wrap">{entry.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {isInstallment && siblings && siblings.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Parcelamento</CardTitle>
            {parentId && siblings.some((s) => s.status === "open" || s.status === "overdue") && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!(await confirmDialog("Excluir todas as parcelas em aberto deste grupo?"))) return;
                  const r = await delGroup({ data: { parent_entry_id: parentId, only_open: true } });
                  toast.success(`${r.deleted} parcela(s) excluída(s); ${r.kept} mantida(s).`);
                  invalidate();
                  navigate({
                    to: entry.direction === "receivable" ? "/finance/receivable" : "/finance/payable",
                  });
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Excluir parcelas em aberto
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {siblings.map((s) => (
                  <TableRow
                    key={s.id}
                    className={s.id === entry.id ? "bg-muted/50" : "cursor-pointer"}
                    onClick={() => {
                      if (s.id !== entry.id) navigate({ to: "/finance/entries/$id", params: { id: s.id } });
                    }}
                  >
                    <TableCell className="text-sm tabular-nums">
                      {s.installment_number}/{s.installment_total}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateTime(s.due_date).split(" ")[0]}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatCurrency(Number(s.amount), entry.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader>
          <CardTitle>Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {entry.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entry.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      {formatDateTime(p.paid_at).split(" ")[0]}
                    </TableCell>
                    <TableCell className="text-sm">{p.method ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {p.financial_bank_accounts?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(p.amount), entry.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          await delPayment({ data: { id: p.id } });
                          toast.success("Pagamento removido");
                          invalidate();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RegisterPaymentDialog
        entry={payOpen ? entry : null}
        onOpenChange={(o) => setPayOpen(o)}
        onDone={invalidate}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
