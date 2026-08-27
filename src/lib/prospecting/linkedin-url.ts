/**
 * Normalização de URLs de perfil pessoal do LinkedIn.
 *
 * Aceita as colagens mais comuns (`linkedin.com/in/x`, `www.`, `http://`,
 * `br.linkedin.com`, com parâmetros de rastreio) e devolve a forma canônica
 * `https://www.linkedin.com/in/<slug>`. Recusa páginas que não sejam de
 * perfil pessoal (empresa, publicação, busca).
 */

export type LinkedinUrlResult =
  | { ok: true; url: string; slug: string }
  | { ok: false; error: string };

const PROFILE_PATH = /^\/in\/([^/?#]+)/i;

/** Mensagem única para entradas que não são perfil pessoal. */
const NOT_A_PROFILE =
  "Informe o link de um perfil pessoal do LinkedIn (ex.: https://www.linkedin.com/in/nome-sobrenome).";

/**
 * Normaliza a entrada do usuário. Retorna `ok: false` com mensagem em
 * português quando a URL não é um perfil pessoal utilizável.
 */
export function normalizeLinkedinUrl(input: string | null | undefined): LinkedinUrlResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: "Informe o link do LinkedIn." };

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: NOT_A_PROFILE };
  }

  const host = parsed.hostname.toLowerCase();
  const isLinkedin = host === "linkedin.com" || host.endsWith(".linkedin.com");
  if (!isLinkedin) return { ok: false, error: NOT_A_PROFILE };

  const match = PROFILE_PATH.exec(parsed.pathname);
  if (!match) return { ok: false, error: NOT_A_PROFILE };

  // O slug pode vir percent-encoded (acentos) — mantemos decodificado.
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    slug = match[1];
  }
  slug = slug.replace(/\/+$/, "").trim();
  if (!slug) return { ok: false, error: NOT_A_PROFILE };

  return { ok: true, url: `https://www.linkedin.com/in/${slug}`, slug };
}

/** Igual a `normalizeLinkedinUrl`, mas devolve `null` em vez de erro. */
export function linkedinUrlOrNull(input: string | null | undefined): string | null {
  if (!input) return null;
  const result = normalizeLinkedinUrl(input);
  return result.ok ? result.url : null;
}

/** Compara duas URLs de LinkedIn ignorando variações de formato. */
export function sameLinkedinUrl(a: string | null | undefined, b: string | null | undefined) {
  return linkedinUrlOrNull(a) === linkedinUrlOrNull(b);
}
