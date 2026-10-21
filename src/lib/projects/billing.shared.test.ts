import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatPct,
  hoursToSeconds,
  issueLabel,
  monthBounds,
  monthRangeBounds,
  parseMoneyInput,
  toCsv,
} from "./billing.shared";

describe("billing.shared", () => {
  it("competência mensal usa o último dia real do mês (inclusive fevereiro bissexto)", () => {
    expect(monthBounds("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthBounds("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
    expect(() => monthBounds("2026-13")).toThrow();
  });

  it("rentabilidade aceita até 12 meses completos e recusa ordem invertida", () => {
    expect(monthRangeBounds("2026-01", "2026-12")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(() => monthRangeBounds("2026-01", "2027-01")).toThrow("12 meses");
    expect(() => monthRangeBounds("2026-05", "2026-04")).toThrow();
  });

  it("valor ausente é desconhecido, nunca zero; zero explícito é exibido", () => {
    expect(formatMoney(null, "BRL")).toBe("desconhecido");
    expect(formatMoney(undefined, "BRL")).toBe("desconhecido");
    expect(formatMoney(0, "BRL")).toMatch(/0,00/);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("0")).toBe(0);
  });

  it("percentual nulo (receita zero) é não aplicável, sem divisão por zero", () => {
    expect(formatPct(null)).toBe("n/a");
    expect(formatPct(-12.5)).toBe("-12,5%");
  });

  it("entrada monetária pt-BR preserva casas e recusa texto", () => {
    expect(parseMoneyInput("1.234,56")).toBe(1234.56);
    expect(parseMoneyInput("150.123456")).toBe(150.123456);
    expect(() => parseMoneyInput("12abc")).toThrow();
  });

  it("horas digitadas viram segundos exatos", () => {
    expect(hoursToSeconds("40")).toBe(144000);
    expect(hoursToSeconds("1:30")).toBe(5400);
    expect(hoursToSeconds("0,5")).toBe(1800);
    expect(() => hoursToSeconds("0")).toThrow();
  });

  it("códigos de exclusão têm rótulo em português", () => {
    expect(issueLabel("excluded:imported_locked")).toMatch(/Importadas/);
    expect(issueLabel("rate_missing")).toMatch(/desconhecido/);
  });

  it("CSV usa ; e escapa aspas/quebras só com as colunas pedidas", () => {
    const csv = toCsv(
      [{ a: 'x;"y"', b: 2, secret: "não exportar" }],
      [
        ["a", "A"],
        ["b", "B"],
      ],
    );
    expect(csv).toBe('A;B\n"x;""y""";2');
    expect(csv).not.toContain("não exportar");
  });
});
