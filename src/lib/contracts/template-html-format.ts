// Filtro de HTML de modelos importados e aplicação determinística das variáveis.
// Mantém só tags e estilos de formatação seguros, preservando o layout original.

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "sup",
  "sub",
  "span",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
]);
const ALLOWED_CSS = new Set([
  "text-align",
  "margin-left",
  "margin-right",
  "margin-top",
  "margin-bottom",
  "text-indent",
  "line-height",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-transform",
  "color",
  "border",
  "border-collapse",
  "padding",
  "vertical-align",
  "width",
]);

function cleanStyle(value: string): string {
  return value
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(":");
      if (i < 0) return null;
      const prop = d.slice(0, i).trim().toLowerCase();
      const val = d.slice(i + 1).trim();
      if (!ALLOWED_CSS.has(prop)) return null;
      if (!/^[#\w\s.,%()-]+$/.test(val) || /expression|url|javascript/i.test(val)) return null;
      return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join("; ");
}

export function sanitizeTemplateHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(
      /<\s*(\/?)\s*([a-z0-9]+)\b([^>]*)>/gi,
      (_m, close: string, rawTag: string, attrs: string) => {
        const tag = rawTag.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) return "";
        if (close) return `</${tag}>`;
        const kept: string[] = [];
        for (const a of attrs.matchAll(/([a-z-]+)\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
          const name = a[1]!.toLowerCase();
          const value = a[3] ?? a[4] ?? "";
          if (name === "style") {
            const s = cleanStyle(value);
            if (s) kept.push(`style="${s.replace(/"/g, "")}"`);
          } else if ((name === "colspan" || name === "rowspan") && /^\d{1,2}$/.test(value)) {
            kept.push(`${name}="${value}"`);
          }
        }
        return `<${tag}${kept.length ? " " + kept.join(" ") : ""}>`;
      },
    );
}

const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Substitui trechos originais por variáveis apenas no TEXTO (nunca em tags/atributos).
 * Trechos mais longos primeiro, para não quebrar substituições maiores.
 */
export function applyTokenSuggestions(
  html: string,
  suggestions: Array<{ original?: string | null; token?: string | null }>,
): { html: string; unmatched: string[] } {
  const valid = suggestions
    .map((s) => ({ original: (s.original ?? "").trim(), token: (s.token ?? "").trim() }))
    .filter((s) => s.original.length >= 2 && /^\{\{[\w.]+\}\}$/.test(s.token))
    .sort((a, b) => b.original.length - a.original.length);
  const hits = new Set<string>();
  const out = `>${html}<`.replace(/>([^<]+)</g, (_m, text: string) => {
    let t = text;
    for (const s of valid) {
      const re = new RegExp(escRe(escText(s.original)), "g");
      if (re.test(t)) {
        hits.add(s.original);
        t = t.replace(re, s.token);
      }
    }
    return `>${t}<`;
  });
  return {
    html: out.slice(1, -1),
    unmatched: valid.filter((s) => !hits.has(s.original)).map((s) => s.original),
  };
}
