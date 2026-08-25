import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, Link2, RefreshCw, XCircle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Can } from "@/lib/access-control/use-permissions";
import { INTEGRATIONS_MANAGE } from "@/lib/access-control/admin-permission-keys";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/lib/crm";
import { CA_ENTITY_LABELS, CA_ENTITIES, type CaEntity } from "@/lib/integrations/contaazul-map";
import {
  contaAzulAuthorizeUrl,
  contaAzulDisconnect,
  contaAzulRunSync,
  contaAzulStatus,
} from "@/lib/integrations/contaazul.functions";
import { ContaAzulFileImportDialog } from "@/components/contaazul/contaazul-file-import-dialog";

export const Route = createFileRoute("/_authenticated/integrations/contaazul")({
  head: () => ({
    meta: [
      { title: "Conta Azul — Integração TechFinance" },
      {
        name: "description",
        content:
          "Conecte o Conta Azul e importe contas a pagar, a receber, plano de contas e extratos para o TechFinance.",
      },
      { property: "og:title", content: "Conta Azul — Integração TechFinance" },
      {
        property: "og:description",
        content: "Importação e sincronização incremental do Conta Azul no TechFinance.",
      },
    ],
  }),
  component: ContaAzulIntegrationPage,
});

function ContaAzulIntegrationPage() {
  const qc = useQueryClient();
  const status = useServerFn(contaAzulStatus);
  const authorize = useServerFn(contaAzulAuthorizeUrl);
  const disconnect = useServerFn(contaAzulDisconnect);
  const runSync = useServerFn(contaAzulRunSync);

  const [selected, setSelected] = useState<CaEntity[]>([...CA_ENTITIES]);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["contaazul", "status"],
    queryFn: () => status({}),
  });

  // Retorno do popup OAuth.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const payload = event.data as { type?: string } | null;
      if (payload?.type === "contaazul-oauth-connected") {
        toast.success("Conta Azul conectado.");
        void qc.invalidateQueries({ queryKey: ["contaazul"] });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [qc]);

  const handleConnect = useCallback(async () => {
    setBusy(true);
    try {
      const { url } = await authorize({ data: { origin: window.location.origin } });
      window.open(url, "contaazul-oauth", "width=560,height=720");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao iniciar a conexão.");
    } finally {
      setBusy(false);
    }
  }, [authorize]);

  const handleDisconnect = useCallback(async () => {
    const ok = await confirmDialog({
      title: "Desconectar Conta Azul?",
      description: "Os dados já importados permanecem no TechFinance.",
      confirmLabel: "Desconectar",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await disconnect({});
      toast.success("Conta Azul desconectado.");
      await qc.invalidateQueries({ queryKey: ["contaazul"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao desconectar.");
    } finally {
      setBusy(false);
    }
  }, [disconnect, qc]);

  const handleSync = useCallback(async () => {
    if (!selected.length) {
      toast.error("Selecione ao menos uma entidade.");
      return;
    }
    setBusy(true);
    try {
      const { results } = await runSync({ data: { entities: selected, since: null } });
      const imported = results.reduce((acc, r) => acc + r.imported + r.updated, 0);
      const failed = results.reduce((acc, r) => acc + r.failed, 0);
      if (failed > 0) {
        toast.warning(`Importação parcial: ${imported} registros, ${failed} com erro.`);
      } else {
        toast.success(`Importação concluída: ${imported} registros.`);
      }
      await qc.invalidateQueries({ queryKey: ["contaazul"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na sincronização.");
    } finally {
      setBusy(false);
    }
  }, [runSync, selected, qc]);

  const syncState = new Map(
    (data?.syncState ?? []).map((s) => [
      s.entity as CaEntity,
      s as {
        entity: string;
        last_synced_at: string | null;
        imported_count: number;
        failed_count: number;
        last_error: string | null;
      },
    ]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conta Azul"
        description="Importe contas a pagar e a receber, plano de contas, contas bancárias e extratos para o TechFinance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/integrations">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Integrações
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-4 w-4 text-destructive" />
              Não foi possível carregar a integração
            </CardTitle>
            <CardDescription>
              Verifique sua conexão e tente novamente. Se persistir, revise as credenciais do
              aplicativo Conta Azul.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Conexão</CardTitle>
                  <CardDescription>
                    Autorização OAuth por workspace. Sem credenciais de aplicativo, use a importação
                    por arquivo.
                  </CardDescription>
                </div>
                {data?.connected ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline">Não conectado</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!data?.configured ? (
                <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                  <span>
                    Credenciais do aplicativo Conta Azul ausentes (CONTAAZUL_CLIENT_ID e
                    CONTAAZUL_CLIENT_SECRET). A conexão via API fica indisponível até a
                    configuração; a importação por arquivo continua funcionando.
                  </span>
                </div>
              ) : null}

              {data?.lastError ? (
                <p className="text-sm text-destructive">Último erro: {data.lastError}</p>
              ) : null}

              <Can any={INTEGRATIONS_MANAGE} fallback={null}>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => void handleConnect()} disabled={busy || !data?.configured}>
                    <Link2 className="mr-2 h-4 w-4" />
                    {data?.connected ? "Reautorizar" : "Conectar Conta Azul"}
                  </Button>
                  {data?.connected ? (
                    <Button
                      variant="outline"
                      onClick={() => void handleDisconnect()}
                      disabled={busy}
                    >
                      Desconectar
                    </Button>
                  ) : null}
                  <ContaAzulFileImportDialog disabled={busy} />
                </div>
              </Can>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Importação de dados</CardTitle>
              <CardDescription>
                Escolha o que sincronizar. A execução é idempotente: registros já importados são
                atualizados, não duplicados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {CA_ENTITIES.map((entity) => {
                  const state = syncState.get(entity);
                  return (
                    <div key={entity} className="flex items-start gap-3 rounded-md border p-3">
                      <Checkbox
                        id={`entity-${entity}`}
                        checked={selected.includes(entity)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked
                              ? [...new Set([...prev, entity])]
                              : prev.filter((e) => e !== entity),
                          )
                        }
                      />
                      <div className="min-w-0 space-y-1">
                        <Label htmlFor={`entity-${entity}`} className="text-sm font-medium">
                          {CA_ENTITY_LABELS[entity]}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {state?.last_synced_at
                            ? `Última sincronização: ${formatDateTime(state.last_synced_at)} — ${state.imported_count} registros${state.failed_count ? `, ${state.failed_count} com erro` : ""}`
                            : "Nunca sincronizado"}
                        </p>
                        {state?.last_error ? (
                          <p className="truncate text-xs text-destructive">{state.last_error}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Can any={INTEGRATIONS_MANAGE} fallback={null}>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => void handleSync()}
                    disabled={busy || !data?.connected || selected.length === 0}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {busy ? "Sincronizando..." : "Sincronizar agora"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    A sincronização incremental automática roda a cada 6 horas pelo agendador.
                  </span>
                </div>
              </Can>
            </CardContent>
          </Card>

          <ContaAzulSyncProgress
            syncState={(data?.syncState ?? []) as CaSyncStateRow[]}
            cronRuns={data?.cronRuns ?? []}
            running={busy}
          />
        </>
      )}
    </div>
  );
}
