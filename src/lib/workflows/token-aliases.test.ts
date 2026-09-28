import { describe, expect, it } from "vitest";

import {
  localizeWorkflowTokenPath,
  normalizeWorkflowTokenName,
  resolveWorkflowTokenPath,
  workflowFieldAlias,
} from "./token-aliases";

describe("aliases PT-BR de variáveis de workflow", () => {
  it("normaliza rótulos para minúsculas sem acentos e com underscore", () => {
    expect(normalizeWorkflowTokenName("Início da vigência")).toBe("inicio_da_vigencia");
  });

  it("usa aliases explícitos para campos técnicos", () => {
    expect(workflowFieldAlias("signature_document_id", "Documento")).toBe(
      "id_documento_assinatura",
    );
    expect(workflowFieldAlias("metadata", "Metadados técnicos")).toBe("metadados_tecnicos");
  });

  it("traduz contexto, passos e campos", () => {
    expect(localizeWorkflowTokenPath("deal.services", "Serviços")).toBe("negocio.servicos");
    expect(localizeWorkflowTokenPath("steps.1.title", "Título")).toBe("passos.1.titulo");
  });

  it("resolve aliases conforme as propriedades disponíveis", () => {
    const value = { company_id: "empresa-1", metadata: { fonte: "crm" } };
    expect(resolveWorkflowTokenPath(value, "id_empresa")).toBe("company_id");
    expect(resolveWorkflowTokenPath(value, "metadados_tecnicos")).toBe("metadata");
  });
});