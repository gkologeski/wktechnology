import { describe, expect, it, vi } from "vitest";
import {
  channelPageKey,
  emailAccountsFilter,
  mergeChannelPages,
  parseChannelPage,
} from "./channel-page";
import {
  createInvalidationBatcher,
  payloadMatchesFilter,
} from "@/lib/realtime/invalidation-batcher";

const row = (id: string) => ({ id, sort_at: "2026-10-01T00:00:00Z" });

describe("parseChannelPage", () => {
  it("lê contagens exatas, total e cursor; descarta linhas sem id/sort_at", () => {
    const p = parseChannelPage<{ id: string }>({
      items: [row("a"), { id: "b" }, null],
      counts: { all: 7463, mine: 12, unassigned: 7000 },
      total: 12,
      has_more: true,
      next_cursor: { at: "2026-10-01T00:00:00Z", id: "a" },
    });
    expect(p.items.map((i) => i.id)).toEqual(["a"]);
    expect(p.counts).toEqual({ all: 7463, mine: 12, unassigned: 7000 });
    expect(p.total).toBe(12);
    expect(p.hasMore).toBe(true);
  });
  it("has_more sem cursor não pede próxima página", () => {
    expect(parseChannelPage({ has_more: true }).hasMore).toBe(false);
  });
});

describe("mergeChannelPages", () => {
  it("remove duplicata que subiu de posição entre recargas", () => {
    const a = parseChannelPage<{ id: string }>({ items: [row("1"), row("2")] });
    const b = parseChannelPage<{ id: string }>({ items: [row("2"), row("3")] });
    expect(mergeChannelPages([a, b]).map((r) => r.id)).toEqual(["1", "2", "3"]);
  });
});

describe("channelPageKey", () => {
  it("separa cache por canal, usuário, responsável e busca", () => {
    const k = channelPageKey("u1", "email", "mine", " x ");
    expect(k).toEqual(channelPageKey("u1", "email", "mine", "x"));
    expect(k).not.toEqual(channelPageKey("u2", "email", "mine", "x"));
    expect(k).not.toEqual(channelPageKey("u1", "email", "all", "x"));
    expect(k).not.toEqual(channelPageKey("u1", "whatsapp", "mine", "x"));
  });
});

describe("realtime de e-mail (fixture de eventos, sem banco)", () => {
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  const OTHER = "33333333-3333-3333-3333-333333333333";
  const filter = emailAccountsFilter([B, A, A, "lixo"])!;

  it("filtra só as caixas do usuário, ordenado e sem valores inválidos", () => {
    expect(filter).toBe(`account_id=in.(${A},${B})`);
    expect(emailAccountsFilter([])).toBeNull();
  });
  it("evento de outra caixa não recarrega; da própria caixa recarrega", () => {
    expect(payloadMatchesFilter(filter, { eventType: "UPDATE", new: { account_id: OTHER } })).toBe(
      false,
    );
    expect(payloadMatchesFilter(filter, { eventType: "INSERT", new: { account_id: A } })).toBe(
      true,
    );
  });
  it("DELETE com payload incompleto (só id) recarrega por segurança", () => {
    expect(payloadMatchesFilter(filter, { eventType: "DELETE", old: { id: "x" } })).toBe(true);
  });
  it("rajada de eventos vira uma única recarga", () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const b = createInvalidationBatcher(flush);
    for (let i = 0; i < 30; i++) b.push([["inbox-channel", "email", "u1"]], []);
    vi.advanceTimersByTime(1500);
    expect(flush).toHaveBeenCalledTimes(1);
    b.cancel();
    vi.useRealTimers();
  });
});

import { compactCount } from "./channel-page";
describe("compactCount", () => {
  it("abrevia milhares em pt-BR", () => {
    expect(compactCount(999)).toBe("999");
    expect(compactCount(7489)).toBe("7,5 mil");
    expect(compactCount(12345)).toBe("12 mil");
  });
});
