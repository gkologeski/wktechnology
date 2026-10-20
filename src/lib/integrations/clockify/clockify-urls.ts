// URLs oficiais da API do Clockify (docs.clockify.me › API URLs / Regional Server Prefixes).
// Pura e client-safe. Só monta URLs em hosts *.clockify.me conhecidos, nunca a partir
// de texto livre, para impedir SSRF e vazamento da chave para outro host.

export const CLOCKIFY_REGIONS = ["global", "euc1", "use2", "euw2", "apse2"] as const;
export type ClockifyRegion = (typeof CLOCKIFY_REGIONS)[number];

export const CLOCKIFY_REGION_LABEL: Record<ClockifyRegion, string> = {
  global: "Global (padrão)",
  euc1: "UE — Alemanha (euc1)",
  use2: "EUA (use2)",
  euw2: "Reino Unido (euw2)",
  apse2: "Austrália (apse2)",
};

/** Subdomínio de workspace Clockify (ex.: "minhaempresa" de minhaempresa.clockify.me). */
const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** Hosts reservados do Clockify que não podem ser usados como subdomínio de workspace. */
const RESERVED_SUBDOMAINS = new Set([
  "api",
  "reports",
  "developer",
  "app",
  "www",
  "global",
  ...CLOCKIFY_REGIONS,
]);

export const CLOCKIFY_ID_RE = /^[0-9a-f]{24}$/i;

export function isClockifyId(value: unknown): value is string {
  return typeof value === "string" && CLOCKIFY_ID_RE.test(value);
}

export function normalizeSubdomain(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  // Aceita "empresa", "empresa.clockify.me" ou "https://empresa.clockify.me/".
  const host = v
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.clockify\.me$/, "");
  if (!SUBDOMAIN_RE.test(host) || RESERVED_SUBDOMAINS.has(host)) {
    throw new Error("Subdomínio do Clockify inválido. Use apenas o nome, ex.: minhaempresa.");
  }
  return host;
}

export function assertRegion(raw: string | null | undefined): ClockifyRegion {
  const v = (raw ?? "global") as ClockifyRegion;
  if (!CLOCKIFY_REGIONS.includes(v)) throw new Error("Região do Clockify inválida.");
  return v;
}

export type ClockifyBases = { api: string; reports: string };

/** Bases oficiais por região/subdomínio. */
export function clockifyBases(region: ClockifyRegion, subdomain: string | null): ClockifyBases {
  if (region === "global") {
    return subdomain
      ? {
          api: "https://api.clockify.me/api/v1",
          reports: `https://${subdomain}.clockify.me/report/v1`,
        }
      : { api: "https://api.clockify.me/api/v1", reports: "https://reports.api.clockify.me/v1" };
  }
  return {
    api: `https://${region}.clockify.me/api/v1`,
    reports: subdomain
      ? `https://${subdomain}.clockify.me/report/v1`
      : `https://${region}.clockify.me/report/v1`,
  };
}

/** Caminhos permitidos (somente leitura). Qualquer outro é recusado. */
const GET_PATHS: RegExp[] = [
  /^\/user$/,
  /^\/workspaces$/,
  /^\/workspaces\/[0-9a-f]{24}$/i,
  /^\/workspaces\/[0-9a-f]{24}\/(users|clients|projects|tags|user-groups|custom-fields|approval-requests|expenses|invoices|holidays|time-off\/policies)$/i,
  /^\/workspaces\/[0-9a-f]{24}\/projects\/[0-9a-f]{24}\/tasks$/i,
  /^\/workspaces\/[0-9a-f]{24}\/user\/[0-9a-f]{24}\/time-entries$/i,
  /^\/workspaces\/[0-9a-f]{24}\/time-entries\/status\/in-progress$/i,
];
/** Relatórios: POST de consulta (leitura), documentado pelo Clockify. */
const REPORT_PATHS: RegExp[] = [/^\/workspaces\/[0-9a-f]{24}\/reports\/summary$/i];

export function buildClockifyUrl(
  bases: ClockifyBases,
  kind: "api" | "reports",
  path: string,
  query?: Record<string, string | number | boolean | Array<string> | undefined | null>,
): string {
  const allowed = kind === "api" ? GET_PATHS : REPORT_PATHS;
  if (!allowed.some((re) => re.test(path))) {
    throw new Error(`Endpoint do Clockify não permitido: ${path}`);
  }
  const url = new URL(`${bases[kind]}${path}`);
  if (!url.hostname.endsWith(".clockify.me") || url.protocol !== "https:") {
    throw new Error("Host do Clockify inválido.");
  }
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else url.searchParams.set(k, String(v));
  }
  return url.toString();
}
