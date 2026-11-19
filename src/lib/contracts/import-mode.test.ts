import { describe, expect, it } from "vitest";
import {
  attemptFor,
  autoPairAllowed,
  bodylessRetryAllowed,
  buildCreateFromImportRequest,
  importModeAccess,
  legacyPendingConfirmed,
  legacyReasonError,
  manualRoleFrom,
  originalRequired,
} from "./import-mode";
import type { ExtractedContract } from "./import-schemas";

const all = new Set([
  "techcontracts.imports.manage.workspace",
  "techcontracts.contracts.create.workspace",
  "techcontracts.contracts.view.workspace",
  "techcontracts.contracts.update.workspace",
  "techcontracts.legacy_contracts.create.workspace",
]);
const perm = (keys: Set<string>) => ({
  can: (k: string) => keys.has(k),
  canAny: (ks: string[]) => ks.some((k) => keys.has(k)),
});
const fields = { title: "X", signature_provider: "forsign" } as unknown as ExtractedContract;

describe("import mode access", () => {
  it("legacy needs every key; missing one is named", () => {
    expect(importModeAccess(perm(all), true)).toMatchObject({ draft: true, legacy: true });
    for (const k of all) {
      const s = new Set(all);
      s.delete(k);
      expect(importModeAccess(perm(s), true).legacy).toBe(false);
    }
    const s = new Set(all);
    s.delete("techcontracts.legacy_contracts.create.workspace");
    expect(importModeAccess(perm(s), true)).toMatchObject({
      draft: true,
      legacyMissing: ["reconhecer contrato legado"],
    });
  });
  it("loading/error permissions offer nothing", () => {
    expect(importModeAccess(perm(all), false)).toEqual({
      draft: false,
      legacy: false,
      legacyMissing: [],
    });
  });
});

describe("legacy request", () => {
  it("requires reason >= 5 and a kept original", () => {
    expect(legacyReasonError("abcd")).toMatch(/mínimo 5/);
    expect(legacyReasonError("  abcde ")).toBeNull();
    const attempt = { operationId: "op-1", sourceFilePath: null, uploaded: false };
    expect(() =>
      buildCreateFromImportRequest({
        mode: "legacy",
        fields,
        attempt,
        kind: "pdf",
        bodyHtml: "<p/>",
        reason: "abc",
        manualRole: null,
      }),
    ).toThrow(/motivo/i);
    expect(() =>
      buildCreateFromImportRequest({
        mode: "legacy",
        fields,
        attempt,
        kind: "pdf",
        bodyHtml: "<p/>",
        reason: "Acervo 2019",
        manualRole: null,
      }),
    ).toThrow(/original/);
  });
  it("builds payload with stable operation id, explicit manual role and trimmed reason", () => {
    const attempt = { operationId: "op-1", sourceFilePath: "u/a.pdf", uploaded: true };
    expect(
      buildCreateFromImportRequest({
        mode: "legacy",
        fields,
        attempt,
        kind: "pdf",
        bodyHtml: null,
        reason: "  Acervo 2019 ",
        manualRole: "client",
      }),
    ).toEqual({
      fields,
      source_file_path: "u/a.pdf",
      imported_from: "pdf",
      body_html: null,
      import_mode: "legacy",
      legacy_reason: "Acervo 2019",
      operation_id: "op-1",
      manual_role: "client",
    });
    const d = buildCreateFromImportRequest({
      mode: "draft",
      fields,
      attempt: { ...attempt, sourceFilePath: null },
      kind: "docx",
      bodyHtml: null,
      manualRole: null,
    });
    expect(d).not.toHaveProperty("legacy_reason");
    expect(d.import_mode).toBe("draft");
  });
  it("retry reuses the same UUID and path; new attempt only when absent", () => {
    let n = 0;
    const id = () => `id-${++n}`;
    const first = attemptFor(null, id);
    const stored = { ...first, sourceFilePath: "u/a.pdf", uploaded: true };
    expect(attemptFor(stored, id)).toBe(stored);
    expect(n).toBe(1);
  });
  it("manual role is never derived from auto/extracted", () => {
    expect(manualRoleFrom("auto")).toBeNull();
    expect(manualRoleFrom(null)).toBeNull();
    expect(manualRoleFrom("provider")).toBe("provider");
  });
  it("legacy keeps the original, skips auto pairing and body-less retry", () => {
    expect(originalRequired("legacy")).toBe(true);
    expect(originalRequired("draft")).toBe(false);
    expect(autoPairAllowed("legacy")).toBe(false);
    expect(autoPairAllowed("draft")).toBe(true);
    expect(bodylessRetryAllowed("legacy")).toBe(false);
  });
  it("pending is confirmed only from the legacy state", () => {
    expect(
      legacyPendingConfirmed({ access: "granted", state: { record: { status: "pending" } } }),
    ).toBe(true);
    expect(legacyPendingConfirmed({ access: "granted", state: { record: null } })).toBe(false);
    expect(legacyPendingConfirmed({ id: "x" })).toBe(false);
    expect(legacyPendingConfirmed({ access: "denied", classification: "pending" })).toBe(true);
    expect(legacyPendingConfirmed({ record: { status: "pending" } })).toBe(false);
  });
});

it("import batch preserves the explicit principal or amendment choice", () => {
  for (const kind of ["main", "amendment"] as const) {
    const request = buildCreateFromImportRequest({
      mode: "legacy",
      fields,
      attempt: { operationId: "op", sourceFilePath: "original.pdf", uploaded: true },
      kind: "pdf",
      bodyHtml: null,
      reason: "Acervo conferido",
      manualRole: null,
      manualDocumentKind: kind,
    });
    expect(request.manual_document_kind).toBe(kind);
  }
});
