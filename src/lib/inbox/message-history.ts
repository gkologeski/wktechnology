// Histórico de mensagens paginado por conversa: cursor (created_at, id), junção sem
// duplicar e redutor puro (descarta respostas de outro contexto pela chave).

export type HistoryChannel = "email" | "whatsapp" | "chat";
export type HistoryCursor = { at: string; id: string };
export type HistoryRow = { id: string; created_at: string };
export type HistoryPage<Row> = { items: Row[]; hasMore: boolean };

export const HISTORY_PAGE_SIZE: Record<HistoryChannel, number> = {
  email: 20,
  whatsapp: 50,
  chat: 50,
};

const TS_RE =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/** Aceita o formato do PostgREST e o do tempo real (espaço, "+00"). */
export function isHistoryTimestamp(s: string): boolean {
  return TS_RE.test(s);
}

/** Chave numérica em microssegundos (Date perde os microssegundos do Postgres). */
export function tsKey(s: string): number {
  const m = TS_RE.exec(s);
  if (!m) return Number.NaN;
  let off = m[4] ?? "Z";
  if (off !== "Z") off = off.length === 3 ? `${off}:00` : off.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
  const ms = Date.parse(`${m[1]}T${m[2]}${off}`);
  const frac = (m[3] ?? "").padEnd(6, "0");
  return ms * 1000 + Number(frac);
}

export function compareHistory(a: HistoryRow, b: HistoryRow): number {
  const d = tsKey(a.created_at) - tsKey(b.created_at);
  if (d !== 0) return d;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Une e ordena (antigas → novas); a versão recebida substitui a existente. */
export function mergeHistory<Row extends HistoryRow>(current: Row[], incoming: Row[]): Row[] {
  if (!incoming.length) return current;
  const byId = new Map(current.map((r) => [r.id, r]));
  for (const r of incoming) byId.set(r.id, { ...byId.get(r.id), ...r });
  return [...byId.values()].sort(compareHistory);
}

export const cursorOf = (r: HistoryRow): HistoryCursor => ({ at: r.created_at, id: r.id });
const ZERO_ID = "00000000-0000-0000-0000-000000000000";
/** Cursor estritamente anterior à mais antiga carregada (usado na reconciliação da janela). */
export const windowStartCursor = (oldest: HistoryRow): HistoryCursor => ({
  at: oldest.created_at,
  id: ZERO_ID,
});

export type HistoryState<Row> = {
  key: string | null;
  items: Row[];
  hasOlder: boolean;
  initial: "idle" | "loading" | "ready" | "error";
  initialError: string | null;
  olderLoading: boolean;
  olderError: string | null;
  syncError: string | null;
};

export const emptyHistory = <Row>(key: string | null = null): HistoryState<Row> => ({
  key,
  items: [],
  hasOlder: false,
  initial: key ? "loading" : "idle",
  initialError: null,
  olderLoading: false,
  olderError: null,
  syncError: null,
});

export type HistoryAction<Row> =
  | { type: "reset"; key: string | null }
  | { type: "initialOk"; key: string; items: Row[]; hasMore: boolean }
  | { type: "initialErr"; key: string; error: string }
  | { type: "olderStart"; key: string }
  | { type: "olderOk"; key: string; items: Row[]; hasMore: boolean }
  | { type: "olderErr"; key: string; error: string }
  | { type: "upsert"; key: string; items: Row[] }
  | { type: "patch"; key: string; id: string; fields: Partial<Row> }
  | { type: "remove"; key: string; id: string }
  | { type: "replaceWindow"; key: string; items: Row[] }
  | { type: "syncErr"; key: string; error: string | null };

export function historyReducer<Row extends HistoryRow>(
  s: HistoryState<Row>,
  a: HistoryAction<Row>,
): HistoryState<Row> {
  if (a.type === "reset") return emptyHistory<Row>(a.key);
  if (a.key !== s.key) return s; // resposta de outra conversa/usuário: descarta
  switch (a.type) {
    case "initialOk":
      return {
        ...s,
        items: mergeHistory(s.items, a.items),
        hasOlder: a.hasMore,
        initial: "ready",
        initialError: null,
      };
    case "initialErr":
      return { ...s, initial: s.items.length ? "ready" : "error", initialError: a.error };
    case "olderStart":
      return { ...s, olderLoading: true, olderError: null };
    case "olderOk":
      return { ...s, items: mergeHistory(s.items, a.items), hasOlder: a.hasMore, olderLoading: false };
    case "olderErr":
      return { ...s, olderLoading: false, olderError: a.error };
    case "upsert":
      return { ...s, items: mergeHistory(s.items, a.items), syncError: null };
    case "patch": {
      if (!s.items.some((r) => r.id === a.id)) return s;
      const { created_at: _ignored, id: _id, ...rest } = a.fields as Partial<Row> & HistoryRow;
      return {
        ...s,
        items: s.items.map((r) => (r.id === a.id ? { ...r, ...(rest as Partial<Row>) } : r)),
      };
    }
    case "remove":
      return { ...s, items: s.items.filter((r) => r.id !== a.id) };
    case "replaceWindow": {
      // Itens anteriores à janela (se houver) são mantidos; a janela é a resposta do servidor.
      const start = a.items[0] ?? null;
      const keep = start ? s.items.filter((r) => compareHistory(r, start) < 0) : [];
      return { ...s, items: mergeHistory(keep, a.items), syncError: null };
    }
    case "syncErr":
      return { ...s, syncError: a.error };
  }
  return s;
}

/** Campos do payload do tempo real que podem atualizar um item já carregado. */
export function pickFields<Row>(payload: Record<string, unknown> | undefined, keys: readonly string[]) {
  const out: Record<string, unknown> = {};
  if (!payload) return out as Partial<Row>;
  for (const k of keys) if (k in payload && k !== "created_at" && k !== "id") out[k] = payload[k];
  return out as Partial<Row>;
}

export function isNearBottom(
  m: { scrollHeight: number; scrollTop: number; clientHeight: number },
  px = 120,
) {
  return m.scrollHeight - m.scrollTop - m.clientHeight <= px;
}

/** Nova posição para manter o conteúdo visível no lugar após inserir itens acima. */
export function anchoredScrollTop(prev: { scrollHeight: number; scrollTop: number }, nextHeight: number) {
  return prev.scrollTop + (nextHeight - prev.scrollHeight);
}
