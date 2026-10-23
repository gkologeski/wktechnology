import { normalizePhone, PLATFORM_DEFAULT_PHONE_COUNTRY } from "@/lib/phone/e164";

import { isEmailAddress } from "@/lib/email-address";

export function isEmail(v: string | null | undefined): boolean {
  return isEmailAddress(v);
}

/** Telefone com +DDI válido (metadados completos). Delegado a `@/lib/phone/e164`. */
export function isPhone(v: string | null | undefined): boolean {
  if (!v) return false;
  return normalizePhone(v, { defaultCountry: null }).status === "valid";
}

/**
 * Normaliza para E.164 ("+5511999998888") ou null. Delegado a
 * `@/lib/phone/e164` (fonte única). O país só é usado para números sem "+";
 * passe o país do workspace quando souber.
 */
export function toE164(
  v: string | null | undefined,
  defaultCountry: string = PLATFORM_DEFAULT_PHONE_COUNTRY,
): string | null {
  const r = normalizePhone(v, { defaultCountry });
  return r.status === "valid" ? r.e164 : null;
}

/** Strip everything but digits (used for CNPJ persistence). */
export function stripCNPJ(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** Format 14 digits as "12.345.678/0001-90". Returns raw input if length differs. */
export function formatCNPJ(v: string | null | undefined): string {
  const d = stripCNPJ(v);
  if (d.length !== 14) return String(v ?? "");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Validate CNPJ using official mod-11 check digits. */
export function isCNPJ(v: string | null | undefined): boolean {
  const d = stripCNPJ(v);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false; // all same digits
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, n, i) => acc + Number(n) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calc(d.slice(0, 12), w1);
  const dv2 = calc(d.slice(0, 12) + String(dv1), w2);
  return dv1 === Number(d[12]) && dv2 === Number(d[13]);
}
