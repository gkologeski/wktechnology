import { describe, expect, it } from "vitest";
import { effectiveTerms } from "./effective-terms";

const main = { id: "m", starts_at: "2026-10-02", ends_at: "2026-12-04", total_value: 25500, contracted_hours: 150, service_scope: "150 h" };

describe("effectiveTerms", () => {
  it("NEXID: aditivo ativo estende o prazo e soma horas e valor", () => {
    const r = effectiveTerms(main, [
      { id: "a", status: "active", starts_at: "2026-11-17", ends_at: "2026-12-24", total_value: 18870, contracted_hours: 111 },
    ]);
    expect(r.ends_at).toBe("2026-12-24");
    expect(r.starts_at).toBe("2026-10-02");
    expect(r.contracted_hours).toBe(261);
    expect(r.total_value).toBe(44370);
  });
  it("prazo menor no aditivo também prevalece", () => {
    expect(effectiveTerms(main, [{ id: "a", status: "active", ends_at: "2026-11-30" }]).ends_at).toBe("2026-11-30");
  });
  it("escopo diferente substitui o original", () => {
    expect(effectiveTerms(main, [{ id: "a", status: "active", service_scope: "Novo" }]).service_scope).toBe("Novo");
  });
  it("aditivo em rascunho não altera nada", () => {
    const r = effectiveTerms(main, [{ id: "a", status: "draft", ends_at: "2027-01-01", total_value: 999 }]);
    expect(r.ends_at).toBe("2026-12-04");
    expect(r.total_value).toBe(25500);
  });
});
