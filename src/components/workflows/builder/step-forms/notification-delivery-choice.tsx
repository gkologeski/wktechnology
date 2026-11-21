import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { WorkflowAction } from "@/lib/workflows/types";
import type { NotificationDeliveryConfig } from "@/lib/notifications/delivery-types";
import { notificationDeliveryInteractionAllowed } from "@/lib/notification-delivery-interaction";

type Action = Extract<WorkflowAction, { type: "send_notification" }>;
export function NotificationDeliveryChoice({
  action,
  onChange,
  canEdit = false,
  notificationEventKey,
}: {
  action: Action;
  onChange: (action: WorkflowAction) => void;
  canEdit?: boolean;
  notificationEventKey?: string;
}) {
  const [open, setOpen] = useState(Boolean(action.delivery));
  const config: NotificationDeliveryConfig = action.delivery ?? {
    channels: ["inapp"],
    fallback: "none",
  };
  const updateChannel = (
    channel: NotificationDeliveryConfig["channels"][number],
    enabled: boolean,
  ) => {
    if (!notificationDeliveryInteractionAllowed(canEdit)) return;
    const channels = enabled
      ? [...new Set([...config.channels, channel])]
      : config.channels.filter((current) => current !== channel);
    if (!channels.length) return;
    const fallback =
      channels.includes("whatsapp") && !channels.includes("email") ? config.fallback : "none";
    onChange({ ...action, delivery: { ...config, channels, fallback } });
  };
  return (
    <section className="space-y-3 border-t border-border pt-4" aria-label="Canais da notificação">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Canais de aviso</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Ocultar canais" : "Configurar canais de aviso"}
        </Button>
      </div>
      {!action.delivery && (
        <p className="text-xs text-muted-foreground">
          Configuração legada preservada: somente aviso no app. Abrir estas opções não habilita
          envios externos.
        </p>
      )}
      {open && (
        <fieldset className="space-y-3" disabled={!canEdit}>
          <legend className="sr-only">Escolher canais e fallback</legend>
          {(
            [
              ["inapp", "No app"],
              ["email", "E-mail"],
              ["whatsapp", "WhatsApp oficial"],
            ] as const
          ).map(([channel, label]) => (
            <div key={channel} className="flex items-center gap-3">
              <Checkbox
                id={`notification-delivery-${channel}`}
                checked={config.channels.includes(channel)}
                disabled={
                  (config.channels.length === 1 && config.channels.includes(channel)) ||
                  (channel === "inapp" && Boolean(config.followup))
                }
                onCheckedChange={(checked) => updateChannel(channel, checked === true)}
              />
              <Label htmlFor={`notification-delivery-${channel}`}>{label}</Label>
            </div>
          ))}
          <label className="block space-y-1 text-sm">
            Prioridade da comunicação
            <select
              aria-label="Prioridade da comunicação"
              className="block h-10 w-full rounded-md border border-input bg-background px-3"
              value={config.priority ?? "normal"}
              onChange={(event) =>
                notificationDeliveryInteractionAllowed(canEdit) &&
                onChange({
                  ...action,
                  delivery: {
                    ...config,
                    priority: event.target.value as "low" | "normal" | "high",
                  },
                })
              }
            >
              <option value="normal">Normal</option>
              <option value="low">Baixa · pode entrar no resumo</option>
              <option value="high">Alta</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            Sem escolha explícita, a prioridade permanece normal. Só o envio inicial de baixa
            prioridade de um evento canônico pode entrar no resumo pessoal, se o destinatário aderir
            e a política permitir. A central continua imediata; prioridade não supera acesso,
            preferências ou consentimento.
            {notificationEventKey === "people.approval.pending"
              ? " Esta aprovação não é agrupada em resumo."
              : !notificationEventKey && " Este gatilho genérico não participa do resumo."}
          </p>
          <label className="block space-y-1 text-sm">
            Alternativa após falha definitiva
            <select
              aria-label="Fallback da notificação"
              className="block h-10 w-full rounded-md border border-input bg-background px-3"
              value={config.fallback}
              disabled={!config.channels.includes("whatsapp") || config.channels.includes("email")}
              onChange={(event) =>
                notificationDeliveryInteractionAllowed(canEdit) &&
                onChange({
                  ...action,
                  delivery: {
                    ...config,
                    fallback: event.target.value as NotificationDeliveryConfig["fallback"],
                  },
                })
              }
            >
              <option value="none">Sem fallback</option>
              <option value="email">E-mail após falha definitiva do WhatsApp</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            O fallback exige WhatsApp como canal primário e e-mail fora do envio em paralelo. Não
            acontece enquanto o resultado for incerto, nem contorna revogação de acesso ou
            consentimento.
          </p>
        </fieldset>
      )}
      <p className="text-xs text-muted-foreground">
        E-mail e WhatsApp exigem política habilitada e preferências válidas. O WhatsApp também exige
        autorização individual e modelo compatível aprovado para o número fixado na política. A
        mensagem externa é sempre neutra; não copia o título, corpo ou variáveis deste passo.
      </p>
    </section>
  );
}
