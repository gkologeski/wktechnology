import { describe, expect, it } from "vitest";
import { buildContractTitle, normalizePartyName } from "@/lib/contracts/title";

describe("normalizePartyName", () => {
  it("remove sufixos societários e normaliza", () => {
    expect(normalizePartyName(" Gralha Imóveis Ltda. ")).toBe("GRALHA IMÓVEIS");
    expect(normalizePartyName("WK Technology S/A")).toBe("WK TECHNOLOGY");
  });

  it("trunca nomes muito longos sem cortar no meio da palavra", () => {
    const out = normalizePartyName("Companhia Brasileira de Desenvolvimento e Integração Digital");
    expect(out && out.length).toBeLessThanOrEqual(40);
  });

  it("retorna null para vazio", () => {
    expect(normalizePartyName("")).toBeNull();
    expect(normalizePartyName(null)).toBeNull();
  });
});

describe("buildContractTitle", () => {
  it("prestação: CPS contratante x contratada", () => {
    expect(
      buildContractTitle({
        role: "provider",
        serviceType: "outsourcing",
        contractingName: "Gralha Imóveis Ltda",
        ownName: "WK Technology Ltda",
      }),
    ).toBe("CPS GRALHA IMÓVEIS X WK TECHNOLOGY");
  });

  it("compra: prefixo CC", () => {
    expect(
      buildContractTitle({
        role: "client",
        ownName: "WK Technology Ltda",
        counterpartyName: "Fornecedor Alpha ME",
      }),
    ).toBe("CC WK TECHNOLOGY X FORNECEDOR ALPHA");
  });

  it("aditivo recebe prefixo ADT com número", () => {
    expect(
      buildContractTitle({
        role: "provider",
        documentKind: "amendment",
        amendmentNumber: "1",
        contractingName: "Gralha Imóveis",
        ownName: "WK Technology",
      }),
    ).toBe("ADT 1 CPS GRALHA IMÓVEIS X WK TECHNOLOGY");
  });

  it("usa prefixo por tipo de serviço", () => {
    expect(
      buildContractTitle({
        role: "provider",
        serviceType: "consultoria",
        contractingName: "Cliente Beta",
        ownName: "WK Technology",
      }),
    ).toBe("CCO CLIENTE BETA X WK TECHNOLOGY");
  });

  it("acrescenta o ano quando solicitado", () => {
    expect(
      buildContractTitle({
        role: "provider",
        contractingName: "Cliente Beta",
        ownName: "WK Technology",
        startsAt: "2026-03-01",
        includeYear: true,
      }),
    ).toBe("CPS CLIENTE BETA X WK TECHNOLOGY — 2026");
  });

  it("retorna null quando falta uma das partes", () => {
    expect(buildContractTitle({ role: "provider", contractingName: "Cliente Beta" })).toBeNull();
    expect(buildContractTitle({ role: "client" })).toBeNull();
  });
});
