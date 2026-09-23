import { describe, expect, it } from "vitest";

import { formatLineItemIdentity, formatLineItemQuantity } from "./line-item-display";

describe("formatLineItemIdentity", () => {
  it("preserva o título digitado, quantidade e preset", () => {
    expect(
      formatLineItemIdentity({
        name: "Título livre",
        service_name: "Outsourcing de TI",
        preset_name: "Desenvolvedor Java Sr",
        quantity: 1,
      }),
    ).toBe("Título livre x1 (Desenvolvedor Java Sr)");
  });

  it("usa o serviço do catálogo quando não há título digitado", () => {
    expect(formatLineItemIdentity({ service_name: "Outsourcing de TI", quantity: 1 })).toBe(
      "Outsourcing de TI x1",
    );
  });

  it("omite os parênteses quando não há preset", () => {
    expect(formatLineItemIdentity({ service_name: "Fábrica de Software", quantity: 244 })).toBe(
      "Fábrica de Software x244",
    );
  });

  it("usa o título do item quando não há serviço vinculado", () => {
    expect(formatLineItemIdentity({ name: "Item avulso", quantity: 2 })).toBe("Item avulso x2");
  });

  it("normaliza quantidade decimal em pt-BR", () => {
    expect(formatLineItemQuantity(1.5)).toBe("1,5");
  });

  it("usa fallbacks para campos vazios", () => {
    expect(formatLineItemIdentity({ name: " ", preset_name: " ", quantity: null })).toBe(
      "Serviço x0",
    );
  });
});
