import { CANONICAL_APP_ORIGIN, PRODUCTION_APP_HOSTS } from "@/lib/platform-domains";

/** Origem permitida para links de convite; qualquer outra cai na canônica. */
export function safeInviteOrigin(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const okHost =
      PRODUCTION_APP_HOSTS.has(host) ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovableproject.com");
    if (u.protocol === "https:" && okHost && !u.port) return u.origin;
  } catch {
    /* origem inválida */
  }
  return CANONICAL_APP_ORIGIN;
}
