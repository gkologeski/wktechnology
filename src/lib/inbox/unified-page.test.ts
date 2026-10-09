import { describe, expect, it } from "vitest";
import { inboxPageKey, mergeInboxPages, parseInboxPage } from "./unified-page";

const row = (channel: string, id: string, at = "2026-10-01T00:00:00Z") => ({
  channel,
  id,
  sort_at: at,
  title: "t",
});

describe("parseInboxPage", () => {
  it("lê cursor, contagens exatas e descarta linhas inválidas", () => {
    const p = parseInboxPage({
      items: [row("email", "a"), row("fax", "b"), { channel: "chat" }],
      counts: { email: 8689, whatsapp: 8, chat: 2 },
      total: 8699,
      has_more: true,
      next_cursor: { at: "2026-10-01T00:00:00Z", src: 1, id: "a" },
    });
    expect(p.items.map((i) => i.id)).toEqual(["a"]);
    expect(p.counts).toEqual({ email: 8689, whatsapp: 8, chat: 2 });
    expect(p.total).toBe(8699);
    expect(p.hasMore).toBe(true);
    expect(p.nextCursor).toEqual({ at: "2026-10-01T00:00:00Z", src: 1, id: "a" });
  });

  it("sem cursor não há próxima página, mesmo com has_more", () => {
    expect(parseInboxPage({ items: [], has_more: true }).hasMore).toBe(false);
  });
});

describe("mergeInboxPages", () => {
  it("mantém a ordem e remove duplicatas entre páginas pela chave canal+id", () => {
    const a = parseInboxPage({ items: [row("email", "1"), row("whatsapp", "1")] });
    const b = parseInboxPage({ items: [row("whatsapp", "1"), row("chat", "2")] });
    expect(mergeInboxPages([a, b]).map((i) => `${i.channel}:${i.id}`)).toEqual([
      "email:1",
      "whatsapp:1",
      "chat:2",
    ]);
  });
});

describe("inboxPageKey", () => {
  it("separa cache por usuário, canal e busca", () => {
    expect(inboxPageKey("u1", "all", " x ")).not.toEqual(inboxPageKey("u2", "all", "x"));
    expect(inboxPageKey("u1", "all", " x ")).toEqual(inboxPageKey("u1", "all", "x"));
    expect(inboxPageKey("u1", "email", "x")).not.toEqual(inboxPageKey("u1", "chat", "x"));
  });
});
