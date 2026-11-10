import { describe, expect, it } from "vitest";
import { buildPaymentSchedule, suggestPaymentTerms, validatePaymentTerms } from "./payment-terms";

const start = new Date(Date.UTC(2026, 10, 10));

describe("cronograma de pagamento", () => {
  it("outsourcing mensal: 12 mensalidades no dia escolhido", () => {
    const s = buildPaymentSchedule(
      { downPayment: { kind: "none" }, plan: { kind: "monthly", months: 12, dueDay: 10 } },
      120000,
      start,
    );
    expect(s).toHaveLength(12);
    expect(s[0]).toMatchObject({ amount: 10000, dueDate: "2026-11-10" });
    expect(s[11].dueDate).toBe("2027-10-10");
  });

  it("entrada em % + parcelas periódicas", () => {
    const s = buildPaymentSchedule(
      { downPayment: { kind: "percent", value: 30 }, plan: { kind: "periodic", count: 2, intervalMonths: 3, dueDay: 15 } },
      45000,
      start,
    );
    expect(s.map((p) => p.amount)).toEqual([13500, 15750, 15750]);
    expect(s.map((p) => p.dueDate)).toEqual(["2026-11-10", "2026-12-15", "2027-03-15"]);
  });

  it("entrada em R$ + marcos sem data", () => {
    const s = buildPaymentSchedule(
      {
        downPayment: { kind: "amount", value: 5000 },
        plan: { kind: "milestones", milestones: [{ label: "Homologação", percent: 50 }, { label: "Go-live", percent: 50 }] },
      },
      45000,
      start,
    );
    expect(s.map((p) => [p.label, p.amount, p.dueDate])).toEqual([
      ["Entrada", 5000, "2026-11-10"],
      ["Homologação", 20000, null],
      ["Go-live", 20000, null],
    ]);
  });

  it("centavos de sobra vão para a última parcela", () => {
    const s = buildPaymentSchedule(
      { downPayment: { kind: "none" }, plan: { kind: "periodic", count: 3, intervalMonths: 1, dueDay: 31 } },
      100,
      start,
    );
    expect(s.map((p) => p.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(s[0].dueDate).toBe("2026-11-30");
  });

  it("marcos precisam somar 100%", () => {
    expect(
      validatePaymentTerms(
        { downPayment: { kind: "none" }, plan: { kind: "milestones", milestones: [{ label: "A", percent: 60 }] } },
        1000,
      ),
    ).toContain("Os marcos devem somar 100% do saldo.");
  });

  it("propostas antigas: condições automáticas a partir das parcelas atuais", () => {
    expect(suggestPaymentTerms([], { installmentsCount: 1, dueDay: 15 })).toEqual({
      downPayment: { kind: "none" },
      plan: { kind: "periodic", count: 1, intervalMonths: 1, dueDay: 15 },
    });
  });

  it("sugestão por tipo de item", () => {
    expect(suggestPaymentTerms(["Outsourcing"]).plan.kind).toBe("monthly");
    expect(suggestPaymentTerms(["Consultoria"]).downPayment).toEqual({ kind: "percent", value: 30 });
  });
});
