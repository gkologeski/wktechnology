import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";

// Canonical email validation regex (HTML5-style, case-insensitive).
const EMAIL_RE =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
// TLD must have at least 2 letters (rejects ".b", ".1", etc.).
const TLD_MIN_RE = /\.[a-z]{2,}$/i;

export function isEmail(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim();
  return EMAIL_RE.test(s) && TLD_MIN_RE.test(s);
}

/** Accepts E.164 format (e.g. +5511999998888). */
export function isPhone(v: string | null | undefined): boolean {
  if (!v) return false;
  try {
    return isValidPhoneNumber(v);
  } catch {
    return false;
  }
}

/**
 * Normalize a phone string to E.164 (e.g. "+5511999998888").
 * Returns null if the value cannot be parsed into a valid number.
 * Assumes Brazil ("BR") as default country when no "+" prefix is present.
 */
export function toE164(v: string | null | undefined, defaultCountry: "BR" = "BR"): string | null {
  if (!v) return null;
  const raw = String(v).trim();
  if (!raw) return null;
  try {
    const parsed = parsePhoneNumberFromString(
      raw,
      raw.startsWith("+") ? undefined : defaultCountry,
    );
    if (parsed && parsed.isValid()) return parsed.number; // E.164
  } catch {
    // fall through
  }
  return null;
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
