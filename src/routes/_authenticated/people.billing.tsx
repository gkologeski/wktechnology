// TechPeople · Sprint 13 — /people/billing
// Aprovação de timesheet + geração de fatura a partir das horas billable.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, FileText, Clock, DollarSign } from "lucide-react";

import { IsoDateRangePicker } from "@/components/iso-date-range-picker";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  listPendingBillableGroups,
  generateInvoiceFromTimesheet,
  approveAllocationTimesheet,
  type PendingBillingGroup,
} from "@/lib/people/billing.functions";

export const Route = createFileRoute("/_authenticated/people/billing")({
  head: () => ({
    meta: [
      { title: "Faturamento de horas — TechPeople" },
      {
        name: "description",
        content:
          "Aprove horas billable e gere faturas a partir dos apontamentos consolidados por alocação.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PeopleBillingPage,
});

function fmtCurrency(v: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function PeopleBillingPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingBillableGroups);
  const genFn = useServerFn(generateInvoiceFromTimesheet);
  const approveFn = useServerFn(approveAllocationTimesheet);

  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>(todayIso());
  const [selected, setSelected] = useState<PendingBillingGroup | null>(null);
  const [dueDate, setDueDate] = useState<string>(plusDaysIso(15));

  const q = useQuery({
    queryKey: ["people-billing-groups", start, end],
    queryFn: () => listFn({ data: { start: start || undefined, end: end || undefined } }),
  });

  const genMut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          allocation_id: selected!.allocation_id,
          start: start || undefined,
          end: end || undefined,
          due_date: dueDate,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `Fatura ${res.invoice.invoice_number} criada — ${res.entries_linked} apontamento(s) vinculado(s).`,
      );
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["people-billing-groups"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar fatura");
    },
  });

  const approveMut = useMutation({
    mutationFn: (g: PendingBillingGroup) =>
      approveFn({
        data: {
          allocation_id: g.allocation_id,
          start: start || undefined,
          end: end || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Horas aprovadas");
      qc.invalidateQueries({ queryKey: ["people-billing-groups"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Falha ao aprovar");
    },
  });

  const groups = q.data?.groups ?? [];
  const totalHours = groups.reduce((s, g) => s + g.hours, 0);
  const totalAmount = groups.reduce((s, g) => s + g.amount, 0);
  const totalEntries = groups.reduce((s, g) => s + g.entries_count, 0);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Faturamento de horas"
        description="Horas billable aprovadas por alocação, prontas para virar fatura."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/people">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Horas pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totalHours.toFixed(2)}h</div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalEntries} apontamento(s) em {groups.length} alocação(ões)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Valor pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{fmtCurrency(totalAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Período</CardTitle>
          </CardHeader>
          <CardContent>
            <IsoDateRangePicker
              className="w-full"
              ariaLabel="Período de faturamento"
              placeholder="Todo o período"
              from={start}
              to={end}
              onChange={({ from, to }) => {
                setStart(from);
                setEnd(to);
              }}
              onClear={() => {
                setStart("");
                setEnd("");
              }}
            />

          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alocações com horas a faturar</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : groups.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              Nenhuma hora billable aprovada pendente de faturamento neste período.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.allocation_id}>
                    <TableCell className="font-medium">
                      {g.company_name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {g.contract_number || g.contract_title ? (
                        <div className="flex flex-col">
                          <span className="text-sm">{g.contract_number ?? g.contract_title}</span>
                          {g.contract_number && g.contract_title && (
                            <span className="text-xs text-muted-foreground">
                              {g.contract_title}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline">Sem contrato</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{g.person_name ?? "—"}</span>
                        {g.role_title && (
                          <span className="text-xs text-muted-foreground">{g.role_title}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {g.min_date && g.max_date ? `${g.min_date} → ${g.max_date}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{g.hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtCurrency(g.amount, g.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveMut.mutate(g)}
                          disabled={approveMut.isPending}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Aprovar pendentes
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelected(g);
                            setDueDate(plusDaysIso(15));
                          }}
                        >
                          <FileText className="mr-1 h-3.5 w-3.5" /> Faturar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar fatura</DialogTitle>
            <DialogDescription>
              Uma fatura em rascunho será criada com todas as horas billable aprovadas desta
              alocação no período selecionado.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Empresa:</span>{" "}
                  <span className="font-medium">{selected.company_name ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pessoa:</span>{" "}
                  <span className="font-medium">{selected.person_name ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Horas:</span>{" "}
                  <span className="font-medium">{selected.hours.toFixed(2)}h</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor:</span>{" "}
                  <span className="font-medium">
                    {fmtCurrency(selected.amount, selected.currency)}
                  </span>
                </div>
              </div>
              <div>
                <Label htmlFor="due-date">Vencimento</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancelar
            </Button>
            <Button onClick={() => genMut.mutate()} disabled={genMut.isPending || !dueDate}>
              {genMut.isPending ? "Gerando..." : "Gerar fatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
