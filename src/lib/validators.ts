import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";

// Canonical email validation regex (HTML5-style, case-insensitive).
const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
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
    const parsed = parsePhoneNumberFromString(raw, raw.startsWith("+") ? undefined : defaultCountry);
    if (parsed && parsed.isValid()) return parsed.number; // E.164
  } catch {
    // fall through
  }
  return null;
}
