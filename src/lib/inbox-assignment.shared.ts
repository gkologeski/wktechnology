export type InboxAssignChannel = "whatsapp" | "email" | "chat";

export const INBOX_ASSIGN_DENIED =
  "Você não tem permissão para alterar o responsável desta conversa.";

/** Converte o retorno do RPC de atribuição em erro amigável quando nada foi alterado. */
export function assertInboxAssigned(ok: unknown): void {
  if (ok !== true) throw new Error(INBOX_ASSIGN_DENIED);
}
