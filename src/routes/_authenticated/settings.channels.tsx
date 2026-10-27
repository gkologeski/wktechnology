import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Mail, Globe, RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listServiceChannels,
  discoverServiceChannels,
  saveServiceChannel,
  type ServiceAccount,
  type ServiceBinding,
} from "@/lib/prospecting/sdr/channel-accounts.functions";

export const Route = createFileRoute("/_authenticated/settings/channels")({
  component: ServiceChannelsPage,
});
const TYPES = {
  whatsapp: { label: "WhatsApp", icon: MessageSquare, path: "/settings/whatsapp" },
  email: { label: "E-mail", icon: Mail, path: "/settings/email" },
  chat: { label: "Chat do site", icon: Globe, path: "/settings/widget" },
};
function ServiceChannelsPage() {
  const permissions = usePermissions();
  const canView = permissions.can("system.channels.view.workspace");
  const canManage = permissions.can("system.channels.manage.workspace");
  const query = useQueryClient();
  const list = useServerFn(listServiceChannels);
  const discover = useServerFn(discoverServiceChannels);
  const accounts = useQuery({
    queryKey: ["service_channels"],
    queryFn: () => list(),
    enabled: canView,
  });
  const refresh = useMutation({
    mutationFn: () => discover(),
    onSuccess: () => {
      query.invalidateQueries({ queryKey: ["service_channels"] });
      toast.success("Contas atualizadas.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [channel, setChannel] = useState<keyof typeof TYPES>("whatsapp");
  if (!canView)
    return (
      <p className="text-muted-foreground">Sem permissão para visualizar canais de atendimento.</p>
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Canais de atendimento"
        description="Conecte suas contas e defina quem atende em cada canal."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(TYPES).map(([key, item]) => (
          <button
            key={key}
            onClick={() => setChannel(key as keyof typeof TYPES)}
            className={`rounded-lg border p-5 text-left transition-colors ${channel === key ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
          >
            <item.icon className="mb-3 h-5 w-5 text-primary" />
            <span className="font-semibold">{item.label}</span>
            <p className="mt-1 text-sm text-muted-foreground">
              {accounts.data?.accounts.filter((a) => a.channel === key).length ?? "—"} contas
            </p>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{TYPES[channel].label}</h2>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={TYPES[channel].path}>
              <Settings className="mr-2 h-4 w-4" />
              Configurar conexão
            </a>
          </Button>
          {canManage && (
            <Button variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar contas
            </Button>
          )}
        </div>
      </div>
      {accounts.isLoading && <p>Carregando contas…</p>}
      {accounts.isError && (
        <div role="alert" className="rounded-lg border border-destructive p-4">
          <p>Não foi possível carregar os canais.</p>
          <Button variant="outline" onClick={() => accounts.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {accounts.data && !accounts.data.accounts.some((a) => a.channel === channel) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma conta registrada. Configure uma conexão e atualize as contas.
          </CardContent>
        </Card>
      )}
      {accounts.data?.accounts
        .filter((a) => a.channel === channel)
        .map((account) => (
          <AccountEditor
            key={account.id}
            account={account}
            binding={accounts.data.bindings.find((b) => b.account_id === account.id)}
            agents={accounts.data.agents}
            canManage={canManage}
          />
        ))}
    </div>
  );
}
function AccountEditor({
  account,
  binding,
  agents,
  canManage,
}: {
  account: ServiceAccount;
  binding?: ServiceBinding;
  agents: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [label, setLabel] = useState(account.label);
  const [name, setName] = useState(account.display_name);
  const [enabled, setEnabled] = useState(account.enabled);
  const [agentId, setAgentId] = useState(binding?.agent_id ?? "none");
  const [agentName, setAgentName] = useState(binding?.display_name ?? "");
  const [inbound, setInbound] = useState(binding?.inbound ?? false);
  const [campaigns, setCampaigns] = useState(binding?.campaigns ?? false);
  const [agentEnabled, setAgentEnabled] = useState(binding?.enabled ?? false);
  const save = useServerFn(saveServiceChannel);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          accountId: account.id,
          label,
          displayName: name,
          enabled,
          agentId: agentId === "none" ? null : agentId,
          agentDisplayName: agentName,
          inbound,
          campaigns,
          agentEnabled,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_channels"] });
      toast.success("Canal salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>{account.label}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{account.source_key}</p>
        </div>
        <Badge variant={account.enabled ? "default" : "secondary"}>
          {account.enabled ? "Habilitada" : "Desabilitada"}
        </Badge>
      </CardHeader>
      <CardContent>
        <fieldset disabled={!canManage || mutation.isPending} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Label>
              Nome da conta
              <Input
                className="mt-2"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={120}
              />
            </Label>
            <Label>
              Nome de atendimento
              <Input
                className="mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Ex.: Bruna"
              />
            </Label>
            <Label>
              Agente responsável
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Somente atendimento humano</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Identidade deste agente na conta
              <Input
                className="mt-2"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                maxLength={60}
                placeholder="Usar nome de atendimento da conta"
              />
            </Label>
          </div>
          <div className="flex flex-wrap gap-6">
            <Label className="flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              Conta habilitada
            </Label>
            <Label className="flex items-center gap-2">
              <Switch checked={inbound} onCheckedChange={setInbound} />
              Receptivo
            </Label>
            <Label className="flex items-center gap-2">
              <Switch checked={campaigns} onCheckedChange={setCampaigns} />
              Após campanhas
            </Label>
            <Label className="flex items-center gap-2">
              <Switch checked={agentEnabled} onCheckedChange={setAgentEnabled} />
              Agente automático
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Apresentação:{" "}
            {agentName ||
              name ||
              agents.find((a) => a.id === agentId)?.name ||
              "defina o nome de atendimento"}
            .
          </p>
          {canManage && <Button onClick={() => mutation.mutate()}>Salvar configuração</Button>}
        </fieldset>
      </CardContent>
    </Card>
  );
}
