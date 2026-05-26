/**
 * Cron / scheduled-job authentication.
 *
 * All /api/public/hooks/*-tick endpoints are triggered by pg_cron or an
 * external scheduler. They must NOT be invokable by arbitrary internet
 * actors (would let attackers trigger emails, WhatsApp sends, AI credit
 * consumption, etc.).
 *
 * Callers must send: Authorization: Bearer <CRON_SECRET>
 * CRON_SECRET is a server-only env var (never bundled into the client).
 */

export function requireCronAuth(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron-auth] CRON_SECRET is not configured");
    return new Response("Server misconfigured", { status: 500 });
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  // Constant-time-ish comparison
  if (token.length !== expected.length || token !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
