import { describe, expect, it } from "vitest";
import { countQuestions, nextFollowUpAt } from "./policy";
import { plainReplyUsable } from "./agent.server";

const base = { hours: 24, count: 0, max: 2, stage: "discovery" as const };
const BH = { startHour: 8, endHour: 18, utcOffsetHours: -3 };

describe("retomada dentro da janela de 24 h", () => {
  it("caso Andressa: nunca marca depois do fim da janela", () => {
    const last = "2026-10-14T20:01:46Z"; // 17:01 BRT
    const at = nextFollowUpAt({ ...base, now: new Date("2026-10-14T20:01:52Z"), lastInboundAt: last });
    expect(at!.toISOString()).toBe("2026-10-15T19:01:46.000Z"); // 1 h antes do fim
  });
  it("antecipa para dentro do expediente", () => {
    const last = "2026-10-14T23:30:00Z"; // 20:30 BRT; teto 19:30 BRT do dia seguinte
    const at = nextFollowUpAt({
      ...base,
      now: new Date("2026-10-14T23:30:05Z"),
      lastInboundAt: last,
      businessHours: BH,
    });
    expect(at!.toISOString()).toBe("2026-10-15T20:45:00.000Z"); // 17:45 BRT
  });
  it("sem horário possível na janela devolve null", () => {
    const at = nextFollowUpAt({
      ...base,
      now: new Date("2026-10-15T19:30:00Z"),
      lastInboundAt: "2026-10-14T20:00:00Z",
    });
    expect(at).toBeNull();
  });
});

describe("formato e perguntas", () => {
  it("conta perguntas", () => {
    expect(countQuestions("Qual o prazo? Já tentaram internamente?")).toBe(2);
    expect(countQuestions("Qual o prazo?")).toBe(1);
  });
  it("texto puro aproveitável vs JSON quebrado", () => {
    expect(plainReplyUsable("Qual o prazo dessa contratação?")).toBe(true);
    expect(plainReplyUsable('{"reply": "oi"')).toBe(false);
    expect(plainReplyUsable("")).toBe(false);
  });
});
