// Barreira contra horários inventados: toda hora citada pela Lia precisa ter
// vindo da agenda (ferramenta) ou já constar na conversa.

const TIME_RE = /\b([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)?\b(?!\s*(?:min|minutos|dias|horas))/gi;

/** Extrai horas citadas no texto, normalizadas como HH:MM. */
export function extractTimes(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(TIME_RE)) {
    const h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    out.add(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return [...out];
}

/** Horas da resposta que não aparecem em nenhuma fonte permitida. */
export function unverifiedTimes(reply: string, sources: string[]): string[] {
  const allowed = new Set(sources.flatMap(extractTimes));
  return extractTimes(reply).filter((t) => !allowed.has(t));
}
