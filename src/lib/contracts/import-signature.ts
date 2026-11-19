import type { ExtractedContract } from "./import-schemas";

// The atomic legacy RPC rejects protected keys even when their values are null.
// Legacy documentary references are stored separately in external_signature_extracted.
export function importSignatureFields(
  mode: "draft" | "legacy",
  fields: Pick<
    ExtractedContract,
    "signature_provider" | "signature_document_id" | "signature_operation_id"
  >,
) {
  if (mode === "legacy") return {};
  return {
    signature_provider: fields.signature_provider ?? null,
    signature_document_id: fields.signature_document_id ?? null,
    signature_operation_id: fields.signature_operation_id ?? null,
  };
}
