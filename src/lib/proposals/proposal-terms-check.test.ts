import { describe, expect, it } from "vitest";
import { missingPaymentTerms, missingPaymentTermsMessage } from "./proposal-terms-check";

describe("missingPaymentTerms", () => {
  it("exige parcelas e dia de vencimento", () => {
    expect(missingPaymentTerms({ installments: null, dueDay: null })).toEqual([
      "Parcelas",
      "Dia de vencimento",
    ]);
  });
  it("aceita 1 parcela no dia 15", () => {
    expect(missingPaymentTermsMessage({ installments: 1, dueDay: 15 })).toBeNull();
  });
  it("rejeita dia 32", () => {
    expect(missingPaymentTerms({ installments: 1, dueDay: 32 })).toEqual(["Dia de vencimento"]);
  });
});
