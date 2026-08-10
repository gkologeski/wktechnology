// Semelhança entre o título do contrato e o nome da pessoa.
// Módulo client-safe: usado para ordenar o seletor de contrato de prestação
// na alocação de pessoas (apresentação apenas, nada é escondido).

const PARTICLES = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "del", "la"]);

/** Remove acentos, pontuação e normaliza espaços/caixa. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Remove prefixos entre colchetes, ex.: "[PRESTAÇÃO] [ADITIVO 2] ...". */
function stripTitlePrefixes(title: string): string {
  return title.replace(/\[[^\]]*\]/g, " ");
}

function nameTokens(personName: string): string[] {
  return normalize(personName)
    .split(" ")
    .filter((t) => t.length > 1 && !PARTICLES.has(t));
}

/**
 * Pontuação de 0 (nenhuma relação) a 100.
 *  - nome completo (todos os tokens relevantes) presente no título → maior peso;
 *  - sobrenomes presentes → peso médio;
 *  - apenas primeiro nome → peso menor.
 */
export function scoreContractTitleForPerson(
  title: string | null | undefined,
  personName: string | null | undefined,
): number {
  const tokens = nameTokens(personName ?? "");
  if (!tokens.length) return 0;
  const haystack = normalize(stripTitlePrefixes(title ?? ""));
  if (!haystack) return 0;

  const present = tokens.filter((t) => haystack.includes(t));
  if (!present.length) return 0;

  const first = tokens[0] as string;
  const surnames = tokens.slice(1);
  const surnamesPresent = surnames.filter((t) => haystack.includes(t)).length;

  if (present.length === tokens.length) return 100;
  if (surnamesPresent > 0 && present.includes(first)) {
    return 70 + Math.round((surnamesPresent / Math.max(surnames.length, 1)) * 20);
  }
  if (surnamesPresent > 0) {
    return 40 + Math.round((surnamesPresent / Math.max(surnames.length, 1)) * 20);
  }
  return 25;
}

/** Divide a lista em prováveis (score > 0, ordem decrescente) e o restante. */
export function splitContractsByPersonMatch<T>(
  items: T[],
  personName: string | null | undefined,
  getTitle: (item: T) => string,
): { likely: T[]; others: T[] } {
  const scored = items.map((item, index) => ({
    item,
    index,
    score: scoreContractTitleForPerson(getTitle(item), personName),
  }));
  const likely = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.item);
  const others = scored.filter((s) => s.score === 0).map((s) => s.item);
  return { likely, others };
}
