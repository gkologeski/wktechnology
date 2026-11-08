import { describe, expect, it } from "vitest";
import { SERVICE_TYPES, serviceTypeLabel } from "./import-schemas";

describe("tipos de serviço do contrato", () => {
  it("oferece Hunting e as categorias do catálogo", () => {
    expect(SERVICE_TYPES).toContain("hunting");
    expect(SERVICE_TYPES).toContain("alocacao_squad");
    expect(SERVICE_TYPES).toContain("fabrica_software");
    expect(SERVICE_TYPES).toContain("engenharia_ia");
    expect(SERVICE_TYPES).toContain("bpo");
  });
  it("não oferece mais Manutenção e Licenciamento", () => {
    expect(SERVICE_TYPES as readonly string[]).not.toContain("manutencao");
    expect(SERVICE_TYPES as readonly string[]).not.toContain("licenciamento");
  });
  it("valores antigos continuam legíveis", () => {
    expect(serviceTypeLabel("manutencao")).toBe("Manutenção (legado)");
    expect(serviceTypeLabel("Outsourcing")).toBe("Outsourcing");
    expect(serviceTypeLabel(null)).toBe("Não definido");
  });
});
