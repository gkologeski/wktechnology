import { linkedinUrlOrNull } from "@/lib/prospecting/linkedin-url";
import { sourcePhone } from "@/lib/phone/phone-boundary";

export const MOBILE_CREDIT_LIMIT = 5_000;
// Standard People Enrichment: 1 demographics/email + 8 if mobile returned.
// https://docs.apollo.io/reference/people-enrichment
export const MOBILE_CREDIT_PER_REQUEST = 9;
export const MOBILE_ATTEMPT_LIMIT = Math.floor(MOBILE_CREDIT_LIMIT / MOBILE_CREDIT_PER_REQUEST);

const fold = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function staffFloor(size: string | null): number | null {
  const value = fold(size)
    .trim()
    .replace(/\s*(funcionarios|colaboradores|employees)$/, "")
    .trim();
  const number = "(?:[0-9]+|[0-9]{1,3}(?:[.,][0-9]{3})+)";
  const m = value.match(
    new RegExp(`^(?:>=\\s*)?(${number})(?:\\s*(?:-|–|—|a|to)\\s*(${number})|\\s*\\+)?$`),
  );
  if (!m) return null;
  const lo = Number(m[1].replace(/[.,]/g, ""));
  const hi = m[2] ? Number(m[2].replace(/[.,]/g, "")) : lo;
  return Number.isSafeInteger(lo) && Number.isSafeInteger(hi) && lo <= hi ? lo : null;
}

export function isITManager(title: string | null) {
  const t = fold(title);
  if (/\b(assistente|assistant|estagiario|intern|trainee|secretari[ao])\b/.test(t)) return false;
  if (/\b(cio|cto|chief (?:information|technology) officer)\b/.test(t)) return true;
  const leadership =
    /\b(gerent[ea]|diretor[ae]?|coordenador[ae]?|manager|director|head|vp|vice[ -]president[ea]?)\b/;
  const it =
    /\b(ti|it|tic|tecnologia(?: da informacao)?|information technology|infrastructure|infraestrutura|engenharia de software|software engineering|desenvolvimento de (?:software|sistemas)|systems engineering|seguranca da informacao|information security|cybersecurity)\b/;
  return leadership.test(t) && it.test(t);
}

function domain(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return null;
  }
}
export type Identity = { linkedin_url: string } | { email: string };
export function matchIdentity(
  contact: { linkedin_url: string | null; email: string | null },
  company: { domain: string | null; website: string | null },
): Identity | null {
  const linkedin = linkedinUrlOrNull(contact.linkedin_url);
  if (linkedin) return { linkedin_url: linkedin.toLowerCase() };
  const email = contact.email?.trim().toLowerCase();
  const host = domain(company.domain) ?? domain(company.website);
  if (email && host && /^[^\s@]+@[^\s@]+$/.test(email) && email.split("@")[1] === host)
    return { email };
  return null;
}

export function matchesApolloIdentity(
  identity: Identity,
  person: { linkedin_url?: string; email?: string },
) {
  return "linkedin_url" in identity
    ? linkedinUrlOrNull(person.linkedin_url)?.toLowerCase() === identity.linkedin_url
    : person.email?.trim().toLowerCase() === identity.email;
}

type ApolloPhone = {
  type?: string;
  sanitized_number?: string;
  raw_number?: string;
  dnc_status?: unknown;
};
export function confirmedMobile(numbers: ApolloPhone[] | undefined) {
  const valid = new Set(
    (numbers ?? [])
      .filter((n) => n.type?.toLowerCase() === "mobile")
      .map((n) => sourcePhone(n.sanitized_number ?? n.raw_number))
      .filter((n): n is string => !!n),
  );
  return valid.size === 1 ? [...valid][0] : null;
}
