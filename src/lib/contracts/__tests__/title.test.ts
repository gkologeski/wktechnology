import { describe, expect, it } from "vitest";
import {
  buildContractTitle,
  buildContractTitleResult,
  normalizePartyName,
} from "@/lib/contracts/title";

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

describe("buildContractTitle com entidades legais do workspace", () => {
  const ownNames = ["GM Kologeski & Cia Ltda ME", "WK Technology", "CW Kologeski Ltda"];

  it("corrige lados invertidos usando os nomes próprios (prestação)", () => {
    expect(
      buildContractTitle({
        role: "provider",
        contractingName: "GM KOLOGESKI & CIA LTDA",
        counterpartyName: "ICT SOLUÇÕES INTELIGENTES LTDA",
        ownName: "GM Kologeski & Cia Ltda ME",
        ownNames,
        startsAt: "2026-02-09",
      }),
    ).toBe("[PRESTAÇÃO] ICT SOLUÇÕES INTELIGENTES X GM KOLOGESKI — 2026");
  });

  it("mantém nosso lado como CONTRATANTE em contratos de compra", () => {
    expect(
      buildContractTitle({
        role: "client",
        contractingName: "ALEX MONTEIRO DE CASTRO SILVA",
        counterpartyName: "WK Technology",
        ownNames,
      }),
    ).toBe("[COMPRA] WK TECHNOLOGY X ALEX MONTEIRO DE CASTRO SILVA");
  });
});

describe("buildContractTitleResult", () => {
  it("informa quando faltam partes", () => {
    expect(buildContractTitleResult({ role: "client" })).toEqual({
      title: null,
      reason: "missing_parties",
    });
  });

  it("informa quando as partes ficam iguais", () => {
    expect(
      buildContractTitleResult({
        role: "provider",
        contractingName: "WK Technology Ltda",
        ownName: "WK Technology",
      }),
    ).toEqual({ title: null, reason: "same_parties" });
  });
});
