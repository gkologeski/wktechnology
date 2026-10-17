import { isDerivedCrmField } from "./derived-fields";
export function applyDerivedFilters<T extends { ilike: (column: string, pattern: string) => T }>(
  query: T,
  filters?: Record<string, string>,
): T {
  let out = query;
  for (const [key, value] of Object.entries(filters ?? {})) {
    if ((key === "job_title" || isDerivedCrmField(key)) && value.trim())
      out = out.ilike(key, `%${value.trim().replace(/[%_\\]/g, "")}%`);
  }
  return out;
}
