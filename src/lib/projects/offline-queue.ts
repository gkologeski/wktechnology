// Fila offline de apontamentos (opt-in, por usuário + workspace, só no aparelho).
// Guarda o MÍNIMO para reenviar um apontamento novo: projeto, atividade existente, data, horário ou
// duração, fuso, descrição e faturável. Nunca guarda tokens, custos, respostas autenticadas nem
// dados de outras telas. Itens expiram (OFFLINE_TIME_QUEUE_RETENTION_HOURS) e são apagados ao sair
// da conta. Estado "sincronizado" só depois da confirmação do servidor.
import { OFFLINE_TIME_QUEUE_MAX_ITEMS, OFFLINE_TIME_QUEUE_RETENTION_HOURS } from "@/lib/limits";
import { canonicalJson, sha256Hex } from "./public-api.shared";

export type OfflineState = "pending" | "sending" | "synced" | "conflict" | "error";

export type OfflinePayload = {
  project_id: string;
  task_id: string;
  entry_date: string;
  mode: "interval" | "duration";
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  timezone?: string;
  description?: string;
  billable?: boolean;
};

export type OfflineItem = {
  id: string; // client_request_id estável
  userId: string;
  workspaceId: string;
  payload: OfflinePayload;
  requestHash: string;
  label: string; // texto curto para a lista (projeto/atividade), sem dados extras
  state: OfflineState;
  attempts: number;
  lastError: string | null;
  entryId: string | null;
  deviceRecordedAt: string;
  createdAt: number;
  expiresAt: number;
  nextAttemptAt: number;
};

export interface OfflineStore {
  all(): Promise<OfflineItem[]>;
  put(item: OfflineItem): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export const RETENTION_MS = OFFLINE_TIME_QUEUE_RETENTION_HOURS * 3600_000;

export async function hashPayload(p: OfflinePayload): Promise<string> {
  return sha256Hex(canonicalJson(p));
}

export function scoped(items: OfflineItem[], userId: string, workspaceId: string) {
  return items.filter((i) => i.userId === userId && i.workspaceId === workspaceId);
}

export async function enqueue(
  store: OfflineStore,
  input: { userId: string; workspaceId: string; payload: OfflinePayload; label: string },
  now = Date.now(),
  newId: () => string = () => crypto.randomUUID(),
): Promise<OfflineItem> {
  const mine = scoped(await store.all(), input.userId, input.workspaceId).filter(
    (i) => i.state !== "synced",
  );
  if (mine.length >= OFFLINE_TIME_QUEUE_MAX_ITEMS)
    throw new Error(
      `Limite de ${OFFLINE_TIME_QUEUE_MAX_ITEMS} apontamentos guardados neste aparelho. Envie ou descarte os pendentes.`,
    );
  const item: OfflineItem = {
    id: newId(),
    userId: input.userId,
    workspaceId: input.workspaceId,
    payload: input.payload,
    requestHash: await hashPayload(input.payload),
    label: input.label.slice(0, 120),
    state: "pending",
    attempts: 0,
    lastError: null,
    entryId: null,
    deviceRecordedAt: new Date(now).toISOString(),
    createdAt: now,
    expiresAt: now + RETENTION_MS,
    nextAttemptAt: now,
  };
  await store.put(item);
  return item;
}

/** Remove vencidos e sincronizados há mais de 1 dia. Devolve quantos vencidos NÃO enviados caíram. */
export async function purgeExpired(store: OfflineStore, now = Date.now()) {
  let lostUnsent = 0;
  for (const i of await store.all()) {
    const syncedOld = i.state === "synced" && now - i.createdAt > 24 * 3600_000;
    if (i.expiresAt <= now || syncedOld) {
      if (i.state !== "synced") lostUnsent++;
      await store.remove(i.id);
    }
  }
  return { lostUnsent };
}

export type SendResult =
  | { kind: "ok"; replay: boolean; entryId: string | null }
  | { kind: "conflict"; message: string }
  | { kind: "retry"; message: string };

/** Classifica falhas: rede/servidor indisponível = tentar de novo; regra de negócio = conflito. */
export function classifyError(e: unknown): SendResult {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    /Failed to fetch|NetworkError|Load failed|network|fetch failed|timeout|aborted|50[234]|ECONN/i.test(
      msg,
    ) ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  )
    return { kind: "retry", message: "Sem conexão com o servidor." };
  if (/Sessão obrigatória|401|Unauthorized|JWT/i.test(msg))
    return { kind: "retry", message: "Sessão expirada: entre novamente para enviar." };
  return { kind: "conflict", message: msg.replace(/^[A-Z_]+:\s*/, "").slice(0, 300) };
}

/**
 * Envia os itens elegíveis do usuário + workspace ATUAIS, um por vez. Itens de outra conta ou de
 * outro workspace nunca são enviados. Conflito não é reenviado automaticamente.
 */
export async function syncQueue(
  store: OfflineStore,
  ctx: { userId: string; workspaceId: string },
  send: (item: OfflineItem) => Promise<SendResult>,
  now = () => Date.now(),
): Promise<{ sent: number; conflicts: number; retries: number }> {
  let sent = 0,
    conflicts = 0,
    retries = 0;
  const eligible = scoped(await store.all(), ctx.userId, ctx.workspaceId)
    .filter(
      (i) =>
        (i.state === "pending" || i.state === "error" || i.state === "sending") &&
        i.nextAttemptAt <= now(),
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const item of eligible) {
    await store.put({ ...item, state: "sending" });
    const r = await send(item).catch((e) => classifyError(e));
    if (r.kind === "ok") {
      sent++;
      await store.put({
        ...item,
        state: "synced",
        entryId: r.entryId,
        lastError: null,
        attempts: item.attempts + 1,
      });
    } else if (r.kind === "conflict") {
      conflicts++;
      await store.put({
        ...item,
        state: "conflict",
        lastError: r.message.replace(/^[A-Z_]+:\s*/, ""),
        attempts: item.attempts + 1,
      });
    } else {
      retries++;
      const attempts = item.attempts + 1;
      const backoff = Math.min(15 * 60_000, 2 ** Math.min(attempts, 10) * 1000);
      await store.put({
        ...item,
        state: "error",
        lastError: r.message,
        attempts,
        nextAttemptAt: now() + backoff,
      });
      // Sem rede: para o lote; os demais aguardam a próxima tentativa.
      break;
    }
  }
  return { sent, conflicts, retries };
}

export function memoryStore(seed: OfflineItem[] = []): OfflineStore {
  const map = new Map(seed.map((i) => [i.id, i]));
  return {
    all: async () => [...map.values()].map((i) => ({ ...i })),
    put: async (i) => void map.set(i.id, { ...i }),
    remove: async (id) => void map.delete(id),
    clear: async () => map.clear(),
  };
}

const DB = "techerp-offline-v1";
const STORE = "time-queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}

/** Armazenamento no IndexedDB do navegador (somente no cliente). */
export function indexedDbStore(): OfflineStore {
  return {
    all: () => tx<OfflineItem[]>("readonly", (s) => s.getAll() as IDBRequest<OfflineItem[]>),
    put: async (i) => void (await tx("readwrite", (s) => s.put(i))),
    remove: async (id) => void (await tx("readwrite", (s) => s.delete(id))),
    clear: async () => void (await tx("readwrite", (s) => s.clear())),
  };
}

/** Apaga a fila deste aparelho (usado ao sair da conta). */
export async function purgeAllOfflineQueues() {
  if (typeof indexedDB === "undefined") return;
  try {
    await indexedDbStore().clear();
  } catch {
    /* sem IndexedDB: nada a apagar */
  }
}

export const offlinePrefKey = (userId: string, workspaceId: string) =>
  `techerp.offlineTime.optIn:${userId}:${workspaceId}`;
