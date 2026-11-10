import { describe, expect, it } from "vitest";
import { stripLegacyInvestment } from "./proposal-items-placement";
import { missingFieldsMessage } from "@/lib/contracts/template-tokens";

describe("stripLegacyInvestment", () => {
  it("retira a seção Investimento antiga com tabela e total", () => {
    const body =
      "<p>A</p><h2>Investimento</h2><p></p><table><tbody><tr><th><p>Item</p></th><th><p>Cobrança</p></th></tr></tbody></table><p><strong>Total:</strong> R$ 45.000,00</p><h3>Condições comerciais</h3>";
    expect(stripLegacyInvestment(body)).toBe("<p>A</p><h3>Condições comerciais</h3>");
  });
  it("mantém o texto sem a seção antiga", () => {
    expect(stripLegacyInvestment("<h2>Diagnóstico inicial</h2>")).toBe(
      "<h2>Diagnóstico inicial</h2>",
    );
    expect(stripLegacyInvestment(null)).toBe("");
  });
});

describe("missingFieldsMessage", () => {
  it("usa rótulos em português e orienta onde preencher", () => {
    const m = missingFieldsMessage(["contract.installments_count", "contract.governing_law"]);
    expect(m).toContain("Quantidade de parcelas");
    expect(m).toContain("Lei aplicável");
    expect(m).not.toContain("contract.installments_count");
    expect(m).toContain("passo Dados");
  });
});
