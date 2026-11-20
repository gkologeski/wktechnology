import { Clock3, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NotificationCenterItem } from "@/lib/notification-center";
import { notificationHref } from "@/lib/notification-href";
import { formatDateTime } from "@/lib/crm";
type Props = {
  selected: NotificationCenterItem | null;
  category: string;
  status: string;
  pending: boolean;
  loading?: boolean;
  error?: string | null;
  onRead: (ids: string[], read: boolean) => void;
  onSnooze: (id: string, minutes: 0 | 60 | 1440) => void;
};
export function NotificationDetail({
  selected,
  category,
  status,
  pending,
  loading,
  error,
  onRead,
  onSnooze,
}: Props) {
  const target = selected ? notificationHref(selected) : null;
  return (
    <aside
      aria-label="Detalhe da notificação"
      className="min-w-0 rounded-xl bg-muted/25 p-5 lg:sticky lg:top-4 lg:self-start"
    >
      {error ? (
        <p role="alert" className="py-5 text-sm text-muted-foreground">
          {error}
        </p>
      ) : loading ? (
        <p role="status" className="py-5 text-sm text-muted-foreground">
          Conferindo acesso ao aviso…
        </p>
      ) : !selected ? (
        <div className="py-10 text-center text-muted-foreground">
          <h2 className="font-medium text-foreground">Seu contexto aparece aqui</h2>
          <p className="mt-2 text-sm">
            Selecione um aviso para conferir o conteúdo e os próximos passos.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{category}</Badge>
            <Badge variant="outline">{status}</Badge>
          </div>
          <h2 className="min-w-0 break-words text-xl font-semibold">{selected.title}</h2>
          {selected.body && (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{selected.body}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Recebida em {formatDateTime(selected.created_at)}
          </p>
          {selected.snoozed_until && Date.parse(selected.snoozed_until) > Date.now() && (
            <p className="text-sm">
              <Clock3 className="mr-2 inline h-4 w-4" />
              Retorno em {formatDateTime(selected.snoozed_until)}
            </p>
          )}
          <p className="rounded-lg bg-background p-3 text-sm text-muted-foreground">
            Marcar como lida ou adiar não conclui a tarefa nem aprova o registro. Prazos e decisões
            continuam no fluxo de origem.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => !pending && onRead([selected.id], !selected.read_at)}
            >
              {selected.read_at ? "Marcar não lida" : "Marcar como lida"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => !pending && onSnooze(selected.id, 60)}
            >
              Adiar 1 hora
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => !pending && onSnooze(selected.id, 1440)}
            >
              Adiar 24 horas
            </Button>
            {selected.snoozed_until && Date.parse(selected.snoozed_until) > Date.now() && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => !pending && onSnooze(selected.id, 0)}
              >
                Cancelar adiamento
              </Button>
            )}
          </div>
          {target ? (
            <Button asChild>
              <Link to={target.to as never} search={target.search as never}>
                Abrir registro
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este aviso não possui um destino autorizado disponível. Consulte a área responsável
              pelo registro.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
