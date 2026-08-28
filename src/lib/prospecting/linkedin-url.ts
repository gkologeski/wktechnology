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

const EXAMPLE = "https://www.linkedin.com/in/nome-sobrenome";

/** Mensagens específicas por tipo de falha (ajudam a corrigir a colagem). */
const MSG = {
  empty: "Informe o link do LinkedIn.",
  malformed: `Link inválido. Cole a URL completa do perfil (ex.: ${EXAMPLE}).`,
  otherHost: `Este link não é do LinkedIn. Cole a URL do perfil (ex.: ${EXAMPLE}).`,
  companyPage:
    "Este é um link de página de empresa (/company). Informe o perfil pessoal do contato (/in/...).",
  schoolPage:
    "Este é um link de instituição (/school). Informe o perfil pessoal do contato (/in/...).",
  postOrFeed:
    "Este é um link de publicação/feed do LinkedIn. Abra o perfil do contato e copie a URL (/in/...).",
  searchPage:
    "Este é um link de busca do LinkedIn. Abra o perfil do contato e copie a URL (/in/...).",
  salesNavigator:
    "Links do Sales Navigator não são aceitos. Abra o perfil público do contato e copie a URL (/in/...).",
  notProfile: `Informe o link de um perfil pessoal do LinkedIn (ex.: ${EXAMPLE}).`,
} as const;

/** Classifica caminhos conhecidos que não são perfil pessoal. */
function pathError(pathname: string): string {
  const p = pathname.toLowerCase();
  if (p.startsWith("/company/") || p === "/company") return MSG.companyPage;
  if (p.startsWith("/school/") || p === "/school") return MSG.schoolPage;
  if (p.startsWith("/sales/")) return MSG.salesNavigator;
  if (p.startsWith("/posts/") || p.startsWith("/feed") || p.startsWith("/pulse/"))
    return MSG.postOrFeed;
  if (p.startsWith("/search")) return MSG.searchPage;
  return MSG.notProfile;
}

/**
 * Normaliza a entrada do usuário. Retorna `ok: false` com mensagem em
 * português específica para o tipo de link informado.
 */
export function normalizeLinkedinUrl(input: string | null | undefined): LinkedinUrlResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: MSG.empty };

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: MSG.malformed };
  }

  const host = parsed.hostname.toLowerCase();
  const isLinkedin = host === "linkedin.com" || host.endsWith(".linkedin.com");
  if (!isLinkedin) return { ok: false, error: MSG.otherHost };

  if (host.startsWith("sales.")) return { ok: false, error: MSG.salesNavigator };

  const match = PROFILE_PATH.exec(parsed.pathname);
  if (!match) return { ok: false, error: pathError(parsed.pathname) };

  // O slug pode vir percent-encoded (acentos) — mantemos decodificado.
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    slug = match[1];
  }
  slug = slug.replace(/\/+$/, "").trim();
  if (!slug) return { ok: false, error: MSG.notProfile };

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
