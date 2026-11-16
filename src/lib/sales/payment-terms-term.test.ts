import { describe, expect, it } from "vitest";
import {
  buildPaymentSchedule,
  DEFAULT_CONTRACT_TERM,
  parsePaymentTerms,
  recurringTotal,
  suggestPaymentTerms,
  validatePaymentTerms,
} from "./payment-terms";

describe("PRAZO-MENSAL", () => {
  it("3 meses de R$ 22.000 dão R$ 66.000 em 3 mensalidades cheias", () => {
    const total = recurringTotal(22000, 3);
    expect(total).toBe(66000);
    const s = buildPaymentSchedule(
      { downPayment: { kind: "none" }, plan: { kind: "monthly", months: 3, dueDay: 10 } },
      total,
      new Date("2026-11-16T12:00:00Z"),
    );
    expect(s.map((p) => p.amount)).toEqual([22000, 22000, 22000]);
  });
  it("12 meses de R$ 22.000 dão R$ 264.000", () => {
    expect(recurringTotal(22000, 12)).toBe(264000);
  });
  it("padrão é 3 meses de prazo mínimo e 30 dias de aviso prévio", () => {
    expect(DEFAULT_CONTRACT_TERM).toEqual({ minimumMonths: 3, noticeDays: 30, autoRenew: true });
    const t = suggestPaymentTerms(["Outsourcing"]);
    expect(t.plan).toMatchObject({ kind: "monthly", months: 3 });
    expect(t.term).toEqual(DEFAULT_CONTRACT_TERM);
  });
  it("serviço por projeto continua sem prazo e dividindo por marcos", () => {
    const t = suggestPaymentTerms(["Consultoria"]);
    expect(t.term).toBeUndefined();
    expect(t.plan.kind).toBe("milestones");
  });
  it("prazo e mensalidade sobrevivem à gravação e aviso inválido é recusado", () => {
    const t = { ...suggestPaymentTerms(["Outsourcing"]), monthlyAmount: 22000 };
    expect(parsePaymentTerms(JSON.parse(JSON.stringify(t)))).toEqual(t);
    expect(
      validatePaymentTerms({ ...t, term: { ...DEFAULT_CONTRACT_TERM, noticeDays: 400 } }, 66000),
    ).toContain("O aviso prévio deve estar entre 0 e 365 dias.");
  });
});
