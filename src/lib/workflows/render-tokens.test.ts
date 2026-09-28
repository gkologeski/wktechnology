import { describe, expect, it } from "vitest";
import { renderWorkflowTokens } from "./render-tokens";

describe("renderWorkflowTokens", () => {
  const after = { first_name: "Ana", company_id: "c-1", owner: { name: "Bruno" } };

  it("resolve campos da entidade do gatilho", () => {
    expect(renderWorkflowTokens("Olá {{first_name}}", after, {})).toBe("Olá Ana");
  });

  it("resolve caminho aninhado", () => {
    expect(renderWorkflowTokens("{{owner.name}}", after, {})).toBe("Bruno");
  });

  it("resolve {{vars.X}} e {{steps.N.campo}}", () => {
    const vars = { plano: "Pro", steps: { 2: { id: "abc" } } };
    expect(renderWorkflowTokens("{{vars.plano}} / {{steps.2.id}}", after, vars)).toBe("Pro / abc");
  });

  it("resolve aliases PT-BR sem quebrar os tokens técnicos anteriores", () => {
    const contract = {
      signature_document_id: "doc-1",
      metadata: { origem: "importacao" },
      deal: { services: "Consultoria" },
    };
    expect(renderWorkflowTokens("{{id_documento_assinatura}}", contract, {})).toBe("doc-1");
    expect(renderWorkflowTokens("{{metadados_tecnicos}}", contract, {})).toBe(
      '{"origem":"importacao"}',
    );
    expect(renderWorkflowTokens("{{negocio.servicos}}", contract, {})).toBe("Consultoria");
    expect(renderWorkflowTokens("{{deal.services}}", contract, {})).toBe("Consultoria");
  });

  it("resolve prefixos PT-BR de variáveis e passos anteriores", () => {
    const vars = { plano: "Pro", steps: { 2: { title: "Contrato anual" } } };
    expect(renderWorkflowTokens("{{variaveis.plano}}", after, vars)).toBe("Pro");
    expect(renderWorkflowTokens("{{passos.2.titulo}}", after, vars)).toBe("Contrato anual");
  });

  it("token ausente vira vazio e não-string passa direto", () => {
    expect(renderWorkflowTokens("[{{inexistente}}]", after, {})).toBe("[]");
    expect(renderWorkflowTokens(42, after, {})).toBe(42);
  });
});
