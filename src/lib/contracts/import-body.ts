// Corpo do contrato importado: converte o texto lido do arquivo em HTML simples.
// Puro (sem navegador) para poder ser testado; o servidor ainda filtra o HTML.

const MAX_BODY = 400_000;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Linha que abre um novo bloco (cláusula, item numerado, título em caixa alta). */
function startsBlock(line: string): boolean {
  return (
    /^(CL[ÁA]USULA|PAR[ÁA]GRAFO|ANEXO|CONSIDERANDO)\b/i.test(line) ||
    /^\d+(\.\d+)*[.)]?\s+\S/.test(line) ||
    /^[a-z]\)\s/.test(line) ||
    (line.length <= 80 && line === line.toUpperCase() && /[A-ZÁÉÍÓÚÇ]{3}/.test(line))
  );
}

/** Junta linhas quebradas pelo PDF em parágrafos e devolve HTML com <p>. */
export function plainTextToBodyHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const paragraphs: string[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) paragraphs.push(cur.join(" "));
    cur = [];
  };
  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    if (startsBlock(line)) flush();
    cur.push(line);
    const heading = line.length <= 80 && line === line.toUpperCase() && /[A-ZÁÉÍÓÚÇ]{3}/.test(line);
    if (heading || (/[.:;]$/.test(line) && line.length < 60)) flush();
  }
  flush();
  const html = paragraphs.map((p) => `<p>${esc(p)}</p>`).join("");
  return html.length > MAX_BODY ? html.slice(0, MAX_BODY) : html;
}

/** HTML com texto de verdade (ignora conversões vazias). */
export function hasBodyText(html: string | null | undefined): boolean {
  return !!html && html.replace(/<[^>]+>/g, "").trim().length >= 40;
}

export const IMPORT_BODY_MAX = MAX_BODY;

/** Ajusta o corpo ao limite do servidor sem cortar uma tag pela metade. */
export function fitBodyHtml(html: string | null | undefined): { html: string | null; truncated: boolean } {
  if (!hasBodyText(html)) return { html: null, truncated: false };
  const h = html as string;
  if (h.length <= MAX_BODY) return { html: h, truncated: false };
  const note = "<p><em>[Corpo truncado: consulte o arquivo original para o texto completo.]</em></p>";
  const cut = h.slice(0, MAX_BODY - note.length);
  const end = cut.lastIndexOf("</p>");
  const safe = end > 0 ? cut.slice(0, end + 4) : cut.slice(0, cut.lastIndexOf("<"));
  return { html: safe + note, truncated: true };
}
