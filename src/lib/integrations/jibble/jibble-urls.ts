// Hosts oficiais da API do Jibble (docs.api.jibble.io) e validação de URLs. Puro.
// Toda URL que o importador chama — inclusive @odata.nextLink e statusUrl — passa por
// aqui: só https, só hosts da lista, sem usuário/senha embutidos e sem porta estranha.

export const JIBBLE_HOSTS = {
  identity: "identity.prod.jibble.io",
  workspace: "workspace.prod.jibble.io",
  timeTracking: "time-tracking.prod.jibble.io",
  timeAttendance: "time-attendance.prod.jibble.io",
} as const;

export type JibbleService = keyof typeof JIBBLE_HOSTS;

const API_HOSTS = new Set<string>([
  JIBBLE_HOSTS.workspace,
  JIBBLE_HOSTS.timeTracking,
  JIBBLE_HOSTS.timeAttendance,
]);

export const JIBBLE_TOKEN_URL = `https://${JIBBLE_HOSTS.identity}/connect/token`;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isJibbleId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** URL de API permitida? (nunca o host de identidade nem o storage de exportação) */
export function isAllowedApiUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  return (
    u.protocol === "https:" &&
    API_HOSTS.has(u.hostname.toLowerCase()) &&
    (u.port === "" || u.port === "443") &&
    !u.username &&
    !u.password
  );
}

export function buildJibbleUrl(
  service: Exclude<JibbleService, "identity">,
  path: string,
  query?: Record<string, string | number | Array<string> | undefined | null>,
): string {
  if (!path.startsWith("/v1/")) throw new Error("Caminho do Jibble inválido.");
  const u = new URL(`https://${JIBBLE_HOSTS[service]}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v == null) continue;
    if (Array.isArray(v)) for (const item of v) u.searchParams.append(k, item);
    else u.searchParams.set(k, String(v));
  }
  const out = u.toString();
  if (!isAllowedApiUrl(out)) throw new Error("Host do Jibble fora da lista permitida.");
  return out;
}

/**
 * statusUrl do export assíncrono é relativo e deve ser chamado no MESMO host que recebeu
 * o pedido original (docs: "Async requests for OData collection endpoints").
 */
export function resolveStatusUrl(originalUrl: string, statusUrl: string): string {
  const base = new URL(originalUrl);
  const resolved = new URL(statusUrl, base);
  if (resolved.hostname !== base.hostname || !isAllowedApiUrl(resolved.toString())) {
    throw new Error("statusUrl do Jibble aponta para outro host.");
  }
  if (!/^\/v1\/AsyncExports\(/i.test(resolved.pathname)) {
    throw new Error("statusUrl do Jibble com caminho inesperado.");
  }
  return resolved.toString();
}

/**
 * URL assinada de download (303 Location). Só https e sem credenciais embutidas; é
 * baixada SEM o cabeçalho Authorization. Não pode apontar para hosts internos.
 */
export function isSafeDownloadUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return false; // IP literal
  return true;
}

/** Janelas mensais [from, to) em YYYY-MM-DD cobrindo o período inteiro. */
export function monthWindows(
  fromDate: string,
  toDate: string,
): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  const start = new Date(`${fromDate.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  let cur = start;
  while (cur <= end && out.length < 600) {
    const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    out.push({ from: cur.toISOString().slice(0, 10), to: next.toISOString().slice(0, 10) });
    cur = next;
  }
  return out;
}
