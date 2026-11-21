import { CANONICAL_APP_ORIGIN, PRODUCTION_APP_HOSTS } from "@/lib/platform-domains";

/** Convites só redirecionam para hosts oficiais por https; qualquer outro vira a origem canônica. */
export function resolveInviteOrigin(origin: string | undefined | null): string {
  if (!origin) return CANONICAL_APP_ORIGIN;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port) {
      return CANONICAL_APP_ORIGIN;
    }
    return PRODUCTION_APP_HOSTS.has(host) && host !== "wktechnology.lovable.app"
      ? `https://${host}`
      : CANONICAL_APP_ORIGIN;
  } catch {
    return CANONICAL_APP_ORIGIN;
  }
}
