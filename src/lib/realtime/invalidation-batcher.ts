// Lógica pura (sem React/Supabase) usada por useRealtimeInvalidate.
// Mantida separada para ser testada em ambiente node.
import type { QueryKey } from "@tanstack/react-query";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export type ChannelSubIdentity = {
  table: string;
  event?: RealtimeEvent;
  /** Filtro Postgres Changes, ex.: `id=eq.<uuid>` ou `deal_id=eq.<uuid>`. */
  filter?: string;
};

/**
 * Nome do canal = identidade completa (escopo + tabela + evento + filtro).
 * Dois componentes com filtros diferentes nunca compartilham o mesmo canal.
 */
export function buildChannelName(subs: ChannelSubIdentity[], scope?: string | null): string {
  const parts = subs.map((s) => `${s.table}:${s.event ?? "*"}:${s.filter ?? ""}`).join("|");
  return `rt:${scope ?? "-"}:${parts}`;
}

type ParsedFilter = { column: string; values: string[] } | null;

export function parseFilter(filter: string | undefined): ParsedFilter {
  if (!filter) return null;
  const m = /^([a-zA-Z0-9_]+)=(eq|in)\.(.+)$/.exec(filter);
  if (!m) return null;
  const [, column, op, raw] = m;
  if (op === "eq") return { column, values: [raw] };
  const inner = raw.replace(/^\(/, "").replace(/\)$/, "");
  return { column, values: inner.split(",").map((v) => v.trim().replace(/^"|"$/g, "")) };
}

type ChangePayload = {
  eventType?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

/**
 * Confere se o evento pertence ao registro filtrado.
 * O Postgres Changes NÃO aplica filtro a DELETE e, com REPLICA IDENTITY
 * default, `old` só traz a chave primária. Quando a coluna do filtro não vem no
 * payload, a resposta é conservadora (true) para não perder atualização.
 * Isto é só otimização de recarga: quem decide o que o usuário vê é a RLS.
 */
export function payloadMatchesFilter(filter: string | undefined, payload: ChangePayload): boolean {
  const parsed = parseFilter(filter);
  if (!parsed) return true;
  const record =
    payload.eventType === "DELETE" ? (payload.old ?? null) : (payload.new ?? payload.old ?? null);
  if (!record || !(parsed.column in record)) return true;
  const value = record[parsed.column];
  if (value === null || value === undefined) {
    // Em UPDATE o vínculo pode ter sido removido: confere o valor anterior.
    const prev = payload.old?.[parsed.column];
    if (prev !== undefined && prev !== null) return parsed.values.includes(String(prev));
    return false;
  }
  if (parsed.values.includes(String(value))) return true;
  // UPDATE que tirou o registro do filtro também precisa recarregar.
  const prev = payload.old?.[parsed.column];
  return prev !== undefined && prev !== null && parsed.values.includes(String(prev));
}

export type Batcher = {
  push: (keys: QueryKey[], callbacks?: Array<() => void>) => void;
  flushNow: () => void;
  cancel: () => void;
  pendingCount: () => number;
};

/**
 * Agrupa invalidações: espera `delayMs` de silêncio, mas nunca mais que
 * `maxWaitMs` desde o primeiro evento pendente (evita fome em rajadas longas).
 * Chaves repetidas são deduplicadas por JSON.
 */
export function createInvalidationBatcher(
  flush: (keys: QueryKey[], callbacks: Array<() => void>) => void,
  opts: {
    delayMs?: number;
    maxWaitMs?: number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (h: unknown) => void;
    now?: () => number;
  } = {},
): Batcher {
  const delay = opts.delayMs ?? 250;
  const maxWait = opts.maxWaitMs ?? 1000;
  const setT = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const now = opts.now ?? (() => Date.now());
  const keys = new Map<string, QueryKey>();
  const cbs = new Set<() => void>();
  let timer: unknown = null;
  let firstAt: number | null = null;

  const run = () => {
    if (timer !== null) clearT(timer);
    timer = null;
    firstAt = null;
    const k = [...keys.values()];
    const c = [...cbs];
    keys.clear();
    cbs.clear();
    if (k.length || c.length) flush(k, c);
  };

  return {
    push(newKeys, callbacks = []) {
      for (const key of newKeys) keys.set(JSON.stringify(key), key);
      for (const cb of callbacks) cbs.add(cb);
      const t = now();
      if (firstAt === null) firstAt = t;
      if (timer !== null) clearT(timer);
      const wait = Math.max(0, Math.min(delay, firstAt + maxWait - t));
      timer = setT(run, wait);
    },
    flushNow: run,
    cancel() {
      if (timer !== null) clearT(timer);
      timer = null;
      firstAt = null;
      keys.clear();
      cbs.clear();
    },
    pendingCount: () => keys.size + cbs.size,
  };
}
