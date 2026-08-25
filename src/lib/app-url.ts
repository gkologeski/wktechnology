// URL canônica da aplicação. Em runtime (cliente) preferimos o host
// atual; no SSR/build usamos VITE_APP_URL ou o domínio publicado padrão.
const FALLBACK = "https://app.wktechnology.com.br";

// Host público canônico para todo link entregue a terceiros (cotação,
// portal, formulário, arquivo compartilhado, convite, reunião, etc.).
export const CANONICAL_PUBLIC_URL = "https://app.wktechnology.com.br";

// Hosts de produção conhecidos. Se o navegador estiver em um destes, o
// link público mantém o host atual; qualquer outro host (preview,
// localhost, custom domain novo) é normalizado para o canônico.
const PROD_HOSTS = new Set([
  "app.wktechnology.com.br",
  "crm.wktechnology.com.br",
  "ats.wktechnology.com.br",
  "wktechnology.lovable.app",
]);

export function getAppUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const envUrl =
    (typeof import.meta !== "undefined" &&
      (import.meta as { env?: { VITE_APP_URL?: string } }).env?.VITE_APP_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_APP_URL) ||
    (typeof process !== "undefined" && process.env?.APP_URL);
  return envUrl || FALLBACK;
}

/**
 * Retorna a base URL a ser usada em QUALQUER link público entregue a
 * terceiros. No cliente, respeita o host atual apenas se for de produção;
 * caso contrário (preview, localhost, domínios não reconhecidos) retorna
 * o host canônico. No servidor, usa PUBLIC_APP_URL somente se apontar
 * para um host de produção, senão retorna o canônico.
 */
export function getPublicAppUrl(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    if (PROD_HOSTS.has(window.location.hostname)) {
      return window.location.origin;
    }
    return CANONICAL_PUBLIC_URL;
  }
  const envUrl =
    (typeof process !== "undefined" && (process.env?.PUBLIC_APP_URL || process.env?.APP_URL)) || "";
  if (envUrl) {
    try {
      const u = new URL(envUrl);
      if (PROD_HOSTS.has(u.hostname)) return `${u.protocol}//${u.host}`;
    } catch {
      /* fall through */
    }
  }
  return CANONICAL_PUBLIC_URL;
}

// Constante para uso em `head()` (SSR-safe). No cliente, código que precisa
// do host atual deve chamar `getAppUrl()` em runtime.
export const APP_URL = getAppUrl();
