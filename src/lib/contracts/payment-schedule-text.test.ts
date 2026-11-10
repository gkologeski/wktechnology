import { describe, expect, it } from "vitest";
import { paymentScheduleText } from "./payment-schedule-text";

describe("texto das condições de pagamento no contrato", () => {
  it("usa o cronograma com entrada de 30% na assinatura e marco", () => {
    const terms = {
      downPayment: { kind: "percent", value: 30 },
      downPaymentDue: { kind: "signature" },
      plan: { kind: "milestones", milestones: [{ label: "Entrega final", percent: 100 }] },
    };
    expect(paymentScheduleText(terms, 45000, null, null)).toBe(
      "entrada de 30% do total (vence na assinatura do contrato) · 1 marco de entrega",
    );
  });
  it("sem cronograma, usa parcelas e dia de vencimento", () => {
    expect(paymentScheduleText({}, 45000, 3, 15)).toBe("3 parcela(s), com vencimento todo dia 15");
  });
  it("sem nada preenchido, fica vazio para o modelo pedir o dado", () => {
    expect(paymentScheduleText({}, 45000, null, null)).toBeNull();
  });
});
