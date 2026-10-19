import { describe, expect, it } from "vitest";
import { isRecentAutoPhoto, isRecentEnrichment } from "./recent-enrichment";

const now = new Date("2026-10-19T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("selo de enriquecimento recente", () => {
  it("mostra para enriquecimento de 29 dias atrás", () => {
    expect(isRecentEnrichment(daysAgo(29), now)).toBe(true);
  });
  it("não mostra para enriquecimento de 31 dias atrás", () => {
    expect(isRecentEnrichment(daysAgo(31), now)).toBe(false);
  });
  it("foto do LinkedIn recente conta; foto manual não", () => {
    expect(isRecentAutoPhoto("linkedin", daysAgo(5), now)).toBe(true);
    expect(isRecentAutoPhoto("manual", daysAgo(5), now)).toBe(false);
  });
});
