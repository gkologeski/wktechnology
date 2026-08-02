import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  getSlackIntegration,
  saveSlackIntegration,
  deleteSlackIntegration,
  sendSlackTest,
  upsertSlackRoute,
  deleteSlackRoute,
  SLACK_EVENT_TYPES,
} from "@/lib/slack.functions";

export const Route = createFileRoute("/_authenticated/settings/notifications/slack")({
  component: SlackSettingsPage,
});

function SlackSettingsPage() {
  const getFn = useServerFn(getSlackIntegration);
  const saveFn = useServerFn(saveSlackIntegration);
  const delFn = useServerFn(deleteSlackIntegration);
  const testFn = useServerFn(sendSlackTest);
  const upsertRoute = useServerFn(upsertSlackRoute);
  const delRoute = useServerFn(deleteSlackRoute);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["slack-integration"],
    queryFn: getFn,
  });
  const [webhookUrl, setWebhookUrl] = useState("");
  const [teamName, setTeamName] = useState("");
  const [defaultChannel, setDefaultChannel] = useState("");
  const [newEvent, setNewEvent] = useState<string>("lead.created");
  const [newChannel, setNewChannel] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const integ = data?.integration;
  const routes = data?.routes ?? [];

  async function doSave() {
    setBusy(true);
    try {
      await saveFn({
        data: {
          webhook_url: webhookUrl,
          team_name: teamName || undefined,
          default_channel_name: defaultChannel || undefined,
        },
      });
      toast.success("Salvo");
      setWebhookUrl("");
      setTeamName("");
      setDefaultChannel("");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }
  async function doDelete() {
    if (!(await confirmDialog("Remover integração com Slack?"))) return;
    setBusy(true);
    try {
      await delFn();
      toast.success("Removido");
      await refetch();
    } finally {
      setBusy(false);
    }
  }
  async function doTest() {
    setBusy(true);
    try {
      await testFn();
      toast.success("Mensagem enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }
  async function addRoute() {
    if (!newChannel.trim()) return;
    setBusy(true);
    try {
      await upsertRoute({
        data: {
          event_type: newEvent as (typeof SLACK_EVENT_TYPES)[number],
          channel_id: newChannel.trim(),
          enabled: true,
        },
      });
      setNewChannel("");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }
  async function removeRoute(id: string) {
    setBusy(true);
    try {
      await delRoute({ data: { id } });
      await refetch();
    } finally {
      setBusy(false);
    }
  }
  async function toggleRoute(id: string, event_type: string, channel_id: string, enabled: boolean) {
    await upsertRoute({
      data: {
        id,
        event_type: event_type as (typeof SLACK_EVENT_TYPES)[number],
        channel_id,
        enabled,
      },
    });
    await refetch();
  }

  return (
    <div className="space-y-4 p-6 max-w-3xl">
      <PageHeader
        title="Notificações no Slack"
        description="Receba alertas de leads, deals e tickets em canais do Slack via Incoming Webhook."
      />

      <Card>
        <CardHeader>
          <CardTitle>Conexão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {integ ? (
            <>
              <div className="text-sm">
                Conectado a <strong>{integ.team_name || "Slack"}</strong>
                {integ.default_channel_name
                  ? ` · canal default: #${integ.default_channel_name}`
                  : ""}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={doTest} disabled={busy}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar teste
                </Button>
                <Button variant="destructive" onClick={doDelete} disabled={busy}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Crie um Incoming Webhook em <code>api.slack.com/messaging/webhooks</code> e cole a
                URL abaixo.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="hook">Webhook URL</Label>
                <Input
                  id="hook"
                  placeholder="https://hooks.slack.com/services/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="team">Workspace Slack</Label>
                  <Input id="team" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ch">Canal default</Label>
                  <Input
                    id="ch"
                    placeholder="alerts-crm"
                    value={defaultChannel}
                    onChange={(e) => setDefaultChannel(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={doSave} disabled={busy || !webhookUrl}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Conectar
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {integ && (
        <Card>
          <CardHeader>
            <CardTitle>Eventos → Canal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sem regras, todos os eventos vão para o webhook default. Adicione regras para
              sobrescrever o canal por tipo de evento.
            </p>
            <div className="space-y-2">
              {routes.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{r.event_type}</span>
                    <span className="text-muted-foreground"> → #{r.channel_id}</span>
                  </div>
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) => toggleRoute(r.id, r.event_type, r.channel_id, v)}
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeRoute(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {routes.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhuma regra ainda.</div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
              <Select value={newEvent} onValueChange={setNewEvent}>
                <SelectTrigger className="sm:w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLACK_EVENT_TYPES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="canal-alvo"
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                className="flex-1"
              />
              <Button onClick={addRoute} disabled={busy || !newChannel}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
