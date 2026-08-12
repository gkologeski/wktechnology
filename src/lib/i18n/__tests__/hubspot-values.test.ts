import { describe, expect, it } from "vitest";
import { humanizeCode, translateFieldValue, translateOptions } from "../hubspot-values";

describe("translateFieldValue", () => {
  it("traduz setores conhecidos", () => {
    expect(translateFieldValue("industry", "COMPUTER_SOFTWARE")).toBe("Software de Computador");
    expect(translateFieldValue("industry", "INFORMATION_TECHNOLOGY_AND_SERVICES")).toBe(
      "Tecnologia da Informação e Serviços",
    );
  });

  it("traduz ciclo de vida, status e origem", () => {
    expect(translateFieldValue("lifecyclestage", "lead")).toBe("Lead");
    expect(translateFieldValue("hs_lead_status", "NEW")).toBe("Novo");
    expect(translateFieldValue("marketing_status", "non-marketing")).toBe(
      "Não é contato de marketing",
    );
    expect(translateFieldValue("source", "OFFLINE")).toBe("Offline");
  });

  it("mantém valores já em português e textos livres", () => {
    expect(translateFieldValue("type", "Concorrente")).toBe("Concorrente");
    expect(translateFieldValue("source", "Prospecção da IA")).toBe("Prospecção da IA");
  });

  it("mantém IDs numéricos de estágio customizado", () => {
    expect(translateFieldValue("lifecyclestage", "237031492")).toBe("237031492");
  });

  it("humaniza códigos desconhecidos de campos mapeados", () => {
    expect(translateFieldValue("industry", "SOME_NEW_SECTOR")).toBe("Some New Sector");
  });

  it("não altera campos fora do dicionário", () => {
    expect(translateFieldValue("name", "ACME_LTDA")).toBe("ACME_LTDA");
  });

  it("trata vazios", () => {
    expect(translateFieldValue("industry", null)).toBe("");
    expect(translateFieldValue("industry", "  ")).toBe("");
  });

  it("humanizeCode capitaliza palavras", () => {
    expect(humanizeCode("COMPUTER_SOFTWARE")).toBe("Computer Software");
  });

  it("translateOptions preserva os valores originais", () => {
    expect(translateOptions("industry", [{ value: "RETAIL" }])).toEqual([
      { value: "RETAIL", label: "Varejo" },
    ]);
  });
});
