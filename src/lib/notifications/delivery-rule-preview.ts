import type { NotificationDeliveryPolicy, NotificationSlackPolicy } from "./delivery-types";
import type { WorkflowTrigger } from "@/lib/workflows/types";
import { getWorkflowNotificationEvent } from "@/lib/workflows/notification-events";

/** Describes a validated draft; it never looks up a record or schedules an occurrence. */
export function inspectNotificationTrigger(trigger: WorkflowTrigger): string[] {
  const selection = trigger.notification_event;
  if (!selection) return [];
  const event = getWorkflowNotificationEvent(selection.key);
  if (!event) return ["O evento de notificação não está disponível nesta versão."];
  const notes = [`Evento: ${event.label}. A ocorrência será conferida na origem pelo motor.`];
  if (selection.key === "contracts.contract.expiring")
    notes.push(
      `Antecedência: ${selection.days_before} dias antes do fim da vigência. Contratos sem data válida ou já vencidos não entram na janela.`,
    );
  if (selection.key === "contracts.contract.renewal_due")
    notes.push(
      `Antecedência: ${selection.days_before} dias antes do prazo de aviso definido no contrato. Exige renovação automática configurada e prazo válido; não renova nem encerra o contrato.`,
    );
  if (selection.key === "projects.project.started")
    notes.push(
      "Início: quando o projeto passa de Planejamento para Ativo. A data prevista, a importação de um projeto ativo e a retomada de um projeto em espera não iniciam este aviso.",
    );
  if (selection.key === "projects.project.overdue" || selection.key === "projects.task.overdue")
    notes.push(
      "Atraso: a partir do dia seguinte ao prazo, no calendário America/Sao_Paulo. Uma ocorrência por prazo, sem lembrete diário. Atrasos anteriores à publicação da regra não entram; os que surgirem depois podem ser recuperados no próximo processamento.",
      selection.key === "projects.project.overdue"
        ? "Somente projetos em Planejamento ou Ativo, com prazo válido e ainda atrasados na execução."
        : "Tarefas concluídas ou com situação personalizada de conclusão não entram. O projeto deve estar em Planejamento, Ativo ou Em espera; prazos e vínculos são conferidos novamente na execução.",
    );
  if (selection.key === "projects.milestone.due")
    notes.push(
      `Antecedência: ${selection.days_before} dias antes do prazo do marco, no calendário America/Sao_Paulo. Marcos concluídos, cancelados ou já vencidos não entram na janela. O projeto deve estar em Planejamento, Ativo ou Em espera.`,
    );
  notes.push(
    event.moduleKey === "projects"
      ? "O evento de aviso não cria tarefas, altera prazos, registra horas ou gera cobrança por si só. Revise as ações do Workflow. A publicação e a ativação são separadas desta conferência."
      : "Esta regra não recria encaminhamentos, tarefas ou decisões contratuais. A publicação e a ativação da regra são ações separadas desta conferência.",
  );
  return notes;
}

/** Structural inspection only: no recipient lookup, persistence, provider or event execution. */
export function inspectNotificationActions(
  actions: unknown[],
  policy: NotificationDeliveryPolicy | null,
  slackPolicy: NotificationSlackPolicy | null = null,
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
      if (s.type === "send_slack") {
        notificationSteps++;
        channels.add("slack (coletivo)");
        if (!slackPolicy)
          issues.add("A política coletiva do Slack não foi inspecionada com seu acesso atual.");
        else if (!slackPolicy.enabled)
          issues.add("O Slack está desabilitado na política coletiva do workspace.");
        if (typeof s.channel === "string" && s.channel.trim())
          issues.add(
            "O canal antigo desta ação bloqueia o Incoming Webhook. Remova o override e revise o destino.",
          );
        issues.add(
          "Slack usa modelo neutro fixo para um canal compartilhado, sem comprovar entrega pessoal ou leitura.",
        );
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
