import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import type { WorkflowNotificationEventSelection } from "@/lib/workflows/notification-events";
import { listWorkflowWhatsAppSources } from "@/lib/workflows/whatsapp-inbound.functions";

const scopes = ["own", "team", "workspace"];

/** Account metadata only; the backend revalidates the source and row scope on save and execution. */
export function WhatsAppInboundFilters({
  selection,
  onChange,
}: {
  selection: WorkflowNotificationEventSelection;
  onChange: (value: WorkflowNotificationEventSelection) => void;
}) {
  const { user, loading } = useAuth();
  const permissions = usePermissions();
  const listSources = useServerFn(listWorkflowWhatsAppSources);
  const ready =
    !loading &&
    !!user?.id &&
    !permissions.isLoading &&
    !permissions.isError &&
    !!permissions.workspaceId;
  const allowed =
    ready &&
    permissions.canAny(scopes.map((scope) => `system.workflows.view.${scope}`)) &&
    permissions.canAny(scopes.map((scope) => `techsales.inbox.whatsapp.view.${scope}`)) &&
    permissions.canAny(
      ["create", "update", "manage"].flatMap((action) =>
        scopes.map((scope) => `system.workflows.${action}.${scope}`),
      ),
    );
  const query = useQuery({
    queryKey: ["workflow-whatsapp-sources", user?.id, permissions.workspaceId],
    queryFn: () => listSources({ data: {} }),
    enabled: allowed,
    staleTime: 0,
    retry: false,
  });
  if (permissions.isError)
    return (
      <p role="alert">
        Não foi possível confirmar o acesso às contas WhatsApp. Atualize as permissões antes de
        configurar o filtro.
      </p>
    );
  if (!ready) return <p role="status">Verificando acesso às contas WhatsApp…</p>;
  if (!allowed) return <p>Sem permissão para consultar as contas WhatsApp deste gatilho.</p>;
  if (query.isError)
    return (
      <div role="alert" className="space-y-2">
        <p>Não foi possível consultar as contas WhatsApp. Os filtros salvos foram preservados.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
          Tentar consultar contas novamente
        </Button>
      </div>
    );
  if (!query.isFetchedAfterMount || !query.data)
    return <p role="status">Consultando contas e números autorizados…</p>;
  if (query.data.workspace_id !== permissions.workspaceId)
    return (
      <p role="alert">
        Não foi possível confirmar o workspace das contas. Atualize a consulta antes de configurar o
        filtro.
      </p>
    );

  const sources = query.data.sources;
  const selectedSources = selection.source_keys ?? [];
  const selectedPhones = selection.phone_number_ids ?? [];
  const visibleSources = selectedSources.length
    ? sources.filter((source) => selectedSources.includes(source.id))
    : sources;
  const numbers = [
    ...new Map(
      visibleSources.flatMap((source) =>
        source.numbers.map(
          (number) => [number.id, { ...number, sourceLabel: source.label }] as const,
        ),
      ),
    ).values(),
  ];
  const missingSources = selectedSources.filter(
    (id) => !sources.some((source) => source.id === id),
  );
  const missingPhones = selectedPhones.filter((id) => !numbers.some((number) => number.id === id));
  const toggle = (field: "source_keys" | "phone_number_ids", id: string, checked: boolean) => {
    const current = selection[field] ?? [];
    const values = checked
      ? [...new Set([...current, id])]
      : current.filter((value) => value !== id);
    onChange({ ...selection, [field]: values });
  };

  return (
    <div className="space-y-4" aria-label="Filtros de origem WhatsApp">
      <p>
        Sem marcações, o gatilho considera qualquer conta e número autorizado no momento da
        execução. Ao marcar, somente a interseção das contas e números escolhidos será considerada.
      </p>
      {sources.length === 0 && <p>Nenhuma conta WhatsApp disponível para este acesso.</p>}
      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium text-foreground">Contas de recebimento</legend>
        {sources.map((source) => (
          <label key={source.id} className="flex items-center gap-2">
            <Checkbox
              aria-label={`Conta ${source.label}`}
              checked={selectedSources.includes(source.id)}
              onCheckedChange={(checked) => toggle("source_keys", source.id, checked === true)}
            />
            <span>{source.label}</span>
          </label>
        ))}
        {missingSources.map((id) => (
          <label key={id} className="flex items-center gap-2 text-destructive">
            <Checkbox
              aria-label={`Remover conta indisponível ${id}`}
              checked
              onCheckedChange={() => toggle("source_keys", id, false)}
            />
            <span>Conta salva indisponível. Desmarque para remover: {id}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-2 font-medium text-foreground">
          Números comerciais de recebimento
        </legend>
        {numbers.map((number) => (
          <label key={number.id} className="flex items-center gap-2">
            <Checkbox
              aria-label={`Número ${number.phone} · ${number.sourceLabel}`}
              checked={selectedPhones.includes(number.id)}
              onCheckedChange={(checked) => toggle("phone_number_ids", number.id, checked === true)}
            />
            <span>
              {number.label} · {number.phone} · {number.sourceLabel}
            </span>
          </label>
        ))}
        {missingPhones.map((id) => (
          <label key={id} className="flex items-center gap-2 text-destructive">
            <Checkbox
              aria-label={`Remover número indisponível ${id}`}
              checked
              onCheckedChange={() => toggle("phone_number_ids", id, false)}
            />
            <span>
              Número salvo indisponível ou fora das contas marcadas. Desmarque para remover: {id}
            </span>
          </label>
        ))}
      </fieldset>
      {(missingSources.length > 0 || missingPhones.length > 0) && (
        <p role="alert" className="text-destructive">
          Confira os filtros indisponíveis antes de salvar. A seleção não é ampliada
          automaticamente.
        </p>
      )}
      <p>
        São números da sua operação, não o telefone do cliente. A regra não lê o corpo da mensagem,
        não responde ao cliente e não altera o responsável da conversa por esta seleção.
      </p>
    </div>
  );
}
