import { describe, expect, it } from "vitest";
import { payablesProblem, proposePurchasePayables } from "./purchase-payables";

describe("contas a pagar da compra", () => {
  it("sem condições propõe parcela única na data da assinatura", () => {
    const r = proposePurchasePayables(
      {
        total_value: 12000,
        payment_terms: null,
        signed_at: "2026-11-20T10:00:00Z",
        starts_at: null,
      },
      "2026-11-23",
    );
    expect(r).toEqual([{ label: "Parcela única", amount: 12000, due_on: "2026-11-20" }]);
  });
  it("segue as condições de pagamento do contrato e fecha o total", () => {
    const r = proposePurchasePayables(
      {
        total_value: 9000,
        payment_terms: {
          downPayment: { kind: "none" },
          plan: { kind: "monthly", months: 3, dueDay: 10 },
        },
        signed_at: "2026-11-20T10:00:00Z",
        starts_at: null,
      },
      "2026-11-23",
    );
    expect(r).toHaveLength(3);
    expect(r.reduce((s, x) => s + x.amount, 0)).toBe(9000);
    expect(payablesProblem(9000, r)).toBeNull();
  });
  it("bloqueia soma diferente do valor do contrato", () => {
    expect(payablesProblem(100, [{ label: "a", amount: 99.99, due_on: "2026-12-01" }])).toMatch(
      /soma/,
    );
  });
  it("sem valor total não propõe nada", () => {
    expect(
      proposePurchasePayables(
        { total_value: null, payment_terms: null, signed_at: null, starts_at: null },
        "2026-11-23",
      ),
    ).toEqual([]);
  });
});
