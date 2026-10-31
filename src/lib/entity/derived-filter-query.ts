import { isDerivedCrmField } from "./derived-fields";

/** Separador de múltiplas escolhas guardadas no mesmo filtro (mantém Record<string,string>). */
export const MULTI_SEP = "\u001f";

export function splitMulti(value: string | undefined): string[] {
  return (value ?? "")
    .split(MULTI_SEP)
    .map((v) => v.trim())
    .filter(Boolean);
}
export function joinMulti(values: string[]): string {
  return values.length === 1 ? values[0] + MULTI_SEP : values.join(MULTI_SEP);
}
export function isMultiValue(value: string | undefined): boolean {
  return !!value && value.includes(MULTI_SEP);
}

export function applyDerivedFilters<
  T extends { ilike: (column: string, pattern: string) => T; in: (column: string, values: string[]) => T },
>(query: T, filters?: Record<string, string>): T {
  let out = query;
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (!(key === "job_title" || isDerivedCrmField(key)) || !value.trim()) continue;
    if (isMultiValue(value)) {
      const parts = splitMulti(value);
      if (parts.length) out = out.in(key, parts);
    } else out = out.ilike(key, `%${value.trim().replace(/[%_\\]/g, "")}%`);
  }
  return out;
}
