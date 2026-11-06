// Trechos do texto do template ao redor de cada variável {{n}} (apresentação).

/** Divide o texto em partes de texto e variáveis, para destacar {{n}}. */
export function splitTemplateBody(body: string): Array<{ text: string; variable?: string }> {
  const parts: Array<{ text: string; variable?: string }> = [];
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index) });
    parts.push({ text: `{{${m[1]}}}`, variable: m[1] });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}

/** Trecho curto em volta da primeira ocorrência de {{n}}; null se ausente. */
export function variableSnippet(body: string, n: number, radius = 30): string | null {
  const re = new RegExp(`\\{\\{\\s*${n}\\s*\\}\\}`);
  const m = re.exec(body);
  if (!m) return null;
  const start = Math.max(0, m.index - radius);
  const end = Math.min(body.length, m.index + m[0].length + radius);
  const core = body.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${core}${end < body.length ? "…" : ""}`;
}
