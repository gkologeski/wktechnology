// Helpers for persisting WYSIWYG HTML fields without losing formatting
// and without storing visually-empty markup ("<p></p>", "<p><br></p>", etc.).
import { htmlToPlain, sanitizeHtml } from "@/components/rich-html-editor";

/**
 * Normaliza um valor HTML vindo do RichHtmlEditor antes de salvar.
 * - Retorna `null` quando o conteúdo é vazio (sem texto visível e sem mídia).
 * - Caso contrário, devolve o HTML sanitizado (idempotente em re-edições).
 */
export function normalizeHtmlField(html: string | null | undefined): string | null {
  if (!html) return null;
  const sanitized = sanitizeHtml(html);
  // Preserva conteúdo se houver texto OU elementos auto-fechados (img/br dentro de figure, etc.)
  if (htmlToPlain(sanitized).trim()) return sanitized;
  if (/<(img|video|audio|iframe)\b/i.test(sanitized)) return sanitized;
  return null;
}

/** Compara dois valores HTML após sanitização — útil para verificar round-trip. */
export function htmlEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return sanitizeHtml(a ?? "") === sanitizeHtml(b ?? "");
}
