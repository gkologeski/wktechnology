/**
 * Telefone nas BORDAS de gravação (servidor: APIs, formulários públicos,
 * importações, integrações, workflows, agentes). Usa só `e164.ts`.
 *
 * - `humanPhone`: dado digitado agora por uma pessoa/cliente de API. País de
 *   contexto = país padrão do workspace. Inválido → `PhoneValidationError`
 *   (API responde 422 sem ecoar o número).
 * - `sourcePhone`: dado vindo de outro sistema (HubSpot, Apollo, CV, CSV...)
 *   ou copiado de outro registro. País só com evidência da própria fonte;
 *   válido → E.164; qualquer outro caso → null: o registro entra sem o
 *   telefone e o original continua na fonte (decisão do usuário, 23/10/2026,
 *   junto com a guarda de formato do banco).
 */
import { z } from "zod";
import {
  asCountry,
  isValidE164,
  normalizePhone,
  normalizePhoneField,
  PLATFORM_DEFAULT_PHONE_COUNTRY,
  type PhoneFailureReason,
} from "./e164";

export class PhoneValidationError extends Error {
  readonly code = "invalid_phone";
  readonly status = 422;
  constructor(
    readonly field: string,
    message: string,
    readonly reason: PhoneFailureReason | "required",
  ) {
    super(message);
    this.name = "PhoneValidationError";
  }
}

export function isPhoneValidationError(e: unknown): e is PhoneValidationError {
  return e instanceof PhoneValidationError;
}

/** Corpo 422 padrão para APIs (não inclui o valor enviado). */
export function phoneErrorBody(e: PhoneValidationError) {
  return { error: "invalid_phone", field: e.field, reason: e.reason, message: e.message };
}

export function humanPhone(
  raw: unknown,
  opts: { field: string; country?: string | null; required?: boolean },
): string | null {
  if (raw === undefined || raw === null) {
    if (opts.required)
      throw new PhoneValidationError(
        opts.field,
        `${opts.field}: telefone obrigatório.`,
        "required",
      );
    return null;
  }
  const text = String(raw);
  // Já canônico: não depende de país.
  if (isValidE164(text)) return text;
  const r = normalizePhoneField(text, {
    defaultCountry: asCountry(opts.country) ?? PLATFORM_DEFAULT_PHONE_COUNTRY,
    required: opts.required,
  });
  if (!r.ok) throw new PhoneValidationError(opts.field, r.message, r.reason);
  return r.value;
}

/** Igual a `humanPhone`, mas para campos opcionais em PATCH: `undefined` continua `undefined`. */
export function humanPhonePatch(
  raw: unknown,
  opts: { field: string; country?: string | null },
): string | null | undefined {
  if (raw === undefined) return undefined;
  return humanPhone(raw, opts);
}

/**
 * Número vindo de outra fonte (ou copiado de outro registro). `country` só
 * quando a FONTE comprova o país (ex.: Receita Federal → BR; país gravado no
 * próprio registro de origem). Devolve E.164 ou `null` — nunca texto fora do
 * padrão, para o registro não ser recusado pela guarda do banco.
 */
export function sourcePhone(raw: unknown, country?: string | null): string | null {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (isValidE164(text)) return text;
  const r = normalizePhone(text, { defaultCountry: asCountry(country) });
  return r.status === "valid" ? r.e164 : null;
}

/** Ramal extraído de um texto de origem, quando houver. */
export function sourcePhoneExtension(raw: unknown, country?: string | null): string | null {
  if (raw == null) return null;
  const r = normalizePhone(String(raw), { defaultCountry: asCountry(country) });
  return r.status === "valid" ? r.extension : null;
}

const COUNTRY_NAMES: Record<string, string> = {
  brasil: "BR",
  brazil: "BR",
  br: "BR",
  "estados unidos": "US",
  "united states": "US",
  usa: "US",
  eua: "US",
  us: "US",
  portugal: "PT",
  pt: "PT",
  alemanha: "DE",
  germany: "DE",
  deutschland: "DE",
  "reino unido": "GB",
  "united kingdom": "GB",
  uk: "GB",
  inglaterra: "GB",
  franca: "FR",
  frança: "FR",
  france: "FR",
  espanha: "ES",
  spain: "ES",
  italia: "IT",
  itália: "IT",
  italy: "IT",
  argentina: "AR",
  mexico: "MX",
  méxico: "MX",
  chile: "CL",
  colombia: "CO",
  colômbia: "CO",
  uruguai: "UY",
  uruguay: "UY",
  paraguai: "PY",
  paraguay: "PY",
  peru: "PE",
  canada: "CA",
  canadá: "CA",
  finland: "FI",
  finlandia: "FI",
  finlândia: "FI",
  holanda: "NL",
  netherlands: "NL",
  "países baixos": "NL",
  suica: "CH",
  suíça: "CH",
  switzerland: "CH",
  india: "IN",
  índia: "IN",
  china: "CN",
  japao: "JP",
  japão: "JP",
  japan: "JP",
};

/** País de um campo "country" do próprio registro (nome PT/EN ou ISO-2). */
export function countryFromRecordField(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return null;
  return COUNTRY_NAMES[s] ?? (s.length === 2 ? asCountry(s) : null);
}

/** País padrão do workspace (para dado novo digitado). */
export async function workspacePhoneCountry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { rpc: (fn: any, args: any) => any },
  workspaceId: string | null | undefined,
): Promise<string> {
  if (!workspaceId) return PLATFORM_DEFAULT_PHONE_COUNTRY;
  try {
    const { data } = await supabase.rpc("workspace_phone_country", { _workspace: workspaceId });
    return asCountry(typeof data === "string" ? data : null) ?? PLATFORM_DEFAULT_PHONE_COUNTRY;
  } catch {
    return PLATFORM_DEFAULT_PHONE_COUNTRY;
  }
}

/**
 * `humanPhone` para gravação de um registro existente: se o valor recebido
 * é exatamente o que já está gravado (dado antigo não editado), mantém —
 * editar outro campo nunca é bloqueado por telefone legado.
 */
export async function humanPhoneForRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ref: { table: string; id?: string | null; column: string },
  raw: unknown,
  opts: { field?: string; country?: string | null; required?: boolean },
): Promise<string | null> {
  const field = opts.field ?? ref.column;
  if (ref.id && raw != null && String(raw).trim() && !isValidE164(String(raw))) {
    const { data } = await supabase
      .from(ref.table)
      .select(ref.column)
      .eq("id", ref.id)
      .maybeSingle();
    const current = (data as Record<string, unknown> | null)?.[ref.column];
    if (typeof current === "string" && current.trim() === String(raw).trim()) return current;
  }
  return humanPhone(raw, { field, country: opts.country, required: opts.required });
}

/**
 * Esquema zod para telefone digitado (perfil/convite): aceita formatação,
 * devolve E.164. Sem país do workspace disponível no esquema, usa o padrão
 * da plataforma só para número sem +DDI (os campos da tela já enviam E.164).
 */
export function zHumanPhone(opts: { required?: boolean; label?: string } = {}) {
  const label = opts.label ?? "Telefone";
  return z
    .string()
    .max(64)
    .transform((v, ctx) => {
      try {
        return humanPhone(v, { field: label, required: opts.required });
      } catch (e) {
        ctx.addIssue({
          code: "custom",
          message: isPhoneValidationError(e) ? `${label}: ${e.message}` : `${label} inválido.`,
        });
        return z.NEVER;
      }
    });
}

/**
 * Telefone de ação de workflow, depois de resolver os tokens. Texto fixo
 * digitado no fluxo segue a regra de dado novo (país do workspace; inválido
 * falha a ação). Valor vindo de token ({{contact.phone}}) é copiado sem
 * inventar país: canônico continua canônico; legado fora do padrão vira vazio.
 */
export function workflowPhone(
  template: string | null | undefined,
  resolved: string | null | undefined,
  country: string | null,
): string | null {
  const v = (resolved ?? "").trim();
  if (!v) return null;
  if ((template ?? "").includes("{{")) return sourcePhone(v, null);
  return humanPhone(v, { field: "phone", country });
}
