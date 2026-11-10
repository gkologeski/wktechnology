import { describe, expect, it } from "vitest";
import { activationSchedule } from "./activation-terms";
import { buildPaymentSchedule, describePaymentTerms } from "@/lib/sales/payment-terms";

const consult = {
  downPayment: { kind: "amount", value: 5000 },
  plan: { kind: "milestones", milestones: [{ label: "Ao final do consumo de horas", percent: 100 }] },
};

describe("vencimento da entrada", () => {
  it("padrão é a assinatura do contrato, sem data antes de assinar", () => {
    const s = buildPaymentSchedule(consult as never, 18870, new Date("2026-11-10T12:00:00Z"));
    expect(s[0]).toMatchObject({ label: "Entrada", amount: 5000, dueDate: null, dueEvent: "signature" });
  });
  it("usa a data da assinatura quando o contrato já foi assinado", () => {
    const s = buildPaymentSchedule(consult as never, 18870, new Date("2026-11-10T12:00:00Z"), {
      signedAt: "2026-11-12T15:00:00Z",
    });
    expect(s[0]!.dueDate).toBe("2026-11-12");
  });
  it("usa a data escolhida", () => {
    const t = { ...consult, downPaymentDue: { kind: "date", date: "2026-12-01" } };
    expect(buildPaymentSchedule(t as never, 18870, new Date())[0]!.dueDate).toBe("2026-12-01");
    expect(describePaymentTerms(t as never)).toContain("vence em 01/12/2026");
  });
  it("exige a data quando escolhido vencer em uma data", () => {
    const t = { ...consult, downPaymentDue: { kind: "date", date: "" } };
    expect(() => buildPaymentSchedule(t as never, 18870, new Date())).toThrow(/data de vencimento da entrada/);
  });
});

describe("cronograma na ativação do serviço", () => {
  it("soma exatamente o valor do contrato", () => {
    const s = activationSchedule(consult, 18870, "2026-11-10", null)!;
    expect(s.map((x) => x.amount)).toEqual([5000, 13870]);
    expect(s[1]!.dueEvent).toBe("milestone");
  });
  it("sem condições válidas não gera cronograma (serviço cobra como antes)", () => {
    expect(activationSchedule({}, 18870, "2026-11-10", null)).toBeNull();
    expect(activationSchedule(consult, null, "2026-11-10", null)).toBeNull();
  });
  it("mensal começa no mês seguinte à ativação quando há entrada", () => {
    const t = {
      downPayment: { kind: "percent", value: 10 },
      downPaymentDue: { kind: "date", date: "2026-11-10" },
      plan: { kind: "monthly", months: 2, dueDay: 10 },
    };
    const s = activationSchedule(t, 1000, "2026-11-10", null)!;
    expect(s.map((x) => [x.amount, x.dueDate])).toEqual([
      [100, "2026-11-10"],
      [450, "2026-12-10"],
      [450, "2027-01-10"],
    ]);
  });
});
