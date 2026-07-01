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
  | "hosted.link";

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

function getEnv() {
  const dsn = process.env.UNIPILE_DSN;
  const key = process.env.UNIPILE_API_KEY;
  if (!dsn || !key) {
    throw new UnipileError(
      "Credenciais Unipile não configuradas (UNIPILE_DSN / UNIPILE_API_KEY).",
      "missing_credentials",
    );
  }
  const normalized = /^https?:\/\//i.test(dsn) ? dsn : `https://${dsn}`;
  return { dsn: normalized.replace(/\/$/, ""), key };
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

interface CallOptions {
  endpoint: UnipileEndpoint;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string; // relativo ao DSN, ex.: "/api/v1/users/abc"
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

async function call(ctx: ThrottleCtx, opts: CallOptions) {
  const budget = BUDGETS[opts.endpoint];
  await enforceBudget(ctx, opts.endpoint, budget);

  const { dsn, key } = getEnv();
  const qs = opts.query
    ? "?" +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const url = `${dsn}${opts.path}${qs}`;

  const started = Date.now();
  let status: number | null = null;
  let errorMsg: string | null = null;
  try {
    const res = await fetch(url, {
      method: opts.method,
      headers: {
        "X-API-KEY": key,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
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
      opts.method,
      status,
      Date.now() - started,
      errorMsg,
      opts.body,
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
 * `notifyUrl` é o webhook público que receberá o callback do account.connected.
 */
export async function createHostedAuthLink(params: {
  ownerId: string;
  notifyUrl: string;
  successRedirect: string;
  failureRedirect: string;
  connectToken: string;
}) {
  const { dsn, key } = getEnv();
  const body = {
    type: "create",
    providers: ["LINKEDIN"],
    api_url: dsn,
    expiresOn: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    notify_url: params.notifyUrl,
    name: params.connectToken,
    success_redirect_url: params.successRedirect,
    failure_redirect_url: params.failureRedirect,
  };
  const res = await fetch(`${dsn}/api/v1/hosted/accounts/link`, {
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

/**
 * Busca pessoas no LinkedIn Classic. Filtros mapeados ao endpoint
 * POST /api/v1/linkedin/search com category=people, api=classic.
 */
export async function searchPeopleClassic(
  ctx: ThrottleCtx,
  filters: {
    keywords?: string;
    location?: string[]; // geoUrns (IDs numéricos) — texto livre vai para keywords
    industry?: string[]; // industry IDs — texto livre vai para keywords
    current_company?: string[]; // company IDs — texto livre vai para keywords
    school?: string[]; // school IDs — texto livre vai para keywords
    network?: ("F" | "S" | "O")[];
    language?: string[];
    cursor?: string;
    limit?: number;
  },
) {
  // LinkedIn Classic search exige IDs (URNs) para location/industry/company/school.
  // Quando o usuário envia texto livre, mesclamos no `keywords` para não quebrar
  // o schema da Unipile (que rejeita strings não-numéricas nesses campos).
  const isId = (v: string) => /^\d{3,}$/.test(v.trim());
  const splitIds = (arr?: string[]) => {
    const ids: string[] = [];
    const text: string[] = [];
    for (const v of arr ?? []) {
      if (!v) continue;
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

  const body: Record<string, unknown> = {
    api: "classic",
    category: "people",
    limit: filters.limit ?? 10,
  };
  if (mergedKeywords) body.keywords = mergedKeywords;
  if (loc.ids) body.location = loc.ids;
  if (ind.ids) body.industry = ind.ids;
  if (comp.ids) body.current_company = comp.ids;
  if (sch.ids) body.school = sch.ids;
  if (filters.network?.length) body.network = filters.network;
  if (filters.language?.length) body.profile_language = filters.language;
  if (filters.cursor) body.cursor = filters.cursor;

  return call(ctx, {
    endpoint: "profile.search",
    method: "POST",
    path: "/api/v1/linkedin/search",
    query: { account_id: ctx.unipileAccountId },
    body,
  });
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
  });
}

/**
 * Resolve texto livre (ex.: "São Paulo") em IDs/URNs aceitos pela busca
 * Classic do LinkedIn via Unipile. Retorna array de IDs (string) — vazio se nada bater.
 */
export async function resolveSearchParameter(
  ctx: ThrottleCtx,
  type: "LOCATION" | "INDUSTRY" | "COMPANY" | "SCHOOL" | "LANGUAGE",
  keywords: string,
  limit = 5,
): Promise<string[]> {
  if (!keywords?.trim()) return [];
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
      },
    })) as { items?: Array<{ id?: string | number; entity_urn?: string }> } | null;
    const items = data?.items ?? [];
    const ids = items
      .map((it) => (it.id != null ? String(it.id) : it.entity_urn ?? null))
      .filter((v): v is string => !!v && /^\d{3,}$/.test(v));
    return ids.slice(0, limit);
  } catch {
    return [];
  }
}

// --------- Mensageria (Fase 4) ---------

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
    provider_id: params.providerId,
  };
  if (params.message?.trim()) body.message = params.message.trim();
  return call(ctx, {
    endpoint: "invite.send",
    method: "POST",
    path: "/api/v1/users/invite",
    query: { account_id: ctx.unipileAccountId },
    body,
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
  });
}


