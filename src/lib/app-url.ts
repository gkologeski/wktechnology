// URL canônica da aplicação. Em runtime (cliente) preferimos o host
// atual; no SSR/build usamos VITE_APP_URL ou o domínio publicado padrão.
const FALLBACK = "https://app.wktechnology.com.br";

export function getAppUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const envUrl =
    (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_APP_URL?: string } }).env?.VITE_APP_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_APP_URL) ||
    (typeof process !== "undefined" && process.env?.APP_URL);
  return envUrl || FALLBACK;
}

// Constante para uso em `head()` (SSR-safe). No cliente, código que precisa
// do host atual deve chamar `getAppUrl()` em runtime.
export const APP_URL = getAppUrl();
