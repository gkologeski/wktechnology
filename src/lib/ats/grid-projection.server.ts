// Projeção dinâmica das listagens do TechHire.
//
// As colunas extras e a coluna de ordenação chegam do cliente (preferência
// salva do usuário), então nunca entram cruas em `select`/`order`: aqui elas são
// validadas contra o catálogo real da tabela (`get_entity_field_catalog`) e
// contra o formato de nome de coluna simples.
import { isPlainColumn } from "@/lib/grid/dynamic-select";

export type AtsCatalogTable =
  | "ats_jobs"
  | "ats_candidates"
  | "ats_applications"
  | "ats_interviews"
  | "ats_offers";

/** Colunas nunca projetadas dinamicamente (payloads pesados/sensíveis). */
const NEVER_PROJECT = new Set<string>([
  "hs_raw",
  "external_ids",
  "portal_token",
  "self_schedule_token",
]);

/** Cliente Supabase autenticado (tipo relaxado: a RPC é chamada por nome). */
export type SupabaseLike = { rpc: unknown };

async function realColumns(
  supabase: SupabaseLike,
  table: AtsCatalogTable,
  userId: string,
): Promise<Set<string>> {
  try {
    const rpc = supabase.rpc as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>;
    const { data, error } = await rpc.call(supabase, "get_entity_field_catalog", {
      p_table: table,
      p_owner_id: userId,
    });
    if (error) return new Set();
    const rows = (data ?? []) as Array<{ column_name?: string }>;
    return new Set(rows.map((r) => r.column_name).filter((c): c is string => !!c));
  } catch {
    return new Set();
  }
}

export type AtsGridProjection = {
  /** Colunas extras aprovadas (já existentes na tabela). */
  extras: string[];
  /** Coluna de ordenação aprovada, ou `null` para manter o padrão da função. */
  sortKey: string | null;
  sortDir: "asc" | "desc";
};

/**
 * Valida `extraColumns`/`sortKey`/`sortDir` vindos do cliente.
 * Chave inexistente é descartada; ordenação inválida volta para `null`
 * (a função de listagem mantém então sua ordenação padrão).
 */
export async function resolveAtsGridProjection(
  supabase: SupabaseLike,
  userId: string,
  table: AtsCatalogTable,
  input: { extraColumns?: string[]; sortKey?: string | null; sortDir?: "asc" | "desc" | null },
): Promise<AtsGridProjection> {
  const wanted = (input.extraColumns ?? []).filter(
    (k) => isPlainColumn(k) && !NEVER_PROJECT.has(k),
  );
  const wantsSort =
    !!input.sortKey && isPlainColumn(input.sortKey) && !NEVER_PROJECT.has(input.sortKey);
  if (!wanted.length && !wantsSort) {
    return { extras: [], sortKey: null, sortDir: input.sortDir === "asc" ? "asc" : "desc" };
  }
  const columns = await realColumns(supabase, table, userId);
  const extras = wanted.filter((k) => columns.has(k));
  const sortKey =
    wantsSort && columns.has(input.sortKey as string) ? (input.sortKey as string) : null;
  return { extras, sortKey, sortDir: input.sortDir === "asc" ? "asc" : "desc" };
}
