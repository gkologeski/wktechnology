import { ChannelHealth } from "./channel-health";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
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
  saveServiceChannel,
  type ServiceAccount,
  type ServiceBinding,
} from "@/lib/prospecting/sdr/channel-accounts.functions";

export function AccountEditor({
  account,
  binding,
  agents,
  canManage,
  suggestedAgentId,
}: {
  account: ServiceAccount;
  binding?: ServiceBinding;
  agents: { id: string; name: string }[];
  canManage: boolean;
  suggestedAgentId?: string;
}) {
  const permissions = usePermissions();
  canManage =
    canManage &&
    account.workspace_id === permissions.workspaceId &&
    permissions.can("system.channels.manage.workspace");
  const [label, setLabel] = useState(account.label);
  const [name, setName] = useState(account.display_name);
  const [enabled, setEnabled] = useState(account.enabled);
  const [agentId, setAgentId] = useState(binding?.agent_id ?? suggestedAgentId ?? "none");
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
          {!account.routing_configured
            ? "Configuração não aplicada"
            : account.enabled
              ? "Automação permitida"
              : "Automação desligada"}
        </Badge>
      </CardHeader>
      <CardContent>
        {!account.routing_configured && (
          <p className="mb-3 text-sm text-muted-foreground">
            A conta descoberta mantém o atendimento atual até você salvar estas configurações.
          </p>
        )}
        <div className="mb-4">
          <ChannelHealth account={account} />
        </div>
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
              Permitir automação nesta conta
            </Label>
            <Label className="flex items-center gap-2">
              <Switch checked={inbound} onCheckedChange={setInbound} />
              Receptivo
            </Label>
            {account.channel === "whatsapp" && (
              <Label className="flex items-center gap-2">
                <Switch checked={campaigns} onCheckedChange={setCampaigns} />
                Após campanhas WhatsApp
              </Label>
            )}
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
