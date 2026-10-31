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
