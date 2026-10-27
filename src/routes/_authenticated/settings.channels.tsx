import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Mail, Globe, RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountEditor } from "@/components/service-channels/account-editor";
import {
  listServiceChannels,
  discoverServiceChannels,
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
