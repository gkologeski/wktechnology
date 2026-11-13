import { describe, expect, it } from "vitest";
import { mergeCompanyParty } from "./company-party";

describe("mergeCompanyParty", () => {
  it("cadastro preenchido vence a cópia vazia da proposta", () => {
    const r = mergeCompanyParty(
      { id: "1", name: "NEXID LTDA", cnpj: "1", address: null, city: null, state: null },
      {
        address: "Rua Egon Roskamp, 75, Sala A",
        city: "PONTA GROSSA",
        state: "PR",
        cep: "84016360",
      },
    );
    expect(r?.address).toBe("Rua Egon Roskamp, 75, Sala A, CEP 84.016-360");
    expect(r?.city).toBe("PONTA GROSSA");
    expect(r?.name).toBe("NEXID LTDA");
  });
  it("cadastro vazio mantém a cópia", () => {
    const r = mergeCompanyParty(
      { name: "X", address: "Rua A", city: "B" },
      { address: "", city: null },
    );
    expect(r?.address).toBe("Rua A");
    expect(r?.city).toBe("B");
  });
});
