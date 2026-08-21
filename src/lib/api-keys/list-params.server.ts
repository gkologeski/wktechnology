/**
 * Regras compartilhadas de paginação, ordenação e filtros de data das rotas
 * públicas `/api/public/v1/*`.
 *
 * Todas as listagens usam o mesmo contrato para facilitar integrações:
 * `limit`, `offset` (ou `page`), `from`, `to` e `order`.
 */

export type ListParams = {
  limit: number;
  offset: number;
  ascending: boolean;
  from: string | null;
  to: string | null;
};

export type ListMeta = {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function intParam(value: string | null, fallback: number): number {
  if (value == null || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** Aceita ISO 8601 completo ou apenas a data (`YYYY-MM-DD`). */
export function normalizeDateParam(value: string | null, endOfDay = false): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const iso = isDateOnly ? `${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : raw;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function parseListParams(url: URL): ListParams {
  const limit = Math.min(Math.max(intParam(url.searchParams.get("limit"), DEFAULT_LIMIT), 1), MAX_LIMIT);

  const offsetParam = url.searchParams.get("offset");
  const pageParam = url.searchParams.get("page");
  let offset = Math.max(intParam(offsetParam, 0), 0);
  if (offsetParam == null && pageParam != null) {
    const page = Math.max(intParam(pageParam, 1), 1);
    offset = (page - 1) * limit;
  }

  const order = (url.searchParams.get("order") ?? "desc").toLowerCase();

  return {
    limit,
    offset,
    ascending: order === "asc",
    from: normalizeDateParam(url.searchParams.get("from")),
    to: normalizeDateParam(url.searchParams.get("to"), true),
  };
}

export function buildMeta(params: ListParams, rows: number, total: number | null): ListMeta {
  const resolvedTotal = total ?? params.offset + rows;
  return {
    limit: params.limit,
    offset: params.offset,
    total: resolvedTotal,
    has_more: params.offset + rows < resolvedTotal,
  };
}

export function jsonError(error: string, status: number, details?: unknown): Response {
  return new Response(JSON.stringify(details === undefined ? { error } : { error, details }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
