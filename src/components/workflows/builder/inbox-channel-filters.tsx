import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { listWorkflowInboxSources } from "@/lib/workflows/inbox-channels.functions";
import { inboxEventChannel } from "@/lib/workflows/inbox-channel-events";
import type { WorkflowNotificationEventSelection } from "@/lib/workflows/notification-events";

export function InboxChannelFilters({
  selection,
  onChange,
}: {
  selection: WorkflowNotificationEventSelection;
  onChange: (value: WorkflowNotificationEventSelection) => void;
}) {
  const channel = inboxEventChannel(selection.key);
  const permissions = usePermissions();
  const { user } = useAuth();
  const list = useServerFn(listWorkflowInboxSources);
  const scopes = ["own", "team", "workspace"];
  const allowed =
    !!channel &&
    !permissions.isLoading &&
    !permissions.isError &&
    permissions.canAny(scopes.map((scope) => `system.workflows.view.${scope}`)) &&
    permissions.canAny(scopes.map((scope) => `techsales.inbox.${channel}.view.${scope}`)) &&
    permissions.canAny(
      ["create", "update", "manage"].flatMap((action) =>
        scopes.map((scope) => `system.workflows.${action}.${scope}`),
      ),
    );
  const query = useQuery({
    queryKey: ["workflow-inbox-sources", user?.id, permissions.workspaceId, channel],
    queryFn: () => {
      if (!channel) throw new Error("Canal indisponível.");
      return list({ data: { channel } });
    },
    enabled: allowed,
    retry: false,
    staleTime: 0,
  });
  if (!channel) return null;
  if (permissions.isLoading) return <p role="status">Verificando acesso às contas…</p>;
  if (!allowed) return <p role="alert">Sem permissão para consultar contas deste canal.</p>;
  if (query.isError)
    return (
      <div role="alert">
        <p>Não foi possível consultar contas. Os filtros salvos foram preservados.</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!query.data || !query.isFetchedAfterMount)
    return <p role="status">Consultando contas autorizadas…</p>;
  if (query.data.workspace_id !== permissions.workspaceId || query.data.channel !== channel)
    return <p role="alert">Workspace ou canal indisponível. Atualize a consulta.</p>;
  const selected = selection.account_ids ?? [];
  const missing = selected.filter((id) => !query.data.sources.some((source) => source.id === id));
  return (
    <fieldset className="space-y-2" disabled={query.isFetching}>
      <legend className="font-medium text-foreground">Contas de recebimento</legend>
      {!query.data.sources.length && <p>Nenhuma conta conectada e autorizada.</p>}
      {query.data.sources.map((source) => (
        <label key={source.id} className="flex items-center gap-2 break-words">
          <Checkbox
            aria-label={source.label}
            checked={selected.includes(source.id)}
            onCheckedChange={(checked) => {
              if (
                checked !== true &&
                selected.length === 1 &&
                !window.confirm(
                  "Remover a última conta selecionada? O filtro passará a abranger todas as contas autorizadas deste canal.",
                )
              )
                return;
              onChange({
                ...selection,
                channel,
                account_ids:
                  checked === true
                    ? [...selected, source.id]
                    : selected.filter((id) => id !== source.id),
              });
            }}
          />
          {source.label}
        </label>
      ))}
      {missing.length > 0 && (
        <div className="space-y-2">
          <p role="alert">
            Há {missing.length} conta(s) salva(s) indisponível(is). A seleção foi preservada para
            revisão. Remover a última conta fará o filtro abranger todas as contas autorizadas deste
            canal.
          </p>
          {missing.map((id) => (
            <div key={id} className="flex items-center gap-2">
              <span className="min-w-0 break-all text-muted-foreground">
                Conta salva indisponível · {id}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                title={`Remover conta indisponível ${id}`}
                aria-label={`Remover conta indisponível ${id}`}
                onClick={() => {
                  if (
                    selected.length === 1 &&
                    !window.confirm(
                      "Remover a última conta selecionada? O filtro passará a abranger todas as contas autorizadas deste canal.",
                    )
                  )
                    return;
                  onChange({
                    ...selection,
                    channel,
                    account_ids: selected.filter((value) => value !== id),
                  });
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}
