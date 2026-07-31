// Paginação de leituras do Data API (PostgREST) — evita o corte silencioso em
// 1.000 linhas nas tabelas de catálogo de permissões, que já cresceram acima
// desse limite (permissions ~1.6k, permission_set_items ~8.8k linhas).
// Módulo client-safe: apenas lógica pura, sem segredos e sem cliente admin.

export const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Executa `buildPage(from, to)` em lotes sequenciais até esgotar as linhas.
 * `buildPage` deve retornar uma query já com `.range(from, to)` aplicado.
 */
export async function fetchAllPages<T>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const res = await buildPage(offset, offset + pageSize - 1);
    if (res.error) throw new Error(res.error.message);
    const rows = res.data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
