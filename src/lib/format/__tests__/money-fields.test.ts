import { describe, expect, it } from "vitest";
import { formatMoney, isMoneyField, resolveCurrency } from "@/lib/format/money-fields";

describe("isMoneyField", () => {
  it("reconhece campos monetários comuns", () => {
    for (const k of [
      "value",
      "amount",
      "budget",
      "total_value",
      "monthly_value",
      "salary_amount",
      "unit_price",
      "hourly_rate",
      "mrr",
      "estimated_cost",
      "annualrevenue",
      "hs_arr",
      "hs_acv",
      "dealamount",
      "totalrevenue",
    ]) {
      expect(isMoneyField(k), k).toBe(true);
    }
  });

  it("não confunde percentuais, dias, contagens e taxas", () => {
    for (const k of [
      "late_fee_percent",
      "penalty_percent",
      "payment_day",
      "notice_days",
      "confidentiality_term_months",
      "hours_per_month",
      "import_confidence",
      "score",
      "quantity",
      "currency",
      "win_rate",
      "exchange_rate",
      "first_name",
      "total_score",
      "total_cycles",
    ]) {
      expect(isMoneyField(k), k).toBe(false);
    }
  });
});

describe("formatMoney", () => {
  it("formata em BRL por padrão", () => {
    expect(formatMoney(1500)?.replace(/\u00a0/g, " ")).toBe("R$ 1.500,00");
  });
  it("aceita string numérica", () => {
    expect(formatMoney("1500.5")).toBeTruthy();
  });
  it("retorna null para valores inválidos ou vazios", () => {
    expect(formatMoney(null)).toBeNull();
    expect(formatMoney("")).toBeNull();
    expect(formatMoney("abc")).toBeNull();
  });
});

describe("resolveCurrency", () => {
  it("usa a moeda do registro quando válida", () => {
    expect(resolveCurrency({ currency: "usd" })).toBe("USD");
  });
  it("cai para BRL", () => {
    expect(resolveCurrency({})).toBe("BRL");
    expect(resolveCurrency({ currency: "reais" })).toBe("BRL");
  });
});
