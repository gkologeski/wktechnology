import { describe, expect, it } from "vitest";
import { applyDerivedFilters, joinMulti } from "./derived-filter-query";
import { assertDerivedOptionColumn } from "./derived-filter-options.server";

function fake() {
  const calls: unknown[] = [];
  const q = {
    ilike: (c: string, p: string) => (calls.push(["ilike", c, p]), q),
    in: (c: string, v: string[]) => (calls.push(["in", c, v]), q),
  };
  return { q, calls };
}

describe("filtros derivados por escolha", () => {
  it("várias escolhas viram filtro exato (in)", () => {
    const { q, calls } = fake();
    applyDerivedFilters(q, { nivel_hierarquico: joinMulti(["Gerência", "Diretoria"]) });
    expect(calls).toEqual([["in", "nivel_hierarquico", ["Gerência", "Diretoria"]]]);
  });
  it("uma escolha também é exata", () => {
    const { q, calls } = fake();
    applyDerivedFilters(q, { cargo_resumido: joinMulti(["Analista"]) });
    expect(calls).toEqual([["in", "cargo_resumido", ["Analista"]]]);
  });
  it("filtro antigo em texto continua como 'contém'", () => {
    const { q, calls } = fake();
    applyDerivedFilters(q, { job_title: "gerente" });
    expect(calls).toEqual([["ilike", "job_title", "%gerente%"]]);
  });
  it("opções só para campos derivados permitidos", () => {
    expect(() => assertDerivedOptionColumn("contacts", "email")).toThrow();
    expect(() => assertDerivedOptionColumn("contacts", "size_description")).toThrow();
    expect(() => assertDerivedOptionColumn("contacts", "area_atuacao")).not.toThrow();
  });
});
