import { describe, it, expect } from "vitest";
import {
  parseClock,
  formatClock,
  durationMinutes,
  formatMinutes,
  expectedMinutesForDate,
  expectedMinutesForRange,
  eachIsoDate,
  findOverlap,
} from "./time-entry.shared";

describe("time-entry.shared", () => {
  it("interpreta e formata horários", () => {
    expect(parseClock("09:00")).toBe(540);
    expect(parseClock("09:00:00")).toBe(540);
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("")).toBeNull();
    expect(formatClock(750)).toBe("12:30");
  });

  it("calcula duração e formata", () => {
    expect(durationMinutes("09:00", "12:30")).toBe(210);
    expect(durationMinutes("12:30", "09:00")).toBeNull();
    expect(durationMinutes("09:00", "09:00")).toBeNull();
    expect(formatMinutes(210)).toBe("3h30");
    expect(formatMinutes(60)).toBe("1h00");
    expect(formatMinutes(null)).toBe("0h00");
  });

  it("deriva meta de horas da alocação", () => {
    // 2026-09-08 é uma terça-feira
    expect(expectedMinutesForDate("2026-09-08", [])).toBe(480);
    // 2026-09-12 é sábado
    expect(expectedMinutesForDate("2026-09-12", [])).toBe(0);
    expect(
      expectedMinutesForDate("2026-09-08", [
        { allocation_pct: 50, starts_at: "2026-01-01", ends_at: null },
      ]),
    ).toBe(240);
    expect(
      expectedMinutesForDate("2026-09-08", [
        { allocation_pct: 50, starts_at: null, ends_at: "2026-01-01" },
      ]),
    ).toBe(480);
  });

  it("acumula meta no intervalo", () => {
    expect(eachIsoDate("2026-09-07", "2026-09-13")).toHaveLength(7);
    expect(expectedMinutesForRange("2026-09-07", "2026-09-13", [])).toBe(5 * 480);
  });

  it("detecta sobreposição", () => {
    const existing = [{ id: "a", start_time: "09:00:00", end_time: "12:00:00" }];
    expect(findOverlap(existing, { start_time: "10:00", end_time: "11:00" })).toEqual({
      start_time: "09:00",
      end_time: "12:00",
    });
    expect(findOverlap(existing, { start_time: "12:00", end_time: "13:00" })).toBeNull();
    expect(findOverlap(existing, { id: "a", start_time: "10:00", end_time: "11:00" })).toBeNull();
  });
});
