import type { NotificationDeliveryPolicy } from "./delivery-types";
/** Structural inspection only: no recipient lookup, persistence, provider or event execution. */
export function inspectNotificationActions(
  actions: unknown[],
  policy: NotificationDeliveryPolicy | null,
) {
  const channels = new Set<string>(),
    issues = new Set<string>();
  let notificationSteps = 0;
  const walk = (steps: unknown[], depth = 0) => {
    if (depth > 8) return;
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      const s = step as Record<string, unknown>;
      if (s.type === "send_notification") {
        notificationSteps++;
        const delivery = s.delivery as { channels: string[]; fallback: string } | undefined;
        for (const ch of delivery?.channels ?? ["inapp"]) channels.add(ch);
        if (delivery?.fallback === "email") channels.add("email");
        if (delivery?.channels.includes("whatsapp") && policy && !policy.whatsapp_enabled)
          issues.add("O WhatsApp está desabilitado na política do workspace.");
        if (
          (delivery?.channels.includes("email") || delivery?.fallback === "email") &&
          policy &&
          !policy.email_enabled
        )
          issues.add("O e-mail está desabilitado na política do workspace.");
      }
      for (const key of ["then", "else", "actions", "default"])
        if (Array.isArray(s[key])) walk(s[key] as unknown[], depth + 1);
      for (const key of ["branches", "cases"])
        if (Array.isArray(s[key]))
          for (const child of s[key] as Record<string, unknown>[])
            if (Array.isArray(child.actions)) walk(child.actions, depth + 1);
    }
  };
  walk(actions);
  if (!policy)
    issues.add("A política de canais exige permissão de consulta e não foi inspecionada.");
  if (!notificationSteps) issues.add("A regra não contém uma ação de notificação.");
  issues.add(
    "Disponibilidade dos destinatários, consentimento, permissões, horário de silêncio e limites serão conferidos na execução. Nenhuma mensagem foi enviada.",
  );
  return {
    notificationSteps,
    channels: [...channels],
    issues: [...issues],
    realMessages: 0 as const,
  };
}
