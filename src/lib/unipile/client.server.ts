// Cliente server-only para a API Unipile (LinkedIn).
// Implementa throttling human-like: cap mínimo, jitter, budget diário,
// pausa de café e janela horária por conta. Persiste rate buckets e
// log de requisições para observabilidade.
//
// IMPORTANTE: este módulo é server-only. Nunca importar no topo de
// arquivos *.functions.ts que rotas/componentes importam — fazer
// `await import("@/lib/unipile/client.server")` dentro do handler.

import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// --------- Tipos ---------

export type UnipileEndpoint =
  | "profile.fetch"
  | "profile.search"
  | "message.send"
  | "invite.send"
  | "chat.list"
  | "hosted.link"
  | "job.publish";


export interface ThrottleBudget {
  minIntervalMs: number;
  jitterMs: [number, number]; // [min, max] uniforme
  dailyLimit: number;
  coffeeBreakEvery: [number, number]; // a cada N requisições (random nesse intervalo)
  coffeeBreakMs: [number, number]; // duração da pausa
}

const BUDGETS: Record<UnipileEndpoint, ThrottleBudget> = {
  "profile.fetch": {
    minIntervalMs: 4_000,
    jitterMs: [1_000, 4_000],
    dailyLimit: 80,
    coffeeBreakEvery: [8, 12],
    coffeeBreakMs: [30_000, 90_000],
  },
  "profile.search": {
    minIntervalMs: 10_000,
    jitterMs: [2_000, 5_000],
    dailyLimit: 20,
    coffeeBreakEvery: [5, 8],
    coffeeBreakMs: [30_000, 90_000],
  },
  "message.send": {
    minIntervalMs: 8_000,
    jitterMs: [2_000, 6_000],
    dailyLimit: 40,
    coffeeBreakEvery: [6, 10],
    coffeeBreakMs: [30_000, 90_000],
  },
  "invite.send": {
    minIntervalMs: 12_000,
    jitterMs: [3_000, 8_000],
    dailyLimit: 15,
    coffeeBreakEvery: [4, 7],
    coffeeBreakMs: [60_000, 120_000],
  },
  "chat.list": {
    minIntervalMs: 2_000,
    jitterMs: [500, 1_500],
    dailyLimit: 200,
    coffeeBreakEvery: [20, 30],
    coffeeBreakMs: [10_000, 30_000],
  },
  "hosted.link": {
    minIntervalMs: 0,
    jitterMs: [0, 0],
    dailyLimit: 50,
    coffeeBreakEvery: [50, 100],
    coffeeBreakMs: [0, 0],
  },
  "job.publish": {
    minIntervalMs: 30_000,
    jitterMs: [2_000, 6_000],
    dailyLimit: 5,
    coffeeBreakEvery: [3, 5],
    coffeeBreakMs: [30_000, 90_000],
  },
};


export class UnipileError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "missing_credentials"
      | "rate_limited"
      | "daily_budget_reached"
      | "out_of_window"
      | "account_disconnected"
      | "provider_error"
      | "network_error",
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "UnipileError";
  }
}

// --------- Helpers ---------

function randBetween(min: number, max: number) {
  if (max <= min) return min;
  return Math.floor(min + Math.random() * (max - min));
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function isInsideWindow(window: { tz?: string; start_hour?: number; end_hour?: number } | null) {
  if (!window) return true;
  const tz = window.tz ?? "America/Sao_Paulo";
  const start = window.start_hour ?? 8;
  const end = window.end_hour ?? 20;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    const hour = parseInt(fmt.format(new Date()), 10);
    return hour >= start && hour < end;
  } catch {
    return true;
  }
}

/**
 * Versão da API Unipile em uso. Padrão: "v1" (comportamento atual).
 * Defina UNIPILE_API_VERSION="v2" para usar a API v2 (api.unipile.com/v2).
 * Lido a cada chamada (env é injetado em runtime, não em module scope).
 */
export type UnipileApiVersion = "v1" | "v2";

export function unipileApiVersion(): UnipileApiVersion {
  return String(process.env.UNIPILE_API_VERSION ?? "").trim().toLowerCase() === "v2"
    ? "v2"
    : "v1";
}

const V2_DEFAULT_BASE_URL = "https://api.unipile.com/v2";

/**
 * Base URL + API key. Na v1 usamos o DSN do tenant; na v2 o DSN foi
 * descontinuado e a base é fixa (com override opcional para testes).
 */
function getEnv() {
  const key = process.env.UNIPILE_API_KEY;
  const version = unipileApiVersion();

  if (version === "v2") {
    if (!key) {
      throw new UnipileError(
        "Credenciais Unipile não configuradas (UNIPILE_API_KEY).",
        "missing_credentials",
      );
    }
    const override = process.env.UNIPILE_API_BASE_URL?.trim();
    const base = (override || V2_DEFAULT_BASE_URL).replace(/\/$/, "");
    return { dsn: base, key, version };
  }

  const dsn = process.env.UNIPILE_DSN;
  if (!dsn || !key) {
    throw new UnipileError(
      "Credenciais Unipile não configuradas (UNIPILE_DSN / UNIPILE_API_KEY).",
      "missing_credentials",
    );
  }
  const normalized = /^https?:\/\//i.test(dsn) ? dsn : `https://${dsn}`;
  return { dsn: normalized.replace(/\/$/, ""), key, version };
}


function hashPayload(input: unknown): string {
  return createHash("sha256")
    .update(typeof input === "string" ? input : JSON.stringify(input ?? null))
    .digest("hex")
    .slice(0, 32);
}

// --------- Throttle / budget ---------

interface ThrottleCtx {
  accountId: string;
  ownerId?: string | null;
  unipileAccountId: string;
  window?: { tz?: string; start_hour?: number; end_hour?: number } | null;
}

async function enforceBudget(
  ctx: ThrottleCtx,
  endpoint: UnipileEndpoint,
  budget: ThrottleBudget,
) {
  // 1) Janela humana
  if (!isInsideWindow(ctx.window ?? null)) {
    throw new UnipileError(
      "Fora da janela horária permitida para esta conta.",
      "out_of_window",
    );
  }

  // 2) Bucket diário
  const day = todayUtc();
  const { data: existing } = await supabaseAdmin
    .from("unipile_rate_buckets")
    .select("id, count, last_request_at")
    .eq("account_id", ctx.accountId)
    .eq("endpoint", endpoint)
    .eq("day_utc", day)
    .maybeSingle();

  if (existing && existing.count >= budget.dailyLimit) {
    throw new UnipileError(
      `Budget diário atingido para ${endpoint} (${budget.dailyLimit}).`,
      "daily_budget_reached",
    );
  }

  // 3) Intervalo mínimo + jitter
  if (existing?.last_request_at && budget.minIntervalMs > 0) {
    const last = new Date(existing.last_request_at).getTime();
    const elapsed = Date.now() - last;
    const wait = budget.minIntervalMs - elapsed;
    if (wait > 0) {
      await sleep(wait + randBetween(budget.jitterMs[0], budget.jitterMs[1]));
    } else {
      await sleep(randBetween(budget.jitterMs[0], budget.jitterMs[1]));
    }
  }

  // 4) Pausa de café
  if (existing && budget.coffeeBreakMs[1] > 0) {
    const every = randBetween(budget.coffeeBreakEvery[0], budget.coffeeBreakEvery[1] + 1);
    if (existing.count > 0 && existing.count % every === 0) {
      await sleep(randBetween(budget.coffeeBreakMs[0], budget.coffeeBreakMs[1]));
    }
  }
}

async function incrementBucket(
  accountId: string,
  endpoint: UnipileEndpoint,
) {
  const day = todayUtc();
  const { data: existing } = await supabaseAdmin
    .from("unipile_rate_buckets")
    .select("id, count")
    .eq("account_id", accountId)
    .eq("endpoint", endpoint)
    .eq("day_utc", day)
    .maybeSingle();
  if (existing) {
    await supabaseAdmin
      .from("unipile_rate_buckets")
      .update({ count: existing.count + 1, last_request_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("unipile_rate_buckets").insert({
      account_id: accountId,
      endpoint,
      day_utc: day,
      count: 1,
      last_request_at: new Date().toISOString(),
    });
  }
}

async function logRequest(
  ctx: ThrottleCtx,
  endpoint: UnipileEndpoint,
  method: string,
  status: number | null,
  latencyMs: number,
  error: string | null,
  payload: unknown,
) {
  await supabaseAdmin.from("unipile_request_log").insert({
    account_id: ctx.accountId,
    owner_id: ctx.ownerId ?? null,
    endpoint,
    method,
    status,
    latency_ms: latencyMs,
    error,
    payload_hash: payload ? hashPayload(payload) : null,
  });
}

// --------- HTTP ---------

interface CallVariant {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

interface CallOptions {
  endpoint: UnipileEndpoint;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string; // v1 — relativo ao DSN, ex.: "/api/v1/users/abc"
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /**
   * Variante v2 (relativa a https://api.unipile.com/v2), ex.:
   * `/${accountId}/users/abc`. Obrigatória quando UNIPILE_API_VERSION=v2.
   */
  v2?: CallVariant;
}

function buildQuery(query?: Record<string, string | number | undefined>) {
  if (!query) return "";
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

async function call(ctx: ThrottleCtx, opts: CallOptions) {
  const budget = BUDGETS[opts.endpoint];
  await enforceBudget(ctx, opts.endpoint, budget);

  const { dsn, key, version } = getEnv();

  if (version === "v2" && !opts.v2) {
    throw new UnipileError(
      `Endpoint ${opts.endpoint} (${opts.path}) ainda não migrado para a API v2.`,
      "provider_error",
    );
  }

  const variant: CallVariant =
    version === "v2" && opts.v2
      ? opts.v2
      : { method: opts.method, path: opts.path, query: opts.query, body: opts.body };

  const method = variant.method ?? opts.method;
  const url = `${dsn}${variant.path}${buildQuery(variant.query)}`;
  const requestBody = variant.body;


  const started = Date.now();
  let status: number | null = null;
  let errorMsg: string | null = null;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "X-API-KEY": key,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    });
    status = res.status;
    const text = await res.text();
    const data = text ? safeJson(text) : null;

    if (!res.ok) {
      errorMsg = (data && (data.message || data.error)) || text.slice(0, 500);
      if (res.status === 429) {
        throw new UnipileError(`Rate limited (${res.status}).`, "rate_limited", res.status);
      }
      if (res.status === 401 || res.status === 403) {
        throw new UnipileError(
          `Conta desconectada (${res.status}).`,
          "account_disconnected",
          res.status,
        );
      }
      throw new UnipileError(
        `Unipile ${res.status}: ${errorMsg ?? "erro provider"}`,
        "provider_error",
        res.status,
      );
    }

    await incrementBucket(ctx.accountId, opts.endpoint);
    return data;
  } catch (err) {
    if (!errorMsg) errorMsg = (err as Error).message;
    if (err instanceof UnipileError) throw err;
    throw new UnipileError((err as Error).message, "network_error");
  } finally {
    await logRequest(
      ctx,
      opts.endpoint,
      method,
      status,
      Date.now() - started,
      errorMsg,
      requestBody,
    );
  }
}


function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// --------- API pública do cliente ---------

/**
 * Carrega o registro `unipile_accounts` e monta o contexto de throttling.
 * Lança UnipileError se a conta não estiver conectada.
 */
export async function loadAccountCtx(ownerId: string): Promise<ThrottleCtx> {
  const { data, error } = await supabaseAdmin
    .from("unipile_accounts")
    .select("id, owner_id, unipile_account_id, status, daily_window")
    .eq("owner_id", ownerId)
    .eq("provider", "linkedin")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new UnipileError(error.message, "provider_error");
  if (!data || !data.unipile_account_id || data.status !== "connected") {
    throw new UnipileError(
      "Nenhuma conta LinkedIn conectada via Unipile.",
      "account_disconnected",
    );
  }
  return {
    accountId: data.id,
    ownerId: data.owner_id,
    unipileAccountId: data.unipile_account_id,
    window: (data.daily_window as ThrottleCtx["window"]) ?? null,
  };
}

/**
 * Gera URL Hosted Auth para conectar uma conta LinkedIn.
 *
 * v1: POST /api/v1/hosted/accounts/link (usa notify_url + name para correlacionar).
 * v2: POST /v2/auth/link — não existem mais `api_url`, `notify_url`, `name` nem
 * redirects separados de sucesso/erro. O `connectToken` viaja como `state` no
 * `redirect_uri`, e a tela de sucesso é responsabilidade da nossa aplicação.
 */
export async function createHostedAuthLink(params: {
  ownerId: string;
  notifyUrl: string;
  successRedirect: string;
  failureRedirect: string;
  connectToken: string;
}) {
  const { dsn, key, version } = getEnv();
  const expiresOn = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const url =
    version === "v2" ? `${dsn}/auth/link` : `${dsn}/api/v1/hosted/accounts/link`;

  const body =
    version === "v2"
      ? {
          type: "create",
          providers: ["LINKEDIN"],
          expires_on: expiresOn,
          redirect_uri: appendQueryParam(
            params.successRedirect,
            "state",
            params.connectToken,
          ),
        }
      : {
          type: "create",
          providers: ["LINKEDIN"],
          api_url: dsn,
          expiresOn,
          notify_url: params.notifyUrl,
          name: params.connectToken,
          success_redirect_url: params.successRedirect,
          failure_redirect_url: params.failureRedirect,
        };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = safeJson(text);
  if (!res.ok) {
    throw new UnipileError(
      `Falha ao criar hosted auth (${res.status}): ${data?.message ?? text.slice(0, 300)}`,
      "provider_error",
      res.status,
    );
  }
  // resposta típica: { url: "...", object: "AccountAuthLinkResource" }
  return { url: data?.url as string, raw: data };
}

function appendQueryParam(url: string, key: string, value: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export type UnipileAccountSummary = {
  id: string;
  name: string | null;
  provider: string;
  created_at: string | null;
  raw: Record<string, unknown>;
};

/**
 * Lista as contas do tenant Unipile.
 *
 * v1: GET /api/v1/accounts (item traz `type` e `name`).
 * v2: GET /v2/accounts (item traz `provider`; `name` não é mais definível
 * por nós no hosted auth, então a correlação passa a ser via `state`).
 *
 * Não usa `call()` porque não é uma chamada por conta (sem throttle bucket).
 */
export async function listUnipileAccounts(
  limit = 50,
): Promise<{ ok: true; items: UnipileAccountSummary[] } | { ok: false; reason: string }> {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch {
    return { ok: false, reason: "missing_credentials" };
  }
  const { dsn, key, version } = env;
  const path = version === "v2" ? "/accounts" : "/api/v1/accounts";
  const res = await fetch(`${dsn}${path}?limit=${limit}`, {
    headers: { "X-API-KEY": key, Accept: "application/json" },
  });
  if (!res.ok) return { ok: false, reason: `unipile_${res.status}` };
  const json: any = await res.json().catch(() => ({}));
  const raw: any[] = json?.items ?? json?.data ?? json?.accounts ?? [];
  const items = raw
    .filter((a) => a && a.id)
    .map((a) => ({
      id: String(a.id),
      name: (a.name ?? a.display_name ?? null) as string | null,
      provider: String(a.provider ?? a.type ?? "").toUpperCase(),
      created_at: (a.created_at ?? a.createdAt ?? null) as string | null,
      raw: a as Record<string, unknown>,
    }));
  return { ok: true, items };
}



/** Valor de filtro estruturado: texto livre (string) ou ID já resolvido. */
export type SearchParamValue = string | { id: string };

/**
 * Busca pessoas no LinkedIn Classic.
 * v1: POST /api/v1/linkedin/search (api=classic, category=people).
 * v2: POST /v2/:account_id/linkedin/search/people (sem api/category, offset).
 */
export async function searchPeopleClassic(
  ctx: ThrottleCtx,
  filters: {
    keywords?: string;
    location?: SearchParamValue[]; // IDs de parâmetro — texto livre vai para keywords
    industry?: SearchParamValue[];
    current_company?: SearchParamValue[];
    school?: SearchParamValue[];
    network?: ("F" | "S" | "O")[];
    language?: string[];
    cursor?: string;
    offset?: number;
    limit?: number;

  },
) {
  // A busca do LinkedIn exige IDs de parâmetro para location/industry/company/school.
  // Na v1 os IDs são numéricos; na v2 são strings opacas — por isso aceitamos
  // `{ id }` para valores já resolvidos via search/parameters. Texto livre é
  // mesclado em `keywords` para não quebrar o schema da Unipile.
  const isId = (v: string) => /^\d{3,}$/.test(v.trim());
  const splitIds = (arr?: SearchParamValue[]) => {
    const ids: string[] = [];
    const text: string[] = [];
    for (const v of arr ?? []) {
      if (!v) continue;
      if (typeof v === "object") {
        const id = String(v.id ?? "").trim();
        if (id) ids.push(id);
        continue;
      }
      (isId(v) ? ids : text).push(v.trim());
    }
    return { ids: ids.length ? ids : undefined, text };
  };

  const loc = splitIds(filters.location);
  const ind = splitIds(filters.industry);
  const comp = splitIds(filters.current_company);
  const sch = splitIds(filters.school);

  const extraKeywords = [...loc.text, ...ind.text, ...comp.text, ...sch.text]
    .filter(Boolean)
    .join(" ");
  const mergedKeywords =
    [filters.keywords?.trim(), extraKeywords].filter(Boolean).join(" ").trim() || undefined;

  const commonBody: Record<string, unknown> = {
    limit: filters.limit ?? 10,
  };
  if (mergedKeywords) commonBody.keywords = mergedKeywords;
  if (loc.ids) commonBody.location = loc.ids;
  if (ind.ids) commonBody.industry = ind.ids;
  if (comp.ids) commonBody.current_company = comp.ids;
  if (sch.ids) commonBody.school = sch.ids;
  if (filters.language?.length) commonBody.profile_language = filters.language;

  const bodyV1: Record<string, unknown> = {
    api: "classic",
    category: "people",
    ...commonBody,
  };
  if (filters.network?.length) bodyV1.network = filters.network;
  if (filters.cursor) bodyV1.cursor = filters.cursor;

  // v2: `api`/`category` removidos, paginação por offset e `network` virou
  // `network_distance` (array de números: 1 = 1º grau, 2 = 2º, 3 = 3º+).
  const bodyV2: Record<string, unknown> = { ...commonBody };
  if (filters.network?.length) {
    const distance = filters.network
      .map((n): number | null => (n === "F" ? 1 : n === "S" ? 2 : n === "O" ? 3 : null))
      .filter((n): n is number => n != null);

    if (distance.length) bodyV2.network_distance = distance;
  }
  const offset = filters.offset ?? (filters.cursor ? Number(filters.cursor) : undefined);
  const safeOffset =
    typeof offset === "number" && Number.isFinite(offset) && offset > 0 ? offset : 0;
  if (safeOffset > 0) bodyV2.offset = safeOffset;

  const data = await call(ctx, {
    endpoint: "profile.search",
    method: "POST",
    path: "/api/v1/linkedin/search",
    query: { account_id: ctx.unipileAccountId },
    body: bodyV1,
    v2: {
      method: "POST",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/linkedin/search/people`,
      body: bodyV2,
    },
  });

  return unipileApiVersion() === "v2"
    ? normalizePeopleSearchResponse(data, safeOffset)
    : data;
}


/**
 * Normaliza a resposta de busca de pessoas da v2 para o shape que o restante
 * da aplicação já consome (nomes de campos da v1). A v2 devolve `data` e pagina
 * por `offset`, então expomos o próximo offset em `cursor` (string) para manter
 * a interface dos consumidores.
 */
function normalizePeopleSearchResponse(data: any, offset = 0) {
  if (!data || typeof data !== "object") return data;
  const items: any[] = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.data)
      ? data.data
      : [];
  const mapped = items.map((it) => ({
    ...it,
    verified: it.is_verified ?? it.verified,
    premium: it.is_premium ?? it.premium,
    open_profile: it.is_open_profile ?? it.open_profile,
    shared_connections_count: it.shared_relations_count ?? it.shared_connections_count,
  }));
  const nextOffset = offset + mapped.length;
  const cursor =
    data.next_cursor ?? (mapped.length > 0 ? String(nextOffset) : null);
  return { ...data, items: mapped, cursor };
}


/**
 * Obtém o perfil completo de um usuário pelo identifier público.
 */
export async function fetchProfile(ctx: ThrottleCtx, publicIdentifier: string) {
  return call(ctx, {
    endpoint: "profile.fetch",
    method: "GET",
    path: `/api/v1/users/${encodeURIComponent(publicIdentifier)}`,
    query: { account_id: ctx.unipileAccountId, linkedin_sections: "*" },
    v2: {
      method: "GET",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/users/${encodeURIComponent(publicIdentifier)}`,
    },
  });
}

/**
 * Mapa de tipos de search parameters v1 -> v2.
 * Os tipos que usamos (LOCATION/INDUSTRY/COMPANY/SCHOOL/PROFILE_LANGUAGE)
 * mantêm o nome; CONNECTIONS virou RELATION.
 */
const SEARCH_PARAM_TYPE_V2: Record<string, string> = {
  CONNECTIONS: "RELATION",
  LANGUAGE: "PROFILE_LANGUAGE",
};

export function toV2SearchParameterType(type: string): string {
  return SEARCH_PARAM_TYPE_V2[type] ?? type;
}

/** Produto LinkedIn usado na resolução de parâmetros de busca. */
export type LinkedinSearchProduct = "CLASSIC" | "RECRUITER" | "SALES_NAVIGATOR";

/** Paths v2 de search/parameters por produto (a v1 usava a query `service`). */
const SEARCH_PARAM_PATH_V2: Record<LinkedinSearchProduct, string> = {
  CLASSIC: "linkedin/search/parameters",
  RECRUITER: "linkedin/recruiter/search/parameters",
  SALES_NAVIGATOR: "linkedin/sales-navigator/search/parameters",
};

export type SearchParameterItem = { id: string; title: string };

/**
 * Resolve texto livre (ex.: "São Paulo") em parâmetros de busca do LinkedIn.
 * Retorna `{ id, title }` — na v1 os IDs são numéricos; na v2 são strings
 * opacas, então não aplicamos filtro numérico nessa versão.
 */
export async function resolveSearchParameterItems(
  ctx: ThrottleCtx,
  type: "LOCATION" | "INDUSTRY" | "COMPANY" | "SCHOOL" | "LANGUAGE",
  keywords: string,
  limit = 5,
  product: LinkedinSearchProduct = "CLASSIC",
): Promise<SearchParameterItem[]> {
  if (!keywords?.trim()) return [];
  const isV2 = unipileApiVersion() === "v2";
  try {
    const data = (await call(ctx, {
      endpoint: "chat.list", // budget leve — não é fetch de perfil
      method: "GET",
      path: "/api/v1/linkedin/search/parameters",
      query: {
        account_id: ctx.unipileAccountId,
        type,
        keywords: keywords.trim(),
        limit,
        service: product,
      },
      v2: {
        method: "GET",
        path: `/${encodeURIComponent(ctx.unipileAccountId)}/${SEARCH_PARAM_PATH_V2[product]}`,
        query: {
          type: toV2SearchParameterType(type),
          keywords: keywords.trim(),
          limit,
        },
      },
    })) as {
      items?: Array<Record<string, unknown>>;
      data?: Array<Record<string, unknown>>;
    } | null;
    const items = data?.items ?? data?.data ?? [];
    const mapped = items
      .map((it) => {
        const rawId =
          it.id != null ? String(it.id) : ((it.entity_urn as string) ?? "").split(":").pop() ?? "";
        const id = rawId.trim();
        // v2 renomeou `title` para `name`.
        const title = String(it.name ?? it.title ?? it.text ?? "").trim();
        return { id, title };
      })
      // v1 exige IDs numéricos; v2 aceita qualquer string opaca.
      .filter((it) => !!it.id && (isV2 || /^\d{3,}$/.test(it.id)));
    return mapped.slice(0, limit);
  } catch {
    return [];
  }
}

/** Compatibilidade: devolve apenas os IDs resolvidos. */
export async function resolveSearchParameter(
  ctx: ThrottleCtx,
  type: "LOCATION" | "INDUSTRY" | "COMPANY" | "SCHOOL" | "LANGUAGE",
  keywords: string,
  limit = 5,
  product: LinkedinSearchProduct = "CLASSIC",
): Promise<string[]> {
  const items = await resolveSearchParameterItems(ctx, type, keywords, limit, product);
  return items.map((it) => it.id);
}



// --------- Mensageria (Fase 4) ---------

// Normalizadores v1/v2. Na v2 o vocabulário mudou (`provider_id` -> `id`/
// `user_id`, `attendees` -> `users`) e as respostas de escrita são reduzidas
// (normalmente só o id do recurso criado).

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

/**
 * Extrai o identificador do destinatário a partir de um perfil.
 * v1: `provider_id`. v2: `id` / `user_id` (o objeto User perdeu `provider_id`).
 */
export function extractProfileProviderId(profile: any): string | null {
  const node = profile?.user ?? profile ?? {};
  return pickString(
    node.provider_id,
    node.user_id,
    profile?.provider_id,
    profile?.user_id,
    // v2: o User traz `id` como identificador canônico.
    unipileApiVersion() === "v2" ? node.id : undefined,
    node.member_urn,
    node.urn,
    profile?.public_profile_url_id,
    profile?.member_urn,
  );
}

/**
 * Campos de perfil usados na renderização de tokens ({{first_name}}, ...),
 * tolerante às diferenças de shape entre v1 e v2.
 */
export function extractProfileFields(profile: any): {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  headline: string | null;
  company: string | null;
} {
  const node = profile?.user ?? profile ?? {};
  const firstName = pickString(node.first_name, node.firstName);
  const lastName = pickString(node.last_name, node.lastName);
  const fullName =
    pickString(node.name, node.display_name, node.full_name) ??
    ([firstName, lastName].filter(Boolean).join(" ").trim() || null);
  const experience =
    (Array.isArray(node.work_experience) ? node.work_experience[0] : null) ??
    (Array.isArray(node.experience) ? node.experience[0] : null) ??
    null;
  return {
    firstName,
    lastName,
    fullName,
    headline: pickString(node.headline, node.summary),
    company: pickString(
      node.company,
      node.current_company,
      experience?.company,
      experience?.company_name,
    ),
  };
}

/** Normaliza a resposta de envio de mensagem (v1: chat criado; v2: reduzida). */
export function normalizeSendMessageResult(res: any): {
  messageId: string | null;
  chatId: string | null;
} {
  const node = res?.data ?? res ?? {};
  const chatId = pickString(node.chat_id, node.chat?.id, res?.chat_id);
  const messageId = pickString(
    node.message_id,
    node.message?.id,
    res?.message_id,
    // v2 devolve apenas `id` do recurso criado.
    node.id,
  );
  return { messageId: messageId ?? chatId, chatId };
}

/**
 * Normaliza a resposta de convite de conexão.
 * v1: `invitation_id`/`invite_id`. v2 (relation-requests): `id`.
 */
export function normalizeInviteResult(res: any): { invitationId: string | null } {
  const node = res?.data ?? res ?? {};
  return {
    invitationId: pickString(
      node.invitation_id,
      node.invite_id,
      node.relation_request_id,
      node.id,
      res?.invitation_id,
    ),
  };
}


/**
 * Envia DM em uma conversa 1:1 no LinkedIn (cria a conversa se necessário).
 * `attendeeProviderId` é o `provider_id` do destinatário (obtido via fetchProfile).
 */
export async function sendLinkedinMessage(
  ctx: ThrottleCtx,
  params: { attendeeProviderId: string; text: string },
) {
  const body = {
    account_id: ctx.unipileAccountId,
    attendees_ids: [params.attendeeProviderId],
    text: params.text,
  };
  return call(ctx, {
    endpoint: "message.send",
    method: "POST",
    path: "/api/v1/chats",
    body,
    // v2: POST /:account_id/chats/send — `attendees_ids` virou `users_ids`.
    v2: {
      method: "POST",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/chats/send`,
      body: { users_ids: [params.attendeeProviderId], text: params.text },
    },
  });
}

/**
 * Envia convite de conexão no LinkedIn.
 * `providerId` é o `provider_id` do destinatário.
 */
export async function sendLinkedinInvite(
  ctx: ThrottleCtx,
  params: { providerId: string; message?: string },
) {
  const body: Record<string, unknown> = {
    account_id: ctx.unipileAccountId,
    provider_id: params.providerId,
  };
  if (params.message?.trim()) body.message = params.message.trim();

  // v2: relation requests — `provider_id` virou `user_id`.
  const bodyV2: Record<string, unknown> = { user_id: params.providerId };
  if (params.message?.trim()) bodyV2.message = params.message.trim();

  return call(ctx, {
    endpoint: "invite.send",
    method: "POST",
    path: "/api/v1/users/invite",
    body,
    v2: {
      method: "POST",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/users/me/relation-requests`,
      body: bodyV2,
    },
  });
}

/** Lista chats (inbox) da conta LinkedIn conectada. */
export async function listLinkedinChats(
  ctx: ThrottleCtx,
  params: { cursor?: string; limit?: number } = {},
) {
  return call(ctx, {
    endpoint: "chat.list",
    method: "GET",
    path: "/api/v1/chats",
    query: {
      account_id: ctx.unipileAccountId,
      limit: params.limit ?? 20,
      cursor: params.cursor,
    },
    v2: {
      method: "GET",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/chats`,
      query: { limit: params.limit ?? 20, cursor: params.cursor },
    },
  });
}

/** Lista mensagens de um chat específico. */
export async function listLinkedinChatMessages(
  ctx: ThrottleCtx,
  params: { chatId: string; cursor?: string; limit?: number },
) {
  return call(ctx, {
    endpoint: "chat.list",
    method: "GET",
    path: `/api/v1/chats/${encodeURIComponent(params.chatId)}/messages`,
    query: {
      limit: params.limit ?? 50,
      cursor: params.cursor,
    },
    v2: {
      method: "GET",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/chats/${encodeURIComponent(params.chatId)}/messages`,
      query: { limit: params.limit ?? 50, cursor: params.cursor },
    },
  });
}

/**
 * Lista convites de conexão pendentes (enviados) na conta LinkedIn.
 * Usado para detectar aceite: se um `provider_invite_id` deixa de aparecer
 * na lista de pendentes, o convite foi aceito ou retirado.
 *
 * v2: GET /:account_id/users/me/relation-requests?type=sent
 */
export async function listSentInvitations(
  ctx: ThrottleCtx,
  params: { cursor?: string; limit?: number; offset?: number } = {},
) {
  return call(ctx, {
    endpoint: "chat.list",
    method: "GET",
    path: "/api/v1/users/invite/sent",
    query: {
      account_id: ctx.unipileAccountId,
      limit: params.limit ?? 100,
      cursor: params.cursor,
    },
    v2: {
      method: "GET",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/users/me/relation-requests`,
      query: {
        type: "sent",
        limit: params.limit ?? 100,
        offset: params.offset,
      },
    },
  });
}



export type LinkedinJobWorkplace = "REMOTE" | "HYBRID" | "ON_SITE";

export type LinkedinJobEmploymentStatus =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "INTERNSHIP"
  | "TEMPORARY"
  | "VOLUNTEER"
  | "OTHER";

export type LinkedinJobApplyMethod =
  | { type: "linkedin"; notificationEmail: string }
  | { type: "external"; url: string };

/**
 * Cria uma vaga (Job Posting) no LinkedIn via Unipile.
 *
 * v1: `POST /api/v1/linkedin/jobs` publica direto (account_id no body,
 *     campos `workplace` e `apply_method.type`).
 * v2: `POST /v2/:account_id/linkedin/jobs` cria apenas um **rascunho**
 *     (`state: DRAFT`), usando `workplace_type` e `apply_method.method`.
 *     A publicação é um segundo passo (`publishLinkedinJob`).
 *
 * Requer que a Company Page (`companyId`) seja administrada pela conta
 * conectada, e que `locationId` seja um geo ID válido do LinkedIn.
 */
export async function createLinkedinJob(
  ctx: ThrottleCtx,
  params: {
    title: string;
    titleId?: string;
    companyId: string;
    companyName?: string;
    locationId: string;
    workplace: LinkedinJobWorkplace;
    employmentStatus: LinkedinJobEmploymentStatus;
    description: string;
    applyMethod: LinkedinJobApplyMethod;
  },
) {
  const jobTitle: Record<string, unknown> = { text: params.title };
  if (params.titleId) jobTitle.id = params.titleId;

  const common: Record<string, unknown> = {
    job_title: jobTitle,
    company: { id: params.companyId, text: params.companyName ?? "" },
    location: params.locationId,
    employment_status: params.employmentStatus,
    description: params.description,
  };

  // v1: `workplace` + apply_method.type
  const v1Payload: Record<string, unknown> = {
    ...common,
    workplace: params.workplace,
    apply_method:
      params.applyMethod.type === "linkedin"
        ? { type: "linkedin", notification_email: params.applyMethod.notificationEmail }
        : { type: "external", url: params.applyMethod.url },
  };

  // v2: `workplace_type` + apply_method.method
  const v2Payload: Record<string, unknown> = {
    ...common,
    workplace_type: params.workplace,
    apply_method:
      params.applyMethod.type === "linkedin"
        ? { method: "linkedin", notification_email: params.applyMethod.notificationEmail }
        : { method: "external", url: params.applyMethod.url },
  };

  return call(ctx, {
    endpoint: "job.publish",
    method: "POST",
    path: "/api/v1/linkedin/jobs",
    body: { account_id: ctx.unipileAccountId, ...v1Payload },
    v2: {
      method: "POST",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/linkedin/jobs`,
      body: v2Payload,
    },
  }) as Promise<{
    id?: string;
    provider_id?: string;
    url?: string;
    object?: string;
    state?: string;
    [k: string]: unknown;
  }>;
}

/**
 * Extrai o ID de uma vaga a partir da resposta de criação/publicação.
 * v1 devolve `id`/`provider_id`; a v2 pode devolver `job_id` ou aninhar em `job`.
 */
export function extractLinkedinJobId(res: Record<string, unknown> | null | undefined) {
  if (!res) return null;
  const nested = (res.job ?? res.job_posting ?? {}) as Record<string, unknown>;
  const candidates = [
    res.id,
    res.job_id,
    res.provider_id,
    res.provider_job_id,
    nested.id,
    nested.job_id,
    nested.provider_id,
  ];
  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/**
 * Consulta o orçamento recomendado / elegibilidade de publicação gratuita
 * de um rascunho de vaga. **Exclusivo da v2**
 * (`GET /v2/:account_id/linkedin/jobs/:job_id/budget`).
 */
export async function getLinkedinJobBudget(ctx: ThrottleCtx, providerJobId: string) {
  return call(ctx, {
    endpoint: "chat.list", // leitura leve
    method: "GET",
    path: `/api/v1/linkedin/jobs/${encodeURIComponent(providerJobId)}/budget`,
    query: { account_id: ctx.unipileAccountId },
    v2: {
      method: "GET",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/linkedin/jobs/${encodeURIComponent(providerJobId)}/budget`,
    },
  }) as Promise<{
    free_eligible?: boolean;
    is_free_eligible?: boolean;
    eligible_for_free?: boolean;
    currency?: string;
    [k: string]: unknown;
  }>;
}

export type LinkedinJobPublishOptions = {
  mode: "FREE" | "PROMOTED";
  budget?: {
    period: "total" | "daily";
    amount: number;
    currency: string;
  };
};

/**
 * Publica um rascunho de vaga (v2: `POST /v2/:account_id/linkedin/jobs/:job_id/publish`).
 * Na v1 não existe etapa de publicação — a criação já publica —, então esta
 * função é no-op nessa versão.
 */
export async function publishLinkedinJob(
  ctx: ThrottleCtx,
  providerJobId: string,
  options: LinkedinJobPublishOptions = { mode: "FREE" },
) {
  if (unipileApiVersion() !== "v2") {
    return { skipped: true, reason: "v1_publishes_on_create" } as Record<string, unknown>;
  }
  const body: Record<string, unknown> = { mode: options.mode };
  if (options.mode === "PROMOTED" && options.budget) {
    body.budget = {
      [options.budget.period]: {
        amount: options.budget.amount,
        currency: options.budget.currency,
      },
    };
  }
  return call(ctx, {
    endpoint: "job.publish",
    method: "POST",
    path: `/api/v1/linkedin/jobs/${encodeURIComponent(providerJobId)}/publish`,
    body: { account_id: ctx.unipileAccountId, ...body },
    v2: {
      method: "POST",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/linkedin/jobs/${encodeURIComponent(providerJobId)}/publish`,
      body,
    },
  }) as Promise<Record<string, unknown>>;
}

/**
 * Fecha (despublica) uma vaga previamente criada no LinkedIn via Unipile.
 *
 * v1: `DELETE /api/v1/linkedin/jobs/:job_id`.
 * v2: `POST /v2/:account_id/linkedin/jobs/:job_id/close`.
 *
 * Se a chamada falhar, o caller deve apenas marcar a `ats_job_postings`
 * como unpublished localmente.
 */
export async function closeLinkedinJob(
  ctx: ThrottleCtx,
  providerJobId: string,
) {
  return call(ctx, {
    endpoint: "job.publish",
    method: "DELETE",
    path: `/api/v1/linkedin/jobs/${encodeURIComponent(providerJobId)}`,
    query: { account_id: ctx.unipileAccountId },
    v2: {
      method: "POST",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/linkedin/jobs/${encodeURIComponent(providerJobId)}/close`,
    },
  }) as Promise<{ ok?: boolean; object?: string; [k: string]: unknown }>;
}


/**
 * Lista aplicantes de uma vaga LinkedIn publicada via Unipile.
 *
 * v1: `GET /api/v1/linkedin/jobs/:job_id/applicants` (paginação por cursor).
 * v2: `POST /v2/:account_id/linkedin/jobs/:job_id/applicants` — filtros vão
 *     no body e a paginação é por `offset`. Para manter o contrato de cursor
 *     usado pelos callers, o offset seguinte é sintetizado como cursor.
 */
export async function listLinkedinJobApplicants(
  ctx: ThrottleCtx,
  params: { providerJobId: string; cursor?: string | null; limit?: number; offset?: number },
) {
  const isV2 = unipileApiVersion() === "v2";
  const limit = params.limit ?? 50;
  const offset =
    params.offset ??
    (params.cursor && /^\d+$/.test(params.cursor) ? Number(params.cursor) : 0);

  const res = (await call(ctx, {
    endpoint: "chat.list", // budget leve — leitura
    method: "GET",
    path: `/api/v1/linkedin/jobs/${encodeURIComponent(params.providerJobId)}/applicants`,
    query: {
      account_id: ctx.unipileAccountId,
      limit,
      cursor: params.cursor ?? undefined,
    },
    v2: {
      method: "POST",
      path: `/${encodeURIComponent(ctx.unipileAccountId)}/linkedin/jobs/${encodeURIComponent(params.providerJobId)}/applicants`,
      query: { limit, offset },
      body: {},
    },
  })) as {
    items?: Array<Record<string, unknown>>;
    data?: Array<Record<string, unknown>>;
    cursor?: string | null;
    next_cursor?: string | null;
    [k: string]: unknown;
  };

  if (isV2) {
    const items = (res?.items ?? res?.data ?? []) as Array<Record<string, unknown>>;
    const hasNext = items.length >= limit;
    return {
      ...res,
      items,
      next_cursor:
        (res?.next_cursor as string | null | undefined) ??
        (hasNext ? String(offset + limit) : null),
    };
  }

  return res;

}




