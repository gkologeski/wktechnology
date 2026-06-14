// Fila offline (IndexedDB) para criação de notas e tarefas quando sem rede.
import { openDB, type IDBPDatabase } from "idb";
import { useEffect, useState, useCallback } from "react";

type QueueItem = {
  id?: number;
  kind: "note" | "task";
  payload: Record<string, unknown>;
  created_at: number;
  attempts: number;
};

const DB_NAME = "crm-offline";
const STORE = "queue";

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    },
  });
}

export async function enqueue(item: Omit<QueueItem, "id" | "created_at" | "attempts">) {
  const d = await db();
  await d.add(STORE, { ...item, created_at: Date.now(), attempts: 0 });
}

export async function listQueue(): Promise<QueueItem[]> {
  const d = await db();
  return d.getAll(STORE);
}

export async function removeFromQueue(id: number) {
  const d = await db();
  await d.delete(STORE, id);
}

export async function clearQueue() {
  const d = await db();
  await d.clear(STORE);
}

/**
 * Hook para sincronizar a fila quando o app volta a ficar online.
 * `flusher(item)` deve persistir o item e lançar erro se falhar — só assim
 * o item permanece na fila para nova tentativa.
 */
export function useOfflineSync(flusher: (item: QueueItem) => Promise<void>) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    const items = await listQueue();
    setPending(items.length);
    return items;
  }, []);

  const flush = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const items = await refresh();
    for (const item of items) {
      try {
        await flusher(item);
        if (item.id) await removeFromQueue(item.id);
      } catch (err) {
        console.warn("[offline-sync] flush failed", err);
        // mantém na fila
      }
    }
    await refresh();
  }, [flusher, refresh]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void refresh();
    if (navigator.onLine) void flush();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flush, refresh]);

  return { online, pending, flush, refresh };
}
