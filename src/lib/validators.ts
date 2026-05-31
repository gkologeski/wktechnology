import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";

// Lightweight RFC-5322-ish email regex, good enough for UI feedback.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(v: string | null | undefined): boolean {
  if (!v) return false;
  return EMAIL_RE.test(v.trim());
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
