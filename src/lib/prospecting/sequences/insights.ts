import { z } from "zod";
export const insightsInput = z
  .object({ workspaceId: z.string().uuid(), versionId: z.string().uuid() })
  .strict();
const count = z.number().int().nonnegative().safe();
export const insightsSchema = z
  .object({
    states: z.record(z.string(), count),
    counts: z
      .object({
        emailAccepted: count,
        whatsappAccepted: count,
        callActivities: count,
        taskActivities: count,
        uncertainEffects: count,
        projectionPending: count,
      })
      .strict(),
    responses: count,
    meetings: count,
    coverage: z.literal("current_scope"),
    history: z
      .array(
        z
          .object({
            id: z.string(),
            runId: z.string().uuid(),
            kind: z.string(),
            reason: z.string().nullable(),
            createdAt: z.string().datetime({ offset: true }),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
export const SEQUENCE_REASON_LABELS: Record<string, string> = {
  reply: "Resposta recebida",
  meeting_booked: "Reunião identificada",
  opt_out: "Pedido para não receber contato",
  customer: "Já é cliente",
  open_deal: "Negociação em aberto",
  missing_email: "Sem e-mail válido",
  missing_whatsapp: "Sem WhatsApp válido",
  missing_phone: "Sem telefone válido",
  outside_business_hours: "Aguardando expediente",
  daily_account_limit: "Limite diário da conta",
  account_pacing: "Intervalo entre contatos",
  hourly_email_limit: "Limite de e-mails por hora",
  intake_paused_for_followups: "Entrada pausada para priorizar follow-ups",
  daily_whatsapp_limit: "Limite diário de WhatsApp",
  whatsapp_random_pacing: "Espaçamento aleatório do WhatsApp",
  daily_intake_limit: "Limite de novos contatos por dia",
  recent_whatsapp_skip: "WhatsApp pulado: contato recente",
  whatsapp_limit_skip: "WhatsApp pulado: limite diário",
  whatsapp_limit_overflow_call: "Transbordado para ligação: limite de WhatsApp",
  recent_whatsapp: "Recebeu WhatsApp recentemente",
  provider_result_unknown: "Resultado do provedor a conferir",
  delivery_uncertain: "Envio anterior a conferir",
  receipt_projection_pending: "Recibo recebido; registro pendente",
  inbox_projection_complete: "Mensagem registrada na Inbox",
  effect_succeeded: "Ação registrada",
  waiting_for_activity: "Aguardando conclusão da atividade",
  waiting_for_call: "Aguardando resultado da ligação",
  task_completed: "Atividade concluída",
  permission_revoked: "Permissão indisponível",
  authorization_or_configuration_unavailable: "Confira permissões e configuração",
  manual_pause: "Pausa solicitada",
  manual_resume: "Retomada solicitada",
  manual_cancel: "Cancelamento solicitado",
  manual_retry: "Nova avaliação solicitada",
  manual_reconcile: "Resultado conciliado",
  cohort_cancelled: "Inscrição cancelada",
  handoff_finished: "Atendimento concluído",
  sequence_end: "Fim da sequência",
  not_active: "Execução inativa",
  wait_elapsed: "Espera concluída",
  waiting: "Aguardando prazo",
  condition_next: "Condição avaliada",
  agent_missing: "Agente não configurado",
};
export function sequenceReasonLabel(reason: string | null) {
  return reason ? SEQUENCE_REASON_LABELS[reason] || reason : "—";
}
