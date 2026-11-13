import { describe, expect, it } from "vitest";
import { normalizeRecentContact, recentSince } from "./recent-contact";

describe("contato recente em campanhas de ligação", () => {
  it("padrão é 7 dias contando só ligações", () => {
    expect(normalizeRecentContact({})).toEqual({ days: 7, scope: "calls" });
  });
  it("aceita ligações + WhatsApp", () => {
    expect(
      normalizeRecentContact({ recent_contact_days: 30, recent_contact_scope: "calls_whatsapp" }),
    ).toEqual({ days: 30, scope: "calls_whatsapp" });
  });
  it("limita a 365 dias e 0 desliga a regra", () => {
    expect(normalizeRecentContact({ recent_contact_days: 900 }).days).toBe(365);
    expect(recentSince({ days: 0, scope: "calls" })).toBeNull();
  });
  it("janela de 7 dias começa 7 dias antes", () => {
    const now = Date.UTC(2026, 10, 12);
    expect(recentSince({ days: 7, scope: "calls" }, now)).toBe(
      new Date(Date.UTC(2026, 10, 5)).toISOString(),
    );
  });
});
