import { describe, expect, it } from "vitest";
import {
  matchJobProfile,
  parseSeniority,
  suggestForName,
  suggestServiceForName,
  tokenSimilarity,
} from "../line-item-classify";

const CATALOG = [
  { id: "s-out", name: "Outsourcing de TI", unit: "h" },
  { id: "s-fab", name: "Fábrica de Software", unit: "PF" },
  { id: "s-hunt", name: "Hunting de TI", unit: "vaga" },
  { id: "s-cons", name: "Consultoria Técnica", unit: "h" },
  { id: "s-bpo", name: "BPO Administrativo/Financeiro", unit: "mês" },
  { id: "s-rh", name: "Recursos Humanos (BPO)", unit: "mês" },
];

const PROFILES = [
  { id: "p-dev", name: "Desenvolvedor Delphi" },
  { id: "p-qa", name: "Analista de Testes" },
  { id: "p-fin", name: "Assistente Financeiro" },
  { id: "p-coord", name: "Coordenador de RH" },
];

describe("parseSeniority", () => {
  it("extrai senioridade textual e remove do nome base", () => {
    expect(parseSeniority("Desenvolvedor Delphi Senior")).toEqual({
      base: "desenvolvedor delphi",
      seniority: "senior",
    });
    expect(parseSeniority("Analista de Testes Jr")).toEqual({
      base: "analista de testes",
      seniority: "junior",
    });
  });

  it("interpreta numerais romanos como nível", () => {
    expect(parseSeniority("Análise de Negócios II").seniority).toBe("pleno");
  });

  it("mantém coordenador/gerente no nome, pois é o cargo", () => {
    const r = parseSeniority("Coordenador de RH");
    expect(r.seniority).toBe("coordenacao");
    expect(r.base).toBe("coordenador de rh");
  });

  it("devolve null quando não há senioridade", () => {
    expect(parseSeniority("Assistente Financeiro").seniority).toBeNull();
  });
});

describe("suggestServiceForName", () => {
  it("mapeia perfis técnicos para Outsourcing", () => {
    expect(suggestServiceForName("Desenvolvedor React Sênior", CATALOG)).toBe("s-out");
    expect(suggestServiceForName("DBA Oracle", CATALOG)).toBe("s-out");
  });

  it("mapeia recrutamento para Hunting", () => {
    expect(suggestServiceForName("Recrutamento e Seleção", CATALOG)).toBe("s-hunt");
  });

  it("mapeia perfis administrativos para BPO", () => {
    expect(suggestServiceForName("Assistente Financeiro", CATALOG)).toBe("s-bpo");
  });

  it("devolve null sem palavra-chave reconhecida", () => {
    expect(suggestServiceForName("Item avulso 123", CATALOG)).toBeNull();
  });
});

describe("matchJobProfile", () => {
  it("casa exatamente após normalização", () => {
    expect(matchJobProfile("desenvolvedor delphi", PROFILES)).toEqual({ id: "p-dev", score: 1 });
  });

  it("não casa quando a similaridade é baixa", () => {
    expect(matchJobProfile("engenheiro de dados", PROFILES)).toBeNull();
  });

  it("tokenSimilarity é simétrica e limitada a 1", () => {
    expect(tokenSimilarity("analista de testes", "analista de testes")).toBe(1);
    expect(tokenSimilarity("abc", "")).toBe(0);
  });
});

describe("suggestForName", () => {
  it("combina serviço, cargo e senioridade", () => {
    const s = suggestForName("Desenvolvedor Delphi Senior", CATALOG, PROFILES);
    expect(s.serviceCatalogId).toBe("s-out");
    expect(s.jobProfileId).toBe("p-dev");
    expect(s.seniority).toBe("senior");
    expect(s.unit).toBe("h");
    expect(s.confidence).toBe("alta");
  });

  it("marca confiança nenhuma quando não há serviço", () => {
    expect(suggestForName("Item avulso", CATALOG, PROFILES).confidence).toBe("nenhuma");
  });
});
