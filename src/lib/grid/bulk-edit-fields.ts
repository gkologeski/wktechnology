// Validação e normalização de valores para a edição em massa dos grids.
// Sem dependência de UI nem de Supabase: é compartilhado entre o diálogo
// (cliente) e a server function que aplica o update.

/**
 * Entidades habilitadas para edição em massa. Deve permanecer alinhada com a
 * lista de tabelas aceitas por `public.get_entity_field_catalog`.
 */
export const BULK_EDIT_ENTITIES = [
  "leads",
  "contacts",
  "companies",
  "deals",
  "tickets",
  "activities",
  "ats_jobs",
  "ats_candidates",
  "ats_applications",
  "ats_interviews",
  "ats_offers",
  "projects",
  "project_tasks",
  "project_milestones",
  "contracts",
  "financial_entries",
  "bank_payments",
  "quotes",
  "proposals",
  "services",
  "recurring_plans",
  "subscription_invoices",
  "customer_invoices",
] as const;

export type BulkEditEntity = (typeof BULK_EDIT_ENTITIES)[number];

export function isBulkEditEntity(v: string): v is BulkEditEntity {
  return (BULK_EDIT_ENTITIES as readonly string[]).includes(v);
}

/**
 * Colunas que nunca podem ser sobrescritas em massa: chaves, isolamento de
 * tenant, auditoria e payloads brutos de integração.
 */
export const BULK_EDIT_DENIED_COLUMNS = new Set<string>([
  "id",
  "workspace_id",
  "owner_id",
  "created_at",
  "updated_at",
  "created_by",
  "deleted_at",
  "portal_token",
  "hs_raw",
  "external_ids",
  "custom_fields",
  "search_vector",
]);

/** Bloqueia também qualquer resquício de sincronização (`hs_*` / `hubspot_*`). */
export function isBulkEditDeniedColumn(col: string): boolean {
  return BULK_EDIT_DENIED_COLUMNS.has(col) || /^(hs_|hubspot_)/.test(col);
}

export class BulkEditValidationError extends Error {}

function fail(msg: string): never {
  throw new BulkEditValidationError(msg);
}

/**
 * Converte um valor cru (vindo do diálogo) para o tipo da coluna no banco.
 * Retorna `null` quando o usuário optou por limpar o campo.
 */
export function coerceBulkValue(column: string, dataType: string, raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) return null;

  if (dataType === "boolean") {
    if (typeof raw === "boolean") return raw;
    const s = String(raw).toLowerCase();
    if (s === "true" || s === "sim") return true;
    if (s === "false" || s === "não" || s === "nao") return false;
    return fail(`${column}: valor booleano inválido.`);
  }

  if (
    dataType === "integer" ||
    dataType === "bigint" ||
    dataType === "smallint" ||
    dataType === "numeric" ||
    dataType === "double precision" ||
    dataType === "real"
  ) {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) return fail(`${column}: número inválido.`);
    if (dataType === "integer" || dataType === "bigint" || dataType === "smallint") {
      if (!Number.isInteger(n)) return fail(`${column}: informe um número inteiro.`);
    }
    return n;
  }

  if (dataType.startsWith("timestamp") || dataType === "date") {
    const s = String(raw);
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return fail(`${column}: data inválida.`);
    return dataType === "date" ? d.toISOString().slice(0, 10) : d.toISOString();
  }

  if (dataType === "jsonb" || dataType === "json") {
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(String(raw));
    } catch {
      return fail(`${column}: JSON inválido.`);
    }
  }

  if (dataType === "ARRAY" || dataType.endsWith("[]")) {
    if (Array.isArray(raw)) return raw;
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (dataType === "uuid") {
    const s = String(raw).trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
      return fail(`${column}: identificador inválido.`);
    }
    return s;
  }

  return typeof raw === "string" ? raw : String(raw);
}

/**
 * Monta o payload final do update validando cada coluna contra o catálogo
 * de colunas da tabela (`column_name` → `data_type`).
 */
export function buildBulkPayload(
  values: Record<string, unknown>,
  columnTypes: Map<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [column, raw] of Object.entries(values)) {
    if (isBulkEditDeniedColumn(column)) fail(`${column}: campo não pode ser alterado em massa.`);
    const dataType = columnTypes.get(column);
    if (!dataType) fail(`${column}: campo inexistente nesta entidade.`);
    payload[column] = coerceBulkValue(column, dataType, raw);
  }
  if (Object.keys(payload).length === 0) fail("Nenhum campo selecionado para alteração.");
  return payload;
}

/** Tamanho do lote enviado por request (evita URL longa no filtro `in`). */
export const BULK_EDIT_CHUNK_SIZE = 200;

export function chunkIds(ids: string[], size = BULK_EDIT_CHUNK_SIZE): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * Pares de colunas que guardam o MESMO dado (mesmo tipo) em tabelas que
 * carregam a coluna canônica e a legada. Telas e RLS ainda leem a legada em
 * algumas entidades, então uma edição em massa deve gravar as duas.
 */
export const MIRRORED_COLUMN_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["assigned_to", "assigned_user_id"],
];

/**
 * Espelha o valor entre colunas equivalentes quando ambas existem na tabela,
 * evitando "sucesso" que não altera o responsável exibido nos grids.
 */
export function mirrorAliasColumns(
  payload: Record<string, unknown>,
  columnTypes: Map<string, string>,
): Record<string, unknown> {
  const out = { ...payload };
  for (const [a, b] of MIRRORED_COLUMN_PAIRS) {
    const hasA = Object.prototype.hasOwnProperty.call(payload, a);
    const hasB = Object.prototype.hasOwnProperty.call(payload, b);
    if (hasA && hasB) continue; // usuário definiu ambas explicitamente
    if (hasA && columnTypes.has(b)) out[b] = payload[a];
    else if (hasB && columnTypes.has(a)) out[a] = payload[b];
  }
  return out;
}
