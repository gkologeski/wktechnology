/** Mailbox de cadastro: RFC 5321/6531 + domínio IDNA (UTS #46).
 * Validade sintática não comprova existência nem capacidade de entrega.
 * Não remove espaços internos, não translitera e não muda o case do usuário.
 */
import validatorEmail from "validator/lib/isEmail";
import { toASCII } from "tr46";

export type EmailResult =
  | { ok: true; value: string; requiresSmtpUtf8: boolean }
  | { ok: false; reason: "required" | "syntax" | "domain" | "length"; message: string };

const encoder = new TextEncoder();
const failure = (reason: "required" | "syntax" | "domain" | "length"): EmailResult => ({
  ok: false,
  reason,
  message: reason === "required" ? "E-mail obrigatório." : "Informe um e-mail válido.",
});

export function validateEmailAddress(raw: unknown): EmailResult {
  if (typeof raw !== "string") return failure(raw == null ? "required" : "syntax");
  // Mesmo CRLF nas bordas é proibido: não esconder tentativa de injeção com trim.
  if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(raw)) return failure("syntax");
  const email = raw.trim();
  if (!email) return failure("required");
  const at = email.lastIndexOf("@");
  if (at <= 0 || email.indexOf("@") !== at) return failure("syntax");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  // Cadastro usa addr-spec não quoted, sem display-name, comentários ou IP literal.
  if (/\s|[<>()[\]"\\,;:]/u.test(local) || !domain || domain.endsWith("."))
    return failure("syntax");
  let ascii: string | null;
  try {
    ascii = toASCII(domain, {
      checkHyphens: true,
      checkBidi: true,
      checkJoiners: true,
      useSTD3ASCIIRules: true,
      transitionalProcessing: false,
      verifyDNSLength: true,
    });
  } catch {
    return failure("domain");
  }
  if (!ascii || !ascii.includes(".") || ascii.endsWith(".")) return failure("domain");
  const value = `${local}@${ascii.toLowerCase()}`;
  if (encoder.encode(local).length > 64 || encoder.encode(value).length > 254)
    return failure("length");
  if (
    !validatorEmail(value, {
      allow_utf8_local_part: true,
      allow_display_name: false,
      require_tld: true,
      allow_ip_domain: false,
      allow_underscores: false,
      ignore_max_length: false,
      domain_specific_validation: false,
    })
  )
    return failure("syntax");
  return {
    ok: true,
    value,
    requiresSmtpUtf8: Array.from(local).some((char) => char.codePointAt(0)! > 0x7f),
  };
}

export function isEmailAddress(raw: unknown): boolean {
  return validateEmailAddress(raw).ok;
}

/** Retorna null somente para campo vazio. Dado inválido não é descartado. */
export function normalizeEmailAddress(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const r = validateEmailAddress(raw);
  if (!r.ok) throw new Error(r.message);
  return r.value;
}

/** Listas da UI usam vírgula, ponto-e-vírgula ou quebra de linha, sem display-name.
 * Cada item é validado inteiro; nunca extrair um pedaço que pareça endereço.
 */
export function parseEmailList(raw: string | readonly string[]): string[] {
  const parts = typeof raw === "string" ? (raw.trim() ? raw.split(/[,;\n]/) : []) : raw;
  if (parts.length > 50) throw new Error("Informe no máximo 50 destinatários.");
  return parts.map((part) => {
    const r = validateEmailAddress(part);
    if (!r.ok) throw new Error("A lista contém um e-mail inválido.");
    return r.value;
  });
}

/** Nome de coluna, não texto de conteúdo nem configurações de campanha. */
export function isEmailColumn(name: string): boolean {
  return (
    name === "email" ||
    /^(?:personal|work|contact|candidate|referrer|client|visitor|signer|support|admin|subject|emergency_contact|linkedin_notification|attendee|invitee|recipient|from|to)_email$/.test(
      name,
    )
  );
}

/** Usada apenas em payloads que escrevem campos, preservando PATCH ausente. */
export function normalizeEmailFields<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const key of Object.keys(out)) {
    if (isEmailColumn(key) && out[key] !== undefined) {
      (out as Record<string, unknown>)[key] = normalizeEmailAddress(out[key]);
    }
  }
  return out;
}
