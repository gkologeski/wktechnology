import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { ENTITY_LABELS, EVENT_LABELS } from "@/lib/workflows/types";
import type { NotificationWorkflowRuleRow } from "./notification-rules-panel";
import { notificationDeliveryInteractionAllowed } from "@/lib/notification-delivery-interaction";
import { workflowNotificationTriggerLabel } from "@/lib/workflows/notification-events";

function schedulingLabels(actions: readonly unknown[]): string[] {
  const labels = new Set<string>();
  const walk = (steps: readonly unknown[], depth = 0) => {
    if (depth > 8) return;
    for (const value of steps) {
      if (!value || typeof value !== "object") continue;
      const step = value as Record<string, unknown>;
      const delivery = step.delivery as
        | {
            priority?: string;
            followup?: {
              reminder?: { interval_hours: number; max_occurrences: number };
              escalation?: { after_hours: number };
            };
          }
        | undefined;
      if (step.type === "send_notification" && delivery) {
        if (delivery.priority === "low")
          labels.add("Prioridade baixa explícita · resumo depende da elegibilidade pessoal");
        if (delivery.followup?.reminder)
          labels.add(
            `Lembrete a cada ${delivery.followup.reminder.interval_hours} h · máximo ${delivery.followup.reminder.max_occurrences}`,
          );
        if (delivery.followup?.escalation)
          labels.add(`Escalonamento após ${delivery.followup.escalation.after_hours} h · uma vez`);
      }
      for (const key of ["then", "else", "actions", "default"])
        if (Array.isArray(step[key])) walk(step[key] as unknown[], depth + 1);
      for (const key of ["branches", "cases"])
        if (Array.isArray(step[key]))
          for (const child of step[key] as { actions?: unknown[] }[])
            if (Array.isArray(child?.actions)) walk(child.actions, depth + 1);
    }
  };
  walk(actions);
  return [...labels];
}

type Capability = { can_update: boolean; can_manage: boolean; can_delete: boolean };
type RuleAction = "edit" | "preview" | "publish" | "toggle" | "discard" | "delete";
export function NotificationRulesList({
  rows,
  capabilityFor,
  manager,
  readOnly,
  pending,
  onAction,
  canRead = false,
}: {
  rows: NotificationWorkflowRuleRow[];
  capabilityFor: (id: string) => Capability;
  manager: boolean;
  readOnly: boolean;
  pending: boolean;
  onAction: (action: RuleAction, row: NotificationWorkflowRuleRow, enabled?: boolean) => void;
  canRead?: boolean;
}) {
  const permissions = usePermissions();
  if (permissions.isLoading || permissions.isError || !permissions.workspaceId)
    return <p role="status">Aguardando confirmação das permissões das regras…</p>;
  if (!notificationDeliveryInteractionAllowed(canRead))
    return <p>Sem permissão para consultar regras.</p>;
  const act = (kind: RuleAction, row: NotificationWorkflowRuleRow, enabled?: boolean) => {
    const cap = capabilityFor(row.id);
    const allowed =
      kind === "preview"
        ? canRead
        : kind === "delete"
          ? !readOnly && cap.can_delete
          : kind === "publish"
            ? manager && !readOnly && cap.can_manage
            : manager && !readOnly && cap.can_update;
    if (notificationDeliveryInteractionAllowed(allowed, pending)) onAction(kind, row, enabled);
  };
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const cap = capabilityFor(row.id),
          editable = manager && !readOnly && cap.can_update;
        return (
          <article className="min-w-0 space-y-3 rounded-lg bg-muted/25 p-4" key={row.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-medium">{row.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {ENTITY_LABELS[row.entity] ?? row.entity} ·{" "}
                  {workflowNotificationTriggerLabel(row.draft_trigger ?? row.trigger) ??
                    EVENT_LABELS[(row.draft_trigger ?? row.trigger)?.event] ??
                    "Gatilho do Workflow"}
                </p>
                {(row.draft_trigger ?? row.trigger)?.notification_event?.days_before && (
                  <p className="text-xs text-muted-foreground">
                    Antecedência:{" "}
                    {(row.draft_trigger ?? row.trigger).notification_event!.days_before} dias ·
                    exige prazo válido na origem.
                  </p>
                )}
                {schedulingLabels(row.draft_actions ?? row.actions).map((label) => (
                  <p key={label} className="text-xs text-muted-foreground">
                    {label}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {row.status === "published"
                    ? `Publicada · v${row.published_version}`
                    : "Rascunho"}
                </Badge>
                <Badge variant="outline">{row.enabled ? "Ativa" : "Desativada"}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editable && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => act("edit", row)}
                >
                  Editar no construtor
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => act("preview", row)}
              >
                Conferir configuração sem enviar
              </Button>
              {manager && !readOnly && cap.can_manage && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => act("publish", row)}
                >
                  Publicar versão
                </Button>
              )}
              {editable && (
                <label className="flex items-center gap-2 px-2 text-sm">
                  <Switch
                    aria-label={`Ativar regra ${row.name}`}
                    checked={row.enabled}
                    disabled={pending}
                    onCheckedChange={(enabled) => act("toggle", row, enabled)}
                  />
                  Ativa
                </label>
              )}
              {editable && row.has_draft_changes && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => act("discard", row)}
                >
                  Descartar rascunho
                </Button>
              )}
              {!readOnly && cap.can_delete && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => act("delete", row)}
                >
                  Excluir regra
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
