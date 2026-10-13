// Metadados padronizados de entrega gravados em cada passo do histórico do
// fluxo: execução, fluxo, canal, agente/versão e status real do provedor.
export type DeliveryChannel = "whatsapp" | "email" | "sdr_agent" | "handoff" | "linkedin";

export type DeliveryMeta = {
  channel: DeliveryChannel;
  workflow_id: string | null;
  run_id: string | null;
  /** Nome do provedor efetivo; null quando nada saiu (ex.: só fila local). */
  provider: string | null;
  /** Status devolvido pelo provedor ou estado local honesto ("queued_local"). */
  provider_status: string | null;
  provider_id: string | null;
  agent_id: string | null;
  agent_version_id: string | null;
};

export function buildDeliveryMeta(
  ctx: { workflowId?: string; runId?: string },
  input: Partial<Omit<DeliveryMeta, "workflow_id" | "run_id">> & { channel: DeliveryChannel },
): DeliveryMeta {
  return {
    channel: input.channel,
    workflow_id: ctx.workflowId ?? null,
    run_id: ctx.runId ?? null,
    provider: input.provider ?? null,
    provider_status: input.provider_status ?? null,
    provider_id: input.provider_id ?? null,
    agent_id: input.agent_id ?? null,
    agent_version_id: input.agent_version_id ?? null,
  };
}

export const CHANNEL_LABELS: Record<DeliveryChannel, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  sdr_agent: "Agente SDR",
  handoff: "Transferência",
  linkedin: "LinkedIn (manual)",
};

const STATUS_LABELS: Record<string, string> = {
  accepted: "Aceita pelo provedor",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
  queued_local: "Na fila interna (não enviada)",
  skipped_duplicate: "Ignorada: já enviada",
  enrolled: "Agente ligado",
  already_on: "Agente já estava ligado",
  paused: "Agente desligado",
  transferred: "Transferida",
  manual_task: "Tarefa manual criada",
  outside_window: "Aguardando horário de envio",
  quota_reached: "Cota diária atingida; reagendada",
  retry_scheduled: "Falha temporária; nova tentativa agendada",
  in_flight: "Envio em andamento em outro processo",
  uncertain: "Envio incerto (não reenviado)",
  reconciled_sent: "Confirmada no histórico do canal",
  deduped: "Ignorada: contato já abordado no período",
};

export function providerStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return STATUS_LABELS[status] ?? status;
}
