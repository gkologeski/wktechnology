// Cursor da lista de notificações: (created_at, id), mais recentes primeiro.
export const NOTIFICATION_PAGE_SIZE = 30;

export type NotificationCursor = { createdAt: string; id: string };

/** Filtro PostgREST para itens estritamente anteriores ao cursor. */
export function cursorFilter(c: NotificationCursor): string {
  return `created_at.lt.${c.createdAt},and(created_at.eq.${c.createdAt},id.lt.${c.id})`;
}

/** Próximo cursor: só existe quando a página veio cheia. */
export function nextCursorOf(
  rows: { created_at: string; id: string }[],
  pageSize = NOTIFICATION_PAGE_SIZE,
): NotificationCursor | null {
  if (rows.length < pageSize) return null;
  const last = rows[rows.length - 1];
  return { createdAt: last.created_at, id: last.id };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Notificações são pessoais: só a sessão autenticada lê as próprias linhas.
 * Sem sessão válida, nada é consultado. A RLS (user_id = auth.uid()) confirma no banco.
 */
export function scopeNotifications<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  callerId: string | null | undefined,
): T {
  if (!callerId || !UUID.test(callerId)) throw new Error("Sessão inválida.");
  return query.eq("user_id", callerId);
}
