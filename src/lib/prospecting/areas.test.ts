import { describe, expect, it } from "vitest";
import { AREA_SECTIONS, LEGACY_TAB_MAP, LEGACY_TAB_VALUES, resolveSection } from "./areas";
import { groupCount, metric } from "./overview.server";

describe("compatibilidade ?tab= da Prospecção", () => {
  it("toda aba antiga tem destino", () => {
    for (const t of LEGACY_TAB_VALUES) expect(LEGACY_TAB_MAP[t]).toBeDefined();
  });
  it("fila abre Meu trabalho › Fila", () => {
    expect(LEGACY_TAB_MAP.fila).toEqual({ kind: "area", area: "trabalho", section: "fila" });
  });
  it("busca Apollo abre Públicos", () => {
    expect(LEGACY_TAB_MAP.prospecting).toEqual({
      kind: "area",
      area: "publicos",
      section: "apollo",
    });
  });
  it("voz vai para configuração de voz e sdr para Agentes", () => {
    expect(LEGACY_TAB_MAP.voice).toEqual({ kind: "route", to: "/settings/voice-agent" });
    expect(LEGACY_TAB_MAP.sdr).toEqual({ kind: "route", to: "/agents/sdr" });
  });
  it("seções mapeadas pertencem à área de destino", () => {
    for (const t of LEGACY_TAB_VALUES) {
      const d = LEGACY_TAB_MAP[t];
      if (d.kind === "area" && d.section) expect(AREA_SECTIONS[d.area]).toContain(d.section);
    }
  });
  it("seção sem permissão cai para a primeira permitida", () => {
    expect(resolveSection("trabalho", "fila", (s) => s !== "fila")).toBe("nutricao");
    expect(resolveSection("trabalho", "fila", () => false)).toBeUndefined();
  });
});

describe("indicadores com cobertura explícita", () => {
  const base = { key: "k", label: "L", origin: "O" };
  it("sem permissão não vira zero", () => {
    expect(metric(base, false, { count: 5, error: null })).toMatchObject({
      value: null,
      coverage: "no_access",
    });
  });
  it("erro de consulta não vira zero", () => {
    expect(metric(base, true, { count: null, error: new Error("x") })).toMatchObject({
      value: null,
      coverage: "error",
    });
  });
  it("contagem real é preservada", () => {
    expect(metric(base, true, { count: 0, error: null })).toMatchObject({
      value: 0,
      coverage: "ok",
    });
  });
  it("agrupa por campanha sem linhas órfãs", () => {
    const g = groupCount(
      [
        { campaign_id: "a", status: "failed" },
        { campaign_id: "a", status: "completed" },
        { campaign_id: null, status: "failed" },
      ],
      "campaign_id",
      "status",
    );
    expect(g.get("a")).toEqual({ failed: 1, completed: 1, total: 2 });
    expect(g.size).toBe(1);
  });
});
