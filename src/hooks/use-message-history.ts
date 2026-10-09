// Histórico de uma conversa: primeira página recente, "carregar anteriores",
// novas mensagens por cursor "after", tempo real filtrado pela conversa e
// reconciliação por intervalos (sem teto que perca itens) ao reconectar/focar ou quando o tempo real falha.
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  cursorOf,
  emptyHistory,
  historyReducer,
  drainNewer,
  pickFields,
  reconcileRange,
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

const SYNC_PAGES_PER_ROUND = 5;
const WINDOW_PAGES_PER_ROUND = 20;
const DEGRADED_RECONCILE_MS = 30_000;

export function useMessageHistory<Row extends HistoryRow>(opts: {
  /** Usuário + workspace + canal + conversa. null = nada selecionado. */
  contextKey: string | null;
  fetchPage: FetchHistoryPage<Row>;
  realtime?: HistoryRealtime | null;
}) {
  const { contextKey, realtime } = opts;
  const [state, dispatch] = useReducer(
    historyReducer as (
      s: HistoryState<Row>,
      a: Parameters<typeof historyReducer<Row>>[1],
    ) => HistoryState<Row>,
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
  const reconciling = useRef<{ running: boolean; again: boolean }>({ running: false, again: false });

  // Troca de contexto: cancela tudo e recomeça.
  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    syncing.current = { running: false, again: false };
    reconciling.current = { running: false, again: false };
    dispatch({ type: "reset", key: contextKey });
    if (!contextKey) return;
    fetchRef
      .current({ signal: ac.signal })
      .then((p) => {
        if (!ac.signal.aborted)
          dispatch({ type: "initialOk", key: contextKey, items: p.items, hasMore: p.hasMore });
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted) dispatch({ type: "initialErr", key: contextKey, error: errMsg(e) });
      });
    return () => ac.abort();
  }, [contextKey]);

  const retryInitial = useCallback(() => {
    const key = stateRef.current.key;
    const ac = abortRef.current;
    if (!key || !ac) return;
    fetchRef
      .current({ signal: ac.signal })
      .then(
        (p) =>
          !ac.signal.aborted &&
          dispatch({ type: "initialOk", key, items: p.items, hasMore: p.hasMore }),
      )
      .catch(
        (e: unknown) =>
          !ac.signal.aborted && dispatch({ type: "initialErr", key, error: errMsg(e) }),
      );
  }, []);

  const loadOlder = useCallback(async () => {
    const s = stateRef.current;
    const ac = abortRef.current;
    if (!s.key || !ac || s.olderLoading || !s.hasOlder || !s.items.length) return;
    const key = s.key;
    dispatch({ type: "olderStart", key });
    try {
      const p = await fetchRef.current({ before: cursorOf(s.items[0]), signal: ac.signal });
      if (!ac.signal.aborted)
        dispatch({ type: "olderOk", key, items: p.items, hasMore: p.hasMore });
    } catch (e) {
      if (!ac.signal.aborted) dispatch({ type: "olderErr", key, error: errMsg(e) });
    }
  }, []);

  /** Busca o que chegou depois da mais nova carregada até esgotar; chamadas concorrentes se juntam. */
  const syncNewer = useCallback(async () => {
    const s0 = stateRef.current;
    const ac = abortRef.current;
    if (!s0.key || !ac || s0.initial !== "ready") return;
    if (syncing.current.running) {
      syncing.current.again = true;
      return;
    }
    const flag = syncing.current; // objeto do contexto atual (troca de contexto cria outro)
    flag.running = true;
    const key = s0.key;
    try {
      do {
        flag.again = false;
        if (!stateRef.current.items.length) {
          const p = await fetchRef.current({ signal: ac.signal });
          if (ac.signal.aborted) return;
          applyUpsert(key, p.items);
          continue;
        }
        await drainNewer<Row>({
          fetch: (a) => fetchRef.current(a),
          getLast: () => stateRef.current.items[stateRef.current.items.length - 1],
          apply: (items) => applyUpsert(key, items),
          signal: ac.signal,
          pagesPerRound: SYNC_PAGES_PER_ROUND,
        });
      } while (flag.again && !ac.signal.aborted);
    } catch (e) {
      if (!ac.signal.aborted) dispatch({ type: "syncErr", key, error: errMsg(e) });
    } finally {
      flag.running = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Revalida a janela já carregada (status, edições, exclusões perdidas), intervalo a intervalo. */
  const reconcile = useCallback(async () => {
    const s = stateRef.current;
    const ac = abortRef.current;
    if (!s.key || !ac || s.initial !== "ready") return;
    if (!s.items.length) return void syncNewer();
    if (reconciling.current.running) {
      reconciling.current.again = true;
      return;
    }
    const rflag = reconciling.current;
    rflag.running = true;
    const key = s.key;
    try {
      do {
        rflag.again = false;
        const oldest = stateRef.current.items[0];
        if (!oldest) break;
        await reconcileRange<Row>({
          oldest,
          fetch: (a) => fetchRef.current(a),
          currentIds: () => new Set(stateRef.current.items.map((r) => r.id)),
          applyRange: (after, until, items, priorIds) => {
            const act = { type: "replaceRange" as const, key, after, until, items, priorIds };
            dispatch(act);
            stateRef.current = historyReducer(stateRef.current, act);
          },
          signal: ac.signal,
          pagesPerRound: WINDOW_PAGES_PER_ROUND,
        });
      } while (rflag.again && !ac.signal.aborted);
      if (!ac.signal.aborted) dispatch({ type: "syncErr", key, error: null });
    } catch (e) {
      if (!ac.signal.aborted) dispatch({ type: "syncErr", key, error: errMsg(e) });
    } finally {
      rflag.running = false;
    }
  }, [syncNewer]);

  function applyUpsert(key: string, items: Row[]) {
    dispatch({ type: "upsert", key, items });
    stateRef.current = historyReducer(stateRef.current, { type: "upsert", key, items });
  }

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
    const fail = () => {
      if (disposed) return;
      setHealth("degraded");
      if (!degradedTimer)
        degradedTimer = setInterval(() => void reconcile(), DEGRADED_RECONCILE_MS);
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      ever = true;
      const wait = Math.min(60_000, 5_000 * 2 ** attempt++);
      if (retry) clearTimeout(retry);
      retry = setTimeout(subscribe, wait);
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
          (payload: {
            eventType?: string;
            new?: Record<string, unknown>;
            old?: Record<string, unknown>;
          }) => {
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
              dispatch({
                type: "patch",
                key,
                id: nid,
                fields: pickFields<Row>(payload.new, patchKeysRef.current),
              });
              return;
            }
            bumpNewer();
          },
        )
        // O SDK responde SUBSCRIBED mesmo com postgres_changes recusado; a recusa vem em "system".
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("system" as any, {}, (p: { status?: string; extension?: string }) => {
          if (p?.status === "error" && p.extension === "postgres_changes") fail();
        })
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
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") fail();
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
