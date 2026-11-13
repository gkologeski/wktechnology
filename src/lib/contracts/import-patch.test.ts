import { describe, expect, it } from "vitest";
import { buildImportPatch, PROTECTED_CONTRACT_KEYS } from "./import-patch";
import type { ExtractedContract } from "./import-schemas";

describe("buildImportPatch", () => {
  it("nunca envia campos protegidos de assinatura", () => {
    const patch = buildImportPatch({
      title: "X",
      signature_provider: "clicksign",
      signature_document_id: "doc",
      signature_operation_id: "op",
    } as unknown as ExtractedContract);
    for (const k of PROTECTED_CONTRACT_KEYS) expect(patch).not.toHaveProperty(k);
    expect(patch.title).toBe("X");
  });
});
