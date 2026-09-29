// Fixa a lista oficial de módulos do produto para evitar que ids legados
// (ex.: `services` / "TechServices") voltem a ser tratados como módulo.
import { describe, expect, it } from "vitest";
import {
  LEGACY_MODULE_IDS,
  MODULES,
  MODULE_LIST,
  VERTICAL_MODULE_IDS,
  VERTICAL_MODULE_LIST,
  isLegacyModuleId,
} from "./registry";

describe("registro de módulos", () => {
  it("expõe exatamente os seis módulos verticais, na ordem de exibição", () => {
    expect(VERTICAL_MODULE_IDS).toEqual([
      "crm",
      "ats",
      "people",
      "contracts",
      "projects",
      "finance",
    ]);
    expect(VERTICAL_MODULE_LIST.map((m) => m.productName)).toEqual([
      "TechSales",
      "TechHire",
      "TechPeople",
      "TechContracts",
      "TechProjects",
      "TechFinance",
    ]);
  });

  it("não expõe nenhum módulo de atendimento/serviços ao usuário", () => {
    for (const m of VERTICAL_MODULE_LIST) {
      expect(m.productName).not.toMatch(/TechService/i);
    }
  });

  it("trata `services` como legado e o mantém fora da lista de módulos", () => {
    expect(LEGACY_MODULE_IDS).toEqual(["services"]);
    expect(isLegacyModuleId("services")).toBe(true);
    expect(isLegacyModuleId("contracts")).toBe(false);
    expect(VERTICAL_MODULE_IDS).not.toContain("services");
  });

  it("mantém `services` resolvível para compatibilidade com o banco", () => {
    expect(MODULES.services).toBeDefined();
    expect(MODULE_LIST).toHaveLength(VERTICAL_MODULE_LIST.length + LEGACY_MODULE_IDS.length);
  });
});
