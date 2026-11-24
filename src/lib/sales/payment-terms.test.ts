import { describe, expect, it } from "vitest";
import {
  buildPaymentSchedule,
  describePaymentTerms,
  FULL_DOWN_PAYMENT_BALANCE_ERROR,
  normalizePaymentTerms,
  parsePaymentTerms,
  paymentTermsSchema,
  suggestPaymentTerms,
  validatePaymentTerms,
  type PaymentTerms,
} from "./payment-terms";

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
      {
        downPayment: { kind: "percent", value: 30 },
        plan: { kind: "periodic", count: 2, intervalMonths: 3, dueDay: 15 },
      },
      45000,
      start,
    );
    expect(s.map((p) => p.amount)).toEqual([13500, 15750, 15750]);
    expect(s.map((p) => p.dueDate)).toEqual([null, "2026-12-15", "2027-03-15"]);
  });

  it("entrada em R$ + marcos sem data", () => {
    const s = buildPaymentSchedule(
      {
        downPayment: { kind: "amount", value: 5000 },
        plan: {
          kind: "milestones",
          milestones: [
            { label: "Homologação", percent: 50 },
            { label: "Go-live", percent: 50 },
          ],
        },
      },
      45000,
      start,
    );
    expect(s.map((p) => [p.label, p.amount, p.dueDate])).toEqual([
      ["Entrada", 5000, null],
      ["Homologação", 20000, null],
      ["Go-live", 20000, null],
    ]);
  });

  it("centavos de sobra vão para a última parcela", () => {
    const s = buildPaymentSchedule(
      {
        downPayment: { kind: "none" },
        plan: { kind: "periodic", count: 3, intervalMonths: 1, dueDay: 31 },
      },
      100,
      start,
    );
    expect(s.map((p) => p.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(s[0].dueDate).toBe("2026-11-30");
  });

  it("marcos precisam somar 100%", () => {
    expect(
      validatePaymentTerms(
        {
          downPayment: { kind: "none" },
          plan: { kind: "milestones", milestones: [{ label: "A", percent: 60 }] },
        },
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
    expect(suggestPaymentTerms(["Consultoria"]).downPayment).toEqual({
      kind: "percent",
      value: 30,
    });
  });
});

describe("SALDO-DATA-FIXA", () => {
  const base = {
    downPayment: { kind: "percent", value: 50 },
    downPaymentDue: { kind: "date", date: "2026-12-07" },
  } as const;
  it("saldo vira parcela única na data escolhida", () => {
    const r = buildPaymentSchedule(
      { ...base, plan: { kind: "fixed_date", date: "2027-01-15" } },
      18870,
      new Date(),
    );
    expect(r.map((x) => [x.label, x.amount, x.dueDate])).toEqual([
      ["Entrada", 9435, "2026-12-07"],
      ["Saldo", 9435, "2027-01-15"],
    ]);
  });
  it("exige a data do saldo", () => {
    expect(
      validatePaymentTerms({ ...base, plan: { kind: "fixed_date", date: "" } }, 100),
    ).toContain("Escolha a data de vencimento do saldo.");
  });
  it("saldo não vence antes da entrada", () => {
    expect(
      validatePaymentTerms({ ...base, plan: { kind: "fixed_date", date: "2026-12-01" } }, 100),
    ).toContain("O saldo não pode vencer antes da entrada.");
  });
});

describe("entrada 100% sem saldo", () => {
  it("entrada de 100% com plan none é válida e gera apenas a parcela da entrada", () => {
    const terms: PaymentTerms = {
      downPayment: { kind: "percent", value: 100 },
      plan: { kind: "none" },
    };
    expect(validatePaymentTerms(terms, 4500)).toEqual([]);
    const schedule = buildPaymentSchedule(terms, 4500, start);
    expect(schedule).toEqual([
      { sequence: 1, label: "Entrada", amount: 4500, dueDate: null, dueEvent: "signature" },
    ]);
    expect(describePaymentTerms(terms)).toContain("sem saldo");
  });

  it("entrada de 100% recusa saldo configurado na validação e no schema", () => {
    const invalid: PaymentTerms = {
      downPayment: { kind: "percent", value: 100 },
      plan: { kind: "milestones", milestones: [{ label: "Entrega final", percent: 100 }] },
    };
    expect(validatePaymentTerms(invalid, 4500)).toContain(FULL_DOWN_PAYMENT_BALANCE_ERROR);
    expect(paymentTermsSchema.safeParse(invalid).success).toBe(false);
  });

  it("entrada em R$ igual ao total exige plan none e recusa saldo", () => {
    const invalid: PaymentTerms = {
      downPayment: { kind: "amount", value: 4500 },
      plan: { kind: "periodic", count: 2, intervalMonths: 1, dueDay: 10 },
    };
    expect(validatePaymentTerms(invalid, 4500)).toContain(FULL_DOWN_PAYMENT_BALANCE_ERROR);
    const normalized = normalizePaymentTerms(invalid, 4500);
    expect(normalized.plan).toEqual({ kind: "none" });
    expect(validatePaymentTerms(normalized, 4500)).toEqual([]);
  });

  it("entrada de 99% exige forma de saldo (recusa plan none)", () => {
    expect(
      validatePaymentTerms(
        { downPayment: { kind: "percent", value: 99 }, plan: { kind: "none" } },
        4500,
      ),
    ).toContain("Informe como o saldo será pago.");
  });

  it("leitura de registro antigo com entrada 100% e marcos normaliza para sem saldo", () => {
    const parsed = parsePaymentTerms({
      downPayment: { kind: "percent", value: 100 },
      plan: { kind: "milestones", milestones: [{ label: "Entrega final", percent: 100 }] },
    });
    expect(parsed).toEqual({
      downPayment: { kind: "percent", value: 100 },
      plan: { kind: "none" },
    });
  });
});
