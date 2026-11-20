import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  NOTIFICATION_DELIVERY_STATUSES,
  type NotificationDeliveryHistoryItem,
} from "@/lib/notifications/delivery-types";
import { formatDateTime } from "@/lib/crm";
import { notificationDeliveryInteractionAllowed } from "@/lib/notification-delivery-interaction";

export type DeliveryFilters = { scope: "own" | "workspace"; status: string; channel: string };
const STATUS: Record<string, string> = {
  queued: "Na fila",
  in_flight: "Em processamento",
  accepted: "Aceito pelo provedor",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falha definitiva",
  retry_scheduled: "Nova tentativa agendada",
  uncertain: "Incerto",
  suppressed: "Suprimido",
  deduped: "Deduplicado",
  available: "Disponível na central",
  sent: "Enviado",
};
const REASON: Record<string, string> = {
  invalid_recipient: "Destinatário indisponível.",
  invalid_configuration: "Configuração indisponível.",
  invalid_template: "O modelo não atende às condições do canal.",
  sender_unavailable: "Remetente indisponível.",
  provider_rejected: "O provedor recusou a tentativa.",
  provider_rate_limited: "O provedor limitou as requisições.",
  provider_preflight_unavailable: "Não foi possível confirmar as condições do provedor.",
  transport_unknown:
    "A resposta não confirma o resultado. Aguarde a conciliação; não reenvie às cegas.",
  recipient_suppressed: "Entrega suprimida pelas condições do destinatário.",
  consent_missing:
    "O destinatário ainda não autorizou os próprios avisos por WhatsApp neste workspace.",
  consent_revoked: "O destinatário revogou sua autorização de WhatsApp.",
  endpoint_changed:
    "O telefone atual difere do número autorizado. Uma nova autorização pessoal é necessária.",
  quota_exceeded: "A cota configurada para o canal foi atingida.",
  budget_exceeded: "O orçamento estimado de WhatsApp foi atingido.",
  preferences_disabled: "As preferências pessoais não permitem este canal.",
};
export function DeliveryHistoryPanel({
  items,
  filters,
  canWorkspace,
  loading,
  error,
  hasMore,
  loadingMore,
  onFilters,
  onMore,
  onRetry,
  canRead = false,
}: {
  items: NotificationDeliveryHistoryItem[];
  filters: DeliveryFilters;
  canWorkspace: boolean;
  loading: boolean;
  error?: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onFilters: (filters: DeliveryFilters) => void;
  onMore: () => void;
  onRetry: () => void;
  canRead?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleItems =
    filters.scope === "workspace" ? items : items.filter((item) => item.channel !== "slack");
  const selected =
    !loading && !error ? visibleItems.find((item) => item.id === selectedId) : undefined;
  useEffect(() => {
    setSelectedId(null);
  }, [loading, error, filters.scope, filters.channel, filters.status]);
  const change = (patch: Partial<DeliveryFilters>) => {
    if (!notificationDeliveryInteractionAllowed(canRead, loading)) return;
    if (patch.scope === "workspace" && !canWorkspace) return;
    setSelectedId(null);
    const next = { ...filters, ...patch };
    if (next.scope !== "workspace" && next.channel === "slack") next.channel = "";
    onFilters(next);
  };
  const retry = () => {
    if (notificationDeliveryInteractionAllowed(canRead, loading)) onRetry();
  };
  if (!notificationDeliveryInteractionAllowed(canRead))
    return <p>Sem permissão para consultar as entregas.</p>;
  return (
    <section className="min-w-0 space-y-4" aria-label="Entregas e rastreabilidade">
      <div>
        <h2 className="text-lg font-semibold">Entregas e rastreabilidade</h2>
        <p className="text-sm text-muted-foreground">
          Cada canal tem seu resultado. Aceitação do provedor não comprova entrega, leitura ou
          decisão.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-sm">
          Escopo
          <select
            aria-label="Escopo das entregas"
            className="ml-2 h-10 rounded-md border border-input bg-background px-3"
            value={filters.scope}
            onChange={(event) => change({ scope: event.target.value as DeliveryFilters["scope"] })}
          >
            <option value="own">Minhas entregas</option>
            {canWorkspace && <option value="workspace">Workspace autorizado</option>}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Estado
          <select
            aria-label="Estado da entrega"
            className="ml-2 h-10 rounded-md border border-input bg-background px-3"
            value={filters.status}
            onChange={(event) => change({ status: event.target.value })}
          >
            <option value="">Todos</option>
            {NOTIFICATION_DELIVERY_STATUSES.map((value) => (
              <option value={value} key={value}>
                {STATUS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Canal
          <select
            aria-label="Canal da entrega"
            className="ml-2 h-10 rounded-md border border-input bg-background px-3"
            value={filters.channel}
            onChange={(event) => change({ channel: event.target.value })}
          >
            <option value="">Todos</option>
            <option value="inapp">Central</option>
            <option value="email">E-mail</option>
            <option value="whatsapp">WhatsApp</option>
            {filters.scope === "workspace" && canWorkspace && (
              <option value="slack">Slack coletivo</option>
            )}
          </select>
        </label>
        <Button variant="ghost" disabled={loading} onClick={retry}>
          Atualizar entregas
        </Button>
      </div>
      {error ? (
        <div role="alert" className="space-y-2">
          <p>Não foi possível carregar as entregas. {error}</p>
          <Button variant="outline" disabled={loading} onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      ) : loading ? (
        <p role="status">Carregando entregas…</p>
      ) : !visibleItems.length ? (
        <p className="py-6 text-sm text-muted-foreground">
          Nenhuma entrega encontrada para este filtro.
        </p>
      ) : (
        <div className="relative min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Ocorrência</th>
                <th className="p-3">Canal</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Tentativas</th>
                <th className="p-3">Horário</th>
                <th className="p-3">
                  <span className="sr-only">Detalhes</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-3 font-mono text-xs">{item.id.slice(0, 8)}</td>
                  <td className="p-3">
                    {
                      {
                        inapp: "Central",
                        email: "E-mail",
                        whatsapp: "WhatsApp",
                        slack: "Slack coletivo",
                      }[item.channel]
                    }
                  </td>
                  <td className="p-3">
                    <Badge variant="secondary">
                      {STATUS[item.status] ?? "Estado não reconhecido"}
                    </Badge>
                  </td>
                  <td className="p-3">{item.attempts}</td>
                  <td className="p-3">{formatDateTime(item.updated_at)}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedId(item.id)}>
                      Ver motivo
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <aside className="space-y-2 rounded-lg bg-muted/30 p-4" aria-label="Detalhe da entrega">
          <h3 className="font-medium">{STATUS[selected.status] ?? "Estado não reconhecido"}</h3>
          <p className="text-sm">
            {REASON[selected.reason_code ?? ""] ??
              (selected.status === "uncertain"
                ? REASON.transport_unknown
                : "Consulte o estado e a próxima tentativa no fluxo autorizado. Dados privados não são reproduzidos aqui.")}
          </p>
          <p className="text-xs text-muted-foreground">
            Ocorrência {selected.id}. Este histórico não autoriza reenvio, fallback ou decisão.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            Fechar detalhe
          </Button>
        </aside>
      )}
      {!error && hasMore && (
        <Button
          variant="outline"
          disabled={loadingMore}
          onClick={() => {
            if (notificationDeliveryInteractionAllowed(canRead, loadingMore)) onMore();
          }}
        >
          {loadingMore ? "Carregando…" : "Carregar entregas anteriores"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        O resultado incerto aguarda conciliação antes de nova tentativa ou fallback. Endereços,
        conteúdo privado e respostas brutas do provedor não são exibidos.
        {canWorkspace &&
          " Avisos coletivos do Slack aparecem somente no escopo do workspace, sem alegar entrega pessoal ou leitura."}
      </p>
    </section>
  );
}
