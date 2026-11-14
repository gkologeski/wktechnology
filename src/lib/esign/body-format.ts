import { sanitizeTemplateHtml } from "@/lib/contracts/template-html-format";

/** Marcador gravado pelo banco quando o documento guarda o HTML do modelo. */
export const ESIGN_HTML_MARKER = "<!--techerp:html-->";

export function isHtmlEsignBody(body: string | null | undefined): boolean {
  return (body ?? "").startsWith(ESIGN_HTML_MARKER);
}

/** HTML seguro para exibir; null quando o documento é texto puro (formato antigo). */
export function esignBodyHtml(body: string | null | undefined): string | null {
  if (!isHtmlEsignBody(body)) return null;
  return sanitizeTemplateHtml((body ?? "").slice(ESIGN_HTML_MARKER.length));
}
