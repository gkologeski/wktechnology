import { afterEach, describe, expect, it } from "vitest";
import { formatIsoDate, isDayWithin, isValidIsoDate, parseIsoDate, todayIsoDate } from "./iso-date";
import {
  SINGLE_PRESETS,
  getSinglePresetDate,
  isSinglePresetAllowed,
  presetForDate,
} from "./date-single-presets";
import { activityDatePart, activityTimePart, fromLocalDateTimeValue } from "./activity-date-time";

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const ZONES = [
  "America/Sao_Paulo", // UTC-3
  "America/Noronha", // UTC-2
  "America/New_York", // UTC-5/-4 (DST)
  "UTC",
  "Europe/Lisbon", // UTC+0/+1 (DST)
  "Asia/Tokyo", // UTC+9
  "Pacific/Kiritimati", // UTC+14
];

describe("parseIsoDate/formatIsoDate — o dia não muda com o fuso", () => {
  for (const tz of ZONES) {
    it(`ida e volta em ${tz}`, () => {
      process.env.TZ = tz;
      for (const v of ["2026-01-01", "2026-10-23", "2026-12-31", "2024-02-29", "1950-07-15"]) {
        const d = parseIsoDate(v)!;
        expect(d.getDate()).toBe(Number(v.slice(8)));
        expect(formatIsoDate(d)).toBe(v);
      }
    });
  }

  it("dia de início do horário de verão (meia-noite inexistente) continua o mesmo dia", () => {
    process.env.TZ = "America/Sao_Paulo";
    expect(formatIsoDate(parseIsoDate("2018-11-04")!)).toBe("2018-11-04");
    process.env.TZ = "America/New_York";
    expect(formatIsoDate(parseIsoDate("2026-03-08")!)).toBe("2026-03-08");
    expect(formatIsoDate(parseIsoDate("2026-11-01")!)).toBe("2026-11-01");
  });

  it("à noite em UTC-3 'hoje' é o dia local, não o dia UTC", () => {
    process.env.TZ = "America/Sao_Paulo";
    const late = new Date(2026, 9, 22, 23, 30); // 22/10 23:30 BRT = 23/10 02:30 UTC
    expect(late.toISOString().slice(0, 10)).toBe("2026-10-23"); // o erro antigo
    expect(todayIsoDate(late)).toBe("2026-10-22");
  });
});

describe("parseIsoDate — datas impossíveis e formatos", () => {
  it("bissexto: 29/02 só em ano bissexto", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2000-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("1900-02-29")).toBe(false);
  });
  it("não normaliza 31/02, 31/04, mês 13 ou dia 00 para outro dia", () => {
    for (const v of [
      "2026-02-31",
      "2026-04-31",
      "2026-13-01",
      "2026-00-10",
      "2026-10-00",
      "2026-10-32",
    ])
      expect(parseIsoDate(v)).toBeNull();
  });
  it("vazio, texto e data-hora não viram dia", () => {
    for (const v of [null, undefined, "", "23/10/2026", "2026-1-5", "2026-10-23T03:00:00Z", "abc"])
      expect(parseIsoDate(v as string | null)).toBeNull();
  });
});

describe("atalhos da skill date-picker-br", () => {
  const now = new Date(2026, 9, 23, 15, 0);
  it("ordem: Personalizado → Ontem → Hoje → Amanhã", () => {
    expect(SINGLE_PRESETS.map((p) => p.label)).toEqual([
      "Personalizado",
      "Ontem",
      "Hoje",
      "Amanhã",
    ]);
  });
  it("Personalizado não tem data (não altera o valor)", () => {
    expect(getSinglePresetDate("custom", now)).toBeNull();
  });
  it("Ontem/Hoje/Amanhã no início do dia", () => {
    expect(formatIsoDate(getSinglePresetDate("yesterday", now)!)).toBe("2026-10-22");
    expect(getSinglePresetDate("today", now)!.getHours()).toBe(0);
    expect(formatIsoDate(getSinglePresetDate("tomorrow", now)!)).toBe("2026-10-24");
    expect(presetForDate(new Date(2026, 9, 24, 18), now)).toBe("tomorrow");
  });
  it("atalhos respeitam min/max do campo", () => {
    const min = new Date(2026, 9, 23);
    expect(isSinglePresetAllowed("yesterday", { min }, now)).toBe(false);
    expect(isSinglePresetAllowed("today", { min }, now)).toBe(true);
    expect(isSinglePresetAllowed("tomorrow", { max: new Date(2026, 9, 23) }, now)).toBe(false);
    expect(isSinglePresetAllowed("custom", { min, max: min }, now)).toBe(true);
  });
  it("limites inclusivos comparam só o dia", () => {
    const d = new Date(2026, 9, 23, 23, 59);
    expect(isDayWithin(d, { min: new Date(2026, 9, 23, 12), max: new Date(2026, 9, 23) })).toBe(
      true,
    );
    expect(isDayWithin(d, { max: new Date(2026, 9, 22) })).toBe(false);
  });
});

describe("data-hora preserva a hora ao trocar o dia", () => {
  it("valor local mantém hora e minutos fora da grade de 15 min", () => {
    process.env.TZ = "America/Sao_Paulo";
    const v = "2026-10-23T10:07";
    expect(activityTimePart(v)).toBe("10:07");
    expect(activityDatePart(v)).toBe("2026-10-23");
  });
  it("valor ISO é lido no fuso local e volta como o mesmo instante", () => {
    process.env.TZ = "America/Sao_Paulo";
    const iso = "2026-10-23T01:30:00.000Z"; // 22/10 22:30 em BRT
    expect(activityDatePart(iso)).toBe("2026-10-22");
    expect(activityTimePart(iso)).toBe("22:30");
    expect(fromLocalDateTimeValue("2026-10-22T22:30", "iso")).toBe(iso);
  });
});
