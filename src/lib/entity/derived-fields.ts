/** Database-owned fields remain readable/filterable, never editable. */
export const DERIVED_CRM_FIELDS = new Set([
  "cargo_resumido",
  "area_atuacao",
  "nivel_hierarquico",
  "size_description",
]);
export const INTERNAL_DERIVATION_FIELDS = new Set(["job_title_source", "cargo_catalog_version"]);
export function isDerivedCrmField(key: string): boolean {
  return DERIVED_CRM_FIELDS.has(key) || INTERNAL_DERIVATION_FIELDS.has(key);
}
