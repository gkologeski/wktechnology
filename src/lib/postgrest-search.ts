// Neutraliza termo de busca usado dentro de filtros `.or()` do PostgREST.
// Remove delimitadores de sintaxe (vírgula, parênteses, aspas, barra invertida,
// dois-pontos, asterisco) e curingas, impedindo injeção de condições extras.
export function orSafeTerm(raw: string, max = 120): string {
  return String(raw ?? "")
    .slice(0, max)
    .replace(/[,()"'\\:*%_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** `%termo%` seguro para `.or("col.ilike.<padrão>")`. */
export function orSafeLike(raw: string, max = 120): string {
  return `%${orSafeTerm(raw, max)}%`;
}
