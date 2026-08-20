// Projeção dinâmica para grids: em vez de `select("*")`, a consulta busca
// apenas as colunas base (obrigatórias para ações/seleção da tela) somadas às
// colunas realmente visíveis escolhidas pelo usuário no editor de colunas.

/**
 * Impede que a string de projeção seja analisada no nível de tipos pelo
 * supabase-js (ver armadilha de typecheck lento em CLAUDE.md).
 */
export const sel = (s: string): string => s;

/** Nome de coluna simples de banco (evita injeção via preferência salva). */
const COLUMN_RE = /^[a-z_][a-z0-9_]*$/i;

export function isPlainColumn(key: string): boolean {
  return COLUMN_RE.test(key);
}

/**
 * Monta a projeção do grid.
 *
 * @param baseKeys colunas sempre necessárias (id, chaves de ações, kanban, filtros)
 * @param extraKeys colunas vindas das colunas automáticas visíveis
 * @param opts.customFields inclui `custom_fields` (colunas personalizadas visíveis)
 */
export function buildGridSelect(
  baseKeys: readonly string[],
  extraKeys: readonly string[] = [],
  opts: { customFields?: boolean } = {},
): string {
  const out = new Set<string>(["id"]);
  for (const k of baseKeys) if (k) out.add(k);
  for (const k of extraKeys) if (isPlainColumn(k)) out.add(k);
  if (opts.customFields) out.add("custom_fields");
  return sel(Array.from(out).join(", "));
}

/** Chave estável para usar em `queryKey` (a ordem do Set não deve gerar refetch). */
export function selectKeysSignature(keys: readonly string[]): string {
  return keys.slice().sort().join(",");
}
