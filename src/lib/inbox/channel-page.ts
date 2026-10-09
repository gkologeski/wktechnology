// Contrato da RPC `get_inbox_channel_page` (migração 0097): lista de UM canal da Inbox,
// paginada por (coalesce(last_message_at, created_at) desc, id desc), com filtro de
// responsável e busca aplicados no servidor antes da paginação. Busca em campos de resumo
// (assunto/trecho/telefone/prévia/visitante + nome/e-mail de contato e lead visíveis);
// o corpo das mensagens NÃO é pesquisado — igual à Inbox unificada.
export type ChannelKind = "email" | "whatsapp" | "chat";
export type AssigneeFilter = "all" | "mine" | "unassigned";
export type ChannelCursor = { at: string; id: string };
export type ChannelCounts = { all: number; mine: number; unassigned: number };

export type ChannelPage<Row> = {
  items: Row[];
  counts: ChannelCounts;
  total: number;
  hasMore: boolean;
  nextCursor: ChannelCursor | null;
};

export function parseChannelPage<Row extends { id: string }>(raw: unknown): ChannelPage<Row> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(r.items) ? r.items : []).filter(
    (it): it is Row =>
      !!it &&
      typeof (it as { id?: unknown }).id === "string" &&
      typeof (it as { sort_at?: unknown }).sort_at === "string",
  );
  const c = (r.counts ?? {}) as Record<string, unknown>;
  const nc = r.next_cursor as Record<string, unknown> | null | undefined;
  const nextCursor =
    nc && typeof nc.at === "string" && typeof nc.id === "string" ? { at: nc.at, id: nc.id } : null;
  return {
    items,
    counts: {
      all: Number(c.all) || 0,
      mine: Number(c.mine) || 0,
      unassigned: Number(c.unassigned) || 0,
    },
    total: Number(r.total) || 0,
    hasMore: r.has_more === true && nextCursor !== null,
    nextCursor,
  };
}

/** Junta páginas sem duplicar: uma conversa pode subir de posição entre recargas. */
export function mergeChannelPages<Row extends { id: string }>(pages: ChannelPage<Row>[]): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const p of pages)
    for (const it of p.items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
  return out;
}

export function channelPageKey(
  userId: string | null | undefined,
  channel: ChannelKind,
  assignee: AssigneeFilter,
  search: string,
) {
  return ["inbox-channel", channel, userId ?? "anon", assignee, search.trim()] as const;
}

/** Filtro realtime das caixas de e-mail do próprio usuário (null = não assinar). */
export function emailAccountsFilter(accountIds: string[]): string | null {
  const ids = [...new Set(accountIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].sort();
  return ids.length ? `account_id=in.(${ids.join(",")})` : null;
}
