// Sprint G — Fases 1 e 2: conexão OAuth + saldo e extrato.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Landmark, Loader2, RefreshCw, ShieldCheck, Unplug, Zap, Plus, Copy, CheckCircle2, X } from "lucide-react";

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
} from "@/lib/banking.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    queryFn: () =>
      listStmt({ data: { connection_id: conn!.id, status: "all", limit: 200 } }),
  });

  const [mockDialog, setMockDialog] = useState<
    | null
    | { connection_id: string; state: string; message?: string }
  >(null);

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
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao desconectar"),
  });

  const syncMut = useMutation({
    mutationFn: (connectionId: string) => syncFn({ data: { connection_id: connectionId } }),
    onSuccess: (res) => {
      toast.success(`Sincronizado — ${res.count} movimentações`);
      qc.invalidateQueries({ queryKey: ["banking"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar"),
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
            <div className="mt-1 text-2xl font-semibold tabular-nums">
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
                  ((conn?.scopes ?? []).length > 3
                    ? ` +${(conn?.scopes ?? []).length - 3}`
                    : "")
                : "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="statement">
        <TabsList>
          <TabsTrigger value="statement">Extrato</TabsTrigger>
          <TabsTrigger value="events">Histórico</TabsTrigger>
        </TabsList>

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
              <CardDescription>Trilha de auditoria da conexão (últimos 10 eventos).</CardDescription>
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
    </div>
  );
}
