// Cliente HTTP server-only do Conta Azul: OAuth (authorize/token/refresh),
// paginação e retry com backoff. Segredos lidos apenas aqui, em runtime.
import type { SupabaseClient } from "@supabase/supabase-js";

import { CANONICAL_PUBLIC_URL } from "@/lib/app-url";

const DEFAULT_API_BASE = "https://api-v2.contaazul.com";
const DEFAULT_AUTH_URL = "https://login.contaazul.com/#/oauth/authorize";
const DEFAULT_TOKEN_URL = "https://api-v2.contaazul.com/oauth/token";

export type CaCreds = {
  clientId: string;
  clientSecret: string;
  apiBase: string;
  authUrl: string;
  tokenUrl: string;
};

export type CaTokens = {
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
  scope?: string | null;
};

export class ContaAzulNotConfiguredError extends Error {
  constructor() {
    super(
      "Integração Conta Azul sem credenciais de aplicativo (CONTAAZUL_CLIENT_ID / CONTAAZUL_CLIENT_SECRET).",
    );
    this.name = "ContaAzulNotConfiguredError";
  }
}

export class ContaAzulNotConnectedError extends Error {
  constructor() {
    super("Conta Azul não conectado neste workspace. Autorize o acesso antes de sincronizar.");
    this.name = "ContaAzulNotConnectedError";
  }
}

/** Lê as credenciais do aplicativo. Lança se ausentes. */
export function contaAzulCreds(): CaCreds {
  const clientId = process.env["CONTAAZUL_CLIENT_ID"];
  const clientSecret = process.env["CONTAAZUL_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new ContaAzulNotConfiguredError();
  return {
    clientId,
    clientSecret,
    apiBase: process.env["CONTAAZUL_API_BASE"] ?? DEFAULT_API_BASE,
    authUrl: process.env["CONTAAZUL_AUTH_URL"] ?? DEFAULT_AUTH_URL,
    tokenUrl: process.env["CONTAAZUL_TOKEN_URL"] ?? DEFAULT_TOKEN_URL,
  };
}

export function contaAzulConfigured(): boolean {
  return !!process.env["CONTAAZUL_CLIENT_ID"] && !!process.env["CONTAAZUL_CLIENT_SECRET"];
}

export function contaAzulRedirectUri(_origin?: string): string {
  const configured = process.env["CONTAAZUL_REDIRECT_URI"];
  const base = configured?.trim() || `${CANONICAL_PUBLIC_URL}/api/public/oauth/contaazul-callback`;
  return base.replace(/\/$/, "");
}

export const CA_SCOPES = "openid profile aws.cognito.signin.user.admin";

function appendAuthorizeParams(authUrl: string, params: Record<string, string>): string {
  if (!authUrl.includes("#")) {
    const url = new URL(authUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }

  const [base = "", hash = ""] = authUrl.split("#", 2);
  const [hashPath = "", hashQuery = ""] = hash.split("?", 2);
  const search = new URLSearchParams(hashQuery);
  for (const [key, value] of Object.entries(params)) search.set(key, value);
  const query = search.toString();
  return `${base}#${hashPath}${query ? `?${query}` : ""}`;
}

export function buildAuthorizeUrl(opts: { origin: string; state: string }): string {
  const creds = contaAzulCreds();
  return appendAuthorizeParams(creds.authUrl, {
    client_id: creds.clientId,
    redirect_uri: contaAzulRedirectUri(opts.origin),
    response_type: "code",
    scope: CA_SCOPES,
    state: opts.state,
  });
}

function basicAuth(creds: CaCreds): string {
  return `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`;
}

function toTokens(payload: Record<string, unknown>, previousRefresh?: string | null): CaTokens {
  const accessToken = String(payload["access_token"] ?? "");
  if (!accessToken) throw new Error("Conta Azul não retornou access_token.");
  const expiresIn = Number(payload["expires_in"] ?? 0);
  return {
    access_token: accessToken,
    refresh_token: (payload["refresh_token"] as string | undefined) ?? previousRefresh ?? null,
    expires_at: expiresIn
      ? new Date(Date.now() + Math.max(60, expiresIn - 60) * 1000).toISOString()
      : null,
    scope: (payload["scope"] as string | undefined) ?? null,
  };
}

async function tokenRequest(body: URLSearchParams): Promise<Record<string, unknown>> {
  const creds = contaAzulCreds();
  const res = await fetch(creds.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(creds),
      Accept: "application/json",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Conta Azul OAuth falhou [${res.status}]: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Resposta OAuth do Conta Azul não é JSON válido.");
  }
}

export async function exchangeCodeForTokens(opts: {
  code: string;
  origin: string;
}): Promise<CaTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: contaAzulRedirectUri(opts.origin),
  });
  return toTokens(await tokenRequest(body));
}

export async function refreshTokens(refreshToken: string): Promise<CaTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return toTokens(await tokenRequest(body), refreshToken);
}

/* -------------------------------------------------------------------------- */
/* Persistência da conexão                                                    */
/* -------------------------------------------------------------------------- */

export type CaIntegrationRow = {
  id: string;
  status: string;
  config: Record<string, unknown> | null;
  oauth_tokens: CaTokens | null;
};

export async function loadIntegration(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<CaIntegrationRow | null> {
  const { data, error } = await supabase
    .from("integrations")
    .select("id, status, config, oauth_tokens")
    .eq("provider", "contaazul")
    .eq("owner_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CaIntegrationRow | null) ?? null;
}

export async function saveTokens(
  supabase: SupabaseClient,
  opts: {
    workspaceId: string;
    tokens: CaTokens;
    config?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("integrations").upsert(
    {
      owner_id: opts.workspaceId,
      workspace_id: opts.workspaceId,
      provider: "contaazul",
      status: "connected",
      oauth_tokens: opts.tokens as unknown as Record<string, unknown>,
      ...(opts.config ? { config: opts.config } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,provider" },
  );
  if (error) throw new Error(error.message);
}

export async function markIntegrationError(
  supabase: SupabaseClient,
  workspaceId: string,
  message: string,
): Promise<void> {
  await supabase
    .from("integrations")
    .update({
      status: "error",
      config: { last_error: message.slice(0, 500) },
      updated_at: new Date().toISOString(),
    })
    .eq("provider", "contaazul")
    .eq("owner_id", workspaceId);
}

/** Retorna um access token válido, renovando quando necessário. */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<string> {
  const row = await loadIntegration(supabase, workspaceId);
  const tokens = row?.oauth_tokens ?? null;
  if (!tokens?.access_token) throw new ContaAzulNotConnectedError();

  const expiresAt = tokens.expires_at ? Date.parse(tokens.expires_at) : 0;
  const expiringSoon = expiresAt > 0 && expiresAt - Date.now() < 120_000;
  if (!expiringSoon) return tokens.access_token;

  if (!tokens.refresh_token) return tokens.access_token;
  const refreshed = await refreshTokens(tokens.refresh_token);
  await saveTokens(supabase, { workspaceId, tokens: refreshed });
  return refreshed.access_token;
}

/* -------------------------------------------------------------------------- */
/* Chamadas à API                                                             */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function caFetch<T = unknown>(opts: {
  accessToken: string;
  path: string;
  query?: Record<string, string | number | undefined>;
  method?: string;
  maxAttempts?: number;
}): Promise<T> {
  const creds = contaAzulCreds();
  const url = new URL(`${creds.apiBase.replace(/\/$/, "")}${opts.path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const maxAttempts = opts.maxAttempts ?? 4;
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url.toString(), {
      method: opts.method ?? "GET",
      headers: { Authorization: `Bearer ${opts.accessToken}`, Accept: "application/json" },
    });
    if (res.ok) {
      const text = await res.text();
      if (!text) return [] as unknown as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`Resposta não-JSON do Conta Azul em ${opts.path}`);
      }
    }
    const body = await res.text();
    lastError = `[${res.status}] ${body.slice(0, 400)}`;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`Conta Azul ${opts.path} falhou ${lastError}`);
    }
    const retryAfter = Number(res.headers.get("retry-after") ?? 0);
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** (attempt - 1));
  }
  throw new Error(`Conta Azul ${opts.path} falhou ${lastError}`);
}

/** Extrai a lista de itens de respostas com formatos diferentes. */
export function extractList(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["itens", "data", "items", "content", "results", "records"]) {
      if (Array.isArray(obj[key])) return obj[key] as Array<Record<string, unknown>>;
    }
  }
  return [];
}

/** Percorre páginas até esgotar os resultados (ou o limite de páginas). */
export async function caFetchAll(opts: {
  accessToken: string;
  path: string;
  query?: Record<string, string | number | undefined>;
  pageSize?: number;
  maxPages?: number;
}): Promise<Array<Record<string, unknown>>> {
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 50;
  const out: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= maxPages; page++) {
    const payload = await caFetch({
      accessToken: opts.accessToken,
      path: opts.path,
      query: { ...opts.query, pagina: page, tamanho_pagina: pageSize },
    });
    const list = extractList(payload);
    out.push(...list);
    if (list.length < pageSize) break;
  }
  return out;
}
