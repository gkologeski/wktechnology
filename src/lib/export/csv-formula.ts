import { neutralizeCsvFormula as neutralizeText } from "@/lib/security/escape";

/** Preserve typed numeric cells; neutralize text before CSV quoting. */
export function neutralizeCsvFormula(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean")
    return String(value);
  return neutralizeText(String(value));
}
