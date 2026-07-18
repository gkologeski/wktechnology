// Sprint G — Fase 1: painel de conexão OAuth com o Banco Inter (mock).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Landmark, Loader2, ShieldCheck, Unplug, Zap } from "lucide-react";

import {
  getBankConnection,
  startBankAuthorization,
  completeBankAuthorization,
  disconnectBank,
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

function BankingPage() {
  const qc = useQueryClient();
  const getConn = useServerFn(getBankConnection);
  const startFn = useServerFn(startBankAuthorization);
  const completeFn = useServerFn(completeBankAuthorization);
  const disconnectFn = useServerFn(disconnectBank);

  const q = useQuery({
    queryKey: ["banking", "inter"],
    queryFn: () => getConn({ data: { provider: "inter" } }),
  });

  const [mockDialog, setMockDialog] = useState<
    | null
    | {
        connection_id: string;
        state: string;
        message?: string;
      }
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

  const conn = q.data?.connection ?? null;
  const status = (conn?.status ?? "disconnected") as StatusKind;
  const events = q.data?.events ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Banco Inter"
        description="Conexão Open Finance por workspace. Fase 1: provider em modo mock — nenhuma requisição real ao banco."
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
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Acesso restrito a administradores do workspace.
          </div>
          <div>
            Última sincronização:{" "}
            {conn?.last_sync_at ? new Date(conn.last_sync_at).toLocaleString("pt-BR") : "—"}
          </div>
          <div>
            Escopos:{" "}
            {(conn?.scopes ?? []).length
              ? (conn?.scopes ?? []).slice(0, 3).join(", ") +
                ((conn?.scopes ?? []).length > 3 ? ` +${(conn?.scopes ?? []).length - 3}` : "")
              : "—"}
          </div>
        </CardContent>
      </Card>

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
