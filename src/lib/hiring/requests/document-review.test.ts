import { describe, it, expect } from "vitest";
import { documentSuggestion, applyDocumentSuggestion } from "./document-review";
import { emptyPreparation } from "./types";
describe("supplier document review", () => {
  it("does not replace a filled draft until the user selects fields", () => {
    const f = { ...emptyPreparation("supplier"), title: "Manual", scope_text: "Original" };
    const s = documentSuggestion({
      title: "Documento",
      service_scope: "Escopo",
      confidence: 1,
      warnings: [],
    });
    expect(applyDocumentSuggestion(f, s, new Set())).toEqual(f);
    expect(applyDocumentSuggestion(f, s, new Set(["scope_text"]))).toEqual({
      ...f,
      scope_text: "Escopo",
    });
  });
  it("never infers commercial origin, approval, purpose or release from a document", () => {
    const f = emptyPreparation("supplier");
    const s = documentSuggestion({
      title: "Contrato cliente",
      role: "provider",
      confidence: 1,
      warnings: [],
    });
    const next = applyDocumentSuggestion(
      f,
      s,
      new Set(["title", "purpose", "status", "company_id"]),
    );
    expect(next.purpose).toBe("internal");
    expect(next.status).toBe("draft");
    expect(next.company_id).toBeNull();
    expect(s.warnings[0]).toContain("WK como fornecedora");
  });
  it("keeps financial amount separate from ordinary request data", () => {
    const f = emptyPreparation("supplier"),
      s = documentSuggestion({
        monthly_value: 2500,
        total_value: 30000,
        confidence: 1,
        warnings: [],
      });
    expect(s.modality).toBe("monthly");
    expect(s.reference_value).toBe(2500);
    expect(applyDocumentSuggestion(f, s, new Set(["reference_value"]))).not.toHaveProperty(
      "reference_value",
    );
  });
  it("does not invent unknown values or parties and strips database control characters", () => {
    const s = documentSuggestion({
      title: "A\u0000B",
      service_scope: "x".repeat(10005),
      confidence: 0,
      warnings: [],
    });
    expect(s.title).toBe("AB");
    expect(s.scope_text).toHaveLength(10000);
    expect(s.modality).toBeNull();
    expect(s.supplier).toBeNull();
    expect(s.warnings).toHaveLength(1);
  });
});
