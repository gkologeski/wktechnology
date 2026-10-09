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
  if (off !== "Z")
    off = off.length === 3 ? `${off}:00` : off.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
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
  | {
      type: "replaceRange";
      key: string;
      after: HistoryCursor;
      until: HistoryCursor | null;
      items: Row[];
      /** Com `until` null (fim do servidor): só estes ids, já presentes antes da busca, podem sair. */
      priorIds?: ReadonlySet<string>;
    }
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
      return {
        ...s,
        items: mergeHistory(s.items, a.items),
        hasOlder: a.hasMore,
        olderLoading: false,
      };
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
    case "replaceRange": {
      // Só o intervalo (after, until] coberto pela página do servidor é autoritativo:
      // ausente ali = excluído; fora dele nada é apagado (incompleto ≠ excluído).
      const lo = { id: a.after.id, created_at: a.after.at };
      const hi = a.until ? { id: a.until.id, created_at: a.until.at } : null;
      const got = new Set(a.items.map((r) => r.id));
      const kept = s.items.filter(
        (r) =>
          got.has(r.id) ||
          compareHistory(r, lo) <= 0 ||
          (hi ? compareHistory(r, hi) > 0 : !a.priorIds?.has(r.id)),
      );
      return { ...s, items: mergeHistory(kept, a.items) };
    }
    case "syncErr":
      return { ...s, syncError: a.error };
  }
  return s;
}

type LoopFetch<Row> = (args: {
  after: HistoryCursor;
  limit: number;
  signal: AbortSignal;
}) => Promise<HistoryPage<Row>>;

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Busca tudo que chegou depois de `last` até esgotar. Cada rodada tem no máximo
 * `pagesPerRound` páginas (sequenciais) e cede a vez à interface entre rodadas;
 * para quando o servidor diz que acabou, o cursor não avança ou o sinal é abortado.
 */
export async function drainNewer<Row extends HistoryRow>(o: {
  fetch: LoopFetch<Row>;
  getLast: () => Row | undefined;
  apply: (items: Row[]) => void;
  signal: AbortSignal;
  pageSize?: number;
  pagesPerRound?: number;
}): Promise<{ pages: number; complete: boolean }> {
  const limit = o.pageSize ?? 100;
  const per = o.pagesPerRound ?? 5;
  let pages = 0;
  for (;;) {
    for (let i = 0; i < per; i++) {
      const last = o.getLast();
      if (!last) return { pages, complete: true };
      const p = await o.fetch({ after: cursorOf(last), limit, signal: o.signal });
      if (o.signal.aborted) return { pages, complete: false };
      pages++;
      o.apply(p.items);
      if (!p.hasMore) return { pages, complete: true };
      const nl = o.getLast();
      if (!nl || nl.id === last.id) return { pages, complete: false }; // sem progresso
    }
    await yieldToUi();
    if (o.signal.aborted) return { pages, complete: false };
  }
}

/**
 * Revalida a janela carregada a partir da mais antiga, página a página, aplicando
 * cada página como intervalo autoritativo (`replaceRange`). Sem teto que interrompa:
 * cede a vez a cada `pagesPerRound` e termina ao esgotar o servidor.
 */
export async function reconcileRange<Row extends HistoryRow>(o: {
  oldest: Row;
  fetch: LoopFetch<Row>;
  applyRange: (
    after: HistoryCursor,
    until: HistoryCursor | null,
    items: Row[],
    priorIds?: ReadonlySet<string>,
  ) => void;
  /** Ids carregados agora (lidos antes de cada busca). */
  currentIds: () => ReadonlySet<string>;
  signal: AbortSignal;
  pageSize?: number;
  pagesPerRound?: number;
}): Promise<{ pages: number; complete: boolean }> {
  const limit = o.pageSize ?? 100;
  const per = o.pagesPerRound ?? 20;
  let cursor = windowStartCursor(o.oldest);
  let pages = 0;
  for (;;) {
    for (let i = 0; i < per; i++) {
      const prior = o.currentIds();
      const p = await o.fetch({ after: cursor, limit, signal: o.signal });
      if (o.signal.aborted) return { pages, complete: false };
      pages++;
      const lastItem = p.items[p.items.length - 1];
      if (!p.hasMore) {
        // Fim do servidor: some o que já estava aqui antes da busca e não veio;
        // o que chegou durante a busca (fora de `prior`) é mantido.
        o.applyRange(cursor, null, p.items, prior);
        return { pages, complete: true };
      }
      if (!lastItem) return { pages, complete: false }; // resposta incoerente: não apaga nada
      o.applyRange(cursor, cursorOf(lastItem), p.items);
      cursor = cursorOf(lastItem);
    }
    await yieldToUi();
    if (o.signal.aborted) return { pages, complete: false };
  }
}

/** Campos do payload do tempo real que podem atualizar um item já carregado. */
export function pickFields<Row>(
  payload: Record<string, unknown> | undefined,
  keys: readonly string[],
) {
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
export function anchoredScrollTop(
  prev: { scrollHeight: number; scrollTop: number },
  nextHeight: number,
) {
  return prev.scrollTop + (nextHeight - prev.scrollHeight);
}
