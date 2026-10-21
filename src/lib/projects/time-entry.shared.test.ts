import { describe, it, expect } from "vitest";
import {
  parseClock,
  formatClock,
  durationMinutes,
  formatMinutes,
  formatSeconds,
  parseDurationInput,
  expectedMinutesForDate,
  expectedMinutesForRange,
  eachIsoDate,
  findOverlap,
  cleanDbError,
  isImportedLocked,
  isEditableEntry,
  planWeekCopy,
  type WorkSchedule,
} from "./time-entry.shared";

const WEEK_8H: WorkSchedule = { mon: 28800, tue: 28800, wed: 28800, thu: 28800, fri: 28800 };

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

  it("formata segundos exatos sem arredondar", () => {
    expect(formatSeconds(5415)).toBe("1:30:15");
    expect(formatSeconds(59)).toBe("0:00:59");
    expect(formatSeconds(null)).toBe("0:00:00");
  });

  it("entende duração digitada", () => {
    expect(parseDurationInput("1h30")).toBe(5400);
    expect(parseDurationInput("2:15")).toBe(8100);
    expect(parseDurationInput("45m")).toBe(2700);
    expect(parseDurationInput("1,5")).toBe(5400);
    expect(parseDurationInput("abc")).toBeNull();
    expect(parseDurationInput("1:75")).toBeNull();
  });

  it("sem jornada configurada não presume 8 horas", () => {
    expect(expectedMinutesForDate("2026-09-08", [], null)).toBeNull();
    expect(expectedMinutesForRange("2026-09-07", "2026-09-13", [], null)).toBeNull();
  });

  it("deriva meta da jornada do People e da alocação", () => {
    // 2026-09-08 é terça; 2026-09-12 é sábado
    expect(expectedMinutesForDate("2026-09-08", [], WEEK_8H)).toBe(480);
    expect(expectedMinutesForDate("2026-09-12", [], WEEK_8H)).toBe(0);
    expect(
      expectedMinutesForDate(
        "2026-09-08",
        [{ allocation_pct: 50, starts_at: "2026-01-01", ends_at: null }],
        WEEK_8H,
      ),
    ).toBe(240);
    expect(
      expectedMinutesForDate(
        "2026-09-08",
        [{ allocation_pct: 50, starts_at: null, ends_at: "2026-01-01" }],
        WEEK_8H,
      ),
    ).toBe(480);
    expect(expectedMinutesForDate("2026-09-11", [], { ...WEEK_8H, fri: 21600 })).toBe(360);
  });

  it("acumula meta no intervalo", () => {
    expect(eachIsoDate("2026-09-07", "2026-09-13")).toHaveLength(7);
    expect(eachIsoDate("2026-10-31", "2026-11-02")).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(expectedMinutesForRange("2026-09-07", "2026-09-13", [], WEEK_8H)).toBe(5 * 480);
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

  it("importado travado nunca é aprovado nem editável", () => {
    expect(isImportedLocked({ status: "locked", source: "import" })).toBe(true);
    expect(isImportedLocked({ status: "approved", source: "manual" })).toBe(false);
    expect(isEditableEntry({ status: "locked" })).toBe(false);
    expect(isEditableEntry({ status: "approved" })).toBe(false);
    expect(isEditableEntry({ status: "draft", period_closing_id: "x" })).toBe(false);
    expect(isEditableEntry({ status: "rejected" })).toBe(true);
  });

  it("limpa o código técnico das mensagens do banco", () => {
    expect(cleanDbError("SUBMIT_STALE: os apontamentos mudaram")).toBe("os apontamentos mudaram");
    expect(cleanDbError("Informe a duração.")).toBe("Informe a duração.");
  });

  it("copiar semana não copia importado nem duplica nem sobrepõe", () => {
    const base = { task_id: "t", duration_seconds: 3600, status: "approved", source: "manual" };
    const plan = planWeekCopy(
      [
        {
          ...base,
          id: "a",
          entry_date: "2026-03-02",
          project_id: "p",
          start_time: "09:00",
          end_time: "10:00",
          entry_kind: "interval",
        },
        {
          ...base,
          id: "b",
          entry_date: "2026-03-03",
          project_id: "p",
          start_time: null,
          end_time: null,
          entry_kind: "duration",
        },
        {
          ...base,
          id: "c",
          entry_date: "2026-03-04",
          project_id: "p",
          start_time: "09:00",
          end_time: "10:00",
          entry_kind: null,
          source: "import",
        },
        {
          ...base,
          id: "d",
          entry_date: "2026-03-05",
          project_id: "p",
          start_time: "14:00",
          end_time: "15:00",
          entry_kind: "interval",
        },
      ],
      [
        {
          entry_date: "2026-03-09",
          project_id: "p",
          task_id: "t",
          start_time: "09:00",
          end_time: "10:00",
        },
        {
          entry_date: "2026-03-12",
          project_id: "q",
          task_id: null,
          start_time: "14:30",
          end_time: "16:00",
        },
      ],
      7,
    );
    expect(plan.copy.map((c) => [c.id, c.target_date])).toEqual([["b", "2026-03-10"]]);
    expect(plan.skipped.map((s) => s.id)).toEqual(["a", "c", "d"]);
  });
});
