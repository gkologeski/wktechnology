import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useSalesCapabilities } from "@/lib/access-control/use-sales-capabilities";
import { readViewAs } from "@/lib/view-as-client";
import {
  getSlackIntegration,
  saveSlackIntegration,
  deleteSlackIntegration,
  sendSlackTest,
} from "@/lib/slack.functions";

export const Route = createFileRoute("/_authenticated/settings/notifications/slack")({
  component: SlackSettingsPage,
});

function SlackSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const permissions = usePermissions();
  const qc = useQueryClient();
  const getFn = useServerFn(getSlackIntegration);
  const saveFn = useServerFn(saveSlackIntegration);
  const delFn = useServerFn(deleteSlackIntegration);
  const checkFn = useServerFn(sendSlackTest);
  const contextReady = Boolean(
    user?.id &&
    permissions.workspaceId &&
    !authLoading &&
    !permissions.isLoading &&
    !permissions.isError,
  );
  const contextKey = `${user?.id ?? ""}:${permissions.workspaceId ?? ""}`;
  const latestContext = useRef(contextKey);
  latestContext.current = contextKey;
  const canView =
    contextReady &&
    permissions.canAny(
      ["own", "team", "workspace"].map((scope) => `system.integrations.view.${scope}`),
    );
  const query = useQuery({
    queryKey: ["slack-integration", user?.id, permissions.workspaceId],
    queryFn: () => getFn(),
    enabled: canView,
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const integration =
    canView && !query.isError && query.isFetchedAfterMount ? query.data?.integration : null;
  const capabilities = useSalesCapabilities(
    "slack_integrations",
    integration ? [integration.id] : [],
  );
  const record = integration ? capabilities.for(integration.id) : null;
  const view = readViewAs();
  const readOnly = view?.readOnly === true || view?.mode === "role";
  const mutable =
    canView &&
    !query.isError &&
    query.isFetchedAfterMount &&
    !query.isFetching &&
    Boolean(query.data) &&
    !readOnly;
  const canConnect =
    mutable &&
    !integration &&
    permissions.canAny(
      ["own", "team", "workspace"].flatMap((scope) => [
        `system.integrations.create.${scope}`,
        `system.integrations.update.${scope}`,
      ]),
    );
  const canDelete = mutable && record?.can_delete === true;
  const canCheck = mutable && record?.can_manage === true;
  const [draftContext, setDraftContext] = useState(contextKey);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [teamName, setTeamName] = useState("");
  const [defaultChannel, setDefaultChannel] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const draftCurrent = draftContext === contextKey;
  useEffect(() => {
    setWebhookUrl("");
    setTeamName("");
    setDefaultChannel("");
    setDraftContext(contextKey);
  }, [contextKey, canView, canConnect]);
  const refresh = async () => {
    await Promise.all([
      query.refetch(),
      qc.invalidateQueries({
        queryKey: ["notification-slack-settings", user?.id, permissions.workspaceId],
      }),
    ]);
  };
  const execute = async (allowed: boolean, task: () => Promise<void>) => {
    if (!allowed || pending.current) return;
    pending.current = true;
    setBusy(true);
    const origin = contextKey;
    try {
      await task();
    } catch (cause) {
      if (latestContext.current === origin)
        toast.error(
          cause instanceof Error ? cause.message : "Não foi possível concluir a operação.",
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const save = () =>
    execute(canConnect && draftCurrent && Boolean(webhookUrl), async () => {
      await saveFn({
        data: {
          webhook_url: webhookUrl,
          team_name: teamName || undefined,
          default_channel_name: defaultChannel || undefined,
        },
      });
      if (latestContext.current !== contextKey) return;
      setWebhookUrl("");
      setTeamName("");
      setDefaultChannel("");
      toast.success(
        "Conexão salva. A política de avisos coletivos permanece configurada separadamente.",
      );
      await refresh();
    });
  const disconnect = () =>
    execute(canDelete, async () => {
      if (!(await confirmDialog("Remover a integração com Slack deste workspace?"))) return;
      if (latestContext.current !== contextKey) return;
      await delFn();
      if (latestContext.current !== contextKey) return;
      toast.success("Integração removida.");
      await refresh();
    });
  const check = () =>
    execute(canCheck, async () => {
      await checkFn();
      if (latestContext.current === contextKey)
        toast.success("Configuração conferida; nenhum aviso enviado.");
    });
  if (!contextReady)
    return (
      <p role="status" className="p-6">
        Aguardando confirmação do usuário e do workspace…
      </p>
    );
  if (!canView)
    return <p className="p-6">Sem permissão para consultar a integração Slack deste workspace.</p>;
  if (query.isError)
    return (
      <div role="alert" className="space-y-3 p-6">
        <p>Não foi possível carregar a integração Slack. A configuração não foi alterada.</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (query.isLoading || !query.data || !query.isFetchedAfterMount)
    return (
      <div role="status" className="flex items-center gap-2 p-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando configuração Slack…
      </div>
    );
  const routes = query.data.routes;
  return (
    <div className="max-w-3xl space-y-5 p-6">
      <PageHeader
        title="Conexão Slack"
        description="Configure a conexão do workspace. Os avisos coletivos são definidos na central de notificações e no motor de Workflows."
      />
      <Card>
        <CardHeader>
          <CardTitle>Conexão do workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {integration ? (
            <>
              <p className="text-sm">
                Configuração salva para <strong>{integration.team_name || "Slack"}</strong>
                {integration.default_channel_name
                  ? ` · #${integration.default_channel_name}`
                  : " · destino definido no webhook"}
                .
              </p>
              <p className="text-sm text-muted-foreground">
                O nome exibido é cadastral. O Incoming Webhook usa o canal vinculado no Slack e não
                permite sobrescrevê-lo por evento. Uma configuração salva não comprova entrega ou
                leitura.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void check()} disabled={!canCheck || busy}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Conferir configuração
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void disconnect()}
                  disabled={!canDelete || busy}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Crie um Incoming Webhook no Slack para o canal adequado. A URL é uma credencial:
                informe-a somente neste campo protegido. A conexão não habilita avisos
                automaticamente.
              </p>
              <fieldset disabled={!canConnect || busy} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hook">URL do Incoming Webhook</Label>
                  <Input
                    id="hook"
                    type="password"
                    autoComplete="new-password"
                    placeholder="https://hooks.slack.com/services/…"
                    value={draftCurrent ? webhookUrl : ""}
                    onChange={(event) => {
                      if (canConnect && !pending.current) setWebhookUrl(event.target.value);
                    }}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="team">Nome do workspace Slack</Label>
                    <Input
                      id="team"
                      value={draftCurrent ? teamName : ""}
                      onChange={(event) => {
                        if (canConnect && !pending.current) setTeamName(event.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ch">Nome do canal vinculado no Slack</Label>
                    <Input
                      id="ch"
                      value={draftCurrent ? defaultChannel : ""}
                      onChange={(event) => {
                        if (canConnect && !pending.current) setDefaultChannel(event.target.value);
                      }}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => void save()}
                  disabled={!canConnect || busy || !draftCurrent || !webhookUrl}
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar conexão
                </Button>
              </fieldset>
              {!canConnect && (
                <p className="text-sm text-muted-foreground">
                  Consulta apenas. Sem permissão para cadastrar esta conexão.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {integration && (
        <Card>
          <CardHeader>
            <CardTitle>Regras de canal anteriores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Os registros anteriores foram preservados para consulta. Eles não escolhem o destino
              dos avisos coletivos da central e não sobrescrevem o canal de um Incoming Webhook.
              Configure a ação Slack no Workflow e a política coletiva na central.
            </p>
            {routes.length ? (
              <ul className="space-y-2">
                {routes.map((route) => (
                  <li
                    key={route.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 p-3 text-sm"
                  >
                    <span className="break-all">
                      {route.event_type} · {route.channel_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {route.enabled ? "Registro habilitado" : "Registro desabilitado"} · somente
                      leitura
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum registro anterior.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
