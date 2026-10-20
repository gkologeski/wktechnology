// Cliente HTTP somente leitura da API do Jibble. Sem imports de servidor, testável com
// `fetch` falso. client_id/client_secret só vão no corpo do POST de token; o token só no
// cabeçalho Authorization das APIs oficiais. Nada disso aparece em erro, log ou retorno.
import {
  isAllowedApiUrl,
  isSafeDownloadUrl,
  JIBBLE_TOKEN_URL,
  resolveStatusUrl,
} from "./jibble-urls";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type JibbleErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "bad_request"
  | "server"
  | "network"
  | "redirect_blocked"
  | "host_blocked"
  | "export_failed"
  | "invalid_response";

const MESSAGES: Record<JibbleErrorCode, string> = {
  unauthorized:
    "O Jibble recusou as credenciais (401). Confira o Client ID e o Client Secret criados em Organization Settings › API Credentials.",
  forbidden: "As credenciais não têm permissão para este dado (403).",
  not_found: "Recurso não encontrado ou indisponível no plano do Jibble (404).",
  rate_limited: "Limite de requisições do Jibble atingido (429). A execução continua sozinha.",
  bad_request: "O Jibble recusou os parâmetros da consulta (400).",
  server: "O Jibble está instável no momento (5xx). Tente de novo em instantes.",
  network: "Sem resposta do Jibble (rede ou tempo esgotado).",
  redirect_blocked: "O Jibble redirecionou a chamada; redirecionamentos são bloqueados.",
  host_blocked: "Link de paginação ou exportação fora dos hosts oficiais do Jibble.",
  export_failed: "A exportação assíncrona do Jibble falhou.",
  invalid_response: "Resposta inesperada do Jibble.",
};

export class JibbleApiError extends Error {
  constructor(
    public code: JibbleErrorCode,
    public status: number | null,
    /** Quando rate_limited: instante (ms) a partir do qual tentar de novo. */
    public retryAt?: number,
  ) {
    super(MESSAGES[code]);
    this.name = "JibbleApiError";
  }
}

export function jibbleErrorMessage(code: JibbleErrorCode): string {
  return MESSAGES[code];
}

export type JibbleCredentials = { clientId: string; clientSecret: string };

export type JibbleClientOptions = {
  credentials: JibbleCredentials;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  minIntervalMs?: number;
  maxRetries?: number;
  timeoutMs?: number;
  /** Espera maior que isto vira `rate_limited` com retryAt (o job retoma depois). */
  maxInlineWaitMs?: number;
};

export type TokenInfo = { organizationId: string | null; personId: string | null };

export type ODataPage<T> = { items: T[]; nextUrl: string | null; count: number | null };

function retryAfterMs(res: Response, now: number): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(h);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

function codeFor(status: number): JibbleErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 400) return "bad_request";
  return "server";
}

export class JibbleClient {
  private f: FetchLike;
  private sleep: (ms: number) => Promise<void>;
  private now: () => number;
  private token: { value: string; expiresAt: number } | null = null;
  private lastRequestAt = 0;
  public requests = 0;
  public retries = 0;
  public tokenInfo: TokenInfo = { organizationId: null, personId: null };

  constructor(private opts: JibbleClientOptions) {
    const { clientId, clientSecret } = opts.credentials;
    if (!clientId?.trim() || !clientSecret?.trim())
      throw new Error("Credenciais do Jibble ausentes.");
    this.f = opts.fetch ?? ((u, i) => fetch(u, i));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? (() => Date.now());
  }

  private async raw(url: string, init: RequestInit): Promise<Response> {
    const gap = (this.opts.minIntervalMs ?? 100) - (this.now() - this.lastRequestAt);
    if (gap > 0) await this.sleep(gap);
    this.lastRequestAt = this.now();
    this.requests++;
    try {
      return await this.f(url, {
        ...init,
        redirect: "manual",
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 30_000),
      });
    } catch {
      throw new JibbleApiError("network", null);
    }
  }

  /** OAuth client_credentials (POST identity.prod.jibble.io/connect/token). */
  async authenticate(): Promise<TokenInfo> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.opts.credentials.clientId.trim(),
      client_secret: this.opts.credentials.clientSecret.trim(),
    });
    const res = await this.withRetry(() =>
      this.raw(JIBBLE_TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }),
    );
    if (res.status === 400 || res.status === 401)
      throw new JibbleApiError("unauthorized", res.status);
    if (!res.ok) throw new JibbleApiError(codeFor(res.status), res.status);
    let data: {
      access_token?: string;
      expires_in?: number;
      organizationId?: string;
      personId?: string;
    };
    try {
      data = await res.json();
    } catch {
      throw new JibbleApiError("invalid_response", res.status);
    }
    if (!data.access_token) throw new JibbleApiError("invalid_response", res.status);
    const ttl = Math.min(Number(data.expires_in) || 3600, 12 * 3600);
    this.token = { value: data.access_token, expiresAt: this.now() + (ttl - 60) * 1000 };
    this.tokenInfo = {
      organizationId: data.organizationId ?? null,
      personId: data.personId ?? null,
    };
    return this.tokenInfo;
  }

  /** Repete 429/5xx com Retry-After/backoff; espera longa vira rate_limited com retryAt. */
  private async withRetry(call: () => Promise<Response>): Promise<Response> {
    const max = this.opts.maxRetries ?? 5;
    const inline = this.opts.maxInlineWaitMs ?? 10_000;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await call();
      } catch (e) {
        if (attempt < max && e instanceof JibbleApiError && e.code === "network") {
          this.retries++;
          await this.sleep(Math.min(8000, 500 * 2 ** attempt));
          continue;
        }
        throw e;
      }
      if (res.status === 429 || res.status === 503) {
        const wait = retryAfterMs(res, this.now()) ?? Math.min(60_000, 1000 * 2 ** attempt);
        if (attempt >= max || wait > inline)
          throw new JibbleApiError("rate_limited", res.status, this.now() + Math.max(wait, 1000));
        this.retries++;
        await this.sleep(wait);
        continue;
      }
      if (res.status >= 500 && attempt < max) {
        this.retries++;
        await this.sleep(Math.min(8000, 500 * 2 ** attempt));
        continue;
      }
      return res;
    }
  }

  /** GET autenticado em host oficial. 401 → reautentica uma vez. Redirecionamento bloqueado. */
  private async authedGet(url: string, extra?: Record<string, string>): Promise<Response> {
    if (!isAllowedApiUrl(url)) throw new JibbleApiError("host_blocked", null);
    for (let reauth = 0; ; reauth++) {
      if (!this.token || this.token.expiresAt <= this.now()) await this.authenticate();
      const token = this.token!.value;
      const res = await this.withRetry(() =>
        this.raw(url, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...extra },
        }),
      );
      if (res.status === 401 && reauth === 0) {
        this.token = null;
        continue;
      }
      return res;
    }
  }

  private async json<T>(res: Response): Promise<T> {
    try {
      return (await res.json()) as T;
    } catch {
      throw new JibbleApiError("invalid_response", res.status);
    }
  }

  async getJson<T>(url: string): Promise<T> {
    const res = await this.authedGet(url);
    if (res.status >= 300 && res.status < 400)
      throw new JibbleApiError("redirect_blocked", res.status);
    if (!res.ok) throw new JibbleApiError(codeFor(res.status), res.status);
    return this.json<T>(res);
  }

  /** Uma página OData. `@odata.nextLink` só é seguido se estiver na lista de hosts. */
  async page<T>(url: string): Promise<ODataPage<T>> {
    const data = await this.getJson<{
      value?: T[];
      "@odata.nextLink"?: string;
      "@odata.count"?: number;
    }>(url);
    if (!Array.isArray(data.value)) throw new JibbleApiError("invalid_response", 200);
    const next = data["@odata.nextLink"] ?? null;
    if (next && !isAllowedApiUrl(new URL(next, url).toString()))
      throw new JibbleApiError("host_blocked", null);
    return {
      items: data.value,
      nextUrl: next ? new URL(next, url).toString() : null,
      count: typeof data["@odata.count"] === "number" ? data["@odata.count"] : null,
    };
  }

  /**
   * Coleção via exportação assíncrona (Prefer: respond-async). Só trata como export quando o
   * Jibble responde 202 com statusUrl; 200 é a resposta síncrona normal. O download (303
   * Location, URL assinada) é feito SEM Authorization. O export de origem nunca é excluído.
   */
  async collectionAsync<T>(
    url: string,
    opts: { maxPolls?: number; pollMs?: number } = {},
  ): Promise<{ items: T[]; mode: "async" | "sync"; nextUrl: string | null }> {
    const start = await this.authedGet(url, { Prefer: "respond-async" });
    if (start.status === 200) {
      const p = await this.json<{ value?: T[]; "@odata.nextLink"?: string }>(start);
      if (!Array.isArray(p.value)) throw new JibbleApiError("invalid_response", 200);
      const next = p["@odata.nextLink"] ? new URL(p["@odata.nextLink"], url).toString() : null;
      if (next && !isAllowedApiUrl(next)) throw new JibbleApiError("host_blocked", null);
      return { items: p.value, mode: "sync", nextUrl: next };
    }
    if (start.status !== 202) {
      if (start.status >= 300 && start.status < 400)
        throw new JibbleApiError("redirect_blocked", start.status);
      throw new JibbleApiError(codeFor(start.status), start.status);
    }
    const job = await this.json<{ statusUrl?: string }>(start);
    const rel = job.statusUrl ?? start.headers.get("location");
    if (!rel) throw new JibbleApiError("invalid_response", 202);
    const statusUrl = resolveStatusUrl(url, rel);
    for (let i = 0; i < (opts.maxPolls ?? 30); i++) {
      const res = await this.authedGet(statusUrl);
      if (res.status === 303) {
        const loc = res.headers.get("location");
        if (!loc || !isSafeDownloadUrl(loc)) throw new JibbleApiError("host_blocked", 303);
        const dl = await this.withRetry(() =>
          this.raw(loc, { method: "GET", headers: { Accept: "application/json" } }),
        );
        if (!dl.ok)
          throw new JibbleApiError(
            dl.status >= 300 && dl.status < 400 ? "redirect_blocked" : "export_failed",
            dl.status,
          );
        const p = await this.json<{ value?: T[] }>(dl);
        if (!Array.isArray(p.value)) throw new JibbleApiError("invalid_response", dl.status);
        return { items: p.value, mode: "async", nextUrl: null };
      }
      if (!res.ok) throw new JibbleApiError(codeFor(res.status), res.status);
      const st = await this.json<{ status?: string }>(res);
      if (st.status === "Failed") throw new JibbleApiError("export_failed", 200);
      await this.sleep(opts.pollMs ?? 2000);
    }
    throw new JibbleApiError("rate_limited", null, this.now() + 30_000);
  }
}
