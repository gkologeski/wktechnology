import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { listServiceChannels } from "@/lib/prospecting/sdr/channel-accounts.functions";
import { Button } from "@/components/ui/button";
import { AccountEditor } from "./account-editor";

export function AgentChannels({ agentId }: { agentId: string }) {
  const permissions = usePermissions();
  const canView = permissions.can("system.channels.view.workspace");
  const canManage = permissions.can("system.channels.manage.workspace");
  const list = useServerFn(listServiceChannels);
  const query = useQuery({
    queryKey: ["service_channels", permissions.workspaceId],
    queryFn: () => list(),
    enabled: canView,
  });
  if (!canView)
    return (
      <p className="text-sm text-muted-foreground">
        A visualização das contas exige a permissão “Ver canais de atendimento”.
      </p>
    );
  if (query.isLoading) return <p role="status">Carregando contas de atendimento…</p>;
  if (query.isError)
    return (
      <div role="alert">
        <p>Não foi possível carregar as contas.</p>
        <Button variant="outline" onClick={() => query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const data = query.data;
  if (!data) return null;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escolha uma ou mais contas de WhatsApp, e-mail ou chat. Cada conta tem sua identidade e seus
        modos de atendimento.
      </p>
      {data.accounts.map((account) => {
        const binding = data.bindings.find((b) => b.account_id === account.id);
        if (binding && binding.agent_id !== agentId)
          return (
            <div key={account.id} className="rounded-lg border p-4 text-sm">
              <strong>{account.label}</strong>
              <p className="text-muted-foreground">
                Vinculada a{" "}
                {data.agents.find((a) => a.id === binding.agent_id)?.name ?? "outro agente"}.
                Gerencie a troca na central de canais.
              </p>
            </div>
          );
        return (
          <AccountEditor
            key={`${account.id}:${binding?.agent_id ?? "none"}`}
            account={account}
            binding={binding}
            agents={data.agents.filter((a) => a.id === agentId)}
            suggestedAgentId={agentId}
            canManage={canManage}
          />
        );
      })}
      {!data.accounts.length && (
        <p className="text-sm text-muted-foreground">
          Cadastre suas conexões e atualize as contas na central de canais.
        </p>
      )}
      <Button variant="outline" asChild>
        <a href="/settings/channels">Abrir canais de atendimento</a>
      </Button>
    </div>
  );
}
