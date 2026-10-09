// Histórico de uma conversa: primeira página recente, "carregar anteriores",
// novas mensagens por cursor "after", tempo real filtrado pela conversa e
// reconciliação limitada ao reconectar/focar ou quando o tempo real falha.
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  cursorOf,
  emptyHistory,
  historyReducer,
  pickFields,
  windowStartCursor,
  type HistoryCursor,
  type HistoryPage,
  type HistoryRow,
  type HistoryState,
} from "@/lib/inbox/message-history";

export type FetchHistoryPage<Row> = (args: {
  before?: HistoryCursor;
  after?: HistoryCursor;
  limit?: number;
  signal: AbortSignal;
}) => Promise<HistoryPage<Row>>;

export type HistoryRealtime = {
  table: string;
  /** Sempre restrito à conversa (ex.: `conversation_id=eq.<uuid>`). */
  filter: string;
  /** "rows": eventos são das próprias mensagens; "parent": da conversa (só sinaliza novidade). */
  kind: "rows" | "parent";
  patchKeys?: readonly string[];
};

export type RealtimeHealth = "off" | "connecting" | "live" | "degraded";

const MAX_SYNC_PAGES = 5;
const MAX_WINDOW_PAGES = 20;
const DEGRADED_RECONCILE_MS = 30_000;

export function useMessageHistory<Row extends HistoryRow>(opts: {
  /** Usuário + workspace + canal + conversa. null = nada selecionado. */
  contextKey: string | null;
  fetchPage: FetchHistoryPage<Row>;
  realtime?: HistoryRealtime | null;
}) {
  const { contextKey, realtime } = opts;
  const [state, dispatch] = useReducer(
    historyReducer as (s: HistoryState<Row>, a: Parameters<typeof historyReducer<Row>>[1]) => HistoryState<Row>,
    contextKey,
    (k) => emptyHistory<Row>(k),
  );
  const [health, setHealth] = useState<RealtimeHealth>("off");
  const fetchRef = useRef(opts.fetchPage);
  fetchRef.current = opts.fetchPage;
  const stateRef = useRef(state);
  stateRef.current = state;
  const abortRef = useRef<AbortController | null>(null);
  const syncing = useRef<{ running: boolean; again: boolean }>({ running: false, again: false });

  // Troca de contexto: cancela tudo e recomeça.
  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    syncing.current = { running: false, again: false };
    dispatch({ type: "reset", key: contextKey });
    if (!contextKey) return;
    fetchRef
      .current({ signal: ac.signal })
      .then((p) => {
        if (!ac.signal.aborted) dispatch({ type: "initialOk", key: contextKey, items: p.items, hasMore: p.hasMore });
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted)
          dispatch({ type: "initialErr", key: contextKey, error: errMsg(e) });
      });
    return () => ac.abort();
  }, [contextKey]);

  const retryInitial = useCallback(() => {
    const key = stateRef.current.key;
    const ac = abortRef.current;
    if (!key || !ac) return;
    fetchRef
      .current({ signal: ac.signal })
      .then((p) => !ac.signal.aborted && dispatch({ type: "initialOk", key, items: p.items, hasMore: p.hasMore }))
      .catch((e: unknown) => !ac.signal.aborted && dispatch({ type: "initialErr", key, error: errMsg(e) }));
  }, []);

  const loadOlder = useCallback(async () => {
    const s = stateRef.current;
    const ac = abortRef.current;
    if (!s.key || !ac || s.olderLoading || !s.hasOlder || !s.items.length) return;
    const key = s.key;
    dispatch({ type: "olderStart", key });
    try {
      const p = await fetchRef.current({ before: cursorOf(s.items[0]), signal: ac.signal });
      if (!ac.signal.aborted) dispatch({ type: "olderOk", key, items: p.items, hasMore: p.hasMore });
    } catch (e) {
      if (!ac.signal.aborted) dispatch({ type: "olderErr", key, error: errMsg(e) });
    }
  }, []);

  /** Busca o que chegou depois da mais nova carregada; chamadas concorrentes se juntam. */
  const syncNewer = useCallback(async () => {
    const s0 = stateRef.current;
    const ac = abortRef.current;
    if (!s0.key || !ac || s0.initial !== "ready") return;
    if (syncing.current.running) {
      syncing.current.again = true;
      return;
    }
    syncing.current.running = true;
    const key = s0.key;
    try {
      do {
        syncing.current.again = false;
        for (let i = 0; i < MAX_SYNC_PAGES; i++) {
          const items = stateRef.current.items;
          const last = items[items.length - 1];
          const p = last
            ? await fetchRef.current({ after: cursorOf(last), limit: 100, signal: ac.signal })
            : await fetchRef.current({ signal: ac.signal });
          if (ac.signal.aborted) return;
          dispatch({ type: "upsert", key, items: p.items });
          stateRef.current = historyReducer(stateRef.current, { type: "upsert", key, items: p.items });
          if (!last || !p.hasMore) break;
        }
      } while (syncing.current.again && !ac.signal.aborted);
    } catch (e) {
      if (!ac.signal.aborted) dispatch({ type: "syncErr", key, error: errMsg(e) });
    } finally {
      syncing.current.running = false;
    }
  }, []);

  /** Recarrega a janela já carregada (status, edições, exclusões perdidas). */
  const reconcile = useCallback(async () => {
    const s = stateRef.current;
    const ac = abortRef.current;
    if (!s.key || !ac || s.initial !== "ready") return;
    if (!s.items.length) return void syncNewer();
    const key = s.key;
    try {
      let cursor = windowStartCursor(s.items[0]);
      const all: Row[] = [];
      for (let i = 0; i < MAX_WINDOW_PAGES; i++) {
        const p = await fetchRef.current({ after: cursor, limit: 100, signal: ac.signal });
        if (ac.signal.aborted) return;
        all.push(...p.items);
        if (!p.hasMore || !p.items.length) {
          dispatch({ type: "replaceWindow", key, items: all });
          return;
        }
        cursor = cursorOf(p.items[p.items.length - 1]);
      }
      dispatch({ type: "upsert", key, items: all }); // janela grande demais: só une
    } catch (e) {
      if (!ac.signal.aborted) dispatch({ type: "syncErr", key, error: errMsg(e) });
    }
  }, [syncNewer]);

  // Tempo real filtrado pela conversa + saúde da assinatura.
  const rtTable = realtime?.table;
  const rtFilter = realtime?.filter;
  const rtKind = realtime?.kind;
  const patchKeysRef = useRef(realtime?.patchKeys ?? []);
  patchKeysRef.current = realtime?.patchKeys ?? [];
  useEffect(() => {
    if (!contextKey || !rtTable || !rtFilter || typeof window === "undefined") {
      setHealth("off");
      return;
    }
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let ever = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let degradedTimer: ReturnType<typeof setInterval> | null = null;
    let attempt = 0;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const key = contextKey;
    const bumpNewer = () => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = null;
        void syncNewer();
      }, 250);
    };
    const clearDegraded = () => {
      if (degradedTimer) clearInterval(degradedTimer);
      degradedTimer = null;
    };
    const subscribe = () => {
      if (disposed || channel) return;
      setHealth("connecting");
      channel = supabase
        .channel(`history:${key}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "*", schema: "public", table: rtTable, filter: rtFilter },
          (payload: { eventType?: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
            if (rtKind === "parent") return bumpNewer();
            const ev = payload.eventType;
            const nid = typeof payload.new?.id === "string" ? payload.new.id : null;
            const oid = typeof payload.old?.id === "string" ? payload.old.id : null;
            if (ev === "DELETE") {
              if (oid) dispatch({ type: "remove", key, id: oid });
              else void reconcile();
              return;
            }
            if (ev === "UPDATE" && nid && stateRef.current.items.some((r) => r.id === nid)) {
              dispatch({ type: "patch", key, id: nid, fields: pickFields<Row>(payload.new, patchKeysRef.current) });
              return;
            }
            bumpNewer();
          },
        )
        .subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            attempt = 0;
            clearDegraded();
            setHealth("live");
            if (ever) void reconcile();
            ever = true;
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setHealth("degraded");
            if (!degradedTimer) degradedTimer = setInterval(() => void reconcile(), DEGRADED_RECONCILE_MS);
            if (channel) void supabase.removeChannel(channel);
            channel = null;
            const wait = Math.min(60_000, 5_000 * 2 ** attempt++);
            if (retry) clearTimeout(retry);
            retry = setTimeout(subscribe, wait);
          }
        });
    };
    const unsubscribe = () => {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    };
    const onVis = () => {
      if (document.hidden) unsubscribe();
      else {
        subscribe();
        void reconcile();
      }
    };
    if (!document.hidden) subscribe();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVis);
      if (retry) clearTimeout(retry);
      if (debounce) clearTimeout(debounce);
      clearDegraded();
      unsubscribe();
      setHealth("off");
    };
  }, [contextKey, rtTable, rtFilter, rtKind, syncNewer, reconcile]);

  return { ...state, health, loadOlder, syncNewer, reconcile, retryInitial };
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Falha ao carregar mensagens.";
}
