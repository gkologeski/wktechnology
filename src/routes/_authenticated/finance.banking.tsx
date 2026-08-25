// Sprint G — Fases 1 e 2: conexão OAuth + saldo e extrato.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
  Zap,
  Plus,
  Copy,
  CheckCircle2,
  X,
  Send,
  ArrowUpRight,
  Activity,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
} from "lucide-react";

import {
  getBankConnection,
  startBankAuthorization,
  completeBankAuthorization,
  disconnectBank,
  syncBankStatement,
  listBankStatement,
  setStatementReconciliation,
  listBankCharges,
  createBankCharge,
  cancelBankCharge,
  simulateChargePayment,
  listBankPayments,
  createBankPayment,
  approveBankPayment,
  cancelBankPayment,
  simulatePaymentSettlement,
  getPaymentsSummary,
  getBankingHealth,
} from "@/lib/banking.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/finance/banking")({
  component: BankingPage,
  head: () => ({
    meta: [
      { title: "Banco Inter — Conexão | TechFinance" },
      {
        name: "description",
        content:
          "Conecte o TechFinance ao Banco Inter via Open Finance para saldo, extrato, Pix e boletos.",
      },
    ],
  }),
});

type StatusKind = "disconnected" | "connecting" | "connected" | "error" | "revoked";

const STATUS_LABEL: Record<StatusKind, string> = {
  disconnected: "Desconectado",
  connecting: "Aguardando autorização",
  connected: "Conectado",
  error: "Erro",
  revoked: "Revogado",
};

const STATUS_VARIANT: Record<StatusKind, "secondary" | "default" | "destructive" | "outline"> = {
  disconnected: "secondary",
  connecting: "outline",
  connected: "default",
  error: "destructive",
  revoked: "destructive",
};

const RECON_LABEL: Record<string, string> = {
  pending: "Pendente",
  matched: "Conciliado",
  ignored: "Ignorado",
};

function BankingPage() {
  const qc = useQueryClient();
  const getConn = useServerFn(getBankConnection);
  const startFn = useServerFn(startBankAuthorization);
  const completeFn = useServerFn(completeBankAuthorization);
  const disconnectFn = useServerFn(disconnectBank);
  const syncFn = useServerFn(syncBankStatement);
  const listStmt = useServerFn(listBankStatement);
  const setRecon = useServerFn(setStatementReconciliation);

  const q = useQuery({
    queryKey: ["banking", "inter"],
    queryFn: () => getConn({ data: { provider: "inter" } }),
  });

  const conn = q.data?.connection ?? null;
  const status = (conn?.status ?? "disconnected") as StatusKind;
  const events = q.data?.events ?? [];

  const stmt = useQuery({
    queryKey: ["banking", "statement", conn?.id],
    enabled: !!conn?.id && status === "connected",
    queryFn: () => listStmt({ data: { connection_id: conn!.id, status: "all", limit: 200 } }),
  });

  const [mockDialog, setMockDialog] = useState<null | {
    connection_id: string;
    state: string;
    message?: string;
  }>(null);

  const startMut = useMutation({
    mutationFn: () => startFn({ data: { provider: "inter", mode: "mock" } }),
    onSuccess: (res) => {
      if (!res.requires_external_redirect) {
        setMockDialog({
          connection_id: res.connection_id,
          state: res.state,
          message: res.message,
        });
      } else {
        window.location.assign(res.authorize_url);
      }
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar autorização"),
  });

  const completeMut = useMutation({
    mutationFn: (args: { connection_id: string; state: string }) =>
      completeFn({
        data: {
          connection_id: args.connection_id,
          state: args.state,
          code: `mock_code_${Math.random().toString(36).slice(2, 10)}`,
        },
      }),
    onSuccess: () => {
      toast.success("Banco Inter conectado (mock)");
      setMockDialog(null);
      qc.invalidateQueries({ queryKey: ["banking"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao concluir autorização"),
  });

  const disconnectMut = useMutation({
    mutationFn: (connectionId: string) => disconnectFn({ data: { connection_id: connectionId } }),
    onSuccess: () => {
      toast.success("Conexão removida");
      qc.invalidateQueries({ queryKey: ["banking"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao desconectar"),
  });

  const syncMut = useMutation({
    mutationFn: (connectionId: string) => syncFn({ data: { connection_id: connectionId } }),
    onSuccess: (res) => {
      toast.success(`Sincronizado — ${res.count} movimentações`);
      qc.invalidateQueries({ queryKey: ["banking"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao sincronizar"),
  });

  const reconMut = useMutation({
    mutationFn: (args: { id: string; status: "pending" | "ignored" }) =>
      setRecon({ data: { transaction_id: args.id, status: args.status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["banking", "statement"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar status"),
  });

  // -------- Cobranças (Fase 4) --------
  const listCharges = useServerFn(listBankCharges);
  const createCharge = useServerFn(createBankCharge);
  const cancelCharge = useServerFn(cancelBankCharge);
  const simulatePay = useServerFn(simulateChargePayment);

  const charges = useQuery({
    queryKey: ["banking", "charges", conn?.id],
    enabled: !!conn?.id && status === "connected",
    queryFn: () => listCharges({ data: { connection_id: conn!.id, status: "all", limit: 200 } }),
  });

  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    type: "pix" as "pix" | "boleto",
    amount: "",
    due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    description: "",
    payer_name: "",
    payer_document: "",
  });
  const [showCharge, setShowCharge] = useState<any | null>(null);

  const createChargeMut = useMutation({
    mutationFn: () =>
      createCharge({
        data: {
          connection_id: conn!.id,
          type: chargeForm.type,
          amount: Number(chargeForm.amount),
          due_date: chargeForm.due_date,
          description: chargeForm.description || null,
          payer_name: chargeForm.payer_name || null,
          payer_document: chargeForm.payer_document || null,
        },
      }),
    onSuccess: () => {
      toast.success("Cobrança criada");
      setChargeDialogOpen(false);
      setChargeForm((f) => ({ ...f, amount: "", description: "" }));
      qc.invalidateQueries({ queryKey: ["banking", "charges"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar cobrança"),
  });

  const cancelChargeMut = useMutation({
    mutationFn: (id: string) => cancelCharge({ data: { charge_id: id } }),
    onSuccess: () => {
      toast.success("Cobrança cancelada");
      qc.invalidateQueries({ queryKey: ["banking", "charges"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao cancelar"),
  });

  const simulatePayMut = useMutation({
    mutationFn: (id: string) => simulatePay({ data: { charge_id: id } }),
    onSuccess: () => {
      toast.success("Pagamento simulado — cobrança liquidada");
      qc.invalidateQueries({ queryKey: ["banking"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao simular pagamento"),
  });

  // -------- Pagamentos AP (Fase 5) --------
  const listPayments = useServerFn(listBankPayments);
  const createPayment = useServerFn(createBankPayment);
  const approvePayment = useServerFn(approveBankPayment);
  const cancelPayment = useServerFn(cancelBankPayment);
  const simulateSettle = useServerFn(simulatePaymentSettlement);
  const paymentsSummary = useServerFn(getPaymentsSummary);

  const payments = useQuery({
    queryKey: ["banking", "payments", conn?.id],
    enabled: !!conn?.id && status === "connected",
    queryFn: () => listPayments({ data: { connection_id: conn!.id, status: "all", limit: 200 } }),
  });

  const summary = useQuery({
    queryKey: ["banking", "payments-summary", conn?.id],
    enabled: !!conn?.id && status === "connected",
    queryFn: () => paymentsSummary({ data: { connection_id: conn!.id } }),
  });

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    type: "pix" as "pix" | "ted" | "boleto",
    amount: "",
    scheduled_for: new Date().toISOString().slice(0, 10),
    favored_name: "",
    favored_document: "",
    pix_key: "",
    pix_key_type: "cpf" as "cpf" | "cnpj" | "email" | "phone" | "random",
    boleto_digitable_line: "",
    description: "",
  });

  const createPaymentMut = useMutation({
    mutationFn: () =>
      createPayment({
        data: {
          connection_id: conn!.id,
          type: paymentForm.type,
          amount: Number(paymentForm.amount),
          scheduled_for: paymentForm.scheduled_for || null,
          favored_name: paymentForm.favored_name || null,
          favored_document: paymentForm.favored_document || null,
          pix_key: paymentForm.type === "pix" ? paymentForm.pix_key : null,
          pix_key_type: paymentForm.type === "pix" ? paymentForm.pix_key_type : null,
          boleto_digitable_line:
            paymentForm.type === "boleto" ? paymentForm.boleto_digitable_line : null,
          description: paymentForm.description || null,
        },
      }),
    onSuccess: () => {
      toast.success("Pagamento criado (rascunho)");
      setPaymentDialogOpen(false);
      setPaymentForm((f) => ({
        ...f,
        amount: "",
        description: "",
        pix_key: "",
        boleto_digitable_line: "",
      }));
      qc.invalidateQueries({ queryKey: ["banking", "payments"] });
      qc.invalidateQueries({ queryKey: ["banking", "payments-summary"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar pagamento"),
  });

  const approvePayMut = useMutation({
    mutationFn: (id: string) => approvePayment({ data: { payment_id: id } }),
    onSuccess: (res: any) => {
      toast.success(`Pagamento ${res.status === "paid" ? "liquidado" : "enviado"}`);
      qc.invalidateQueries({ queryKey: ["banking"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao aprovar"),
  });

  const cancelPayMut = useMutation({
    mutationFn: (id: string) => cancelPayment({ data: { payment_id: id } }),
    onSuccess: () => {
      toast.success("Pagamento cancelado");
      qc.invalidateQueries({ queryKey: ["banking", "payments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao cancelar"),
  });

  const simulateSettleMut = useMutation({
    mutationFn: (id: string) => simulateSettle({ data: { payment_id: id } }),
    onSuccess: () => {
      toast.success("Pagamento liquidado (mock)");
      qc.invalidateQueries({ queryKey: ["banking"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao liquidar"),
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Banco Inter"
        description="Conexão Open Finance por workspace. Fase 2: saldo e extrato via provider mock."
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {conn?.display_name ?? "Banco Inter"}
                <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                {conn?.mode && (
                  <Badge variant="outline" className="uppercase text-[10px]">
                    {conn.mode}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {status === "connected"
                  ? `Conta ${conn?.external_account_id ?? "—"} · Escopos: ${(conn?.scopes ?? []).length}`
                  : "Autorize para simular o consentimento OAuth. Nenhuma credencial real é enviada nesta fase."}
              </CardDescription>
              {conn?.last_error && (
                <p className="mt-2 text-sm text-destructive">{conn.last_error}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {status === "connected" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => conn && syncMut.mutate(conn.id)}
                  disabled={syncMut.isPending}
                >
                  {syncMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sincronizar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => conn && disconnectMut.mutate(conn.id)}
                  disabled={disconnectMut.isPending}
                >
                  {disconnectMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="h-4 w-4" />
                  )}
                  Desconectar
                </Button>
              </>
            ) : (
              <Button onClick={() => startMut.mutate()} disabled={startMut.isPending}>
                {startMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Conectar (mock)
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-3">
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase text-muted-foreground">Saldo atual</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums truncate">
              {conn?.current_balance != null
                ? formatCurrency(Number(conn.current_balance), "BRL")
                : "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {conn?.balance_synced_at
                ? `Atualizado em ${new Date(conn.balance_synced_at).toLocaleString("pt-BR")}`
                : "Sem sincronização"}
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase text-muted-foreground">Última sincronização</div>
            <div className="mt-1 text-sm">
              {conn?.last_sync_at ? new Date(conn.last_sync_at).toLocaleString("pt-BR") : "—"}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Acesso restrito a administradores.
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase text-muted-foreground">Escopos ativos</div>
            <div className="mt-1 text-sm">
              {(conn?.scopes ?? []).length
                ? (conn?.scopes ?? []).slice(0, 3).join(", ") +
                  ((conn?.scopes ?? []).length > 3 ? ` +${(conn?.scopes ?? []).length - 3}` : "")
                : "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      <BankingHealthCard providerConnected={status === "connected"} />

      <Tabs defaultValue="statement">
        <TabsList>
          <TabsTrigger value="statement">Extrato</TabsTrigger>
          <TabsTrigger value="charges">Cobranças</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="events">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-4 space-y-4">
          {status === "connected" && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">A pagar hoje</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">
                  {formatCurrency(Number(summary.data?.due_today ?? 0), "BRL")}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Próximos 7 dias</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">
                  {formatCurrency(Number(summary.data?.next_7_days ?? 0), "BRL")}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase text-muted-foreground">Atrasados</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-destructive">
                  {formatCurrency(Number(summary.data?.overdue ?? 0), "BRL")}
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Pagamentos a fornecedores</CardTitle>
                <CardDescription>
                  Emita Pix e boletos de saída via Banco Inter. Fluxo: rascunho → aprovar →
                  processamento → pago (conciliação automática com AP).
                </CardDescription>
              </div>
              <Button onClick={() => setPaymentDialogOpen(true)} disabled={status !== "connected"}>
                <Plus className="h-4 w-4" /> Novo pagamento
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {status !== "connected" ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Conecte-se para emitir pagamentos.
                </div>
              ) : payments.isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (payments.data ?? []).length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum pagamento emitido.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Tipo</TableHead>
                      <TableHead>Beneficiário</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[110px]">Agendado</TableHead>
                      <TableHead className="text-right w-[140px]">Valor</TableHead>
                      <TableHead className="w-[130px]">Status</TableHead>
                      <TableHead className="w-[240px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(payments.data ?? []).map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {p.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{p.favored_name ?? "—"}</div>
                          {p.favored_document && (
                            <div className="text-xs text-muted-foreground">
                              {p.favored_document}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{p.description ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {p.scheduled_for
                            ? new Date(p.scheduled_for).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(Number(p.amount), "BRL")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === "paid"
                                ? "default"
                                : p.status === "failed" || p.status === "canceled"
                                  ? "destructive"
                                  : p.status === "processing"
                                    ? "secondary"
                                    : "outline"
                            }
                            title={p.failure_reason ?? undefined}
                          >
                            {p.status === "draft"
                              ? "Rascunho"
                              : p.status === "approved"
                                ? "Aprovado"
                                : p.status === "processing"
                                  ? "Processando"
                                  : p.status === "paid"
                                    ? "Pago"
                                    : p.status === "failed"
                                      ? "Falhou"
                                      : "Cancelado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {p.status === "draft" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => approvePayMut.mutate(p.id)}
                                disabled={approvePayMut.isPending}
                              >
                                <Send className="h-3.5 w-3.5" /> Aprovar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelPayMut.mutate(p.id)}
                                disabled={cancelPayMut.isPending}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {p.status === "processing" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => simulateSettleMut.mutate(p.id)}
                              disabled={simulateSettleMut.isPending}
                              title="Simular confirmação (mock)"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Liquidar
                            </Button>
                          )}
                          {p.status === "approved" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => simulateSettleMut.mutate(p.id)}
                              disabled={simulateSettleMut.isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Liquidar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charges" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Cobranças Pix e Boleto</CardTitle>
                <CardDescription>
                  Emita cobranças vinculadas ao Banco Inter. Ao liquidar, o pagamento é registrado
                  automaticamente no lançamento financeiro associado.
                </CardDescription>
              </div>
              <Button onClick={() => setChargeDialogOpen(true)} disabled={status !== "connected"}>
                <Plus className="h-4 w-4" /> Nova cobrança
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {status !== "connected" ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Conecte-se para emitir cobranças.
                </div>
              ) : charges.isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (charges.data ?? []).length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma cobrança emitida.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Pagador</TableHead>
                      <TableHead className="w-[120px]">Vencimento</TableHead>
                      <TableHead className="text-right w-[140px]">Valor</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[220px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(charges.data ?? []).map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {c.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{c.description ?? "—"}</TableCell>
                        <TableCell className="text-sm">{c.payer_name ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(c.due_date).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(Number(c.amount), "BRL")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.status === "paid"
                                ? "default"
                                : c.status === "pending"
                                  ? "outline"
                                  : "secondary"
                            }
                          >
                            {c.status === "paid"
                              ? "Paga"
                              : c.status === "pending"
                                ? "Pendente"
                                : c.status === "canceled"
                                  ? "Cancelada"
                                  : "Expirada"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => setShowCharge(c)}>
                            Ver
                          </Button>
                          {c.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => simulatePayMut.mutate(c.id)}
                                disabled={simulatePayMut.isPending}
                                title="Simular liquidação (mock)"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Liquidar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelChargeMut.mutate(c.id)}
                                disabled={cancelChargeMut.isPending}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statement" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movimentações</CardTitle>
              <CardDescription>
                {status === "connected"
                  ? "Extrato sincronizado do provider. Marque como ignorado para excluir da conciliação."
                  : "Conecte-se para visualizar o extrato."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {status !== "connected" ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma conexão ativa.
                </div>
              ) : stmt.isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (stmt.data ?? []).length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma movimentação. Clique em "Sincronizar" para buscar dados.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Contraparte</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[120px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(stmt.data ?? []).map((t: any) => {
                      const signed = t.direction === "credit" ? t.amount : -t.amount;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(t.posted_at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-sm">{t.description ?? "—"}</TableCell>
                          <TableCell className="text-sm">{t.counterparty ?? "—"}</TableCell>
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
                                t.reconciliation_status === "matched"
                                  ? "default"
                                  : t.reconciliation_status === "ignored"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {RECON_LABEL[t.reconciliation_status] ?? t.reconciliation_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                reconMut.mutate({
                                  id: t.id,
                                  status:
                                    t.reconciliation_status === "ignored" ? "pending" : "ignored",
                                })
                              }
                              disabled={reconMut.isPending}
                            >
                              {t.reconciliation_status === "ignored" ? "Reativar" : "Ignorar"}
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

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de eventos</CardTitle>
              <CardDescription>
                Trilha de auditoria da conexão (últimos 10 eventos).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {events.map((ev: any) => (
                    <li
                      key={ev.id}
                      className="flex items-start justify-between gap-3 rounded-md border p-2"
                    >
                      <div>
                        <div className="font-medium">{ev.event_type}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(ev.created_at).toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <pre className="max-w-[60%] truncate text-xs text-muted-foreground">
                        {JSON.stringify(ev.payload)}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!mockDialog} onOpenChange={(o) => !o && setMockDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consentimento simulado — Banco Inter</DialogTitle>
            <DialogDescription>{mockDialog?.message}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Em produção, esta etapa acontece no ambiente do Banco Inter. Aqui, aprovar gera tokens
            simulados apenas para desenvolvimento.
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMockDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                mockDialog &&
                completeMut.mutate({
                  connection_id: mockDialog.connection_id,
                  state: mockDialog.state,
                })
              }
              disabled={completeMut.isPending}
            >
              {completeMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Aprovar consentimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chargeDialogOpen} onOpenChange={setChargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova cobrança</DialogTitle>
            <DialogDescription>
              Gere um Pix ou boleto vinculado à conexão do Banco Inter.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={chargeForm.type}
                  onValueChange={(v) => setChargeForm((f) => ({ ...f, type: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={chargeForm.due_date}
                  onChange={(e) => setChargeForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={chargeForm.amount}
                onChange={(e) => setChargeForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pagador (nome)</Label>
                <Input
                  value={chargeForm.payer_name}
                  onChange={(e) => setChargeForm((f) => ({ ...f, payer_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Documento</Label>
                <Input
                  value={chargeForm.payer_document}
                  onChange={(e) => setChargeForm((f) => ({ ...f, payer_document: e.target.value }))}
                  placeholder="CPF/CNPJ"
                />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                rows={2}
                value={chargeForm.description}
                onChange={(e) => setChargeForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChargeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createChargeMut.mutate()}
              disabled={
                createChargeMut.isPending || !chargeForm.amount || Number(chargeForm.amount) <= 0
              }
            >
              {createChargeMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Emitir cobrança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showCharge} onOpenChange={(o) => !o && setShowCharge(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Cobrança {showCharge?.type === "pix" ? "Pix" : "Boleto"} —{" "}
              {showCharge && formatCurrency(Number(showCharge.amount), "BRL")}
            </DialogTitle>
            <DialogDescription>
              {showCharge?.description || "Sem descrição"} · Vencimento{" "}
              {showCharge && new Date(showCharge.due_date).toLocaleDateString("pt-BR")}
            </DialogDescription>
          </DialogHeader>
          {showCharge?.type === "pix" ? (
            <div className="space-y-3">
              {showCharge.pix_qr_code && (
                <div className="flex justify-center rounded-md border bg-white p-4">
                  <img src={showCharge.pix_qr_code} alt="QR Code Pix" className="h-48 w-48" />
                </div>
              )}
              {showCharge.pix_copy_paste && (
                <div>
                  <Label className="text-xs">Copia e cola</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={showCharge.pix_copy_paste}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(showCharge.pix_copy_paste);
                        toast.success("Copiado");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {showCharge?.boleto_digitable_line && (
                <div>
                  <Label className="text-xs">Linha digitável</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={showCharge.boleto_digitable_line}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(showCharge.boleto_digitable_line);
                        toast.success("Copiado");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              {showCharge?.boleto_url && (
                <Button variant="outline" asChild>
                  <a href={showCharge.boleto_url} target="_blank" rel="noreferrer">
                    Abrir PDF do boleto
                  </a>
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCharge(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo pagamento AP */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Novo pagamento</DialogTitle>
            <DialogDescription>
              Emita um Pix ou boleto de saída via Banco Inter. Após criar, aprove para enviar ao
              provider.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={paymentForm.type}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, type: e.target.value as any }))}
                >
                  <option value="pix">Pix</option>
                  <option value="ted">TED</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Agendado para</Label>
              <Input
                type="date"
                value={paymentForm.scheduled_for}
                onChange={(e) => setPaymentForm((f) => ({ ...f, scheduled_for: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Beneficiário</Label>
                <Input
                  value={paymentForm.favored_name}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, favored_name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">CPF/CNPJ</Label>
                <Input
                  value={paymentForm.favored_document}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, favored_document: e.target.value }))
                  }
                />
              </div>
            </div>
            {paymentForm.type === "pix" && (
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <div>
                  <Label className="text-xs">Tipo de chave</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                    value={paymentForm.pix_key_type}
                    onChange={(e) =>
                      setPaymentForm((f) => ({ ...f, pix_key_type: e.target.value as any }))
                    }
                  >
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone</option>
                    <option value="random">Aleatória</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Chave Pix</Label>
                  <Input
                    value={paymentForm.pix_key}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, pix_key: e.target.value }))}
                  />
                </div>
              </div>
            )}
            {paymentForm.type === "boleto" && (
              <div>
                <Label className="text-xs">Linha digitável</Label>
                <Input
                  value={paymentForm.boleto_digitable_line}
                  onChange={(e) =>
                    setPaymentForm((f) => ({ ...f, boleto_digitable_line: e.target.value }))
                  }
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input
                value={paymentForm.description}
                onChange={(e) => setPaymentForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createPaymentMut.mutate()}
              disabled={
                createPaymentMut.isPending || !paymentForm.amount || Number(paymentForm.amount) <= 0
              }
            >
              {createPaymentMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <ArrowUpRight className="h-4 w-4" /> Criar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BankingHealthCard({ providerConnected }: { providerConnected: boolean }) {
  const healthFn = useServerFn(getBankingHealth);
  const health = useQuery({
    queryKey: ["banking", "health"],
    queryFn: () => healthFn({ data: { provider: "inter" } }),
    refetchInterval: 60_000,
  });

  const h = health.data;
  const lastRun = h?.last_run as any;
  const alerts = (h?.alerts ?? []) as Array<{
    id: string;
    severity: "info" | "warning" | "error";
    message: string;
    fired_at: string;
  }>;

  const hasIssue =
    !!h &&
    ((h.stuck_payments ?? 0) > 0 ||
      h.token_expires_soon ||
      !h.token_has_refresh ||
      (h.runs_failed ?? 0) > 0 ||
      alerts.some((a) => a.severity !== "info") ||
      !!h.last_error);

  const tone = hasIssue ? "warning" : "ok";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={
              "rounded-md p-2 " +
              (tone === "ok"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400")
            }
          >
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              Saúde das conexões
              <Badge variant={tone === "ok" ? "secondary" : "destructive"}>
                {health.isLoading ? "Carregando…" : tone === "ok" ? "Saudável" : "Atenção"}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              Monitor do cron{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">banking-tick</code> —
              sincronização, tokens, alertas e pagamentos presos.
            </CardDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => health.refetch()}
          disabled={health.isFetching}
        >
          {health.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase text-muted-foreground">Última execução</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {lastRun?.started_at ? new Date(lastRun.started_at).toLocaleString("pt-BR") : "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {lastRun
                ? `${lastRun.status === "ok" ? "OK" : "Falha"} · ${lastRun.duration_ms ?? 0}ms`
                : "Cron ainda não executou"}
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase text-muted-foreground">Últimas 24 execuções</div>
            <div className="mt-1 text-sm tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">{h?.runs_ok ?? 0} ok</span> ·{" "}
              <span
                className={(h?.runs_failed ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}
              >
                {h?.runs_failed ?? 0} falhas
              </span>
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase text-muted-foreground">Pagamentos parados</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{h?.stuck_payments ?? 0}</div>
            <div className="mt-1 text-xs text-muted-foreground">Em processamento há &gt;6h</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs uppercase text-muted-foreground">Token</div>
            <div className="mt-1 text-sm">
              {!providerConnected
                ? "—"
                : h?.token_expires_at
                  ? new Date(h.token_expires_at).toLocaleString("pt-BR")
                  : "Sem token"}
            </div>
            <div
              className={
                "mt-1 text-xs " +
                (h?.token_expires_soon || !h?.token_has_refresh
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground")
              }
            >
              {!providerConnected
                ? "Conexão desconectada"
                : !h?.token_has_refresh
                  ? "Sem refresh_token — reautorizar"
                  : h?.token_expires_soon
                    ? "Expira em <24h"
                    : "OK"}
            </div>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase text-muted-foreground">Alertas ativos</div>
            {alerts.slice(0, 5).map((a) => {
              const Icon =
                a.severity === "error"
                  ? AlertCircle
                  : a.severity === "warning"
                    ? AlertTriangle
                    : Info;
              const tint =
                a.severity === "error"
                  ? "text-destructive"
                  : a.severity === "warning"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground";
              return (
                <div key={a.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                  <Icon className={"mt-0.5 h-4 w-4 shrink-0 " + tint} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{a.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.fired_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
