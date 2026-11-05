import { describe, expect, it } from "vitest";
import catalogue from "./official-catalogue.json";
import { listArticles } from "../../../tests/help-coverage/help-coverage";

describe("Catálogo oficial versionado", () => {
  it("entrega exatamente os mesmos corpos e versões das fontes oficiais", () => {
    const sources = listArticles();
    expect(catalogue).toHaveLength(sources.length);
    for (const source of sources) {
      const row = catalogue.find(
        (a) => a.module_key === source.meta.module_key && a.slug === source.meta.slug,
      );
      expect(row?.body_md).toBe(source.body.trim());
      expect(row?.version).toBe(Number(source.meta.version || 1));
      expect(row?.min_permission).toBe(source.meta.min_permission || null);
    }
  });
});