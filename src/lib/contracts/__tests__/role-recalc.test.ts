import { describe, expect, it } from "vitest";
import { inferRoleFromParties, type ContractLinkMeta } from "@/lib/contracts/link-suggest";

const own = [{ cnpjDigits: "12345678000190", name: "CW Kologeski Ltda", tradeName: null }];

function meta(over: Partial<ContractLinkMeta>): ContractLinkMeta {
  return {
    id: "c1",
    role: "client",
    document_kind: "main",
    number: null,
    self_number: null,
    title: "Contrato",
    company_name: null,
    contracting_name: null,
    contracting_cnpj: null,
    counterparty_name: null,
    counterparty_cnpj: null,
    starts_at: null,
    ends_at: null,
    ...over,
  };
}

// Regra usada na importação e no recálculo em lote: o papel vem das nossas empresas.
function resolveRole(m: ContractLinkMeta): "provider" | "client" {
  return inferRoleFromParties(m, own) ?? m.role;
}

describe("papel derivado das empresas do workspace", () => {
  it("sobrepõe o papel extraído quando somos a CONTRATADA", () => {
    const m = meta({
      role: "client",
      contracting_name: "CITEL",
      contracting_cnpj: "51.212.892/0001-25",
      counterparty_name: "CW KOLOGESKI LTDA",
      counterparty_cnpj: "12.345.678/0001-90",
    });
    expect(resolveRole(m)).toBe("provider");
  });

  it("sobrepõe o papel extraído quando somos a CONTRATANTE", () => {
    const m = meta({
      role: "provider",
      contracting_name: "CW KOLOGESKI LTDA",
      counterparty_name: "Fornecedor XPTO",
    });
    expect(resolveRole(m)).toBe("client");
  });

  it("mantém o papel extraído quando nenhuma parte é nossa", () => {
    const m = meta({
      role: "client",
      contracting_name: "CITEL",
      counterparty_name: "Gralha Imóveis",
    });
    expect(inferRoleFromParties(m, own)).toBeNull();
    expect(resolveRole(m)).toBe("client");
  });

  it("mantém o papel extraído quando os dois lados casam com o workspace", () => {
    const m = meta({
      role: "provider",
      contracting_name: "CW KOLOGESKI LTDA",
      counterparty_name: "CW Kologeski",
    });
    expect(inferRoleFromParties(m, own)).toBeNull();
    expect(resolveRole(m)).toBe("provider");
  });

  it("casa por CNPJ mesmo sem nome extraído", () => {
    const m = meta({
      role: "client",
      contracting_cnpj: "51212892000125",
      counterparty_cnpj: "12345678000190",
    });
    expect(resolveRole(m)).toBe("provider");
  });
});
