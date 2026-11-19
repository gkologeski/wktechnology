import { expect, it } from "vitest";
import { importSignatureFields } from "./import-signature";

const extracted = {
  signature_provider: "forsign" as const,
  signature_document_id: "document",
  signature_operation_id: "operation",
};
it("legacy payload omits active signature keys rather than serializing nulls", () => {
  expect(JSON.parse(JSON.stringify(importSignatureFields("legacy", extracted)))).toEqual({});
});
it("draft import preserves extracted external signature references", () => {
  expect(importSignatureFields("draft", extracted)).toEqual(extracted);
});
it("draft import retains existing null defaults without references", () => {
  expect(importSignatureFields("draft", {})).toEqual({
    signature_provider: null,
    signature_document_id: null,
    signature_operation_id: null,
  });
});
