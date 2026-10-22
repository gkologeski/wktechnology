// Escapes para conteúdo não confiável em HTML de e-mail e células CSV.
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Neutraliza fórmulas de planilha (=, +, -, @, tab, CR) prefixando apóstrofo.
 * Exceção: telefone E.164 puro ("+" e só dígitos) não executa nada e é a
 * identidade canônica do número; prefixar quebraria cópia, busca e reimportação.
 */
export function neutralizeCsvFormula(value: string): string {
  if (/^\+[1-9]\d{1,14}$/.test(value)) return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
