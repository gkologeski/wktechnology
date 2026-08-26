import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CA_SCOPES,
  buildAuthorizeUrl,
  contaAzulConfigured,
  contaAzulCreds,
  contaAzulRedirectUri,
  loadIntegration,
  normalizeContaAzulReturnOrigin,
} from "./contaazul-api.server";

export type ContaAzulOAuthStage =
  | "configuracao_local"
  | "autorizacao_provedor"
  | "callback"
  | "troca_token"
  | "renovacao";

export type ContaAzulOAuthDiagnostic = {
  stage: ContaAzulOAuthStage;
  status: "pending" | "error";
  code: string | null;
  message: string;
  occurredAt: string;
};

export type ContaAzulOAuthParamChecks = {
  responseType: boolean;
  clientId: boolean;
  redirectUri: boolean;
  state: boolean;
  scope: boolean;
  redirectMatchesCallback: boolean;
  clientIdConsistent: boolean;
};

export type ContaAzulOAuthChecks = {
  https: boolean;
  expectedHosts: boolean;
  callbackConsistent: boolean;
  requiredParams: ContaAzulOAuthParamChecks;
  likelyDevelopmentRedirect: boolean;
};

const SENSITIVE_PARAMS = new Set([
  "state",
  "code",
  "access_token",
  "refresh_token",
  "client_secret",
]);

function shortFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function maskClientId(value: string): string {
  if (value.length <= 8) return `•••• (${shortFingerprint(value)})`;
  return `${value.slice(0, 4)}••••${value.slice(-4)} (${shortFingerprint(value)})`;
}

function cleanMessage(value: string): string {
  return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [removido]")
    .replace(/Basic\s+[^\s]+/gi, "Basic [removido]")
    .replace(
      /(access_token|refresh_token|client_secret|code|state)\s*[=:]\s*[^\s&,}]+/gi,
      "$1=[removido]",
    )
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 300);
}

function readAuthorizeSearchParams(rawUrl: string): URLSearchParams {
  const [base = "", hash = ""] = rawUrl.split("#", 2);
  const merged = new URLSearchParams();
  const baseUrl = new URL(base);
  for (const [key, value] of baseUrl.searchParams.entries()) merged.append(key, value);
  if (hash) {
    const [, hashQuery = ""] = hash.split("?", 2);
    const hashParams = new URLSearchParams(hashQuery);
    for (const [key, value] of hashParams.entries()) merged.set(key, value);
  }
  return merged;
}

function isTruthyParam(params: URLSearchParams, key: string): boolean {
  return Boolean(params.get(key)?.trim());
}

export function inspectContaAzulAuthorizeParams(
  rawUrl: string,
  opts: { callback: string; expectedClientId?: string | null },
): ContaAzulOAuthParamChecks {
  const params = readAuthorizeSearchParams(rawUrl);
  const redirectUri = params.get("redirect_uri")?.trim() ?? "";
  const clientId = params.get("client_id")?.trim() ?? "";
  return {
    responseType: params.get("response_type") === "code",
    clientId: Boolean(clientId),
    redirectUri: Boolean(redirectUri),
    state: isTruthyParam(params, "state"),
    scope: CA_SCOPES.split(" ").every((scope) =>
      (params.get("scope") ?? "").split(/\s+/).includes(scope),
    ),
    redirectMatchesCallback: redirectUri === opts.callback,
    clientIdConsistent: !opts.expectedClientId || !clientId || clientId === opts.expectedClientId,
  };
}

export function sanitizeContaAzulAuthorizeUrl(rawUrl: string): string {
  const [base = "", hash = ""] = rawUrl.split("#", 2);
  const baseUrl = new URL(base);
  for (const key of [...baseUrl.searchParams.keys()]) {
    if (SENSITIVE_PARAMS.has(key)) baseUrl.searchParams.delete(key);
    if (key === "client_id") baseUrl.searchParams.set(key, "[mascarado]");
  }
  if (!hash) return baseUrl.toString();
  const [path = "", query = ""] = hash.split("?", 2);
  const params = new URLSearchParams(query);
  for (const key of [...params.keys()]) {
    if (SENSITIVE_PARAMS.has(key)) params.delete(key);
    if (key === "client_id") params.set(key, "[mascarado]");
  }
  const safeQuery = params.toString();
  return `${baseUrl.toString()}#${path}${safeQuery ? `?${safeQuery}` : ""}`;
}

export function normalizeContaAzulOAuthError(input: {
  stage: ContaAzulOAuthStage;
  code?: string | null;
  message?: string | null;
}): ContaAzulOAuthDiagnostic {
  const fallback =
    input.stage === "autorizacao_provedor"
      ? "O Conta Azul rejeitou a solicitação antes de concluir a autorização."
      : "Não foi possível concluir a autenticação OAuth.";
  return {
    stage: input.stage,
    status: "error",
    code: input.code ? cleanMessage(input.code).slice(0, 80) : null,
    message: cleanMessage(input.message || fallback) || fallback,
    occurredAt: new Date().toISOString(),
  };
}

export async function saveContaAzulOAuthDiagnostic(
  supabase: SupabaseClient,
  workspaceId: string,
  diagnostic: ContaAzulOAuthDiagnostic | null,
): Promise<void> {
  const current = await loadIntegration(supabase, workspaceId);
  const config = { ...(current?.config ?? {}), oauth_diagnostic: diagnostic };
  const { error } = await supabase.from("integrations").upsert(
    {
      owner_id: workspaceId,
      workspace_id: workspaceId,
      provider: "contaazul",
      status: diagnostic?.status === "error" ? "error" : (current?.status ?? "disconnected"),
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,provider" },
  );
  if (error) throw new Error(error.message);
}

export async function markContaAzulAuthorizationStarted(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  await saveContaAzulOAuthDiagnostic(supabase, workspaceId, {
    stage: "autorizacao_provedor",
    status: "pending",
    code: null,
    message: "Aguardando o retorno do Conta Azul.",
    occurredAt: new Date().toISOString(),
  });
}

export function getContaAzulOAuthConfiguration(origin: string) {
  const configured = contaAzulConfigured();
  const returnOrigin = normalizeContaAzulReturnOrigin(origin);
  const callback = contaAzulRedirectUri(returnOrigin);
  if (!configured) {
    return {
      configured: false,
      oauthVersion: "v2",
      authorizationUrl: "https://login.contaazul.com/#/oauth/authorize",
      tokenUrl: "https://api-v2.contaazul.com/oauth/token",
      callback,
      scopes: CA_SCOPES.split(" "),
      returnOrigin,
      clientIdMasked: null,
      checks: {
        https: callback.startsWith("https://"),
        expectedHosts: true,
        callbackConsistent: true,
        requiredParams: {
          responseType: false,
          clientId: false,
          redirectUri: false,
          state: false,
          scope: false,
          redirectMatchesCallback: false,
          clientIdConsistent: true,
        },
        likelyDevelopmentRedirect: false,
      },
    };
  }
  const creds = contaAzulCreds();
  const fullUrl = buildAuthorizeUrl({ origin: returnOrigin, state: "[diagnostico]" });
  const rawConfiguredParams = readAuthorizeSearchParams(creds.authUrl);
  const rawConfiguredRedirect = rawConfiguredParams.get("redirect_uri")?.trim() ?? "";
  const paramChecks = inspectContaAzulAuthorizeParams(fullUrl, {
    callback,
    expectedClientId: creds.clientId,
  });
  const authHost = new URL(creds.authUrl.split("#", 1)[0]).hostname;
  const tokenHost = new URL(creds.tokenUrl).hostname;
  const callbackUrl = new URL(callback);
  return {
    configured: true,
    oauthVersion: "v2",
    authorizationUrl: sanitizeContaAzulAuthorizeUrl(fullUrl),
    tokenUrl: creds.tokenUrl,
    callback,
    scopes: CA_SCOPES.split(" "),
    returnOrigin,
    clientIdMasked: maskClientId(creds.clientId),
    checks: {
      https:
        creds.authUrl.startsWith("https://") &&
        creds.tokenUrl.startsWith("https://") &&
        callbackUrl.protocol === "https:",
      expectedHosts:
        authHost === "login.contaazul.com" &&
        tokenHost === "api-v2.contaazul.com" &&
        callbackUrl.hostname.endsWith("wktechnology.com.br"),
      callbackConsistent: fullUrl.includes(encodeURIComponent(callback)),
      requiredParams: paramChecks,
      likelyDevelopmentRedirect: rawConfiguredRedirect === "https://www.contaazul.com",
    },
  };
}
