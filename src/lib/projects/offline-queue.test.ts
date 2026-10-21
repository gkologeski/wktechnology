import { describe, expect, it } from "vitest";
import {
  classifyError,
  enqueue,
  hashPayload,
  memoryStore,
  purgeExpired,
  RETENTION_MS,
  syncQueue,
  type OfflinePayload,
  type SendResult,
} from "./offline-queue";
import { OFFLINE_TIME_QUEUE_MAX_ITEMS } from "@/lib/limits";

const U1 = "10000000-0000-4000-8000-000000000001";
const U2 = "10000000-0000-4000-8000-000000000002";
const WA = "aaaaaaaa-0000-4000-8000-00000000000a";
const WB = "aaaaaaaa-0000-4000-8000-00000000000b";
const P: OfflinePayload = {
  project_id: "c6000000-0000-4000-8000-000000000001",
  task_id: "c6100000-0000-4000-8000-000000000001",
  entry_date: "2026-03-11",
  mode: "duration",
  duration_seconds: 2700,
};
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

describe("fila offline de apontamentos", () => {
  it("hash do pedido é o mesmo para o mesmo conteúdo em qualquer ordem de campos", async () => {
    const a = await hashPayload(P);
    const b = await hashPayload({ duration_seconds: 2700, mode: "duration", entry_date: "2026-03-11", task_id: P.task_id, project_id: P.project_id });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("envia só itens do usuário e workspace atuais; outra conta/workspace nunca é enviada", async () => {
    const s = memoryStore();
    await enqueue(s, { userId: U1, workspaceId: WA, payload: P, label: "a" }, 1000, id);
    await enqueue(s, { userId: U2, workspaceId: WA, payload: P, label: "b" }, 1000, id);
    await enqueue(s, { userId: U1, workspaceId: WB, payload: P, label: "c" }, 1000, id);
    const sentFor: string[] = [];
    const r = await syncQueue(s, { userId: U1, workspaceId: WA }, async (i) => {
      sentFor.push(`${i.userId}:${i.workspaceId}`);
      return { kind: "ok", replay: false, entryId: "e1" };
    }, () => 2000);
    expect(r.sent).toBe(1);
    expect(sentFor).toEqual([`${U1}:${WA}`]);
    const all = await s.all();
    expect(all.filter((i) => i.state === "synced")).toHaveLength(1);
    expect(all.filter((i) => i.state === "pending")).toHaveLength(2);
  });

  it("só marca sincronizado depois da confirmação; conflito não volta sozinho para a fila", async () => {
    const s = memoryStore();
    await enqueue(s, { userId: U1, workspaceId: WA, payload: P, label: "a" }, 1000, id);
    await syncQueue(s, { userId: U1, workspaceId: WA }, async () => ({ kind: "conflict", message: "PERIOD_CLOSED: competência fechada" }), () => 2000);
    let [item] = await s.all();
    expect(item!.state).toBe("conflict");
    expect(item!.lastError).toBe("competência fechada");
    let calls = 0;
    await syncQueue(s, { userId: U1, workspaceId: WA }, async () => (calls++, { kind: "ok", replay: false, entryId: "x" }), () => 9_999_999);
    [item] = await s.all();
    expect(calls).toBe(0);
    expect(item!.state).toBe("conflict");
  });

  it("sem rede: marca erro com espera crescente e para o lote", async () => {
    const s = memoryStore();
    await enqueue(s, { userId: U1, workspaceId: WA, payload: P, label: "a" }, 1000, id);
    await enqueue(s, { userId: U1, workspaceId: WA, payload: P, label: "b" }, 1001, id);
    let calls = 0;
    const send = async (): Promise<SendResult> => (calls++, { kind: "retry", message: "Sem conexão com o servidor." });
    const r = await syncQueue(s, { userId: U1, workspaceId: WA }, send, () => 5000);
    expect(calls).toBe(1);
    expect(r.retries).toBe(1);
    const errored = (await s.all()).find((i) => i.state === "error")!;
    expect(errored.nextAttemptAt).toBe(5000 + 2000);
    // Antes do prazo não reenvia.
    await syncQueue(s, { userId: U1, workspaceId: WA }, send, () => 6000);
    expect(calls).toBe(2); // o segundo item (ainda pendente) é tentado; o com erro aguarda
  });

  it("retomada: item que ficou 'enviando' (aba fechada) é reenviado com o MESMO id de pedido", async () => {
    const s = memoryStore();
    const it1 = await enqueue(s, { userId: U1, workspaceId: WA, payload: P, label: "a" }, 1000, id);
    await s.put({ ...it1, state: "sending" });
    const ids: string[] = [];
    await syncQueue(s, { userId: U1, workspaceId: WA }, async (i) => (ids.push(i.id), { kind: "ok", replay: true, entryId: "e" }), () => 2000);
    expect(ids).toEqual([it1.id]);
    expect((await s.all())[0]!.state).toBe("synced");
  });

  it("vencidos são descartados e contados como perdidos (não enviados)", async () => {
    const s = memoryStore();
    await enqueue(s, { userId: U1, workspaceId: WA, payload: P, label: "a" }, 0, id);
    const r = await purgeExpired(s, RETENTION_MS + 1);
    expect(r.lostUnsent).toBe(1);
    expect(await s.all()).toHaveLength(0);
  });

  it(`limite de ${OFFLINE_TIME_QUEUE_MAX_ITEMS} itens guardados por usuário + workspace`, async () => {
    const s = memoryStore();
    for (let i = 0; i < OFFLINE_TIME_QUEUE_MAX_ITEMS; i++)
      await enqueue(s, { userId: U1, workspaceId: WA, payload: P, label: "x" }, 1000, id);
    await expect(enqueue(s, { userId: U1, workspaceId: WA, payload: P, label: "x" }, 1000, id)).rejects.toThrow(/Limite/);
    await expect(enqueue(s, { userId: U2, workspaceId: WA, payload: P, label: "x" }, 1000, id)).resolves.toBeTruthy();
  });

  it("classifica falha de rede como nova tentativa e regra de negócio como conflito", () => {
    expect(classifyError(new TypeError("Failed to fetch")).kind).toBe("retry");
    expect(classifyError(new Error("Já existe um apontamento entre 09:00 e 10:00")).kind).toBe("conflict");
    expect(classifyError(new Error("OFFLINE_REQUEST_CONFLICT: x")).kind).toBe("conflict");
  });
});
