import { isValidPhoneNumber } from "libphonenumber-js";

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
