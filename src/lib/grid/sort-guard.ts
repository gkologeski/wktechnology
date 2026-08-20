// Validação da coluna de ordenação dos grids.
//
// A ordenação pode vir de uma preferência salva do usuário, então nunca deve
// entrar direto em `.order()`. Aqui ela é validada contra as colunas realmente
// existentes (declaradas na tela ∪ catálogo dinâmico da entidade) e cai no
// padrão do grid quando inválida.
import { isPlainColumn } from "@/lib/grid/dynamic-select";

export type SortDir = "asc" | "desc";

export function normalizeSortDir(dir: unknown, fallback: SortDir = "desc"): SortDir {
  return dir === "asc" || dir === "desc" ? dir : fallback;
}

/**
 * @param key chave candidata (pode ser nula ou uma coluna virtual como `custom:x`)
 * @param allowed colunas de banco permitidas
 * @param fallback coluna padrão do grid
 */
export function resolveSortKey(
  key: string | null | undefined,
  allowed: Iterable<string>,
  fallback: string,
): string {
  if (!key || !isPlainColumn(key)) return fallback;
  for (const a of allowed) if (a === key) return key;
  return fallback;
}
