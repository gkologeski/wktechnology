import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { getSequenceInsights } from "@/lib/prospecting/sequences/operations.functions";
import { sequenceReasonLabel } from "@/lib/prospecting/sequences/insights";
import { formatDateTime } from "@/lib/crm";
export function SequenceInsights({
  workspaceId,
  versionId,
  disabled,
}: {
  workspaceId: string;
  versionId: string;
  disabled: boolean;
}) {
  const permissions = usePermissions(),
    load = useServerFn(getSequenceInsights);
  const unavailable =
    disabled ||
    permissions.isLoading ||
    permissions.isError ||
    permissions.workspaceId !== workspaceId ||
    !permissions.canAny(
      ["own", "team", "workspace"].map((scope) => `system.automation.sequences.view.${scope}`),
    );
  const query = useQuery({
    queryKey: ["sequence-insights", workspaceId, versionId],
    enabled: !unavailable,
    queryFn: () => load({ data: { workspaceId, versionId } }),
    refetchInterval: 30000,
  });
  if (unavailable) return null;
  if (query.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        Indicadores indisponíveis. Não foi possível conferir os resultados desta versão.
      </p>
    );
  if (!query.data)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Carregando indicadores…
      </p>
    );
  const data = query.data,
    s = data.states;
  const cards = [
    ["Execuções visíveis", Object.values(s).reduce((a, b) => a + b, 0)],
    ["Em andamento", (s.active || 0) + (s.waiting_task || 0)],
    ["Concluídas", s.completed || 0],
    ["Atendimento humano", s.human || 0],
    ["Com agente", s.agent || 0],
    ["Pausadas ou bloqueadas", (s.paused || 0) + (s.blocked || 0)],
    ["Resultados a conferir", s.uncertain || 0],
    ["Canceladas", s.cancelled || 0],
    ["E-mails aceitos pelo provedor", data.counts.emailAccepted],
    ["WhatsApps aceitos pelo provedor", data.counts.whatsappAccepted],
    ["Atividades de chamada", data.counts.callActivities],
    ["Tarefas registradas", data.counts.taskActivities],
    ["Respostas detectadas", data.responses],
    ["Encerradas por reunião", data.meetings],
  ] as const;
  return (
    <section
      className="space-y-3 rounded-md border p-3"
      aria-label="Indicadores e histórico da sequência"
    >
      <h3 className="font-medium">Resultados desta versão</h3>
      <p className="text-xs text-muted-foreground">
        Somente registros do seu escopo atual. Aceitação pelo provedor não comprova entrega ou
        leitura. Atividades de chamada incluem tarefas humanas e ligações automáticas.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-md border bg-muted/20 p-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value.toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </div>
      {data.counts.projectionPending > 0 && (
        <p role="status" className="text-xs">
          {data.counts.projectionPending} recibo(s) aguardam registro na timeline. Não reenvie a
          mensagem para corrigir esse registro.
        </p>
      )}
      {data.counts.uncertainEffects > 0 && (
        <p role="status" className="text-xs">
          {data.counts.uncertainEffects} ação(ões) têm resultado desconhecido. A sequência não fará
          nova tentativa automaticamente.
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Histórico operacional · últimos {data.history.length} eventos visíveis
        </summary>
        {data.history.length === 0 ? (
          <p className="py-2 text-xs">Nenhum evento registrado nesta versão.</p>
        ) : (
          <ol className="max-h-80 space-y-2 overflow-auto py-2">
            {data.history.map((e) => (
              <li key={e.id} className="border-b pb-2 text-xs">
                <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
                <span className="ml-2">{sequenceReasonLabel(e.reason)}</span>
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}
