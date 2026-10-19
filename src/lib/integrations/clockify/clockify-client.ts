// Cliente HTTP somente leitura da API do Clockify. Sem imports de servidor para ser
// testável com `fetch` falso. A chave vai só no cabeçalho X-Api-Key e nunca aparece em
// mensagens de erro, logs ou retornos.
import { buildClockifyUrl, type ClockifyBases } from "./clockify-urls";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type ClockifyErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "bad_request"
  | "server"
  | "network"
  | "redirect_blocked"
  | "invalid_response";

export class ClockifyApiError extends Error {
  constructor(
    public code: ClockifyErrorCode,
    public status: number | null,
    message: string,
    /** Quando rate_limited: instante (ms) a partir do qual tentar de novo. */
    public retryAt?: number,
  ) {
    super(message);
    this.name = "ClockifyApiError";
  }
}

const MESSAGES: Record<ClockifyErrorCode, string> = {
  unauthorized: "A chave do Clockify foi recusada (401). Gere uma nova chave e salve de novo.",
  forbidden:
    "A chave não tem permissão para este dado (403). Use uma chave de administrador do workspace de origem.",
  not_found: "Dado não encontrado ou recurso indisponível no plano do Clockify (404).",
  rate_limited: "Limite de requisições do Clockify atingido (429). A execução continua sozinha.",
  bad_request: "O Clockify recusou os parâmetros da consulta (400).",
  server: "O Clockify está instável no momento (5xx). Tente de novo em instantes.",
  network: "Sem resposta do Clockify (rede ou tempo esgotado).",
  redirect_blocked: "O Clockify redirecionou a chamada; redirecionamentos são bloqueados por segurança.",
  invalid_response: "Resposta inesperada do Clockify.",
};

export function clockifyErrorMessage(code: ClockifyErrorCode): string {
  return MESSAGES[code];
}

/**
 * Intervalo mínimo entre requisições por plano do workspace de origem.
 * Fonte: clockify.me/help (Free: 30 requisições/hora; pagos: 20/s; Enterprise: 50/s).
 * Plano desconhecido usa um ritmo conservador.
 */
export function minIntervalForPlan(plan: string | null | undefined): number {
  const p = (plan ?? "").toUpperCase();
  if (!p) return 200;
  if (p.startsWith("FREE")) return 120_000;
  if (p.startsWith("ENTERPRISE")) return 25;
  if (/^(BASIC|STANDARD|PRO|BUNDLE|TRIAL)/.test(p)) return 60;
  return 200;
}

export type ClockifyClientOptions = {
  apiKey: string;
  bases: ClockifyBases;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  minIntervalMs?: number;
  /** Instante (ms) da última requisição (vem do checkpoint para respeitar o ritmo entre chamadas). */
  lastRequestAt?: number;
  maxRetries?: number;
  timeoutMs?: number;
  /** Maior espera feita dentro da mesma chamada; acima disso devolve rate_limited com retryAt. */
  maxInlineWaitMs?: number;
};

export type PageResult<T> = { items: T[]; lastPage: boolean; status: number };

function retryAfterMs(res: Response, now: number): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(h);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

export class ClockifyClient {
  private f: FetchLike;
  private sleep: (ms: number) => Promise<void>;
  private now: () => number;
  private minInterval: number;
  private maxRetries: number;
  private timeoutMs: number;
  private maxInlineWait: number;
  public lastRequestAt: number;
  public requests = 0;

  constructor(private opts: ClockifyClientOptions) {
    if (!opts.apiKey || opts.apiKey.length < 16) throw new Error("Chave do Clockify ausente.");
    this.f = opts.fetch ?? ((u, i) => fetch(u, i));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? (() => Date.now());
    this.minInterval = opts.minIntervalMs ?? 200;
    this.maxRetries = opts.maxRetries ?? 5;
    this.timeoutMs = opts.timeoutMs ?? 25_000;
    this.maxInlineWait = opts.maxInlineWaitMs ?? 10_000;
    this.lastRequestAt = opts.lastRequestAt ?? 0;
  }

  /** Tempo que falta para a próxima requisição respeitar o ritmo do plano. */
  waitNeededMs(): number {
    return Math.max(0, this.lastRequestAt + this.minInterval - this.now());
  }

  private async pace() {
    const wait = this.waitNeededMs();
    if (wait > this.maxInlineWait) {
      throw new ClockifyApiError(
        "rate_limited",
        null,
        clockifyErrorMessage("rate_limited"),
        this.now() + wait,
      );
    }
    if (wait > 0) await this.sleep(wait);
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    let attempt = 0;
    for (;;) {
      await this.pace();
      this.lastRequestAt = this.now();
      this.requests++;
      let res: Response;
      try {
        res = await this.f(url, {
          ...init,
          redirect: "manual",
          headers: {
            "X-Api-Key": this.opts.apiKey,
            Accept: "application/json",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch {
        if (attempt++ < this.maxRetries) {
          await this.sleep(Math.min(8000, 500 * 2 ** attempt));
          continue;
        }
        throw new ClockifyApiError("network", null, clockifyErrorMessage("network"));
      }
      if (res.status >= 300 && res.status < 400) {
        throw new ClockifyApiError("redirect_blocked", res.status, clockifyErrorMessage("redirect_blocked"));
      }
      if (res.status === 429 || res.status === 503) {
        const wait = retryAfterMs(res, this.now()) ?? Math.min(60_000, 1000 * 2 ** attempt);
        if (attempt++ >= this.maxRetries || wait > this.maxInlineWait) {
          throw new ClockifyApiError(
            "rate_limited",
            res.status,
            clockifyErrorMessage("rate_limited"),
            this.now() + Math.max(wait, 1000),
          );
        }
        await this.sleep(wait);
        continue;
      }
      if (res.status >= 500 && attempt++ < this.maxRetries) {
        await this.sleep(Math.min(8000, 500 * 2 ** attempt));
        continue;
      }
      if (!res.ok) {
        const code: ClockifyErrorCode =
          res.status === 401
            ? "unauthorized"
            : res.status === 403
              ? "forbidden"
              : res.status === 404
                ? "not_found"
                : res.status === 400
                  ? "bad_request"
                  : "server";
        throw new ClockifyApiError(code, res.status, clockifyErrorMessage(code));
      }
      return res;
    }
  }

  async get<T>(path: string, query?: Record<string, string | number | boolean | string[] | undefined>) {
    const res = await this.request(buildClockifyUrl(this.opts.bases, "api", path, query), {
      method: "GET",
    });
    let data: T;
    try {
      data = (await res.json()) as T;
    } catch {
      throw new ClockifyApiError("invalid_response", res.status, clockifyErrorMessage("invalid_response"));
    }
    return { data, res };
  }

  /** Uma página. Fim pelo cabeçalho Last-Page; sem cabeçalho, página incompleta encerra. */
  async page<T>(
    path: string,
    page: number,
    pageSize: number,
    query?: Record<string, string | number | boolean | string[] | undefined>,
  ): Promise<PageResult<T>> {
    const { data, res } = await this.get<T[]>(path, { ...query, page, "page-size": pageSize });
    if (!Array.isArray(data)) {
      throw new ClockifyApiError("invalid_response", res.status, clockifyErrorMessage("invalid_response"));
    }
    const header = res.headers.get("last-page");
    const lastPage =
      header === null ? data.length < pageSize : header.trim().toLowerCase() === "true";
    return { items: data, lastPage: lastPage || data.length === 0, status: res.status };
  }

  /** Relatório (POST de consulta, somente leitura). */
  async report<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.request(buildClockifyUrl(this.opts.bases, "reports", path), {
      method: "POST",
      body: JSON.stringify(body),
    });
    try {
      return (await res.json()) as T;
    } catch {
      throw new ClockifyApiError("invalid_response", res.status, clockifyErrorMessage("invalid_response"));
    }
  }
}
