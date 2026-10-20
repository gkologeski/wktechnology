import { describe, expect, it } from "vitest";
import {
  actionNeedsNote,
  formatSeconds,
  isApprovedHoursStatus,
  isIanaTimeZone,
  monthRangeInTimeZone,
  toCsv,
  validateIsoRange,
} from "./reconciliation-labels";

describe("período do painel", () => {
  it("recusa data inicial depois da final", () => {
    expect(validateIsoRange("2026-02-01", "2026-01-31")).not.toBeNull();
  });
  it("aceita o mesmo dia", () => {
    expect(validateIsoRange("2026-02-01", "2026-02-01")).toBeNull();
  });
  it("recusa mais de 10 anos", () => {
    expect(validateIsoRange("2010-01-01", "2026-01-01")).not.toBeNull();
  });
  it("mês padrão segue o fuso: 31/10 23:30 UTC é outubro em São Paulo e novembro em Tóquio", () => {
    const now = new Date("2026-10-31T23:30:00Z");
    expect(monthRangeInTimeZone(now, "America/Sao_Paulo")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(monthRangeInTimeZone(now, "Asia/Tokyo")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });
  it("fuso inválido é recusado", () => {
    expect(isIanaTimeZone("Mars/Olympus")).toBe(false);
    expect(isIanaTimeZone("America/Sao_Paulo")).toBe(true);
  });
});

describe("horas", () => {
  it("segundos exatos sem arredondar para minutos", () => {
    expect(formatSeconds(3601)).toBe("1:00:01");
  });
  it("importado bloqueado não conta como aprovado", () => {
    expect(isApprovedHoursStatus("locked_import")).toBe(false);
    expect(isApprovedHoursStatus("locked")).toBe(false);
  });
});

describe("fila de revisão", () => {
  it("confirmar e descartar exigem justificativa; adiar não", () => {
    expect(actionNeedsNote("confirm")).toBe(true);
    expect(actionNeedsNote("dismiss")).toBe(true);
    expect(actionNeedsNote("defer")).toBe(false);
  });
});

describe("exportação", () => {
  it("escapa separador, aspas e quebra de linha", () => {
    expect(toCsv(["a"], [['x;"y"\nz']])).toBe('a\r\n"x;""y""\nz"');
  });
});
