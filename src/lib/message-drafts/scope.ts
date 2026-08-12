// Deriva a chave determinística que identifica uma composição de mensagem.
export type DraftScopeInput = {
  channel: "email" | "whatsapp";
  threadId?: string | null;
  conversationId?: string | null;
  leadId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  to?: string | null;
};

export function normalizeRecipient(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

export function draftScopeKey(input: DraftScopeInput): string {
  if (input.channel === "whatsapp") {
    const id = input.conversationId ?? normalizeRecipient(input.to);
    return `whatsapp:${id || "novo"}`;
  }
  if (input.threadId) return `email:reply:${input.threadId}`;
  if (input.dealId) return `email:new:deal:${input.dealId}`;
  if (input.leadId) return `email:new:lead:${input.leadId}`;
  if (input.contactId) return `email:new:contact:${input.contactId}`;
  if (input.companyId) return `email:new:company:${input.companyId}`;
  const to = normalizeRecipient(input.to);
  return `email:new:to:${to || "novo"}`;
}

export function draftContext(input: DraftScopeInput): Record<string, string> {
  const ctx: Record<string, string> = {};
  if (input.threadId) ctx.thread_id = input.threadId;
  if (input.conversationId) ctx.conversation_id = input.conversationId;
  if (input.leadId) ctx.lead_id = input.leadId;
  if (input.dealId) ctx.deal_id = input.dealId;
  if (input.contactId) ctx.contact_id = input.contactId;
  if (input.companyId) ctx.company_id = input.companyId;
  return ctx;
}
