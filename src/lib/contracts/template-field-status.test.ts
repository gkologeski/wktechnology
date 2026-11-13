import { describe, expect, it } from "vitest";
import {
  mergeTemplateBody,
  templateFieldStatus,
  templateMissingFieldsMessage,
} from "./template-tokens";

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

describe("MODELO-RASCUNHO: completude conforme vínculo de proposta", () => {
  const incompleteHtml = "<p>{{contract.ends_at}} {{signer.cpf}} {{custom.variable}}</p>";
  const fields = templateFieldStatus(incompleteHtml, {});

  it("sem proposta permite continuar e gerar rascunho com marcadores", () => {
    expect(templateMissingFieldsMessage(null, fields)).toBeNull();
    expect(mergeTemplateBody(incompleteHtml, {}, { strict: false })).toBe(
      "<p>[[Fim da vigência]] [[CPF do signatário]] [[custom.variable]]</p>",
    );
  });

  it("com proposta bloqueia variáveis ausentes e desconhecidas", () => {
    expect(templateMissingFieldsMessage("proposta-aceita", fields)).toBe(
      "Faltam dados do modelo: Fim da vigência, CPF do signatário, custom.variable.",
    );
    expect(() => mergeTemplateBody(incompleteHtml, {}, { strict: true })).toThrow(
      "Preencha os dados obrigatórios do modelo",
    );
  });

  it("com proposta e variáveis completas permite continuar", () => {
    const complete = templateFieldStatus("{{contract.title}}", {
      contract: { title: "Contrato de teste" },
    });
    expect(templateMissingFieldsMessage("proposta-aceita", complete)).toBeNull();
  });

  it("remover o vínculo de proposta libera os mesmos campos ausentes", () => {
    expect(templateMissingFieldsMessage("proposta-aceita", fields)).not.toBeNull();
    expect(templateMissingFieldsMessage(undefined, fields)).toBeNull();
  });
});
