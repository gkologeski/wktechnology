// Contrato da RPC `get_inbox_unified_page` (migrações 0095/0096): paginação global
// por (sort_at, origem, id), busca/filtros e contagens exatas no servidor, sob RLS.
export type InboxChannel = "email" | "whatsapp" | "chat";
export type InboxChannelFilter = "all" | InboxChannel;

export type InboxCursor = { at: string; src: number; id: string };

export type InboxPageRow = {
  channel: InboxChannel;
  id: string;
  sort_at: string;
  last_message_at: string | null;
  title: string | null;
  snippet: string | null;
  phone: string | null;
  visitor_email: string | null;
  status: string | null;
  contact_id: string | null;
  lead_id: string | null;
  contact_name: string | null;
  lead_name: string | null;
  last_inbound_from: string | null;
};

export type InboxPage = {
  items: InboxPageRow[];
  counts: Record<InboxChannel, number>;
  total: number;
  hasMore: boolean;
  nextCursor: InboxCursor | null;
};

const CHANNELS: InboxChannel[] = ["email", "whatsapp", "chat"];

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function parseInboxPage(raw: unknown): InboxPage {
  const r = (raw ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(r.items) ? r.items : []).flatMap((it): InboxPageRow[] => {
    const o = (it ?? {}) as Record<string, unknown>;
    const channel = o.channel as InboxChannel;
    if (!CHANNELS.includes(channel) || typeof o.id !== "string" || typeof o.sort_at !== "string")
      return [];
    return [
      {
        channel,
        id: o.id,
        sort_at: o.sort_at,
        last_message_at: str(o.last_message_at),
        title: str(o.title),
        snippet: str(o.snippet),
        phone: str(o.phone),
        visitor_email: str(o.visitor_email),
        status: str(o.status),
        contact_id: str(o.contact_id),
        lead_id: str(o.lead_id),
        contact_name: str(o.contact_name),
        lead_name: str(o.lead_name),
        last_inbound_from: str(o.last_inbound_from),
      },
    ];
  });
  const c = (r.counts ?? {}) as Record<string, unknown>;
  const counts = {
    email: Number(c.email) || 0,
    whatsapp: Number(c.whatsapp) || 0,
    chat: Number(c.chat) || 0,
  };
  const nc = r.next_cursor as Record<string, unknown> | null | undefined;
  const nextCursor =
    nc && typeof nc.at === "string" && typeof nc.id === "string" && nc.src != null
      ? { at: nc.at, src: Number(nc.src), id: nc.id }
      : null;
  return {
    items,
    counts,
    total: Number(r.total) || 0,
    hasMore: r.has_more === true && nextCursor !== null,
    nextCursor,
  };
}

/** Junta páginas sem duplicar (um item pode reaparecer se mudou de posição entre recargas). */
export function mergeInboxPages(pages: InboxPage[]): InboxPageRow[] {
  const seen = new Set<string>();
  const out: InboxPageRow[] = [];
  for (const p of pages)
    for (const it of p.items) {
      const k = `${it.channel}:${it.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
  return out;
}

export function inboxPageKey(
  userId: string | null | undefined,
  channel: InboxChannelFilter,
  search: string,
) {
  return ["inbox-unified", "page", userId ?? "anon", channel, search.trim()] as const;
}
