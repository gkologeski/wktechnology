import { describe, expect, it } from "vitest";
import {
  indexRecent,
  normalizeRecentDays,
  phoneRecentKey,
  recentSince,
  splitRecent,
} from "./recent-contact";

const now = new Date("2026-10-16T12:00:00Z");
const items = [{ phone: "+5548991864243" }, { phone: "+5548999929058" }];
const key = (i: { phone: string }) => phoneRecentKey(i.phone);

describe("controle de reenvio recente", () => {
  it("padrão é 7 dias e 0 desliga", () => {
    expect(normalizeRecentDays(undefined)).toBe(7);
    expect(normalizeRecentDays(0)).toBe(0);
    expect(recentSince(0, now)).toBeNull();
    expect(recentSince(7, now)).toBe("2026-10-09T12:00:00.000Z");
  });

  it("retira quem recebeu dentro do período", () => {
    const recent = indexRecent([
      { key: phoneRecentKey("+5548991864243"), at: "2026-10-15T10:00:00Z", campaignName: "ICP 001" },
    ]);
    const r = splitRecent(items, key, recent, new Set());
    expect(r.removed.map((x) => x.phone)).toEqual(["+5548991864243"]);
    expect(r.removed[0].campaignName).toBe("ICP 001");
    expect(r.kept.map((x) => x.phone)).toEqual(["+5548999929058"]);
  });

  it("variante sem 9º dígito conta como o mesmo número", () => {
    const recent = indexRecent([
      { key: phoneRecentKey("554891864243"), at: "2026-10-15T10:00:00Z", campaignName: "X" },
    ]);
    expect(splitRecent(items, key, recent, new Set()).removed).toHaveLength(1);
  });

  it("exceção manual inclui e marca override", () => {
    const k = phoneRecentKey("+5548991864243");
    const recent = indexRecent([{ key: k, at: "2026-10-15T10:00:00Z", campaignName: "X" }]);
    const r = splitRecent(items, key, recent, new Set([k]));
    expect(r.removed).toHaveLength(0);
    expect(r.kept.find((x) => x.phone === "+5548991864243")?.overrideRecent).toBe(true);
  });

  it("sem envio recente no canal, ninguém sai", () => {
    expect(splitRecent(items, key, new Map(), new Set()).kept).toHaveLength(2);
  });
});
