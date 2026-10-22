/**
 * Telefone canônico do TechERP: E.164 ("+" + DDI + número nacional, até 15
 * dígitos — ITU-T E.164). Fonte única de normalização/validação para
 * navegador e servidor, apoiada em `libphonenumber-js/max` (metadados
 * completos: comprimento E tipo por país).
 *
 * Regras (ver docs/architecture/phone-e164.md):
 * - Sem "+" o país PRECISA vir do contexto (país padrão do workspace para
 *   digitação nova, ou evidência gravada no registro). Sem contexto, a
 *   resposta é `region_unknown` — nunca se presume Brasil.
 * - Nunca se acrescenta ou remove o 9º dígito; nunca se completa número
 *   incompleto; nunca se corta zero significativo de outro país.
 * - Ramal é separado do E.164 (campo próprio); vários números num mesmo
 *   texto são `multiple` e não viram um E.164 só.
 * - Validação aqui comprova formato/plano de numeração, não que o número
 *   exista, tenha WhatsApp ou pertença à pessoa. Política de canal (ex.:
 *   WhatsApp só celular BR) fica em `whatsapp-e164.ts`.
 */
import {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js/max";

export const PHONE_NORMALIZER_VERSION = "e164-v1";

/** País padrão da plataforma para digitação nova quando o workspace não define outro. */
export const PLATFORM_DEFAULT_PHONE_COUNTRY: CountryCode = "BR";

/** Forma E.164 (só sintaxe; não comprova validade). */
export const E164_SHAPE = /^\+[1-9]\d{1,14}$/;

export type PhoneLineType =
  | "mobile"
  | "fixed_line"
  | "fixed_or_mobile"
  | "toll_free"
  | "voip"
  | "other";

export type PhoneFailureReason =
  | "letters"
  | "bad_plus"
  | "too_long"
  | "too_short"
  | "invalid"
  | "region_unknown"
  | "ambiguous"
  | "multiple"
  | "placeholder";

export type PhoneNormalization =
  | { status: "empty" }
  | {
      status: "valid";
      e164: string;
      country: CountryCode | null;
      extension: string | null;
      type: PhoneLineType | null;
      /** Como o país foi determinado. */
      via: "explicit_plus" | "idd_00" | "context_country";
    }
  | { status: "invalid"; reason: PhoneFailureReason; candidates?: string[] };

export type NormalizeOptions = {
  /** País de contexto para números sem "+". `null` = sem contexto. */
  defaultCountry?: string | null;
};

const EXT_RE = /\s*[,;]?\s*(?:ramal|ram\.?|r\.|ext\.?|extens[aã]o|x|#)\s*:?\s*(\d{1,7})\s*$/i;
/** Separadores de vários números num mesmo texto. */
const MULTI_SPLIT = /\s*(?:[/;|,\n]|\s(?:e|ou)\s)\s*/i;
/** Caracteres aceitos num número (fora o ramal). */
const ALLOWED = /^[\d\s+().\-\u00a0]+$/;

export function asCountry(c: string | null | undefined): CountryCode | null {
  const v = (c ?? "").trim().toUpperCase();
  return v && /^[A-Z]{2}$/.test(v) && isSupportedCountry(v) ? (v as CountryCode) : null;
}

function mapType(p: PhoneNumber): PhoneLineType | null {
  const t = p.getType();
  switch (t) {
    case "MOBILE":
      return "mobile";
    case "FIXED_LINE":
      return "fixed_line";
    case "FIXED_LINE_OR_MOBILE":
      return "fixed_or_mobile";
    case "TOLL_FREE":
      return "toll_free";
    case "VOIP":
      return "voip";
    case undefined:
      return null;
    default:
      return "other";
  }
}

function tryParse(text: string, country?: CountryCode): PhoneNumber | null {
  try {
    const p = parsePhoneNumberFromString(text, country ? { defaultCountry: country } : undefined);
    return p && p.isValid() ? p : null;
  } catch {
    return null;
  }
}

/** Divide um texto com vários números; devolve só pedaços com dígitos. */
export function splitPhoneCandidates(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return String(raw)
    .split(MULTI_SPLIT)
    .map((s) => s.trim())
    .filter((s) => /\d/.test(s));
}

/**
 * Normaliza UM número para E.164. Não lança.
 */
export function normalizePhone(
  raw: string | null | undefined,
  opts: NormalizeOptions = {},
): PhoneNormalization {
  const original = String(raw ?? "")
    .normalize("NFKC")
    .trim();
  if (!original) return { status: "empty" };
  const digitsAll = original.replace(/\D/g, "");
  if (!digitsAll || /^0+$/.test(digitsAll)) {
    return /[\p{L}]/u.test(original)
      ? { status: "invalid", reason: "letters" }
      : { status: "invalid", reason: "placeholder" };
  }

  const parts = splitPhoneCandidates(original);
  if (parts.length > 1) return { status: "invalid", reason: "multiple", candidates: parts };

  let main = original;
  let extension: string | null = null;
  const ext = EXT_RE.exec(main);
  if (ext && ext.index > 0) {
    extension = ext[1];
    main = main.slice(0, ext.index).trim();
  }
  if (!ALLOWED.test(main)) return { status: "invalid", reason: "letters" };
  const plusCount = (main.match(/\+/g) ?? []).length;
  if (plusCount > 1 || (plusCount === 1 && !main.startsWith("+"))) {
    return { status: "invalid", reason: "bad_plus" };
  }
  const digits = main.replace(/\D/g, "");
  if (digits.length > 17) return { status: "invalid", reason: "too_long" };
  if (digits.length < 4) return { status: "invalid", reason: "too_short" };

  const ctx = asCountry(opts.defaultCountry);
  const found = new Map<
    string,
    { p: PhoneNumber; via: "explicit_plus" | "idd_00" | "context_country" }
  >();
  const add = (p: PhoneNumber | null, via: "explicit_plus" | "idd_00" | "context_country") => {
    if (p && !found.has(p.number)) found.set(p.number, { p, via });
  };

  if (main.startsWith("+")) {
    if (digits.startsWith("0")) return { status: "invalid", reason: "invalid" };
    add(tryParse(`+${digits}`), "explicit_plus");
  } else {
    if (digits.startsWith("00")) add(tryParse(`+${digits.slice(2)}`), "idd_00");
    if (ctx) {
      // Leitura nacional pela biblioteca (trata prefixo 0 / operadora).
      add(tryParse(digits, ctx), "context_country");
      const cc = getCountryCallingCode(ctx);
      if (!digits.startsWith("0")) {
        // Leitura nacional pura (sem tirar o código do país embutido) —
        // revela ambiguidade como DDD 55 x DDI 55.
        add(tryParse(`+${cc}${digits}`), "context_country");
        if (digits.startsWith(cc)) add(tryParse(`+${digits}`), "context_country");
      }
    } else if (!digits.startsWith("00")) {
      return { status: "invalid", reason: "region_unknown" };
    }
  }

  if (found.size === 0) {
    if (main.startsWith("+") && digits.length > 15)
      return { status: "invalid", reason: "too_long" };
    return { status: "invalid", reason: "invalid" };
  }
  if (found.size > 1) {
    return { status: "invalid", reason: "ambiguous", candidates: [...found.keys()] };
  }
  const [{ p, via }] = [...found.values()];
  if (!E164_SHAPE.test(p.number)) return { status: "invalid", reason: "too_long" };
  return {
    status: "valid",
    e164: p.number,
    country: (p.country as CountryCode | undefined) ?? null,
    extension: extension ?? (p.ext ? String(p.ext) : null),
    type: mapType(p),
    via,
  };
}

/** Mensagem PT-BR de cada falha, sem repetir o número digitado. */
export function phoneErrorMessage(reason: PhoneFailureReason): string {
  switch (reason) {
    case "letters":
      return "Telefone com letras ou símbolos inválidos.";
    case "bad_plus":
      return "O sinal + só pode aparecer uma vez, no início.";
    case "too_long":
      return "Telefone longo demais (máximo de 15 dígitos com o código do país).";
    case "too_short":
      return "Telefone incompleto.";
    case "region_unknown":
      return "Informe o código do país (ex.: +55) ou escolha o país.";
    case "ambiguous":
      return "Não foi possível saber o país/DDD deste número. Informe com +código do país.";
    case "multiple":
      return "Informe um único telefone por campo.";
    case "placeholder":
      return "Telefone incompleto.";
    default:
      return "Telefone inválido para o país informado.";
  }
}

export type PhoneFieldResult =
  | { ok: true; value: string | null; extension: string | null }
  | { ok: false; message: string; reason: PhoneFailureReason | "required" };

/**
 * Regra de campo: vazio → null (ou erro se obrigatório); válido → E.164;
 * qualquer outro caso → erro em PT-BR. Placeholder ("--", "0") conta como
 * vazio só quando `placeholderAsEmpty` (backfill/integração).
 */
export function normalizePhoneField(
  raw: string | null | undefined,
  opts: NormalizeOptions & { required?: boolean; placeholderAsEmpty?: boolean } = {},
): PhoneFieldResult {
  const r = normalizePhone(raw, opts);
  const isEmpty =
    r.status === "empty" ||
    (opts.placeholderAsEmpty && r.status === "invalid" && r.reason === "placeholder");
  if (isEmpty) {
    return opts.required
      ? { ok: false, message: "Telefone obrigatório.", reason: "required" }
      : { ok: true, value: null, extension: null };
  }
  if (r.status === "valid") return { ok: true, value: r.e164, extension: r.extension };
  if (r.status === "invalid")
    return { ok: false, message: phoneErrorMessage(r.reason), reason: r.reason };
  return { ok: false, message: phoneErrorMessage("invalid"), reason: "invalid" };
}

/** True quando o valor já é E.164 válido (forma + plano de numeração). */
export function isValidE164(v: string | null | undefined): boolean {
  if (!v || !E164_SHAPE.test(v)) return false;
  return tryParse(v)?.number === v;
}

/** Exibição internacional ("+55 11 99999-8888"); devolve o original se não for E.164. */
export function formatPhoneDisplay(v: string | null | undefined): string {
  if (!v) return "";
  if (!E164_SHAPE.test(v)) return v;
  try {
    const p = parsePhoneNumberFromString(v);
    return p ? p.formatInternational() : v;
  } catch {
    return v;
  }
}

/** Dígitos para provedores que exigem número sem "+" (Meta, Twilio etc.). Só no limite. */
export function e164ToProviderDigits(e164: string): string {
  return e164.replace(/^\+/, "");
}

/** Link `tel:` (RFC 3966) com ramal opcional. */
export function telHref(e164: string, extension?: string | null): string {
  const base = `tel:${e164}`;
  return extension && /^\d{1,7}$/.test(extension) ? `${base};ext=${extension}` : base;
}

/** Máscara para relatórios: mantém "+", 2 primeiros e 2 últimos dígitos. */
export function maskPhone(v: string | null | undefined): string {
  const s = String(v ?? "");
  const total = (s.match(/\d/g) ?? []).length;
  let seen = 0;
  return s.replace(/\d/g, (d) => {
    seen += 1;
    return seen <= 2 || seen > total - 2 ? d : "•";
  });
}
