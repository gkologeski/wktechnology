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
  it("prestação: [PRESTAÇÃO] contratante x contratada", () => {
    expect(
      buildContractTitle({
        role: "provider",
        serviceType: "outsourcing",
        contractingName: "Gralha Imóveis Ltda",
        ownName: "WK Technology Ltda",
      }),
    ).toBe("[PRESTAÇÃO] GRALHA IMÓVEIS X WK TECHNOLOGY");
  });

  it("compra: prefixo [COMPRA]", () => {
    expect(
      buildContractTitle({
        role: "client",
        ownName: "WK Technology Ltda",
        counterpartyName: "Fornecedor Alpha ME",
      }),
    ).toBe("[COMPRA] WK TECHNOLOGY X FORNECEDOR ALPHA");
  });

  it("aditivo recebe prefixo [ADITIVO] com número", () => {
    expect(
      buildContractTitle({
        role: "provider",
        documentKind: "amendment",
        amendmentNumber: "1",
        contractingName: "Gralha Imóveis",
        ownName: "WK Technology",
      }),
    ).toBe("[ADITIVO 1] [PRESTAÇÃO] GRALHA IMÓVEIS X WK TECHNOLOGY");
  });

  it("ignora o tipo de serviço no prefixo", () => {
    expect(
      buildContractTitle({
        role: "provider",
        serviceType: "consultoria",
        contractingName: "Cliente Beta",
        ownName: "WK Technology",
      }),
    ).toBe("[PRESTAÇÃO] CLIENTE BETA X WK TECHNOLOGY");
  });

  it("acrescenta o ano da vigência por padrão", () => {
    expect(
      buildContractTitle({
        role: "provider",
        contractingName: "Cliente Beta",
        ownName: "WK Technology",
        startsAt: "2026-03-01",
      }),
    ).toBe("[PRESTAÇÃO] CLIENTE BETA X WK TECHNOLOGY — 2026");
  });

  it("omite o ano quando includeYear é false", () => {
    expect(
      buildContractTitle({
        role: "provider",
        contractingName: "Cliente Beta",
        ownName: "WK Technology",
        startsAt: "2026-03-01",
        includeYear: false,
      }),
    ).toBe("[PRESTAÇÃO] CLIENTE BETA X WK TECHNOLOGY");
  });




  it("retorna null quando falta uma das partes", () => {
    expect(buildContractTitle({ role: "provider", contractingName: "Cliente Beta" })).toBeNull();
    expect(buildContractTitle({ role: "client" })).toBeNull();
  });
});
