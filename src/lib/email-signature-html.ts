/** Remove the Gmail signature editor shell, never the signature's own tables. */
export function cleanEmailSignatureHtml(html: string): string {
  const opening = /^\s*<table\b[^>]*\bclass=["']An["'][^>]*>\s*<tbody>\s*<tr>\s*<td\b[^>]*\bclass=["']Ap["'][^>]*>\s*<div\b[^>]*\bclass=["']IN["'][^>]*>\s*<div\b[^>]*\bclass=["'][^"']*\beditable\b[^"']*["'][^>]*>/i;
  const closing = /<\/div>\s*<\/div>\s*<\/td>\s*<\/tr>\s*<\/tbody>\s*<\/table>\s*$/i;
  const start = opening.exec(html);
  if (!start || !closing.test(html) || !/\bheight\s*:\s*\d+(?:\.\d+)?(?:px|pt)\b/i.test(start[0])) {
    return html;
  }
  return html.slice(start[0].length).replace(closing, "");
}