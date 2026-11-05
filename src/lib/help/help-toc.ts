// Índice por títulos (## e ###) e âncoras estáveis para artigos da Ajuda.

export function headingId(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "secao"
  );
}

export function extractToc(md: string): Array<{ id: string; text: string; level: 2 | 3 }> {
  const out: Array<{ id: string; text: string; level: 2 | 3 }> = [];
  let inFence = false;
  for (const line of md.split("\n")) {
    if (line.trim().startsWith("```")) inFence = !inFence;
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ id: headingId(m[2]), text: m[2], level: m[1].length as 2 | 3 });
  }
  return out;
}

/** Converte o marcador "<<termo>>" do ts_headline em partes destacáveis. */
export function splitHighlight(snippet: string): Array<{ text: string; hit: boolean }> {
  return snippet
    .split(/(<<.*?>>)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("<<") && part.endsWith(">>")
        ? { text: part.slice(2, -2), hit: true }
        : { text: part, hit: false },
    );
}
