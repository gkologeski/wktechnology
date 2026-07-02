// Helpers server-side para aplicar field rules em payloads antes de retornar/salvar.
// Não é importado por rotas/componentes; use dentro de handlers de server functions.
import type { FieldRulesMap, FieldMode } from "@/lib/access-control/field-rules.functions";

function maskValue(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  if (s.length <= 2) return "•".repeat(s.length || 3);
  return s.slice(0, 1) + "•".repeat(Math.max(3, s.length - 2)) + s.slice(-1);
}

/**
 * Remove/oculta/mascara campos de um registro conforme as regras do usuário.
 * `resource` deve casar com `field_permission_rules.resource`.
 */
export function sanitizeRecord<T extends Record<string, unknown>>(
  record: T,
  resource: string,
  rules: FieldRulesMap,
  { isPrivileged = false }: { isPrivileged?: boolean } = {},
): T {
  if (isPrivileged) return record;
  const bucket = rules[resource];
  if (!bucket) return record;
  const out: Record<string, unknown> = { ...record };
  for (const [field, mode] of Object.entries(bucket) as Array<[string, FieldMode]>) {
    if (!(field in out)) continue;
    if (mode === "hidden") delete out[field];
    else if (mode === "masked") out[field] = maskValue(out[field]);
    // readonly não afeta leitura
  }
  return out as T;
}

export function sanitizeRecords<T extends Record<string, unknown>>(
  records: T[],
  resource: string,
  rules: FieldRulesMap,
  opts?: { isPrivileged?: boolean },
): T[] {
  if (opts?.isPrivileged) return records;
  return records.map((r) => sanitizeRecord(r, resource, rules, opts));
}

/**
 * Rejeita mutações que tentam alterar campos marcados como readonly ou hidden.
 * Lança Error com mensagem clara. Use em handlers de update.
 */
export function assertWritableFields(
  patch: Record<string, unknown>,
  resource: string,
  rules: FieldRulesMap,
  { isPrivileged = false }: { isPrivileged?: boolean } = {},
): void {
  if (isPrivileged) return;
  const bucket = rules[resource];
  if (!bucket) return;
  const violations: string[] = [];
  for (const field of Object.keys(patch)) {
    const mode = bucket[field];
    if (mode === "readonly" || mode === "hidden") violations.push(field);
  }
  if (violations.length) {
    throw new Error(`Campos protegidos por política: ${violations.join(", ")}`);
  }
}
