import { describe, expect, it } from "vitest";
import { bodyHasItemsTable } from "./proposal-items-placement";
import { missingFieldsMessage } from "@/lib/contracts/template-tokens";

describe("bodyHasItemsTable", () => {
  it("detecta a tabela de itens já presente no texto", () => {
    expect(
      bodyHasItemsTable("<table><thead><tr><th>Item</th><th>Cobrança</th></tr></thead></table>"),
    ).toBe(true);
  });
  it("texto sem tabela mostra a tabela final", () => {
    expect(bodyHasItemsTable("<h2>Diagnóstico inicial</h2>")).toBe(false);
    expect(bodyHasItemsTable(null)).toBe(false);
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
