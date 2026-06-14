/**
 * Twilio webhook signature validation.
 *
 * Twilio signs every webhook request with HMAC-SHA1 using the account's
 * Auth Token. Without verification, anyone on the internet can POST forged
 * payloads (inject fake WhatsApp messages, falsify delivery status, trigger
 * outbound calls via TwiML, etc.).
 *
 * Algorithm: HMAC-SHA1( authToken, fullUrl + sortedFormParams )
 * Header:    X-Twilio-Signature
 *
 * Docs: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function buildBaseString(url: string, params: URLSearchParams): string {
  const entries = Array.from(params.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let out = url;
  for (const [k, v] of entries) out += k + v;
  return out;
}

function safeEqualB64(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verifies a Twilio webhook signature.
 *
 * @param request   The original Request (headers used: X-Twilio-Signature)
 * @param rawBody   The raw POST body (application/x-www-form-urlencoded text)
 * @returns         true if the signature is valid
 */
export function verifyTwilioSignature(request: Request, rawBody: string): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) {
    console.error("[twilio-sig] TWILIO_AUTH_TOKEN is not configured");
    return false;
  }
  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  // Twilio computes signature against the EXACT URL it called. When the app
  // is behind a proxy (Cloudflare), trust X-Forwarded-* headers to reconstruct.
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const fullUrl = `${proto}://${host}${url.pathname}${url.search}`;

  const params = new URLSearchParams(rawBody);
  const base = buildBaseString(fullUrl, params);
  const expected = createHmac("sha1", token).update(base, "utf8").digest("base64");

  if (safeEqualB64(signature, expected)) return true;

  // Fallback: some deployments serve under a different canonical host. Try the
  // raw request.url as well before rejecting.
  if (fullUrl !== request.url) {
    const base2 = buildBaseString(request.url, params);
    const expected2 = createHmac("sha1", token).update(base2, "utf8").digest("base64");
    if (safeEqualB64(signature, expected2)) return true;
  }

  return false;
}
