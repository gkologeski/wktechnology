import { describe, expect, it } from "vitest";
import {
  DEFAULT_SDR_SECTION,
  SDR_VIEWS,
  hasStudioTestSide,
  parseSdrAgent,
  parseSdrSection,
  resolveStudioAgent,
  viewOfSection,
} from "./sdr-workspace-sections";

describe("navegação do Agente SDR", () => {
  it("mantém as nove seções anteriores, cada uma em exatamente uma área", () => {
    const ids = SDR_VIEWS.flatMap((v) => v.sections.map((s) => s.id));
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(9);
    expect(SDR_VIEWS.map((v) => v.id)).toEqual(["operation", "studio", "results"]);
  });

  it("agrupa playbook e habilidades no Estúdio e supervisão na Operação", () => {
    expect(viewOfSection("playbook").id).toBe("studio");
    expect(viewOfSection("sdr-skills").id).toBe("studio");
    expect(viewOfSection("sdr-supervision").id).toBe("operation");
    expect(viewOfSection("sdr-results").id).toBe("results");
  });

  it("ignora seção desconhecida no endereço e abre a Operação", () => {
    expect(parseSdrSection("nao-existe")).toBeUndefined();
    expect(parseSdrSection(42)).toBeUndefined();
    expect(parseSdrSection("sdr-catalog")).toBe("sdr-catalog");
    expect(viewOfSection(undefined).id).toBe("operation");
    expect(DEFAULT_SDR_SECTION).toBe("sdr-supervision");
  });

  it("conversa de teste fixa em todas as seções do Estúdio, exceto Persona (já tem a sua)", () => {
    expect(hasStudioTestSide("playbook")).toBe(true);
    expect(hasStudioTestSide("sdr-skills")).toBe(true);
    expect(hasStudioTestSide("sdr-agent")).toBe(false);
    expect(hasStudioTestSide("sdr-supervision")).toBe(false);
    expect(hasStudioTestSide("sdr-results")).toBe(false);
  });

  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const agents = [{ id: A }, { id: B, questionnaire_id: "q" }, { id: C }];

  it("agente do endereço só vale se for identificador válido", () => {
    expect(parseSdrAgent(A)).toBe(A);
    expect(parseSdrAgent("lia")).toBeUndefined();
    expect(parseSdrAgent(7)).toBeUndefined();
  });

  it("abre o agente do endereço; senão o principal; senão o com questionário", () => {
    expect(resolveStudioAgent(agents, C, A)).toBe(C);
    expect(resolveStudioAgent(agents, undefined, A)).toBe(A);
    expect(resolveStudioAgent(agents, "dddddddd-dddd-4ddd-8ddd-dddddddddddd", null)).toBe(B);
    expect(resolveStudioAgent([], A, A)).toBeNull();
  });
});
