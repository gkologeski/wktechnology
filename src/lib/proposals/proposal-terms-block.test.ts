import { describe, expect, it } from "vitest";
import {
  countPlaceholders,
  installmentValue,
  missingTerms,
  renderTermsBlock,
  upsertTermsBlock,
} from "./proposal-terms-block";

const base = {
  total: 45000,
  currency: "BRL",
  installments: 3,
  dueDay: 10,
  validityDays: 90,
  paymentMethod: "pix" as const,
  paymentNotes: null,
};

describe("bloco de condições comerciais", () => {
  it("3 parcelas de R$45.000 dão R$15.000 cada", () => {
    expect(installmentValue(45000, 3)).toBe(15000);
    const html = renderTermsBlock(base);
    expect(html).toContain("3x de R$\u00a015.000,00");
    expect(html).toContain("todo dia 10");
    expect(html).toContain("90 dias");
    expect(html).toContain("PIX");
  });

  it("aponta condições faltantes", () => {
    expect(missingTerms({ ...base, paymentMethod: null, installments: null })).toEqual([
      "forma de pagamento",
      "parcelas",
    ]);
  });

  it("atualiza só o bloco marcado", () => {
    const html = `<p>Antes</p>${renderTermsBlock(base)}<p>Depois</p>`;
    const out = upsertTermsBlock(html, { ...base, installments: 5 });
    expect(out).toContain("<p>Antes</p>");
    expect(out).toContain("<p>Depois</p>");
    expect(out).toContain("5x de");
    expect(out).not.toContain("3x de");
  });

  it("conta trechos [Escreva aqui]", () => {
    expect(countPlaceholders("<p>[Escreva aqui sobre X]</p><p>[Escreva aqui]</p>")).toBe(2);
  });
});
