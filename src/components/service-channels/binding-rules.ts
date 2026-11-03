/**
 * Regra de ativação do agente automático numa conta de atendimento.
 * Espelha a validação do banco (`service_channel_save`) para avisar antes de salvar.
 */
export type BindingDraft = {
  accountEnabled: boolean;
  agentId: string | null;
  inbound: boolean;
  campaigns: boolean;
  agentEnabled: boolean;
};

export function bindingIssues(draft: BindingDraft): string[] {
  if (!draft.agentEnabled) return [];
  const issues: string[] = [];
  if (!draft.agentId) issues.push("Escolha o agente responsável.");
  if (!draft.accountEnabled) issues.push("Ative “Permitir automação nesta conta”.");
  if (!draft.inbound && !draft.campaigns)
    issues.push("Ative ao menos um modo: “Receptivo” ou o de campanhas/sequências.");
  return issues;
}

export function campaignsLabel(channel: string): string {
  return channel === "email" ? "Após sequências e campanhas por e-mail" : "Após campanhas WhatsApp";
}
