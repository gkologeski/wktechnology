import { describe, expect, it } from "vitest";
import {
  anchoredScrollTop,
  compareHistory,
  cursorOf,
  emptyHistory,
  historyReducer,
  isHistoryTimestamp,
  isNearBottom,
  mergeHistory,
  pickFields,
  tsKey,
  windowStartCursor,
  type HistoryCursor,
  type HistoryRow,
  type HistoryState,
} from "./message-history";

type Row = HistoryRow & { status?: string; body?: string };

/** Servidor falso com a mesma semântica do cursor (created_at, id) do listConversationMessages. */
function fakeServer(rows: Row[]) {
  const sorted = () => [...rows].sort(compareHistory);
  return (args: { before?: HistoryCursor; after?: HistoryCursor; limit?: number }) => {
    const limit = args.limit ?? 50;
    const all = sorted();
    let list: Row[];
    if (args.after) {
      const c = { id: args.after.id, created_at: args.after.at };
      list = all.filter((r) => compareHistory(r, c) > 0).slice(0, limit + 1);
    } else {
      const c = args.before ? { id: args.before.id, created_at: args.before.at } : null;
      list = all
        .filter((r) => !c || compareHistory(r, c) < 0)
        .reverse()
        .slice(0, limit + 1);
    }
    const hasMore = list.length > limit;
    const page = list.slice(0, limit);
    if (!args.after) page.reverse();
    return { items: page, hasMore };
  };
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Empates: 4 mensagens por segundo exato, com microssegundos variados em parte.
function fixture(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: uuid(n - i), // ids fora da ordem de tempo
    created_at: `2026-01-01T00:${String(Math.floor(i / 240)).padStart(2, "0")}:${String(Math.floor(i / 4) % 60).padStart(2, "0")}${i % 8 === 0 ? "" : ".1234" + (i % 2)}+00:00`,
  }));
}

function walkToStart(rows: Row[], pageSize: number) {
  const server = fakeServer(rows);
  let s: HistoryState<Row> = emptyHistory<Row>("k");
  const p0 = server({ limit: pageSize });
  s = historyReducer(s, { type: "initialOk", key: "k", items: p0.items, hasMore: p0.hasMore });
  let pages = 1;
  while (s.hasOlder && pages < 1000) {
    const p = server({ before: cursorOf(s.items[0]), limit: pageSize });
    s = historyReducer(s, { type: "olderOk", key: "k", items: p.items, hasMore: p.hasMore });
    pages++;
  }
  return { s, pages, server };
}

describe("histórico de mensagens paginado", () => {
  it("timestamps do PostgREST e do tempo real têm a mesma chave com microssegundos", () => {
    expect(tsKey("2026-10-09T19:27:00.123456+00:00")).toBe(tsKey("2026-10-09 19:27:00.123456+00"));
    expect(tsKey("2026-10-09T19:27:00.123457+00:00")).toBeGreaterThan(
      tsKey("2026-10-09T19:27:00.123456Z"),
    );
    expect(tsKey("2026-10-09T19:27:00+00:00")).toBeLessThan(
      tsKey("2026-10-09T19:27:00.000001+00:00"),
    );
    expect(isHistoryTimestamp('2026-10-09T19:27:00Z",id.gt.x')).toBe(false);
  });

  it.each([501, 1203])(
    "percorre %i mensagens com empates até o início sem perder nem repetir",
    (n) => {
      const rows = fixture(n);
      const { s } = walkToStart(rows, 50);
      expect(s.items).toHaveLength(n);
      expect(new Set(s.items.map((r) => r.id)).size).toBe(n);
      expect(s.items).toEqual([...rows].sort(compareHistory));
      expect(s.hasOlder).toBe(false);
    },
  );

  it("primeira página traz as mais recentes (WhatsApp não esconde as novas >500)", () => {
    const rows = fixture(700);
    const p = fakeServer(rows)({ limit: 50 });
    const newest = [...rows].sort(compareHistory).slice(-50);
    expect(p.items).toEqual(newest);
    expect(p.hasMore).toBe(true);
  });

  it("mensagem nova chegando durante 'carregar anteriores' entra uma vez só", () => {
    const rows = fixture(120);
    const server = fakeServer(rows);
    let s = emptyHistory<Row>("k");
    const p0 = server({ limit: 50 });
    s = historyReducer(s, { type: "initialOk", key: "k", items: p0.items, hasMore: p0.hasMore });
    s = historyReducer(s, { type: "olderStart", key: "k" });
    const fresh = { id: uuid(9999), created_at: "2026-01-01T01:00:00+00:00" };
    rows.push(fresh);
    const newer = server({ after: cursorOf(s.items[s.items.length - 1]), limit: 100 });
    s = historyReducer(s, { type: "upsert", key: "k", items: newer.items });
    s = historyReducer(s, { type: "upsert", key: "k", items: newer.items }); // evento duplicado
    const older = server({ before: cursorOf(s.items[0]), limit: 50 });
    s = historyReducer(s, {
      type: "olderOk",
      key: "k",
      items: older.items,
      hasMore: older.hasMore,
    });
    expect(s.items.filter((r) => r.id === fresh.id)).toHaveLength(1);
    expect(s.items[s.items.length - 1].id).toBe(fresh.id);
    expect(s.items).toHaveLength(101);
  });

  it("status atualiza o item existente; created_at/id do payload não mudam a ordem", () => {
    let s = historyReducer(emptyHistory<Row>("k"), {
      type: "initialOk",
      key: "k",
      items: [{ id: uuid(1), created_at: "2026-01-01T00:00:00Z", status: "sent" }],
      hasMore: false,
    });
    const fields = pickFields<Row>(
      { id: uuid(1), status: "read", created_at: "2030-01-01T00:00:00Z", owner_id: "x" },
      ["status"],
    );
    s = historyReducer(s, { type: "patch", key: "k", id: uuid(1), fields });
    expect(s.items[0]).toEqual({ id: uuid(1), created_at: "2026-01-01T00:00:00Z", status: "read" });
    s = historyReducer(s, { type: "remove", key: "k", id: uuid(1) });
    expect(s.items).toHaveLength(0);
  });

  it("resposta de outra conversa/usuário é descartada após troca de contexto", () => {
    let s = historyReducer(emptyHistory<Row>("u1:wa:A"), { type: "reset", key: "u1:wa:B" });
    s = historyReducer(s, {
      type: "initialOk",
      key: "u1:wa:A",
      items: [{ id: uuid(1), created_at: "2026-01-01T00:00:00Z" }],
      hasMore: false,
    });
    expect(s.items).toHaveLength(0);
    expect(s.initial).toBe("loading");
  });

  it("falha em página anterior mantém o histórico carregado e permite tentar de novo", () => {
    const { s: full } = walkToStart(fixture(60), 50);
    let s = historyReducer(full, { type: "olderStart", key: "k" });
    s = historyReducer(s, { type: "olderErr", key: "k", error: "rede" });
    expect(s.items).toHaveLength(60);
    expect(s.olderError).toBe("rede");
    expect(s.olderLoading).toBe(false);
    // Falha na recarga inicial com itens já na tela não volta para estado de erro vazio.
    s = historyReducer(s, { type: "initialErr", key: "k", error: "x" });
    expect(s.initial).toBe("ready");
  });

  it("reconciliação da janela remove excluídas e preserva o que está antes da janela", () => {
    const rows = fixture(10);
    let s = historyReducer(emptyHistory<Row>("k"), {
      type: "initialOk",
      key: "k",
      items: [...rows].sort(compareHistory),
      hasMore: false,
    });
    const sorted = [...rows].sort(compareHistory);
    const deleted = sorted[5];
    const remaining = sorted.filter((r) => r.id !== deleted.id);
    const server = fakeServer(remaining);
    const w = server({ after: windowStartCursor(sorted[0]), limit: 100 });
    s = historyReducer(s, { type: "replaceWindow", key: "k", items: w.items });
    expect(s.items.map((r) => r.id)).toEqual(remaining.map((r) => r.id));
  });

  it("merge sem duplicar quando o envio local e o tempo real trazem a mesma mensagem", () => {
    const a = { id: uuid(1), created_at: "2026-01-01T00:00:00Z", status: "queued" };
    const merged = mergeHistory([a], [{ ...a, status: "sent" }, a].slice(0, 1));
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("sent");
  });

  it("âncora de rolagem: conteúdo acima não desloca o que está sendo lido", () => {
    expect(anchoredScrollTop({ scrollHeight: 2000, scrollTop: 30 }, 3500)).toBe(1530);
    expect(isNearBottom({ scrollHeight: 2000, scrollTop: 1500, clientHeight: 450 })).toBe(true);
    expect(isNearBottom({ scrollHeight: 2000, scrollTop: 900, clientHeight: 450 })).toBe(false);
  });
});

// ---- Ciclo 7: continuação sem teto e reconciliação por intervalo ----
import { drainNewer, reconcileRange } from "./message-history";

function asyncServer(rows: Row[], onCall?: (n: number) => void) {
  const srv = fakeServer(rows);
  let n = 0;
  return async (a: { after: HistoryCursor; limit: number; signal: AbortSignal }) => {
    onCall?.(++n);
    await Promise.resolve();
    return srv(a);
  };
}

function loaded(rows: Row[]): { s: HistoryState<Row> } {
  const box = { s: emptyHistory<Row>("k") };
  box.s = historyReducer(box.s, { type: "initialOk", key: "k", items: rows, hasMore: false });
  return box;
}

describe("drainNewer (ciclo 7)", () => {
  it("traz >600 novas após reconectar sem parar no teto de 5×100 por rodada", async () => {
    const all = fixture(3200);
    const sorted = [...all].sort(compareHistory);
    const box = loaded(sorted.slice(0, 2600)); // >2500 carregadas
    const r = await drainNewer<Row>({
      fetch: asyncServer(all),
      getLast: () => box.s.items[box.s.items.length - 1],
      apply: (items) => (box.s = historyReducer(box.s, { type: "upsert", key: "k", items })),
      signal: new AbortController().signal,
    });
    expect(r.complete).toBe(true);
    expect(r.pages).toBe(6); // 600 novas = 6 páginas (a 6ª já sem continuação)
    expect(box.s.items.length).toBe(3200);
    expect(new Set(box.s.items.map((x) => x.id)).size).toBe(3200);
  });

  it("aborta ao trocar de contexto sem aplicar respostas posteriores", async () => {
    const all = fixture(1500);
    const sorted = [...all].sort(compareHistory);
    const box = loaded(sorted.slice(0, 100));
    const ac = new AbortController();
    const r = await drainNewer<Row>({
      fetch: asyncServer(all, (n) => n === 3 && ac.abort()),
      getLast: () => box.s.items[box.s.items.length - 1],
      apply: (items) => (box.s = historyReducer(box.s, { type: "upsert", key: "k", items })),
      signal: ac.signal,
    });
    expect(r.complete).toBe(false);
    expect(box.s.items.length).toBe(300); // 100 + 2 páginas antes do abort
  });

  it("para sem laço infinito se o cursor não avança", async () => {
    const box = loaded(fixture(10).sort(compareHistory));
    let calls = 0;
    const r = await drainNewer<Row>({
      fetch: async () => (calls++, { items: [], hasMore: true }),
      getLast: () => box.s.items[box.s.items.length - 1],
      apply: () => {},
      signal: new AbortController().signal,
    });
    expect(r.complete).toBe(false);
    expect(calls).toBe(1);
  });
});

describe("reconcileRange (ciclo 7)", () => {
  function run(box: { s: HistoryState<Row> }, server: Row[], extra?: () => void) {
    return reconcileRange<Row>({
      oldest: box.s.items[0],
      fetch: asyncServer(server, extra ? () => extra() : undefined),
      currentIds: () => new Set(box.s.items.map((r) => r.id)),
      applyRange: (after, until, items, priorIds) =>
        (box.s = historyReducer(box.s, {
          type: "replaceRange",
          key: "k",
          after,
          until,
          items,
          priorIds,
        })),
      signal: new AbortController().signal,
    });
  }

  it("janela >2000 (2600): percorre tudo, remove só excluídos e mantém o resto", async () => {
    const all = fixture(2600).sort(compareHistory);
    const box = loaded(all);
    const deleted = new Set([all[5].id, all[1500].id, all[2599].id]);
    const server = all
      .filter((r) => !deleted.has(r.id))
      .map((r, i) => (i === 2100 ? { ...r, status: "read" } : r));
    const res = await run(box, server);
    expect(res.complete).toBe(true);
    expect(res.pages).toBe(26);
    expect(box.s.items.length).toBe(2597);
    expect(box.s.items.some((r) => deleted.has(r.id))).toBe(false);
    expect(box.s.items.find((r) => r.id === server[2100].id)?.status).toBe("read");
  });

  it("interrompido no meio não apaga itens fora do intervalo já coberto", async () => {
    const all = fixture(2600).sort(compareHistory);
    const box = loaded(all);
    const ac = new AbortController();
    let n = 0;
    await reconcileRange<Row>({
      oldest: box.s.items[0],
      fetch: async (a) => {
        if (++n === 4) ac.abort();
        return fakeServer(all.filter((_, i) => i < 1000 || i > 1100))(a); // 101 excluídos adiante
      },
      currentIds: () => new Set(box.s.items.map((r) => r.id)),
      applyRange: (after, until, items, priorIds) =>
        (box.s = historyReducer(box.s, {
          type: "replaceRange",
          key: "k",
          after,
          until,
          items,
          priorIds,
        })),
      signal: ac.signal,
    });
    // Só 300 itens foram cobertos antes do abort; os excluídos adiante continuam (não verificados).
    expect(box.s.items.length).toBe(2600);
  });

  it("mensagem nova que chega durante a revalidação não é apagada", async () => {
    const all = fixture(400).sort(compareHistory);
    const box = loaded(all.slice(0, 399));
    let calls = 0;
    await run(box, all.slice(0, 399), () => {
      if (++calls !== 4) return; // chega durante a busca da última página
      box.s = historyReducer(box.s, { type: "upsert", key: "k", items: [all[399]] });
    });
    expect(box.s.items.map((r) => r.id)).toContain(all[399].id);
    expect(box.s.items.length).toBe(400);
  });

  it("empates no mesmo instante: exclusão de um não remove o vizinho", async () => {
    const at = "2026-01-01T00:00:00+00:00";
    const rows: Row[] = [uuid(3), uuid(1), uuid(2)].map((id) => ({ id, created_at: at }));
    const box = loaded([...rows].sort(compareHistory));
    await run(
      box,
      rows.filter((r) => r.id !== uuid(2)),
    );
    expect(box.s.items.map((r) => r.id)).toEqual([uuid(1), uuid(3)]);
  });
});
