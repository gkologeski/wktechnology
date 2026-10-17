// Destino do clique em uma notificação. Notificações de conversa do WhatsApp
// (inclusive antigas, gravadas só com "/inbox/whatsapp") abrem a conversa exata.
export type NotificationTarget = { to: string; search?: Record<string, string> };

export function notificationHref(n: {
  link: string | null;
  entity?: string | null;
  entity_id?: string | null;
}): NotificationTarget | null {
  if (!n.link) return null;
  const [path, query] = n.link.split("?");
  if (path === "/inbox/whatsapp" && n.entity === "inbox_conversation" && n.entity_id) {
    return { to: path, search: { conversation: n.entity_id } };
  }
  if (query) {
    return { to: path, search: Object.fromEntries(new URLSearchParams(query)) };
  }
  return { to: path };
}
