import { describe, expect, it } from "vitest";
import {
  csvCell,
  dashPreferenceKey,
  filtersForView,
  metricDef,
  parseDashSearch,
  resolveDashView,
  toSafeCsv,
} from "./dashboard-views.shared";

describe("painel por perfil — utilitários", () => {
  it("exportação neutraliza fórmulas de planilha", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+55 11")).toBe("'+55 11");
    expect(csvCell("-10")).toBe("'-10");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(-10)).toBe("-10");
    expect(csvCell(null)).toBe("");
    expect(csvCell("a;b")).toBe('"a;b"');
  });

  it("CSV usa ponto e vírgula e CRLF", () => {
    expect(toSafeCsv(["A", "B"], [[1, "x"]])).toBe("A;B\r\n1;x");
  });

  it("URL malformada é descartada, não quebra a tela", () => {
    const s = parseDashSearch({
      view: "admin",
      from: "2026-13",
      project: "not-a-uuid",
      person: "10000000-0000-4000-8000-000000000002",
      origin: "planilha",
      status: "approved",
      currency: "brl",
      compare: "true",
    });
    expect(s.view).toBeUndefined();
    expect(s.from).toBeUndefined();
    expect(s.project).toBeUndefined();
    expect(s.person).toBe("10000000-0000-4000-8000-000000000002");
    expect(s.origin).toBeUndefined();
    expect(s.status).toBe("approved");
    expect(s.currency).toBe("BRL");
    expect(s.compare).toBe(true);
  });

  it("cada visão envia só os filtros que aplica", () => {
    const s = parseDashSearch({
      person: "10000000-0000-4000-8000-000000000002",
      origin: "jibble",
      currency: "USD",
    });
    expect(filtersForView("me", s)).toEqual({ origin: "jibble" });
    expect(filtersForView("commercial", s)).toEqual({
      person: "10000000-0000-4000-8000-000000000002",
    });
    expect(filtersForView("finance", s)).toEqual({
      person: "10000000-0000-4000-8000-000000000002",
      currency: "USD",
    });
  });

  it("visão pedida sem permissão cai para a primeira permitida (nunca abre visão negada)", () => {
    const allowed = { me: true, team: false, quality: false };
    expect(resolveDashView("quality", undefined, allowed)).toBe("me");
    expect(resolveDashView(undefined, "team", allowed)).toBe("me");
    expect(resolveDashView("me", "quality", allowed)).toBe("me");
  });

  it("preferência salva é por workspace e usuário", () => {
    expect(dashPreferenceKey("ws-a", "u-1")).not.toBe(dashPreferenceKey("ws-b", "u-1"));
    expect(dashPreferenceKey("ws-a", "u-1")).not.toBe(dashPreferenceKey("ws-a", "u-2"));
  });

  it("importado bloqueado é definido como não aprovado", () => {
    expect(metricDef("entries", "locked_import").definition).toMatch(/Não são aprovação/);
    expect(metricDef("entries", "validated").definition).toMatch(/Importado bloqueado não entra/);
  });
});
