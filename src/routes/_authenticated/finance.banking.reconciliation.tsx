// Sprint G — Fase 3: Conciliação bancária.
// Tela para revisar pendências, aceitar/ignorar sugestões e reativar
// conciliações do histórico.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ScanSearch,
  Wand2,
  FilePlus2,
} from "lucide-react";

import {
  getBankConnection,
  suggestReconciliationMatches,
  listReconciliationHistory,
  setStatementReconciliation,
  bulkIgnoreTransactions,
  bulkLinkBestMatch,
  bulkCreateEntries,
} from "@/lib/banking.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/finance/banking/reconciliation")({
  component: ReconciliationPage,
  head: () => ({
    meta: [
      { title: "Conciliação bancária | TechFinance" },
      {
        name: "description",
        content:
          "Revise pendências de conciliação, aceite ou ignore matches e reative conciliações do histórico.",
      },
    ],
  }),
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function ReconciliationPage() {
  const qc = useQueryClient();
  const getConn = useServerFn(getBankConnection);
  const suggestFn = useServerFn(suggestReconciliationMatches);
  const historyFn = useServerFn(listReconciliationHistory);
  const setRecon = useServerFn(setStatementReconciliation);

  const [windowDays, setWindowDays] = useState(5);
  const [historyStatus, setHistoryStatus] = useState<"matched" | "ignored" | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const clearSelection = () => setSelected(new Set());

  const bulkIgnoreFn = useServerFn(bulkIgnoreTransactions);
  const bulkLinkFn = useServerFn(bulkLinkBestMatch);
  const bulkCreateFn = useServerFn(bulkCreateEntries);

  const connQ = useQuery({
    queryKey: ["banking", "connection", "inter"],
    queryFn: () => getConn({ data: { provider: "inter" } }),
  });
  const connection = connQ.data?.connection;
  const connectionId = connection?.id as string | undefined;

  const suggestQ = useQuery({
    queryKey: ["banking", "suggestions", connectionId, windowDays],
    queryFn: () =>
      suggestFn({
        data: { connection_id: connectionId!, window_days: windowDays, limit: 50 },
      }),
    enabled: !!connectionId,
  });

  const historyQ = useQuery({
    queryKey: ["banking", "history", connectionId, historyStatus],
    queryFn: () =>
      historyFn({
        data: { connection_id: connectionId!, status: historyStatus, limit: 100 },
      }),
    enabled: !!connectionId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["banking"] });
  };

  const acceptMut = useMutation({
    mutationFn: (v: { transaction_id: string; payment_id: string }) =>
      setRecon({
        data: {
          transaction_id: v.transaction_id,
          status: "matched",
          matched_payment_id: v.payment_id,
        },
      }),
    onSuccess: () => {
      toast.success("Match aceito");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao aceitar match"),
  });

  const ignoreMut = useMutation({
    mutationFn: (transaction_id: string) =>
      setRecon({
        data: { transaction_id, status: "ignored", matched_payment_id: null },
      }),
    onSuccess: () => {
      toast.success("Transação ignorada");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao ignorar"),
  });

  const reactivateMut = useMutation({
    mutationFn: (transaction_id: string) =>
      setRecon({
        data: { transaction_id, status: "pending", matched_payment_id: null },
      }),
    onSuccess: () => {
      toast.success("Conciliação reativada");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reativar"),
  });

  const bulkIgnoreMut = useMutation({
    mutationFn: (ids: string[]) => bulkIgnoreFn({ data: { transaction_ids: ids } }),
    onSuccess: (r: any) => {
      toast.success(`${r?.updated ?? 0} transação(ões) ignorada(s)`);
      clearSelection();
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao ignorar em lote"),
  });

  const bulkLinkMut = useMutation({
    mutationFn: (ids: string[]) =>
      bulkLinkFn({
        data: {
          connection_id: connectionId!,
          window_days: windowDays,
          transaction_ids: ids,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(`${r?.linked ?? 0} vinculada(s), ${r?.skipped ?? 0} sem candidato`);
      clearSelection();
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao vincular em lote"),
  });

  const bulkCreateMut = useMutation({
    mutationFn: (ids: string[]) => bulkCreateFn({ data: { transaction_ids: ids } }),
    onSuccess: (r: any) => {
      const errs = r?.errors?.length ?? 0;
      toast.success(
        `${r?.created ?? 0} lançamento(s) criado(s)` + (errs > 0 ? ` · ${errs} falha(s)` : ""),
      );
      clearSelection();
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar em lote"),
  });

  const items = suggestQ.data?.items ?? [];
  const withCandidates = useMemo(
    () => items.filter((it: any) => (it.candidates?.length ?? 0) > 0),
    [items],
  );
  const withoutCandidates = useMemo(
    () => items.filter((it: any) => (it.candidates?.length ?? 0) === 0),
    [items],
  );
  const allIds = useMemo(() => items.map((it: any) => it.transaction.id), [items]);
  const allSelected = allIds.length > 0 && allIds.every((id: string) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => {
    if (allSelected) clearSelection();
    else setSelected(new Set(allIds));
  };
  const bulkBusy = bulkIgnoreMut.isPending || bulkLinkMut.isPending || bulkCreateMut.isPending;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Conciliação bancária"
        description="Revise pendências de conciliação, aceite ou ignore matches sugeridos e reative conciliações do histórico."
      />

      {!connection || connection.status !== "connected" ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma conexão bancária ativa. Conecte o Banco Inter em
            <a href="/finance/banking" className="ml-1 font-medium text-primary underline">
              /finance/banking
            </a>
            .
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard
              label="Pendentes"
              value={items.length}
              hint={`${withCandidates.length} com sugestão`}
            />
            <MetricCard
              label="Sem sugestão"
              value={withoutCandidates.length}
              hint="Ajuste a janela de dias"
            />
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs uppercase text-muted-foreground">Janela de busca</div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={windowDays}
                  onChange={(e) =>
                    setWindowDays(Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">dias (± posted_at)</span>
              </div>
            </div>
          </div>

          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pendências {items.length > 0 && `(${items.length})`}
              </TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sugestões de conciliação</CardTitle>
                  <CardDescription>
                    Cada transação lista até 3 pagamentos candidatos com valor idêntico dentro da
                    janela configurada.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {suggestQ.isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
                      <ScanSearch className="h-6 w-6" />
                      Nenhuma pendência. Todas as transações estão conciliadas ou ignoradas.
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            onCheckedChange={toggleAll}
                          />
                          <span className="font-medium">
                            {selected.size > 0
                              ? `${selected.size} selecionada(s)`
                              : "Selecionar todas"}
                          </span>
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={selected.size === 0 || bulkBusy}
                            onClick={() => bulkLinkMut.mutate(Array.from(selected))}
                          >
                            <Wand2 className="mr-1 h-4 w-4" />
                            Vincular melhor match
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={selected.size === 0 || bulkBusy}
                            onClick={() => bulkCreateMut.mutate(Array.from(selected))}
                          >
                            <FilePlus2 className="mr-1 h-4 w-4" />
                            Criar lançamentos
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={selected.size === 0 || bulkBusy}
                            onClick={() => bulkIgnoreMut.mutate(Array.from(selected))}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Ignorar
                          </Button>
                          {selected.size > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={clearSelection}
                              disabled={bulkBusy}
                            >
                              Limpar
                            </Button>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-3">
                        {items.map((it: any) => {
                          const t = it.transaction;
                          const signed = t.direction === "credit" ? t.amount : -t.amount;
                          const isSelected = selected.has(t.id);
                          return (
                            <li key={t.id} className="rounded-lg border bg-card p-4 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleOne(t.id)}
                                    className="mt-1"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium">
                                      {t.description ?? "Movimentação"}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      <span>{formatDateTime(t.posted_at)}</span>
                                      {t.counterparty && (
                                        <>
                                          <span>·</span>
                                          <span>{t.counterparty}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-base font-semibold tabular-nums ${
                                      signed >= 0 ? "text-emerald-600" : "text-destructive"
                                    }`}
                                  >
                                    {formatCurrency(signed, "BRL")}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => ignoreMut.mutate(t.id)}
                                    disabled={ignoreMut.isPending}
                                  >
                                    <XCircle className="mr-1 h-4 w-4" />
                                    Ignorar
                                  </Button>
                                </div>
                              </div>

                              {it.candidates.length === 0 ? (
                                <div className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                  Nenhum pagamento candidato dentro da janela de {windowDays}{" "}
                                  dia(s).
                                </div>
                              ) : (
                                <div className="mt-3 space-y-2">
                                  <div className="text-xs font-medium uppercase text-muted-foreground">
                                    Candidatos
                                  </div>
                                  {it.candidates.map((c: any) => (
                                    <div
                                      key={c.payment_id}
                                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3"
                                    >
                                      <div className="min-w-0 flex-1 text-sm">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-medium tabular-nums">
                                            {formatCurrency(Number(c.amount), "BRL")}
                                          </span>
                                          <Badge variant="secondary">{c.method ?? "—"}</Badge>
                                          <span className="text-xs text-muted-foreground">
                                            {formatDate(c.paid_at)} · {c.days_diff} dia(s)
                                          </span>
                                        </div>
                                        {(c.reference || c.notes) && (
                                          <div className="mt-1 truncate text-xs text-muted-foreground">
                                            {c.reference ?? c.notes}
                                          </div>
                                        )}
                                      </div>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          acceptMut.mutate({
                                            transaction_id: t.id,
                                            payment_id: c.payment_id,
                                          })
                                        }
                                        disabled={acceptMut.isPending}
                                      >
                                        <CheckCircle2 className="mr-1 h-4 w-4" />
                                        Aceitar
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Histórico</CardTitle>
                    <CardDescription>
                      Transações conciliadas ou ignoradas. Use "Reativar" para voltar a pendente.
                    </CardDescription>
                  </div>
                  <Select value={historyStatus} onValueChange={(v: any) => setHistoryStatus(v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="matched">Conciliados</SelectItem>
                      <SelectItem value="ignored">Ignorados</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="p-0">
                  {historyQ.isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (historyQ.data ?? []).length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum registro no histórico.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="w-[130px]">Status</TableHead>
                          <TableHead>Pagamento vinculado</TableHead>
                          <TableHead className="w-[120px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(historyQ.data ?? []).map((r: any) => {
                          const signed = r.direction === "credit" ? r.amount : -r.amount;
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDateTime(r.posted_at)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {r.description ?? "—"}
                                {r.counterparty && (
                                  <div className="text-xs text-muted-foreground">
                                    {r.counterparty}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell
                                className={`text-right tabular-nums font-medium ${
                                  signed >= 0 ? "text-emerald-600" : "text-destructive"
                                }`}
                              >
                                {formatCurrency(signed, "BRL")}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    r.reconciliation_status === "matched" ? "default" : "secondary"
                                  }
                                >
                                  {r.reconciliation_status === "matched"
                                    ? "Conciliado"
                                    : "Ignorado"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {r.matched_payment ? (
                                  <span>
                                    {formatDate(r.matched_payment.paid_at)} ·{" "}
                                    {formatCurrency(Number(r.matched_payment.amount), "BRL")}
                                    {r.matched_payment.method && (
                                      <span className="text-muted-foreground">
                                        {" "}
                                        · {r.matched_payment.method}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => reactivateMut.mutate(r.id)}
                                  disabled={reactivateMut.isPending}
                                >
                                  <RotateCcw className="mr-1 h-4 w-4" />
                                  Reativar
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
