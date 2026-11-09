import { describe, expect, it } from "vitest";
import {
  DEFAULT_JURISDICTION,
  DEFAULT_PENALTY_PERCENT,
  DEFAULT_VALIDITY_DAYS,
  clampInt,
  endFromValidity,
  pickTerm,
  shouldAutofillAddress,
} from "./contract-terms-defaults";

describe("DADOS-CONTRATO padrões", () => {
  it("vigência padrão é 90 dias", () => expect(DEFAULT_VALIDITY_DAYS).toBe(90));
  it("multa padrão é 2%", () => expect(DEFAULT_PENALTY_PERCENT).toBe(2));
  it("foro padrão é Florianópolis-SC", () => expect(DEFAULT_JURISDICTION).toBe("Florianópolis-SC"));
  it("fim da vigência soma os dias da proposta", () =>
    expect(endFromValidity("2026-11-09", 90)).toBe("2027-02-07"));
  it("valor do modelo prevalece sobre o padrão", () => {
    expect(pickTerm<number>(null, 5, 2)).toBe(5);
    expect(pickTerm<string>(null, null, "Florianópolis-SC")).toBe("Florianópolis-SC");
  });
  it("endereço manual nunca é sobrescrito", () => {
    expect(shouldAutofillAddress({ street: "Rua A" })).toBe(false);
    expect(shouldAutofillAddress("Rua A, 1")).toBe(false);
    expect(shouldAutofillAddress({})).toBe(true);
    expect(shouldAutofillAddress(null)).toBe(true);
  });
  it("parcelas limitadas a 1–120", () => {
    expect(clampInt("0", 1, 120)).toBe(1);
    expect(clampInt("", 1, 120)).toBeNull();
  });
});
