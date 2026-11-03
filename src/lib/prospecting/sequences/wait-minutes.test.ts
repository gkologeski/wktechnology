import { describe, expect, it } from "vitest";
import { waitUntil } from "./runtime";

const settings = { timezone: "America/Sao_Paulo", businessDays: [1, 2, 3, 4, 5] } as never;
const step = (duration: number, unit: string) =>
  ({
    type: "wait",
    id: "w",
    title: "w",
    duration,
    unit,
    source: "previous",
    onReply: "agent",
  }) as never;

describe("espera em minutos", () => {
  const at = new Date("2026-11-03T12:00:00Z");
  it("1 minuto soma exatamente 60 segundos", () => {
    expect(waitUntil(at, step(1, "minutes"), settings).toISOString()).toBe(
      "2026-11-03T12:01:00.000Z",
    );
  });
  it("horas continuam iguais", () => {
    expect(waitUntil(at, step(1, "hours"), settings).toISOString()).toBe(
      "2026-11-03T13:00:00.000Z",
    );
  });
});
