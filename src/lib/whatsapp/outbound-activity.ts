// Registro na linha do tempo de uma mensagem de WhatsApp enviada por uma pessoa.
// Autor e responsável são sempre quem enviou: o banco exige que o autor seja o
// usuário autenticado e que o responsável seja membro ativo — o id do workspace
// não é uma pessoa e fazia a gravação falhar depois do envio já realizado.

export type OutboundWhatsAppActivityInput = {
  workspaceId: string;
  userId: string;
  contactId: string;
  conversationId: string;
  wamid: string | null;
  body: string;
  preview: string;
  templateName?: string | null;
  now?: Date;
};

export function buildOutboundWhatsAppActivity(input: OutboundWhatsAppActivityInput) {
  return {
    workspace_id: input.workspaceId,
    owner_id: input.userId,
    assigned_to: input.userId,
    created_by: input.userId,
    type: "whatsapp" as const,
    related_contact_id: input.contactId,
    subject: input.templateName ? `WhatsApp · ${input.templateName}` : "WhatsApp enviado",
    body: input.body || input.preview,
    email_direction: "outbound",
    completed: true,
    outcome: "sent",
    outcome_set_at: (input.now ?? new Date()).toISOString(),
    external_ids: { wa_message_id: input.wamid, conversation_id: input.conversationId },
  };
}
