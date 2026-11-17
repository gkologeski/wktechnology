/**
 * AGENTE-DO-NUMERO: o agente SDR de uma campanha WhatsApp é definido pelo canal
 * de atendimento do número remetente (mesma regra do disparo em channel-runtime).
 */
export type ChannelAccountLike = {
  id: string;
  enabled: boolean;
  routing_configured: boolean;
  archived_at: string | null;
};
export type ChannelBindingLike = {
  agent_id: string;
  enabled: boolean;
  campaigns: boolean;
};
export type CampaignChannelAgent =
  | { kind: "free" }
  | { kind: "none" }
  | { kind: "locked"; agentId: string };

export function resolveCampaignChannelAgent(
  account: ChannelAccountLike | null,
  binding: ChannelBindingLike | null,
): CampaignChannelAgent {
  if (!account || !account.routing_configured) return { kind: "free" };
  if (!account.enabled || account.archived_at) return { kind: "none" };
  if (!binding || !binding.enabled || !binding.campaigns) return { kind: "none" };
  return { kind: "locked", agentId: binding.agent_id };
}

/** Mensagem de erro quando o agente pedido difere do canal; null se está conforme. */
export function campaignAgentMismatch(
  rule: CampaignChannelAgent,
  playbookId: string | null,
): string | null {
  if (rule.kind === "free") return null;
  if (rule.kind === "none")
    return playbookId
      ? "Este número não tem agente para campanhas; deixe o agente SDR desligado."
      : null;
  return playbookId === rule.agentId
    ? null
    : "O agente desta campanha precisa ser o do número escolhido.";
}
