import { describe, expect, it } from "vitest";
import {
  DEFAULT_SDR_SECTION,
  SDR_VIEWS,
  parseSdrSection,
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
});
