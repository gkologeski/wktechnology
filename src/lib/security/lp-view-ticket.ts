import { createHmac, timingSafeEqual } from "crypto";

/** Bilhete de visita emitido pelo servidor: conversão só conta com visita real e permanência mínima. */
export const LP_TICKET_MIN_AGE_MS = 3_000;
export const LP_TICKET_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function mac(secret: string, pageId: string, visitorId: string, issuedAt: number): string {
  return createHmac("sha256", secret)
    .update(`lp-view:${pageId}:${visitorId}:${issuedAt}`)
    .digest("base64url");
}

export function issueLpViewTicket(
  secret: string,
  pageId: string,
  visitorId: string,
  now: number = Date.now(),
): string {
  return `${now}.${mac(secret, pageId, visitorId, now)}`;
}

export function verifyLpViewTicket(
  secret: string,
  ticket: string,
  pageId: string,
  visitorId: string,
  now: number = Date.now(),
): boolean {
  const m = /^(\d{10,16})\.([A-Za-z0-9_-]{20,100})$/.exec(ticket);
  if (!m) return false;
  const issuedAt = Number(m[1]);
  const age = now - issuedAt;
  if (!Number.isFinite(age) || age < LP_TICKET_MIN_AGE_MS || age > LP_TICKET_MAX_AGE_MS)
    return false;
  const expected = Buffer.from(mac(secret, pageId, visitorId, issuedAt));
  const given = Buffer.from(m[2] ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function lpTicketSecret(): string {
  const s = process.env["LP_TRACKING_SECRET"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!s) throw new Error("Rastreamento de landing page não configurado");
  return s;
}

/** Decisão de conversão no servidor: sem bilhete válido, a conversão é descartada. */
export function acceptLpConversion(
  ticket: string | undefined,
  pageId: string,
  visitorId: string,
): boolean {
  return verifyLpViewTicket(lpTicketSecret(), ticket ?? "", pageId, visitorId);
}
