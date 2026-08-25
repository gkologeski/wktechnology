import { describe, expect, it } from "vitest";

import { buildIdTokens, buildTextTokens, type TokenFieldOpt } from "./token-catalog";

const fields: TokenFieldOpt[] = [
  { name: "id", label: "ID" },
  { name: "title", label: "Título" },
  { name: "amount", label: "Valor", type: "number" },
  { name: "company_id", label: "Empresa", ref: "company" },
  { name: "owner_id", label: "Proprietário" },
  { name: "created_at", label: "Criado em" },
  { name: "internal_flag", label: "Interno", system: true },
];

describe("token-catalog", () => {
  it("expõe apenas colunas de texto úteis do gatilho", () => {
    const t = buildTextTokens(fields).map((x) => x.token);
    expect(t).toContain("{{title}}");
    expect(t).toContain("{{amount}}");
    expect(t).not.toContain("{{id}}");
    expect(t).not.toContain("{{company_id}}");
    expect(t).not.toContain("{{created_at}}");
    expect(t).not.toContain("{{internal_flag}}");
  });

  it("inclui saídas de passos anteriores", () => {
    const t = buildTextTokens(fields, [{ name: "steps.1.title", label: "Passo 1 · Título" }]).map(
      (x) => x.token,
    );
    expect(t).toContain("{{steps.1.title}}");
  });

  it("expõe somente identificadores nos campos de referência", () => {
    const t = buildIdTokens(fields).map((x) => x.token);
    expect(t).toContain("{{id}}");
    expect(t).toContain("{{company_id}}");
    expect(t).not.toContain("{{title}}");
    expect(t).not.toContain("{{owner_id}}");
  });
});
