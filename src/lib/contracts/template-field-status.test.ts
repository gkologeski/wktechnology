import { describe, expect, it } from "vitest";
import { templateFieldStatus } from "./template-tokens";

const html =
  "<p>{{counterparty.address}} {{signer.cpf}} {{contract.service_scope}} {{contract.monthly_value}} ({{contract.monthly_value_extenso}})</p>";

describe("templateFieldStatus (DADOS-ADITIVO)", () => {
  it("aponta endereço, CPF, escopo e valor mensal ausentes", () => {
    const f = templateFieldStatus(html, { counterparty: {}, signer: {}, contract: {} });
    expect(f.filter((x) => x.missing).map((x) => x.key)).toEqual([
      "counterparty.address",
      "signer.cpf",
      "contract.service_scope",
      "contract.monthly_value",
      "contract.monthly_value_extenso",
    ]);
  });

  it("escopo e valor mensal informados liberam esses campos, com extenso derivado", () => {
    const f = templateFieldStatus(html, {
      counterparty: { address: "Rua A, 1" },
      signer: { cpf: "000" },
      contract: { service_scope: "Complemento de 111 horas", monthly_value: 9435 },
    });
    expect(f.every((x) => !x.missing)).toBe(true);
    expect(f.find((x) => x.key === "contract.monthly_value_extenso")?.value).toMatch(/nove mil/);
  });
});
