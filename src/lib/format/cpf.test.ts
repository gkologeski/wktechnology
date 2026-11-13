import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpf } from "./cpf";

describe("cpf", () => {
  it("aceita CPF válido e formata", () => {
    expect(isValidCpf("16877338804")).toBe(true);
    expect(formatCpf("16877338804")).toBe("168.773.388-04");
  });
  it("recusa dígito verificador errado e repetidos", () => {
    expect(isValidCpf("168.773.388-05")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
});
