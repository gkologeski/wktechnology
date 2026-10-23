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

export const PHONE_NORMALIZER_VERSION = "e164-v2";

/**
 * Até este número de dígitos (fora o ramal) o valor não é telefone: não há
 * número de nenhum país tão curto que identifique uma linha. Dado novo é
 * recusado ("Telefone incompleto"); dado legado fica em branco na correção.
 */
export const PHONE_BLANK_MAX_DIGITS = 4;

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
  | "placeholder"
  | "extension_only"
  | "repeated_country_code";

export type PhoneNormalization =
  | { status: "empty" }
  | {
      status: "valid";
      e164: string;
      country: CountryCode | null;
      extension: string | null;
      type: PhoneLineType | null;
      /** Como o país foi determinado. */
      via: "explicit_plus" | "idd_00" | "context_country" | "repeated_country_code";
    }
  | { status: "invalid"; reason: PhoneFailureReason; candidates?: string[] };

export type NormalizeOptions = {
  /** País de contexto para números sem "+". `null` = sem contexto. */
  defaultCountry?: string | null;
  /**
   * Aceita "+DDI DDI …" (código do país repetido) SÓ quando o país de
   * contexto é evidência do próprio registro e coincide com o DDI repetido,
   * a leitura literal é inválida e a sem repetição é a única válida. Nunca
   * usar com o país padrão do workspace (dado digitado volta com erro).
   */
  allowRepeatedCountryCode?: boolean;
};

const EXT_RE = /(?:^|\s*[,;]?\s*)(?:ramal|ram\.?|r\.|ext\.?|extens[aã]o|x|#)\s*:?\s*(\d{1,7})\s*$/i;
/** Separadores de vários números num mesmo texto. */
const MULTI_SPLIT = /\s*(?:[/;|,\n]|\s(?:e|ou)\s)\s*/i;
/** Caracteres aceitos num número (fora o ramal). */
const ALLOWED = /^[\d\s+().\-\u00a0]+$/;
/** Invisíveis (zero-width, marcas de direção, BOM, hífen suave). */
const INVISIBLE = /[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/g;
/** Traços tipográficos → hífen ASCII. */
const DASHES = /[\u2010-\u2015\u2212\ufe58\ufe63\uff0d]/g;
/** Rótulo reconhecido no início ("Tel:", "Telefone -", "tel:" de RFC 3966, "Fone"). */
const LABEL = /^(?:tel(?:efone)?|fone)\s*[.:-]?\s*(?=[\d+(])/i;

export function asCountry(c: string | null | undefined): CountryCode | null {
  const v = (c ?? "").trim().toUpperCase();
  return v && /^[A-Z]{2}$/.test(v) && isSupportedCountry(v) ? (v as CountryCode) : null;
}

/**
 * Remove só artefatos conhecidos que não carregam dígitos: invisíveis,
 * traços tipográficos, apóstrofo inicial de planilha e rótulo tel/telefone.
 * Nunca remove nem acrescenta dígito.
 */
export function sanitizePhoneText(raw: string | null | undefined): string {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(DASHES, "-")
    .trim()
    .replace(/^['\u2018\u2019`]+/, "")
    .trim()
    .replace(LABEL, "")
    .trim();
}

/** Separa o ramal do fim do texto (antes de qualquer divisão em vários números). */
export function splitPhoneExtension(text: string): { main: string; extension: string | null } {
  const m = EXT_RE.exec(text);
  if (!m) return { main: text, extension: null };
  return { main: text.slice(0, m.index).trim(), extension: m[1] };
}

/**
 * Quantidade de dígitos do NÚMERO (ramal fora, máscara/espaços/+ ignorados).
 * É a régua da limpeza "até 4 dígitos": o ramal nunca infla o comprimento.
 */
export function phoneMainDigitCount(raw: string | null | undefined): number {
  const { main } = splitPhoneExtension(sanitizePhoneText(raw));
  return main.replace(/\D/g, "").length;
}

/** Campo não vazio cujo número tem até `PHONE_BLANK_MAX_DIGITS` dígitos. */
export function isBlankableShortPhone(raw: string | null | undefined): boolean {
  if (raw == null || !String(raw).trim()) return false;
  return phoneMainDigitCount(raw) <= PHONE_BLANK_MAX_DIGITS;
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
  const original = sanitizePhoneText(raw);
  if (!original) return { status: "empty" };
  const digitsAll = original.replace(/\D/g, "");
  if (!digitsAll || /^0+$/.test(digitsAll)) {
    return /[\p{L}]/u.test(original)
      ? { status: "invalid", reason: "letters" }
      : { status: "invalid", reason: "placeholder" };
  }

  // Ramal sai ANTES da divisão em vários números ("…, ramal 22" é um número só).
  const { main, extension } = splitPhoneExtension(original);
  if (!/\d/.test(main)) return { status: "invalid", reason: "extension_only" };

  const parts = splitPhoneCandidates(main);
  if (parts.length > 1) return { status: "invalid", reason: "multiple", candidates: parts };

  if (!ALLOWED.test(main)) return { status: "invalid", reason: "letters" };
  const plusCount = (main.match(/\+/g) ?? []).length;
  // "+" só no início, admitindo um "(" antes: "(+55) 11 …".
  const leadingPlus = /^\(?\s*\+/.test(main);
  if (plusCount > 1 || (plusCount === 1 && !leadingPlus)) {
    return { status: "invalid", reason: "bad_plus" };
  }
  const digits = main.replace(/\D/g, "");
  if (digits.length > 17) return { status: "invalid", reason: "too_long" };
  if (digits.length <= PHONE_BLANK_MAX_DIGITS) return { status: "invalid", reason: "too_short" };

  const ctx = asCountry(opts.defaultCountry);
  type Via = "explicit_plus" | "idd_00" | "context_country" | "repeated_country_code";
  const found = new Map<string, { p: PhoneNumber; via: Via }>();
  const add = (p: PhoneNumber | null, via: Via) => {
    if (p && !found.has(p.number)) found.set(p.number, { p, via });
  };

  if (leadingPlus) {
    if (digits.startsWith("0")) return { status: "invalid", reason: "invalid" };
    const literal = tryParse(`+${digits}`);
    add(literal, "explicit_plus");
    if (!literal) {
      // "+55 55 11 …": DDI repetido. Só automatiza com evidência do registro.
      const p0 = parsePhoneNumberFromString(`+${digits}`);
      const cc = p0?.countryCallingCode;
      const rest = cc ? digits.slice(cc.length) : "";
      // Depois do DDI repetido não pode vir "0" (seriam duas correções juntas).
      const stripped =
        cc && rest.startsWith(cc) && rest[cc.length] !== "0" ? tryParse(`+${rest}`) : null;
      if (stripped) {
        const proven =
          !!opts.allowRepeatedCountryCode && !!ctx && getCountryCallingCode(ctx) === cc;
        if (!proven) {
          return {
            status: "invalid",
            reason: "repeated_country_code",
            candidates: [stripped.number],
          };
        }
        add(stripped, "repeated_country_code");
      }
    }
  } else if (ctx) {
    // Leitura pela biblioteca no país de contexto: trata prefixo nacional 0,
    // operadora (CSP) e prefixo internacional DESSE país (00, 0021, 011…).
    const cc = getCountryCallingCode(ctx);
    const byCtx = tryParse(digits, ctx);
    add(byCtx, byCtx && byCtx.countryCallingCode !== cc ? "idd_00" : "context_country");
    if (!digits.startsWith("0")) {
      // Leitura nacional pura (sem tirar o código do país embutido) —
      // revela ambiguidade como DDD 55 x DDI 55.
      add(tryParse(`+${cc}${digits}`), "context_country");
      if (digits.startsWith(cc)) add(tryParse(`+${digits}`), "context_country");
    }
    if (found.size === 0 && digits.startsWith("00")) {
      // "00" não é prefixo internacional válido sozinho neste país (ex.: BR
      // exige operadora). Leitura internacional fica só como candidata.
      const intl = tryParse(`+${digits.slice(2)}`);
      if (intl) return { status: "invalid", reason: "ambiguous", candidates: [intl.number] };
    }
  } else {
    // Sem país: nem "0"/CSP nem "00" têm significado comprovado.
    const intl = digits.startsWith("00") ? tryParse(`+${digits.slice(2)}`) : null;
    return intl
      ? { status: "invalid", reason: "region_unknown", candidates: [intl.number] }
      : { status: "invalid", reason: "region_unknown" };
  }

  if (found.size === 0) {
    if (leadingPlus && digits.length > 15) return { status: "invalid", reason: "too_long" };
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
      return "Telefone incompleto: informe o código de área e o número completo.";
    case "region_unknown":
      return "Informe o código do país (ex.: +55) ou escolha o país.";
    case "ambiguous":
      return "Não foi possível saber o país/DDD deste número. Informe com +código do país.";
    case "multiple":
      return "Informe um único telefone por campo.";
    case "placeholder":
      return "Telefone incompleto.";
    case "extension_only":
      return "Ramal sozinho não é telefone: informe o número e, se houver, o ramal.";
    case "repeated_country_code":
      return "O código do país aparece repetido. Confira o número.";
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
