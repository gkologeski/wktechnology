// API pública v1 do TechProjects — partes puras (sem servidor): normalização do corpo, hash do
// pedido para idempotência e tradução das recusas do banco em respostas HTTP estáveis.
import { z } from "zod";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^\d{2}:\d{2}(:\d{2})?$/;

/** Corpo aceito em POST /v1/time-entries. Situação, usuário e custo nunca vêm do cliente. */
export const PublicTimeEntryInput = z
  .object({
    project_id: z.string().uuid(),
    task_id: z.string().uuid(),
    entry_date: z.string().regex(DATE_ONLY),
    mode: z.enum(["interval", "duration"]).optional(),
    start_time: z.string().regex(CLOCK).optional(),
    end_time: z.string().regex(CLOCK).optional(),
    duration_seconds: z
      .number()
      .int()
      .min(60)
      .max(24 * 3600)
      .optional(),
    /** Compatibilidade: versões anteriores aceitavam minutos. */
    duration_minutes: z
      .number()
      .int()
      .min(1)
      .max(24 * 60)
      .optional(),
    timezone: z.string().min(1).max(64).optional(),
    description: z.string().max(2000).optional(),
    billable: z.boolean().optional(),
    external_id: z.string().min(1).max(180).optional(),
  })
  .strict();

export type PublicTimeEntryBody = z.infer<typeof PublicTimeEntryInput>;

/** Converte o corpo validado no formato da função do banco (segundos exatos, modo explícito). */
export function toEntryPayload(b: PublicTimeEntryBody): Record<string, unknown> {
  const seconds =
    b.duration_seconds ?? (b.duration_minutes != null ? b.duration_minutes * 60 : undefined);
  const mode = b.mode ?? (b.start_time && b.end_time ? "interval" : "duration");
  const out: Record<string, unknown> = {
    project_id: b.project_id,
    task_id: b.task_id,
    entry_date: b.entry_date,
    mode,
  };
  if (mode === "interval") {
    out.start_time = b.start_time;
    out.end_time = b.end_time;
  } else {
    out.duration_seconds = seconds;
  }
  if (b.timezone) out.timezone = b.timezone;
  if (b.description != null) out.description = b.description;
  if (b.billable != null) out.billable = b.billable;
  if (b.external_id) out.external_id = b.external_id;
  return out;
}

/** JSON canônico (chaves ordenadas, sem undefined) para hash estável do pedido. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Chave de idempotência: cabeçalho explícito ou, por compatibilidade, o external_id do corpo. */
export function resolveIdempotencyKey(
  header: string | null,
  externalId: string | undefined,
): string | null {
  const h = header?.trim();
  if (h) return h;
  return externalId ? `external:${externalId}` : null;
}

export type ApiErrorShape = { status: number; error: string; message: string };

/** Tradução estável das recusas do banco (mensagens já em PT-BR e sem dados sensíveis). */
export function mapApiDbError(raw: string): ApiErrorShape {
  const msg = raw.replace(/^.*?ERROR:\s*/, "").trim();
  const clean = msg.replace(/^[A-Z_]+:\s*/, "");
  if (/API_KEY_INVALID/.test(msg))
    return { status: 401, error: "unauthorized", message: "Chave inválida." };
  if (/API_SUBJECT_INACTIVE/.test(msg))
    return { status: 403, error: "forbidden", message: clean };
  if (/IDEMPOTENCY_CONFLICT/.test(msg))
    return { status: 409, error: "idempotency_conflict", message: clean };
  if (/IDEMPOTENCY_KEY_REQUIRED/.test(msg))
    return { status: 400, error: "idempotency_key_required", message: clean };
  if (/INVALID_INPUT/.test(msg)) return { status: 400, error: "invalid_input", message: clean };
  if (/NOT_FOUND/.test(msg)) return { status: 404, error: "not_found", message: clean };
  if (/PERIOD_CLOSED/.test(msg)) return { status: 409, error: "period_closed", message: clean };
  if (/Já existe um apontamento|sobrep/i.test(msg))
    return { status: 409, error: "overlap", message: clean };
  if (/vínculo|permission denied|row-level security|42501/i.test(msg))
    return { status: 403, error: "forbidden", message: clean };
  return { status: 422, error: "rejected", message: clean.slice(0, 300) };
}
