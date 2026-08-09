import { describe, expect, it } from "vitest";
import { formatCnpj, isValidCnpj, onlyDigits } from "@/lib/cnpj";

describe("onlyDigits", () => {
  it("remove máscara", () => {
    expect(onlyDigits("45.009.766/0001-75")).toBe("45009766000175");
    expect(onlyDigits(null)).toBe("");
  });
});

describe("formatCnpj", () => {
  it("formata completo", () => {
    expect(formatCnpj("45009766000175")).toBe("45.009.766/0001-75");
  });
  it("formata parcial durante a digitação", () => {
    expect(formatCnpj("450")).toBe("45.0");
    expect(formatCnpj("450097660")).toBe("45.009.766/0");
  });
  it("ignora excesso de dígitos e vazio", () => {
    expect(formatCnpj("450097660001759999")).toBe("45.009.766/0001-75");
    expect(formatCnpj("")).toBe("");
  });
});

describe("isValidCnpj", () => {
  it("aceita CNPJs válidos", () => {
    expect(isValidCnpj("45.009.766/0001-75")).toBe(true);
    expect(isValidCnpj("19133530000136")).toBe(true);
    expect(isValidCnpj("42296945000142")).toBe(true);
  });
  it("recusa dígito verificador errado", () => {
    expect(isValidCnpj("45009766000174")).toBe(false);
  });
  it("recusa tamanho inválido e repetições", () => {
    expect(isValidCnpj("4500976600017")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj(null)).toBe(false);
  });
});
