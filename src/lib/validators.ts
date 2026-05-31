import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";

// Lightweight RFC-5322-ish email regex, good enough for UI feedback.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Final label (TLD) must be 2-24 letters only — no digits, no hyphen, no extra dots after it.
const TLD_RE = /^[a-z]{2,24}$/i;

export function isEmail(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim();
  if (!EMAIL_RE.test(s)) return false;
  const [local, domain] = s.split("@");
  if (!local || !domain) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (labels.some((l) => l.length === 0)) return false;
  // Reject consecutive duplicate labels (e.g. "gmail.com.br.br").
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].toLowerCase() === labels[i - 1].toLowerCase()) return false;
  }
  // TLD must be alphabetic, 2-24 chars.
  if (!TLD_RE.test(labels[labels.length - 1])) return false;
  return true;
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
