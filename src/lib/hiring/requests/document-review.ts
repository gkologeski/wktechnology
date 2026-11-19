import type { ExtractedContract } from "@/lib/contracts/import-schemas";
import type { PreparationData } from "./types";
export type DocumentSuggestion = Pick<PreparationData, "title" | "scope_text"> & {
  modality: PreparationData["modality"] | null;
  reference_value: number | null;
  supplier: string | null;
  wk: string | null;
  warnings: string[];
};
const clean = (value: string | null | undefined, max: number) =>
  (value ?? "").split(String.fromCharCode(0)).join("").trim().slice(0, max);
/** Only fields supported by the request; no purpose, origin, approval or signature inference. */
export function documentSuggestion(data: ExtractedContract): DocumentSuggestion {
  const monthly = data.monthly_value != null;
  return {
    title: clean(data.title, 200),
    scope_text: clean(data.service_scope, 10000),
    modality: monthly ? "monthly" : null,
    reference_value: monthly ? data.monthly_value! : (data.total_value ?? null),
    supplier: data.role === "client" ? clean(data.counterparty_name, 200) : null,
    wk: data.role === "client" ? clean(data.contracting_name, 200) : null,
    warnings: [
      ...(data.warnings ?? []),
      ...(data.role === "provider"
        ? [
            "Este documento apresenta a WK como fornecedora. Confira se é o contrato correto para contratar um fornecedor.",
          ]
        : []),
      ...((data.title?.length ?? 0) > 200 || (data.service_scope?.length ?? 0) > 10000
        ? ["Texto reduzido ao limite dos campos; confira o documento original."]
        : []),
    ],
  };
}
export function applyDocumentSuggestion(
  form: PreparationData,
  s: DocumentSuggestion,
  fields: ReadonlySet<string>,
): PreparationData {
  return {
    ...form,
    ...(fields.has("title") && s.title ? { title: s.title } : {}),
    ...(fields.has("scope_text") && s.scope_text ? { scope_text: s.scope_text } : {}),
    ...(fields.has("modality") && s.modality ? { modality: s.modality } : {}),
  };
}
