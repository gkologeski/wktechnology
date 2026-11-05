// Casamento puro entre a rota atual e o route_pattern dos artigos da Ajuda.
// Padrões usam a sintaxe do roteador: segmentos "$param" casam qualquer valor.

export function normalizeHelpPath(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

export function matchesRoutePattern(pattern: string, path: string): boolean {
  const p = normalizeHelpPath(pattern).split("/");
  const s = normalizeHelpPath(path).split("/");
  if (p.length !== s.length) return false;
  return p.every((seg, i) => (seg.startsWith("$") ? s[i].length > 0 : seg === s[i]));
}

/** Escolhe o padrão mais específico (mais segmentos literais) que casa com a rota. */
export function pickRouteArticle<T extends {
  route_pattern: string | null;
  article_type: string;
  sort_order?: number;
  slug?: string;
}>(
  articles: T[],
  path: string,
): T | null {
  const score = (a: T) => {
    const segs = normalizeHelpPath(a.route_pattern ?? "").split("/");
    const literals = segs.filter((x) => !x.startsWith("$")).length;
    const typeBonus = a.article_type === "howto" ? 0.5 : a.article_type === "overview" ? 0.25 : 0;
    return literals + typeBonus;
  };
  const hits = articles.filter(
    (a) => a.route_pattern && matchesRoutePattern(a.route_pattern, path),
  );
  if (hits.length === 0) return null;
  return hits.sort((a, b) =>
    score(b) - score(a) ||
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    (a.slug ?? "").localeCompare(b.slug ?? ""),
  )[0];
}
