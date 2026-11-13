import { describe, expect, it } from "vitest";
import {
  callCampaignStatusLabel,
  canEditCallCampaign,
  canDeleteCallCampaign,
  canCancelCallCampaign,
  estimateCallPace,
} from "./status-label";

const win = { start: "09:00", end: "18:00", timezone: "America/Sao_Paulo", days: [1, 2, 3, 4, 5] };

describe("situação Cancelada", () => {
  it("rótulo e regras", () => {
    expect(callCampaignStatusLabel("canceled")).toBe("Cancelada");
    expect(canEditCallCampaign("canceled")).toBe(false);
    expect(canCancelCallCampaign("canceled")).toBe(false);
    expect(canDeleteCallCampaign("canceled")).toBe(true);
  });
});

describe("ritmo", () => {
  it("pausada não tem previsão", () => {
    expect(
      estimateCallPace({
        status: "paused",
        pending: 5,
        nextAt: null,
        window: win,
        now: new Date(),
      }),
    ).toEqual({
      kind: "none",
      label: "Pausada — sem previsão",
    });
  });
  it("sem fila", () => {
    const p = estimateCallPace({
      status: "running",
      pending: 0,
      nextAt: null,
      window: win,
      now: new Date(),
    });
    expect(p).toEqual({ kind: "none", label: "Sem ligações na fila" });
  });
  it("fora da janela começa no próximo dia útil 09:00 (sábado 10:00 BRT → segunda)", () => {
    const now = new Date("2026-11-14T13:00:00Z"); // sábado 10:00 BRT
    const p = estimateCallPace({ status: "running", pending: 20, nextAt: null, window: win, now });
    expect(p.kind).toBe("estimate");
    if (p.kind === "estimate") {
      expect(p.nextAt.toISOString()).toBe("2026-11-16T12:00:00.000Z");
      // 20 pendentes, 10 por rodada de 2 min → 2 rodadas
      expect(p.endAt.toISOString()).toBe("2026-11-16T12:02:00.000Z");
    }
  });
});
