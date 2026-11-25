import { describe, expect, it } from "vitest";
import {
  legalEntityAddressSchema,
  readLegalEntityAddress,
  applyLegalEntityCnpjData,
} from "./legal-entity-address";
import { legalEntityAddress } from "./contracts/accepted-proposal.server";

describe("legal entity address", () => {
  it("loads legacy keys and preserves metadata, including numeric street number", () => {
    const a = readLegalEntityAddress({
      logradouro: "Rua A",
      numero: 42,
      cidade: "Curitiba",
      uf: "PR",
      cep: "80000000",
      source: "manual",
      custom: { country: "BR" },
    });
    expect(a.number).toBe("42");
    expect(a["custom"]).toEqual({ country: "BR" });
    expect(legalEntityAddress(legalEntityAddressSchema.parse(a))).toBe(
      "Rua A, 42, Curitiba, PR, 80000-000",
    );
  });
  it("does not erase populated fields when CNPJ suggestion is incomplete", () => {
    const current = {
      id: "same",
      name: "Old",
      trade_name: "Local",
      address_json: readLegalEntityAddress({
        complement: "Sala 10",
        number: "7",
        source: "manual",
      }),
    };
    const next = applyLegalEntityCnpjData(current, {
      name: "New",
      trade_name: "",
      address: readLegalEntityAddress({ street: "Rua B" }),
      source: "brasilapi",
    });
    expect(next).toMatchObject({
      id: "same",
      name: "New",
      trade_name: "Local",
      address_json: { street: "Rua B", complement: "Sala 10", number: "7", source: "manual" },
    });
  });
  it("rejects invalid postal code and UF at save boundary", () => {
    expect(
      legalEntityAddressSchema.safeParse({ ...readLegalEntityAddress(null), zip_code: "123" })
        .success,
    ).toBe(false);
    expect(
      legalEntityAddressSchema.safeParse({ ...readLegalEntityAddress(null), state: "Sao Paulo" })
        .success,
    ).toBe(false);
    expect(
      legalEntityAddressSchema.parse({
        ...readLegalEntityAddress(null),
        state: "sc",
        zip_code: "88000-000",
      }).state,
    ).toBe("SC");
  });
});
