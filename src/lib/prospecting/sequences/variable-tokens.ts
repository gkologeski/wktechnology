// Variáveis de campo das Sequências: `{{entidade.coluna}}` ou `{{entidade.coluna|padrão}}`.
// Entidades: lead, contact, company, deal. Campos personalizados: `{{lead.cf.chave}}`.
import { CUSTOM_FIELD_PREFIX, isBlockedFilterColumn, type AudienceBase } from "@/lib/whatsapp/campaign-audience";

export type VariableEntity = "lead" | "contact" | "company" | "deal";
export const VARIABLE_ENTITIES: { entity: VariableEntity; base: AudienceBase; label: string }[] = [
  { entity: "lead", base: "leads", label: "Lead" },
  { entity: "contact", base: "contacts", label: "Contato" },
  { entity: "company", base: "companies", label: "Empresa" },
  { entity: "deal", base: "deals", label: "Negócio" },
];

const FIELD_TOKEN = /^\{\{\s*(lead|contact|company|deal)\.((?:cf\.)?[a-z0-9_]{1,60})\s*(?:\|([^{}]{0,200}))?\}\}$/i;
const ANY_TOKEN = /\{\{\s*([\w.]+)\s*(?:\|([^{}]{0,200}))?\}\}/g;

/** Coluna do catálogo (ex.: `cf:setor`) → caminho do token (`cf.setor`). */
export function columnToPath(column: string): string {
  return column.startsWith(CUSTOM_FIELD_PREFIX)
    ? `cf.${column.slice(CUSTOM_FIELD_PREFIX.length)}`
    : column;
}

export function buildFieldToken(entity: VariableEntity, column: string, fallback?: string): string {
  const fb = (fallback ?? "").replace(/[{}|]/g, "").slice(0, 200);
  return `{{${entity}.${columnToPath(column)}${fb ? `|${fb}` : ""}}}`;
}

export function parseFieldToken(
  value: string,
): { entity: VariableEntity; path: string; fallback: string } | null {
  const m = FIELD_TOKEN.exec(value.trim());
  if (!m) return null;
  return { entity: m[1].toLowerCase() as VariableEntity, path: m[2].toLowerCase(), fallback: m[3] ?? "" };
}

function lookup(ctx: Record<string, unknown>, key: string): unknown {
  const lower = key.toLowerCase();
  if (lower in ctx) return ctx[lower];
  return lower.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>))
      return (acc as Record<string, unknown>)[part];
    return undefined;
  }, ctx);
}

function display(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(display).filter(Boolean).join(", ");
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return "";
  return String(v).trim();
}

/** Substitui tokens; usa o padrão quando vazio e falha se faltar valor sem padrão. */
export function renderRequiredTokens(text: string, ctx: Record<string, unknown>): string {
  return text.replace(ANY_TOKEN, (_m, key: string, fallback?: string) => {
    const value = display(lookup(ctx, key)) || (fallback ?? "").trim();
    if (!value) throw new Error("Variável sem valor atual autorizado.");
    return value;
  });
}

/** Remove colunas internas/sensíveis e expõe `custom_fields` como `cf`. */
export function sanitizeEntityRow(row: Record<string, unknown> | null | undefined) {
  if (!row) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!isBlockedFilterColumn(k)) out[k] = v;
  const cf = row.custom_fields;
  if (cf && typeof cf === "object" && !Array.isArray(cf)) {
    const custom: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cf as Record<string, unknown>))
      if (/^[a-z0-9_]{1,60}$/i.test(k)) custom[k.toLowerCase()] = v;
    out.cf = custom;
  }
  return out;
}

/** Indica se o texto usa campos de entidade (evita leitura quando não há). */
export function usesEntityTokens(text: string): boolean {
  return /\{\{\s*(lead|contact|company|deal)\./i.test(text);
}
