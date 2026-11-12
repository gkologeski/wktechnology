import { describe, expect, it } from "vitest";
import { nextRunAt } from "./schedule";

const base = { runHour: 2, runWeekday: 1, timeZone: "America/Sao_Paulo" };
describe("nextRunAt", () => {
  it("a cada 6 horas vai para o próximo bloco de 6h", () => {
    expect(
      nextRunAt({ ...base, frequency: "every_6h" }, new Date("2026-11-12T07:10:00Z")).toISOString(),
    ).toBe("2026-11-12T12:00:00.000Z");
  });
  it("diária às 2h de São Paulo = 05:00 UTC do dia seguinte quando já passou", () => {
    expect(
      nextRunAt({ ...base, frequency: "daily" }, new Date("2026-11-12T17:29:00Z")).toISOString(),
    ).toBe("2026-11-13T05:00:00.000Z");
  });
  it("diária ainda hoje quando o horário não passou", () => {
    expect(
      nextRunAt(
        { ...base, frequency: "daily", runHour: 20 },
        new Date("2026-11-12T17:29:00Z"),
      ).toISOString(),
    ).toBe("2026-11-12T23:00:00.000Z");
  });
  it("semanal na segunda-feira às 2h", () => {
    // 12/11/2026 é quinta; próxima segunda é 16/11
    expect(
      nextRunAt({ ...base, frequency: "weekly" }, new Date("2026-11-12T17:29:00Z")).toISOString(),
    ).toBe("2026-11-16T05:00:00.000Z");
  });
  it("de hora em hora", () => {
    expect(
      nextRunAt({ ...base, frequency: "hourly" }, new Date("2026-11-12T17:00:00Z")).toISOString(),
    ).toBe("2026-11-12T18:00:00.000Z");
  });
});
