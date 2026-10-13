// Regras puras de envio dos fluxos: janela de horário comercial, classificação
// de falhas (tentar de novo x envio incerto x definitiva) e espera crescente.
// Sem acesso a banco: testável e usada pelo guarda de envio.

export type SendPolicy = {
  whatsapp_daily_limit: number | null;
  email_daily_limit: number | null;
  dedupe_hours: number;
  timezone: string;
  window_start: number | null;
  window_end: number | null;
  weekdays: number[];
  email_provider: "gmail_owner" | "gmail_account" | "outlook";
  email_account_id: string | null;
  default_booking_page_id: string | null;
};

export const MAX_DELIVERY_ATTEMPTS = 4;
export const DELIVERY_LEASE_SECONDS = 120;

function localParts(d: Date, tz: string): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return { hour, weekday };
}

function inWindow(
  d: Date,
  p: Pick<SendPolicy, "timezone" | "window_start" | "window_end" | "weekdays">,
) {
  const { hour, weekday } = localParts(d, p.timezone || "America/Sao_Paulo");
  if (p.weekdays.length > 0 && !p.weekdays.includes(weekday)) return false;
  if (p.window_start == null || p.window_end == null) return true;
  return hour >= p.window_start && hour < p.window_end;
}

/**
 * Próximo instante permitido para envio. `null` = agora já está dentro da
 * janela (ou não há janela configurada).
 */
export function nextSendSlot(
  now: Date,
  p: Pick<SendPolicy, "timezone" | "window_start" | "window_end" | "weekdays">,
): Date | null {
  const hasWindow = (p.window_start != null && p.window_end != null) || p.weekdays.length > 0;
  if (!hasWindow || (p.weekdays.length === 7 && p.window_start == null)) return null;
  if (inWindow(now, p)) return null;
  const base = new Date(now);
  base.setUTCMinutes(0, 0, 0);
  for (let k = 1; k <= 24 * 8; k++) {
    const c = new Date(base.getTime() + k * 3_600_000);
    if (inWindow(c, p)) return c;
  }
  return null; // janela impossível (ex.: nenhum dia): não bloqueia para sempre
}

export type FailureKind = "retry" | "uncertain" | "permanent";

/**
 * Classifica a falha do provedor:
 * - 429/5xx com resposta = o provedor recusou; pode tentar de novo;
 * - rede/timeout sem resposta = pode ter saído; NUNCA reenviar às cegas;
 * - demais (4xx, validação, descadastro, janela) = definitiva.
 */
export function classifyFailure(err: unknown): FailureKind {
  const msg = err instanceof Error ? err.message : String(err);
  const status =
    (err as { status?: unknown } | null)?.status ??
    Number(/\[(\d{3})\]/.exec(msg)?.[1] ?? /status (\d{3})/i.exec(msg)?.[1] ?? NaN);
  const n = typeof status === "number" ? status : Number(status);
  if (n === 429 || (n >= 500 && n <= 599)) return "retry";
  if (/fetch failed|network|timed? ?out|ECONN|socket|aborted/i.test(msg)) return "uncertain";
  return "permanent";
}

/** Espera crescente: 2, 4, 8 min… limitada a 60 min. */
export function backoffMs(attempt: number): number {
  return Math.min(60, 2 * 2 ** Math.max(0, attempt - 1)) * 60_000;
}
