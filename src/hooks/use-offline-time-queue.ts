// Fila offline de apontamentos no aparelho (opt-in por usuário + workspace).
// Envia sozinha quando a conexão volta, ao abrir a tela e a cada minuto enquanto houver pendência.
// Uma aba por vez envia (Web Locks quando disponível); o servidor deduplica pelo id do pedido.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOfflineContext, syncOfflineTimeEntry } from "@/lib/projects/time-offline.functions";
import {
  enqueue,
  indexedDbStore,
  offlinePrefKey,
  purgeExpired,
  scoped,
  syncQueue,
  type OfflineItem,
  type OfflinePayload,
  type SendResult,
  classifyError,
} from "@/lib/projects/offline-queue";

const CHANNEL = "techerp-offline-time";
const SYNC_LOCK = "techerp-offline-time-sync";

function announce() {
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage("changed");
    bc.close();
  } catch {
    /* sem BroadcastChannel */
  }
  window.dispatchEvent(new Event(CHANNEL));
}

export function useOfflineTimeQueue() {
  const qc = useQueryClient();
  const ctxFn = useServerFn(getOfflineContext);
  const syncFn = useServerFn(syncOfflineTimeEntry);
  const ctxQ = useQuery({ queryKey: ["offline-time-context"], queryFn: () => ctxFn(), staleTime: Infinity });
  const ctx = ctxQ.data ?? null;
  const supported = typeof window !== "undefined" && typeof indexedDB !== "undefined";
  const store = useMemo(() => (supported ? indexedDbStore() : null), [supported]);
  const [items, setItems] = useState<OfflineItem[]>([]);
  const [online, setOnline] = useState(true);
  const [optIn, setOptInState] = useState(false);
  const [lostUnsent, setLostUnsent] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!store || !ctx) return;
    setItems(scoped(await store.all(), ctx.userId, ctx.workspaceId).sort((a, b) => b.createdAt - a.createdAt));
  }, [store, ctx]);

  useEffect(() => {
    if (!ctx || typeof window === "undefined") return;
    setOptInState(window.localStorage.getItem(offlinePrefKey(ctx.userId, ctx.workspaceId)) === "on");
  }, [ctx]);

  const setOptIn = useCallback(
    (v: boolean) => {
      if (!ctx) return;
      window.localStorage.setItem(offlinePrefKey(ctx.userId, ctx.workspaceId), v ? "on" : "off");
      setOptInState(v);
      announce();
    },
    [ctx],
  );

  const send = useCallback(
    async (item: OfflineItem): Promise<SendResult> => {
      try {
        const r = await syncFn({
          data: {
            workspaceId: item.workspaceId,
            userId: item.userId,
            clientRequestId: item.id,
            requestHash: item.requestHash,
            deviceRecordedAt: item.deviceRecordedAt,
            payload: item.payload,
          },
        });
        return { kind: "ok", replay: r.replay, entryId: r.entryId };
      } catch (e) {
        return classifyError(e);
      }
    },
    [syncFn],
  );

  const syncNow = useCallback(async () => {
    if (!store || !ctx || busy.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    busy.current = true;
    setSyncing(true);
    const run = async () => {
      const r = await syncQueue(store, ctx, send);
      if (r.sent > 0) {
        for (const k of ["time-entries", "my-time-summary", "my-month-calendar", "timesheet"])
          void qc.invalidateQueries({ queryKey: [k] });
      }
    };
    try {
      const locks = (navigator as Navigator & { locks?: LockManager }).locks;
      if (locks) await locks.request(SYNC_LOCK, { ifAvailable: true }, async (lock) => (lock ? run() : undefined));
      else await run();
    } finally {
      busy.current = false;
      setSyncing(false);
      await refresh();
      announce();
    }
  }, [store, ctx, send, qc, refresh]);

  useEffect(() => {
    if (!store || !ctx) return;
    let alive = true;
    void purgeExpired(store).then((r) => {
      if (alive) setLostUnsent(r.lostUnsent);
      void refresh().then(() => void syncNow());
    });
    const onChange = () => {
      setOptInState(window.localStorage.getItem(offlinePrefKey(ctx.userId, ctx.workspaceId)) === "on");
      void refresh();
    };
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANNEL, onChange);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = onChange;
    } catch {
      bc = null;
    }
    const up = () => {
      setOnline(true);
      void syncNow();
    };
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      alive = false;
      window.removeEventListener(CHANNEL, onChange);
      window.removeEventListener("storage", onChange);
      bc?.close();
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [store, ctx, refresh, syncNow]);

  const hasPending = items.some((i) => i.state === "pending" || i.state === "error");
  useEffect(() => {
    if (!hasPending) return;
    const t = window.setInterval(() => void syncNow(), 60_000);
    return () => window.clearInterval(t);
  }, [hasPending, syncNow]);

  const enqueueEntry = useCallback(
    async (payload: OfflinePayload, label: string) => {
      if (!store || !ctx) throw new Error("Este aparelho não consegue guardar apontamentos (sem contexto da conta).");
      const item = await enqueue(store, { userId: ctx.userId, workspaceId: ctx.workspaceId, payload, label });
      await refresh();
      announce();
      return item;
    },
    [store, ctx, refresh],
  );

  const discard = useCallback(
    async (id: string) => {
      if (!store) return;
      await store.remove(id);
      await refresh();
      announce();
    },
    [store, refresh],
  );

  const retry = useCallback(
    async (id: string) => {
      if (!store) return;
      const it = items.find((i) => i.id === id);
      if (!it) return;
      // Conflito só volta para a fila por decisão explícita do usuário.
      await store.put({ ...it, state: "pending", nextAttemptAt: Date.now(), lastError: null });
      await syncNow();
    },
    [store, items, syncNow],
  );

  return {
    supported,
    ready: !!ctx,
    items,
    online,
    optIn,
    setOptIn,
    syncing,
    lostUnsent,
    enqueueEntry,
    discard,
    retry,
    syncNow,
  };
}
